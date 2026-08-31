"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TermiiClient = void 0;
const env_js_1 = require("../../config/env.js");
class TermiiClient {
    static BASE_URL = env_js_1.env.TERMII_BASE_URL.replace(/\/$/, "");
    /**
     * Formats Nigerian phone numbers to international standard 234...
     */
    static formatNigerianPhone(phone) {
        const cleaned = phone.replace(/[^0-9]/g, "");
        if (cleaned.startsWith("0") && cleaned.length === 11) {
            return `234${cleaned.slice(1)}`;
        }
        if (cleaned.startsWith("234") && cleaned.length === 13) {
            return cleaned;
        }
        if (cleaned.startsWith("+234")) {
            return cleaned.slice(1);
        }
        return cleaned;
    }
    /**
     * Sends a transactional SMS or OTP via Termii API
     */
    static async sendSms(to, message) {
        const formattedPhone = this.formatNigerianPhone(to);
        const payload = {
            to: formattedPhone,
            from: env_js_1.env.TERMII_SENDER_ID,
            sms: message,
            type: "plain",
            channel: "generic",
            api_key: env_js_1.env.TERMII_API_LIVE,
        };
        try {
            const response = await fetch(`${this.BASE_URL}/sms/send`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Accept: "application/json",
                },
                body: JSON.stringify(payload),
            });
            const data = (await response.json());
            if (!response.ok) {
                console.error("Termii SMS API Error Response:", data);
                throw new Error(data.message || `Termii SMS sending failed with HTTP ${response.status}`);
            }
            return data;
        }
        catch (error) {
            console.error("Termii Client Network/Dispatch Exception:", error);
            throw new Error(error.message || "Failed to dispatch SMS through Termii.");
        }
    }
    /**
     * Dispatches a secure 6-digit OTP SMS
     */
    static async sendOtp(to, otpCode) {
        const message = `Your Nigerme verification code is ${otpCode}. Valid for 5 minutes. Do not disclose this code to anyone.`;
        return this.sendSms(to, message);
    }
}
exports.TermiiClient = TermiiClient;
