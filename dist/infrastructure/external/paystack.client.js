"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaystackClient = void 0;
const crypto_1 = __importDefault(require("crypto"));
const env_js_1 = require("../../config/env.js");
class PaystackClient {
    static BASE_URL = env_js_1.env.PAYSTACK_BASE_URL.replace(/\/$/, "");
    static getHeaders() {
        return {
            Authorization: `Bearer ${env_js_1.env.PAYSTACK_SECRET_KEY}`,
            "Content-Type": "application/json",
            Accept: "application/json",
        };
    }
    /**
     * Initializes standard Paystack card/bank/USSD checkout transaction
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
        const data = await response.json();
        if (!response.ok || !data.status) {
            console.error("Paystack Initialize Error:", data);
            throw new Error(data.message || "Failed to initialize Paystack payment transaction.");
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
        const hash = crypto_1.default
            .createHmac("sha512", env_js_1.env.PAYSTACK_SECRET_KEY)
            .update(rawBody)
            .digest("hex");
        return crypto_1.default.timingSafeEqual(Buffer.from(hash, "utf8"), Buffer.from(signatureHeader, "utf8"));
    }
}
exports.PaystackClient = PaystackClient;
