"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaystackClient = void 0;
const crypto_1 = __importDefault(require("crypto"));
const env_js_1 = require("../../config/env.js");
class PaystackClient {
    static BASE_URL = (env_js_1.env.PAYSTACK_BASE_URL || process.env.PAYSTACK_BASE_URL || "https://api.paystack.co").replace(/\/$/, "");
    static sanitizeKey(k) {
        if (!k)
            return "";
        return k.trim().replace(/^["']|["']$/g, "").trim();
    }
    static getSecretKey(overrideKey) {
        const raw = overrideKey || env_js_1.env.PAYSTACK_SECRET_KEY || process.env.PAYSTACK_SECRET_KEY;
        const cleaned = this.sanitizeKey(raw);
        if (!cleaned) {
            throw new Error("PAYSTACK_SECRET_KEY is not configured in environment variables.");
        }
        return cleaned;
    }
    static getHeaders(overrideKey) {
        const secretKey = this.getSecretKey(overrideKey);
        return {
            Authorization: `Bearer ${secretKey}`,
            "Content-Type": "application/json",
            Accept: "application/json",
        };
    }
    /**
     * Initializes standard Paystack checkout transaction
     */
    static async initializePayment(req) {
        const reference = req.reference || `NGM-PAY-${Date.now()}-${crypto_1.default.randomBytes(4).toString("hex")}`;
        const payload = {
            email: req.email,
            amount: req.amountInKobo,
            reference,
            callback_url: req.callbackUrl,
            metadata: req.metadata,
            channels: req.channels || ["card", "bank", "ussd", "bank_transfer", "qr"],
        };
        const response = await fetch(`${this.BASE_URL}/transaction/initialize`, {
            method: "POST",
            headers: this.getHeaders(),
            body: JSON.stringify(payload),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.status) {
            console.error("Paystack Initialize Error:", data);
            const msg = response.status === 401 || data.message?.toLowerCase().includes("invalid key")
                ? `Paystack Authentication Failed: The secret key was rejected ("Invalid key"). Please verify PAYSTACK_SECRET_KEY in your environment variables.`
                : (data.message || "Failed to initialize Paystack payment transaction.");
            throw new Error(msg);
        }
        return {
            authorization_url: data.data.authorization_url,
            access_code: data.data.access_code,
            reference: data.data.reference,
        };
    }
    /**
     * Verifies transaction status on Paystack directly by reference
     */
    static async verifyTransaction(reference) {
        const response = await fetch(`${this.BASE_URL}/transaction/verify/${encodeURIComponent(reference)}`, {
            method: "GET",
            headers: this.getHeaders(),
        });
        const data = await response.json();
        if (!response.ok || !data.status) {
            throw new Error(data.message || "Failed to verify Paystack transaction.");
        }
        return data.data;
    }
    /**
     * Cryptographically verifies Paystack Webhook signature using HMAC SHA-512
     */
    static verifyWebhookSignature(signatureHeader, rawBody) {
        if (!signatureHeader)
            return false;
        const secret = env_js_1.env.PAYSTACK_WEBHOOK_SECRET ||
            env_js_1.env.PAYSTACK_SECRET_KEY ||
            process.env.PAYSTACK_WEBHOOK_SECRET ||
            process.env.PAYSTACK_SECRET_KEY ||
            "";
        if (!secret)
            return false;
        try {
            const hash = crypto_1.default
                .createHmac("sha512", secret)
                .update(rawBody)
                .digest("hex");
            return crypto_1.default.timingSafeEqual(Buffer.from(hash, "utf8"), Buffer.from(signatureHeader, "utf8"));
        }
        catch (err) {
            console.error("[PaystackClient] Error verifying webhook signature:", err);
            return false;
        }
    }
}
exports.PaystackClient = PaystackClient;
