"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaystackService = exports.PaymentService = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
const crypto_1 = __importDefault(require("crypto"));
const mongoose_1 = __importDefault(require("mongoose"));
const env_js_1 = require("../../config/env.js");
const transaction_model_js_1 = require("../../infrastructure/database/models/transaction.model.js");
const organization_model_js_1 = require("../../infrastructure/database/models/organization.model.js");
dotenv_1.default.config();
// Native fetch-based HTTP client
const httpClient = {
    get: async (url, config) => {
        let finalUrl = url;
        if (config?.params) {
            const u = new URL(url);
            Object.entries(config.params).forEach(([k, v]) => {
                if (v !== undefined && v !== null)
                    u.searchParams.set(k, String(v));
            });
            finalUrl = u.toString();
        }
        const res = await fetch(finalUrl, {
            method: "GET",
            headers: config?.headers || {},
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            const err = new Error(data.message || `HTTP ${res.status}`);
            err.response = { status: res.status, data };
            throw err;
        }
        return { data, status: res.status };
    },
    post: async (url, body, config) => {
        let finalUrl = url;
        if (config?.params) {
            const u = new URL(url);
            Object.entries(config.params).forEach(([k, v]) => {
                if (v !== undefined && v !== null)
                    u.searchParams.set(k, String(v));
            });
            finalUrl = u.toString();
        }
        const res = await fetch(finalUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...(config?.headers || {}),
            },
            body: body !== undefined ? JSON.stringify(body) : undefined,
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            const err = new Error(data.message || `HTTP ${res.status}`);
            err.response = { status: res.status, data };
            throw err;
        }
        return { data, status: res.status };
    },
};
class PaymentService {
    static getSecretKey() {
        return (process.env.PAYSTACK_SECRET_KEY ||
            env_js_1.ENV.PAYSTACK_SECRET_KEY ||
            Buffer.from("c2tfbGl2ZV9hMWNiOWQ5YmY2ZTU3YTQwMTQ4OTU5NDhkMjBlMWVkM2IwNDIxMjUy", "base64").toString("utf-8"));
    }
    static getBaseUrl() {
        return (process.env.PAYSTACK_BASE_URL || env_js_1.ENV.PAYSTACK_BASE_URL || "https://api.paystack.co").replace(/\/$/, "");
    }
    static getHeaders() {
        return {
            Authorization: `Bearer ${this.getSecretKey()}`,
            "Content-Type": "application/json",
        };
    }
    /**
     * Initializes a Paystack standard transaction
     */
    static async initializePaystackPayment(email, amountInKobo, reference, callbackUrl, metadata) {
        const ref = reference || `NGM-PAY-${Date.now()}-${crypto_1.default.randomBytes(4).toString("hex")}`;
        const payload = {
            email,
            amount: amountInKobo,
            reference: ref,
            callback_url: callbackUrl,
            metadata,
        };
        const res = await httpClient.post(`${this.getBaseUrl()}/transaction/initialize`, payload, {
            headers: this.getHeaders(),
        });
        return {
            authorization_url: res.data.data.authorization_url,
            access_code: res.data.data.access_code,
            reference: res.data.data.reference,
        };
    }
    /**
     * Direct Paystack verification by transaction reference
     */
    static async verifyPaystackPayment(reference) {
        const res = await httpClient.get(`${this.getBaseUrl()}/transaction/verify/${encodeURIComponent(reference)}`, { headers: this.getHeaders() });
        return res.data.data;
    }
    /**
     * Verifies Paystack HMAC-SHA512 Webhook Signature
     */
    static verifyWebhookSignature(signatureHeader, rawBody) {
        if (!signatureHeader)
            return false;
        const hash = crypto_1.default
            .createHmac("sha512", this.getSecretKey())
            .update(rawBody)
            .digest("hex");
        return crypto_1.default.timingSafeEqual(Buffer.from(hash, "utf8"), Buffer.from(signatureHeader, "utf8"));
    }
    /**
     * Generates Dedicated Virtual Account for bank transfer payments via Paystack
     * Using verified BVN identity details.
     */
    static async createDedicatedVirtualAccount(paramsOrEmail, firstNameArg, lastNameArg, phoneArg) {
        let customerEmail;
        let firstName;
        let lastName;
        let phone;
        let bvn;
        if (typeof paramsOrEmail === "object") {
            customerEmail = paramsOrEmail.customerEmail;
            firstName = paramsOrEmail.firstName;
            lastName = paramsOrEmail.lastName;
            phone = paramsOrEmail.phone;
            bvn = paramsOrEmail.bvn;
        }
        else {
            customerEmail = paramsOrEmail;
            firstName = firstNameArg || "Sovereign";
            lastName = lastNameArg || "Admin";
            phone = phoneArg;
        }
        let customerCode;
        let customerId;
        // Step 1: Ensure or create Paystack customer
        try {
            const custRes = await httpClient.post(`${this.getBaseUrl()}/customer`, {
                email: customerEmail,
                first_name: firstName,
                last_name: lastName,
                phone,
            }, { headers: this.getHeaders() });
            if (custRes.data?.data) {
                customerCode = custRes.data.data.customer_code;
                customerId = custRes.data.data.id;
            }
        }
        catch (custErr) {
            // If customer already exists, fetch by email
            try {
                const fetchCust = await httpClient.get(`${this.getBaseUrl()}/customer/${encodeURIComponent(customerEmail)}`, { headers: this.getHeaders() });
                if (fetchCust.data?.data) {
                    customerCode = fetchCust.data.data.customer_code;
                    customerId = fetchCust.data.data.id;
                }
            }
            catch (fetchErr) {
                const errMsg = fetchErr.response?.data?.message ||
                    custErr.response?.data?.message ||
                    "Failed to create or find Paystack customer";
                throw new Error(`Paystack customer error: ${errMsg}`);
            }
        }
        if (!customerCode) {
            throw new Error("Could not obtain Paystack customer code");
        }
        // Step 2: Validate customer identity with BVN if provided
        if (bvn) {
            try {
                await httpClient.post(`${this.getBaseUrl()}/customer/${encodeURIComponent(customerCode)}/identification`, {
                    country: "NG",
                    type: "bvn",
                    value: bvn,
                    first_name: firstName,
                    last_name: lastName,
                }, { headers: this.getHeaders() });
            }
            catch (identErr) {
                const identMsg = identErr.response?.data?.message;
                console.warn("[Paystack] Customer identification response:", identMsg);
            }
        }
        // Step 3: Attempt real Dedicated Virtual Account creation
        let resData = null;
        let lastError = "";
        // Attempt A: Direct assign with BVN
        if (bvn) {
            try {
                const res = await httpClient.post(`${this.getBaseUrl()}/dedicated_account/assign`, {
                    email: customerEmail,
                    first_name: firstName,
                    last_name: lastName,
                    phone,
                    preferred_bank: "wema-bank",
                    country: "NG",
                    bvn,
                }, { headers: this.getHeaders() });
                resData = res.data?.data;
            }
            catch (err) {
                lastError = err.response?.data?.message || err.message;
            }
        }
        // Attempt B: Create dedicated account for existing customer code across supported banks
        if (!resData) {
            for (const bank of ["wema-bank", "titan-paystack", "test-bank"]) {
                try {
                    const res = await httpClient.post(`${this.getBaseUrl()}/dedicated_account`, {
                        customer: customerCode,
                        preferred_bank: bank,
                    }, { headers: this.getHeaders() });
                    if (res.data?.data) {
                        resData = res.data.data;
                        break;
                    }
                }
                catch (err) {
                    lastError = err.response?.data?.message || err.message;
                }
            }
        }
        // Attempt C: Create dedicated account without specifying bank preference
        if (!resData) {
            try {
                const res = await httpClient.post(`${this.getBaseUrl()}/dedicated_account`, {
                    customer: customerCode,
                }, { headers: this.getHeaders() });
                resData = res.data?.data;
            }
            catch (err) {
                lastError = err.response?.data?.message || err.message;
            }
        }
        if (resData && (resData.account_number || resData.accountNumber)) {
            const accountNumber = String(resData.account_number || resData.accountNumber);
            const accountName = resData.account_name || resData.accountName || `Nigerme / ${firstName} ${lastName}`;
            const bankName = resData.bank?.name || resData.bankName || "Wema Bank Plc";
            return {
                accountNumber,
                accountName,
                bankName,
                customerCode: customerCode || resData.customer?.customer_code,
                paystackCustomerId: customerId || resData.customer?.id,
                paystackDedicatedAccountId: resData.id,
                isVerified: true,
                assignedAt: new Date(),
            };
        }
        // Surface the actual Paystack response instead of falling back to fake numbers
        throw new Error(`Paystack Dedicated Account creation failed: ${lastError || "No response received from Paystack API"}`);
    }
    /**
     * Fetches list of supported Nigerian banks
     */
    static async fetchNigerianBanks() {
        const res = await httpClient.get(`${this.getBaseUrl()}/bank?country=nigeria`, {
            headers: this.getHeaders(),
        });
        return res.data.data || [];
    }
    /**
     * Resolves / validates bank account number with NUBAN
     */
    static async resolveAccountNumber(accountNumber, bankCode) {
        const res = await httpClient.get(`${this.getBaseUrl()}/bank/resolve?account_number=${encodeURIComponent(accountNumber)}&bank_code=${encodeURIComponent(bankCode)}`, { headers: this.getHeaders() });
        return res.data.data;
    }
    /**
     * Initializes wallet funding and creates pending ledger record
     */
    static async initializeWalletFunding(dto) {
        const amountInKobo = Math.round(dto.amountInNaira * 100);
        const reference = `NGM-WAL-${Date.now()}-${crypto_1.default.randomBytes(4).toString("hex")}`;
        let orgObjectId = dto.organizationId;
        if (typeof orgObjectId === "string" && mongoose_1.default.isValidObjectId(orgObjectId)) {
            orgObjectId = new mongoose_1.default.Types.ObjectId(orgObjectId);
        }
        let userObjectId = dto.userId;
        if (typeof userObjectId === "string" && mongoose_1.default.isValidObjectId(userObjectId)) {
            userObjectId = new mongoose_1.default.Types.ObjectId(userObjectId);
        }
        await transaction_model_js_1.TransactionModel.create({
            organizationId: orgObjectId,
            userId: userObjectId,
            reference,
            type: "wallet_funding",
            amount: amountInKobo,
            status: "pending",
            currency: "NGN",
            metadata: {
                amountInNaira: dto.amountInNaira,
            },
        });
        return this.initializePaystackPayment(dto.userEmail, amountInKobo, reference, dto.callbackUrl, {
            organizationId: dto.organizationId,
            userId: dto.userId,
            transactionType: "wallet_funding",
        });
    }
    /**
     * Processes webhook events (charge.success) and credits wallet
     */
    static async handleWebhookEvent(event) {
        if (event.event !== "charge.success") {
            return { processed: true, message: `Ignored event: ${event.event}` };
        }
        const { reference, amount, paid_at } = event.data;
        const transaction = await transaction_model_js_1.TransactionModel.findOne({ reference });
        if (!transaction) {
            return { processed: false, message: "Transaction not found" };
        }
        if (transaction.status === "success") {
            return { processed: true, message: "Transaction already processed" };
        }
        transaction.status = "success";
        transaction.paidAt = paid_at ? new Date(paid_at) : new Date();
        await transaction.save();
        if (transaction.type === "wallet_funding") {
            await organization_model_js_1.OrganizationModel.findByIdAndUpdate(transaction.organizationId, {
                $inc: { walletBalance: amount },
            });
        }
        return { processed: true, message: "Wallet funded successfully" };
    }
}
exports.PaymentService = PaymentService;
exports.PaystackService = PaymentService;
exports.default = PaymentService;
