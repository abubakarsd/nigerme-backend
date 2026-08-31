"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TermiiOtpService = exports.SMSService = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
const crypto_1 = __importDefault(require("crypto"));
const env_js_1 = require("../../config/env.js");
const otp_model_js_1 = require("../../infrastructure/database/models/otp.model.js");
dotenv_1.default.config();
class SMSService {
    static getApiKey() {
        return env_js_1.ENV.TERMII_API_LIVE || env_js_1.ENV.TERMII_SECRET_KEY || process.env.TERMII_API_KEY || "";
    }
    static getBaseUrl() {
        let base = (env_js_1.ENV.TERMII_BASE_URL || "https://api.ng.termii.com/api").trim().replace(/\/$/, "");
        if (!base.endsWith("/api")) {
            base = `${base}/api`;
        }
        return base;
    }
    static getSenderId() {
        return env_js_1.ENV.TERMII_SENDER_ID || "NIGERME";
    }
    /**
     * Core Termii SMS sender with multi-sender candidate and channel fallback
     */
    static async sendSMS(phoneNumber, messageText, channel = "dnd") {
        let cleanPhone = (phoneNumber || "").replace(/[^0-9]/g, "");
        if (cleanPhone.startsWith("0")) {
            cleanPhone = "234" + cleanPhone.slice(1);
        }
        const endpointUrl = `${this.getBaseUrl()}/sms/send`;
        const senderCandidates = Array.from(new Set([this.getSenderId(), "N-Alert", "Termii"])).filter(Boolean);
        for (const sender of senderCandidates) {
            for (const ch of [channel, "generic"]) {
                try {
                    const payload = {
                        api_key: this.getApiKey(),
                        to: cleanPhone,
                        from: sender,
                        sms: messageText,
                        type: "plain",
                        channel: ch,
                    };
                    console.log(`[SMSService] Sending Termii SMS (${ch} channel via ${sender}) to ${cleanPhone}...`);
                    const res = await fetch(endpointUrl, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(payload),
                    });
                    const data = await res.json().catch(() => ({}));
                    if (data && (data.message === "Successfully Sent" || data.code === "ok" || data.message_id)) {
                        console.log(`[SMSService] Termii SMS sent successfully (${sender}/${ch})`);
                        return true;
                    }
                }
                catch (error) {
                    const errMsg = error.message || "";
                    if (errMsg.includes("SENDER_ID_NOT_APPROVED")) {
                        console.warn(`[SMSService] Sender ID '${sender}' is pending approval on Termii. Falling back...`);
                        break;
                    }
                    else {
                        console.warn(`[SMSService] Termii dispatch attempt (${sender}/${ch}) failed:`, errMsg);
                    }
                }
            }
        }
        console.error(`[SMSService] All Termii SMS dispatch attempts failed for ${cleanPhone}`);
        return false;
    }
    /**
     * Registration Verification OTP (FREE)
     */
    static async sendRegistrationOTP(phoneNumber, code) {
        const msg = `Your Nigerme verification code is: ${code}. Valid for 10 minutes. Do not share this code with anyone.`;
        return this.sendSMS(phoneNumber, msg, "dnd");
    }
    /**
     * Login 2FA Verification OTP (FREE)
     */
    static async sendLogin2FAOTP(phoneNumber, code) {
        const msg = `Your Nigerme login verification OTP is: ${code}. Valid for 5 minutes. If you did not request this, please secure your account immediately.`;
        return this.sendSMS(phoneNumber, msg, "dnd");
    }
    /**
     * Password Reset OTP (FREE)
     */
    static async sendPasswordResetOTP(phoneNumber, code) {
        const msg = `Use ${code} to reset your Nigerme account password. Code is valid for 10 minutes.`;
        return this.sendSMS(phoneNumber, msg, "dnd");
    }
    /**
     * Unified sendOTP method with purpose support
     */
    static async sendOTP(phoneNumber, otp, purpose) {
        if (purpose === "login2FA" || purpose === "login_2fa") {
            return this.sendLogin2FAOTP(phoneNumber, otp);
        }
        if (purpose === "forgotPassword" || purpose === "password_reset") {
            return this.sendPasswordResetOTP(phoneNumber, otp);
        }
        return this.sendRegistrationOTP(phoneNumber, otp);
    }
    /**
     * Generates and dispatches a secure 6-digit SMS OTP, storing hash with TTL in database
     */
    static async sendPhoneOtp(phone, purpose = "login_2fa") {
        let cleanPhone = (phone || "").replace(/[^0-9]/g, "");
        if (cleanPhone.startsWith("0")) {
            cleanPhone = "234" + cleanPhone.slice(1);
        }
        const rawOtp = crypto_1.default.randomInt(100000, 999999).toString();
        const otpHash = crypto_1.default.createHash("sha256").update(rawOtp).digest("hex");
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
        await otp_model_js_1.OtpModel.deleteMany({ identifier: cleanPhone, purpose });
        await otp_model_js_1.OtpModel.create({
            identifier: cleanPhone,
            otpHash,
            purpose,
            expiresAt,
            attempts: 0,
        });
        await this.sendOTP(cleanPhone, rawOtp, purpose);
        return {
            message: "Verification code sent successfully to your phone number.",
            expiresInMinutes: 5,
        };
    }
    /**
     * Verifies OTP against stored hash
     */
    static async verifyPhoneOtp(phone, otpCode, purpose = "login_2fa") {
        let cleanPhone = (phone || "").replace(/[^0-9]/g, "");
        if (cleanPhone.startsWith("0")) {
            cleanPhone = "234" + cleanPhone.slice(1);
        }
        const candidateHash = crypto_1.default.createHash("sha256").update(otpCode.trim()).digest("hex");
        const otpRecord = await otp_model_js_1.OtpModel.findOne({
            identifier: cleanPhone,
            purpose,
            expiresAt: { $gt: new Date() },
        });
        if (!otpRecord) {
            throw new Error("Invalid or expired verification code.");
        }
        if (otpRecord.attempts >= 5) {
            await otp_model_js_1.OtpModel.deleteOne({ _id: otpRecord._id });
            throw new Error("Too many failed attempts. Please request a new verification code.");
        }
        if (otpRecord.otpHash !== candidateHash) {
            otpRecord.attempts += 1;
            await otpRecord.save();
            throw new Error(`Incorrect verification code. ${5 - otpRecord.attempts} attempts remaining.`);
        }
        await otp_model_js_1.OtpModel.deleteOne({ _id: otpRecord._id });
        return true;
    }
}
exports.SMSService = SMSService;
exports.TermiiOtpService = SMSService;
exports.default = SMSService;
