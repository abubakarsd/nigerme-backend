"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaystackService = exports.PaymentService = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
const crypto_1 = __importDefault(require("crypto"));
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
        return env_js_1.ENV.PAYSTACK_SECRET_KEY || "";
    }
    static getBaseUrl() {
        return (env_js_1.ENV.PAYSTACK_BASE_URL || "https://api.paystack.co").replace(/\/$/, "");
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
     * Generates Dedicated Virtual Account for bank transfer payments
     */
    static async createDedicatedVirtualAccount(customerEmail, firstName, lastName, phone) {
        const payload = {
            email: customerEmail,
            first_name: firstName,
            last_name: lastName,
            phone,
        };
        const res = await httpClient.post(`${this.getBaseUrl()}/dedicated_account`, payload, {
            headers: this.getHeaders(),
        });
        return res.data.data;
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
        await transaction_model_js_1.TransactionModel.create({
            organizationId: dto.organizationId,
            userId: dto.userId,
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
