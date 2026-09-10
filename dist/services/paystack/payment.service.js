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
    static sanitizeKey(k) {
        if (!k)
            return "";
        return k.trim().replace(/^["']|["']$/g, "").trim();
    }
    static getSecretKey() {
        const raw = process.env.PAYSTACK_SECRET_KEY || env_js_1.ENV.PAYSTACK_SECRET_KEY;
        const cleaned = this.sanitizeKey(raw);
        if (!cleaned) {
            throw new Error("PAYSTACK_SECRET_KEY is not configured in environment variables.");
        }
        return cleaned;
    }
    static getPublicKey() {
        const raw = process.env.PAYSTACK_PUBLIC_KEY || env_js_1.ENV.PAYSTACK_PUBLIC_KEY;
        return this.sanitizeKey(raw);
    }
    static getWebhookSecret() {
        const raw = process.env.PAYSTACK_WEBHOOK_SECRET ||
            process.env.PAYSTACK_SECRET_KEY ||
            env_js_1.ENV.PAYSTACK_WEBHOOK_SECRET ||
            env_js_1.ENV.PAYSTACK_SECRET_KEY;
        const cleaned = this.sanitizeKey(raw);
        if (!cleaned) {
            throw new Error("PAYSTACK_WEBHOOK_SECRET is not configured in environment variables.");
        }
        return cleaned;
    }
    static getBaseUrl() {
        return (process.env.PAYSTACK_BASE_URL || env_js_1.ENV.PAYSTACK_BASE_URL || "https://api.paystack.co").replace(/\/$/, "");
    }
    static getHeaders(overrideKey) {
        const key = overrideKey ? this.sanitizeKey(overrideKey) : this.getSecretKey();
        return {
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/json",
            Accept: "application/json",
        };
    }
    /**
     * Centralized HTTP caller for all Paystack API operations.
     * Uses strictly the configured secret key from environment variables.
     */
    static async paystackRequest(method, endpoint, body, params) {
        const baseUrl = this.getBaseUrl();
        const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
        const url = endpoint.startsWith("http") ? endpoint : `${baseUrl}${cleanEndpoint}`;
        const secretKey = this.getSecretKey();
        try {
            if (method === "get") {
                return await httpClient.get(url, { headers: this.getHeaders(secretKey), params });
            }
            else {
                return await httpClient.post(url, body, { headers: this.getHeaders(secretKey), params });
            }
        }
        catch (err) {
            const apiMessage = err.response?.data?.message || err.message || "Paystack API request failed";
            console.error(`[Paystack] Request to ${cleanEndpoint} failed (${err.response?.status || "network"}):`, apiMessage);
            throw err;
        }
    }
    /**
     * Initializes a Paystack standard transaction with fallback key retry
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
        try {
            const res = await this.paystackRequest("post", "/transaction/initialize", payload);
            return {
                authorization_url: res.data.data.authorization_url,
                access_code: res.data.data.access_code,
                reference: res.data.data.reference,
            };
        }
        catch (err) {
            const isAuthError = err.response?.status === 401 ||
                err.message?.toLowerCase().includes("invalid key");
            const helpfulDetail = isAuthError
                ? `Paystack Authentication Failed: The API key provided was rejected as "Invalid key". Please verify that PAYSTACK_SECRET_KEY is configured in your Render dashboard (Settings -> Environment) with an active Secret Key from https://dashboard.paystack.com/#/settings/developers (e.g. sk_test_... or sk_live_...).`
                : (err.message || "Failed to initialize Paystack payment transaction.");
            throw new Error(helpfulDetail);
        }
    }
    /**
     * Direct Paystack verification by transaction reference
     */
    static async verifyPaystackPayment(reference) {
        const res = await this.paystackRequest("get", `/transaction/verify/${encodeURIComponent(reference)}`);
        return res.data.data;
    }
    /**
     * Verifies Paystack HMAC-SHA512 Webhook Signature
     */
    static verifyWebhookSignature(signatureHeader, rawBody) {
        if (!signatureHeader)
            return false;
        try {
            const webhookSecret = this.getWebhookSecret();
            const hash = crypto_1.default
                .createHmac("sha512", webhookSecret)
                .update(rawBody)
                .digest("hex");
            return crypto_1.default.timingSafeEqual(Buffer.from(hash, "utf8"), Buffer.from(signatureHeader, "utf8"));
        }
        catch (err) {
            console.error("[Paystack] Webhook verification error:", err);
            return false;
        }
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
            const custRes = await this.paystackRequest("post", "/customer", {
                email: customerEmail,
                first_name: firstName,
                last_name: lastName,
                phone,
            });
            if (custRes.data?.data) {
                customerCode = custRes.data.data.customer_code;
                customerId = custRes.data.data.id;
            }
        }
        catch (custErr) {
            // If customer already exists, fetch by email
            try {
                const fetchCust = await this.paystackRequest("get", `/customer/${encodeURIComponent(customerEmail)}`);
                if (fetchCust.data?.data) {
                    customerCode = fetchCust.data.data.customer_code;
                    customerId = fetchCust.data.data.id;
                }
            }
            catch (fetchErr) {
                console.warn("[Paystack] Customer check notice:", fetchErr?.message || custErr?.message);
            }
        }
        // Step 2: Validate customer identity with BVN if provided
        if (bvn && customerCode) {
            try {
                await this.paystackRequest("post", `/customer/${encodeURIComponent(customerCode)}/identification`, {
                    country: "NG",
                    type: "bvn",
                    value: bvn,
                    first_name: firstName,
                    last_name: lastName,
                });
            }
            catch (identErr) {
                const identMsg = identErr.response?.data?.message || identErr.message;
                console.warn("[Paystack] Customer identification response note:", identMsg);
            }
        }
        // Step 3: Attempt real Dedicated Virtual Account creation across supported channels
        let resData = null;
        let lastError = "";
        // Attempt A: Direct assign with BVN
        if (bvn) {
            try {
                const res = await this.paystackRequest("post", "/dedicated_account/assign", {
                    email: customerEmail,
                    first_name: firstName,
                    last_name: lastName,
                    phone,
                    preferred_bank: "wema-bank",
                    country: "NG",
                    bvn,
                });
                resData = res.data?.data;
            }
            catch (err) {
                lastError = err.response?.data?.message || err.message;
            }
        }
        // Attempt B: Create dedicated account for existing customer code across supported banks
        if (!resData && customerCode) {
            for (const bank of ["wema-bank", "titan-paystack", "test-bank"]) {
                try {
                    const res = await this.paystackRequest("post", "/dedicated_account", {
                        customer: customerCode,
                        preferred_bank: bank,
                    });
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
        if (!resData && customerCode) {
            try {
                const res = await this.paystackRequest("post", "/dedicated_account", {
                    customer: customerCode,
                });
                resData = res.data?.data;
            }
            catch (err) {
                lastError = err.response?.data?.message || err.message;
            }
        }
        if (resData && (resData.account_number || resData.accountNumber)) {
            const accountNumber = String(resData.account_number || resData.accountNumber);
            const accountName = resData.account_name || resData.accountName || `busmailer / ${firstName} ${lastName}`;
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
        console.error(`[Paystack] Failed to provision dedicated virtual account for ${customerEmail}:`, lastError || "No account returned from Paystack");
        throw new Error(lastError ||
            "Paystack dedicated virtual account creation could not be completed. Please ensure Dedicated NUBAN / Virtual Accounts are enabled on your Paystack merchant dashboard.");
    }
    /**
     * Fetches list of supported Nigerian banks
     */
    static async fetchNigerianBanks() {
        try {
            const res = await this.paystackRequest("get", "/bank", undefined, { country: "nigeria" });
            return res.data?.data || [];
        }
        catch {
            return [];
        }
    }
    /**
     * Resolves / validates bank account number with NUBAN
     */
    static async resolveAccountNumber(accountNumber, bankCode) {
        const res = await this.paystackRequest("get", `/bank/resolve?account_number=${encodeURIComponent(accountNumber)}&bank_code=${encodeURIComponent(bankCode)}`);
        return res.data?.data;
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
