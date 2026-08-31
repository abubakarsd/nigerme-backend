"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OtpService = void 0;
const crypto_1 = __importDefault(require("crypto"));
const otp_model_js_1 = require("../../infrastructure/database/models/otp.model.js");
const termii_client_js_1 = require("../../infrastructure/external/termii.client.js");
const index_js_1 = require("../../services/resend/index.js");
class OtpService {
    static OTP_VALIDITY_MINUTES = 10;
    static MAX_VERIFY_ATTEMPTS = 5;
    /**
     * Generates, stores, and dispatches a secure 6-digit Email OTP via Resend
     */
    static async sendEmailOtp(email, name = "Workspace Administrator", purpose = "email_verification") {
        const formattedEmail = email.toLowerCase().trim();
        // Rate-limiting check: Prevent more than 5 OTP requests within 15 minutes
        const recentOtpCount = await otp_model_js_1.OtpModel.countDocuments({
            identifier: formattedEmail,
            createdAt: { $gte: new Date(Date.now() - 15 * 60 * 1000) },
        });
        if (recentOtpCount >= 5) {
            throw new Error("Too many OTP requests. Please wait 15 minutes before requesting another code.");
        }
        // Generate cryptographically secure 6-digit code
        const rawOtp = crypto_1.default.randomInt(100000, 999999).toString();
        const otpHash = crypto_1.default.createHash("sha256").update(rawOtp).digest("hex");
        const expiresAt = new Date(Date.now() + this.OTP_VALIDITY_MINUTES * 60 * 1000);
        // Remove any previous unused OTP for this email + purpose
        await otp_model_js_1.OtpModel.deleteMany({ identifier: formattedEmail, purpose });
        await otp_model_js_1.OtpModel.create({
            identifier: formattedEmail,
            otpHash,
            purpose,
            expiresAt,
            attempts: 0,
        });
        // Send Email via Resend
        const result = await index_js_1.ResendEmailService.sendOtpEmail(formattedEmail, name, rawOtp, this.OTP_VALIDITY_MINUTES);
        if (!result.success && result.error) {
            console.warn("⚠️ Resend email delivery issue:", result.error);
        }
        return {
            message: `A 6-digit verification code has been dispatched to ${formattedEmail}.`,
            expiresInMinutes: this.OTP_VALIDITY_MINUTES,
        };
    }
    /**
     * Verifies an Email OTP code against stored hash
     */
    static async verifyEmailOtp(email, otpCode, purpose = "email_verification") {
        const formattedEmail = email.toLowerCase().trim();
        const candidateHash = crypto_1.default.createHash("sha256").update(otpCode.trim()).digest("hex");
        const otpRecord = await otp_model_js_1.OtpModel.findOne({
            identifier: formattedEmail,
            purpose,
        });
        if (!otpRecord) {
            throw new Error("No active verification code found for this email address. Please request a new code.");
        }
        if (otpRecord.expiresAt <= new Date()) {
            await otp_model_js_1.OtpModel.deleteOne({ _id: otpRecord._id });
            throw new Error(`Your verification code has expired (${this.OTP_VALIDITY_MINUTES} minutes validity). Please click 'Resend code now'.`);
        }
        if (otpRecord.attempts >= this.MAX_VERIFY_ATTEMPTS) {
            await otp_model_js_1.OtpModel.deleteOne({ _id: otpRecord._id });
            throw new Error("Too many failed attempts. For security, please request a new verification code.");
        }
        if (otpRecord.otpHash !== candidateHash) {
            otpRecord.attempts += 1;
            await otpRecord.save();
            throw new Error(`Incorrect verification code. ${this.MAX_VERIFY_ATTEMPTS - otpRecord.attempts} attempts remaining.`);
        }
        // OTP matched successfully - delete it to prevent replay attacks
        await otp_model_js_1.OtpModel.deleteOne({ _id: otpRecord._id });
        return true;
    }
    /**
     * Generates, stores, and dispatches a secure 6-digit SMS OTP via Termii
     */
    static async sendPhoneOtp(phone, purpose = "login_2fa") {
        const formattedPhone = termii_client_js_1.TermiiClient.formatNigerianPhone(phone);
        // Rate-limiting check: Prevent more than 5 active OTP requests within 15 minutes
        const recentOtpCount = await otp_model_js_1.OtpModel.countDocuments({
            identifier: formattedPhone,
            createdAt: { $gte: new Date(Date.now() - 15 * 60 * 1000) },
        });
        if (recentOtpCount >= 5) {
            throw new Error("Too many OTP requests. Please wait 15 minutes before requesting another code.");
        }
        // Generate cryptographically secure 6-digit code
        const rawOtp = crypto_1.default.randomInt(100000, 999999).toString();
        const otpHash = crypto_1.default.createHash("sha256").update(rawOtp).digest("hex");
        const expiresAt = new Date(Date.now() + this.OTP_VALIDITY_MINUTES * 60 * 1000);
        // Remove any previous unused OTP for this phone + purpose
        await otp_model_js_1.OtpModel.deleteMany({ identifier: formattedPhone, purpose });
        await otp_model_js_1.OtpModel.create({
            identifier: formattedPhone,
            otpHash,
            purpose,
            expiresAt,
            attempts: 0,
        });
        // Send SMS via Termii
        await termii_client_js_1.TermiiClient.sendOtp(formattedPhone, rawOtp);
        return {
            message: "Verification code sent successfully to your phone number.",
            expiresInMinutes: this.OTP_VALIDITY_MINUTES,
        };
    }
    /**
     * Verifies a Phone OTP code against stored hash
     */
    static async verifyPhoneOtp(phone, otpCode, purpose = "login_2fa") {
        const formattedPhone = termii_client_js_1.TermiiClient.formatNigerianPhone(phone);
        const candidateHash = crypto_1.default.createHash("sha256").update(otpCode.trim()).digest("hex");
        const otpRecord = await otp_model_js_1.OtpModel.findOne({
            identifier: formattedPhone,
            purpose,
        });
        if (!otpRecord) {
            throw new Error("No active verification code found for this phone number. Please request a new code.");
        }
        if (otpRecord.expiresAt <= new Date()) {
            await otp_model_js_1.OtpModel.deleteOne({ _id: otpRecord._id });
            throw new Error(`Your verification code has expired (${this.OTP_VALIDITY_MINUTES} minutes validity). Please request a new code.`);
        }
        if (otpRecord.attempts >= this.MAX_VERIFY_ATTEMPTS) {
            await otp_model_js_1.OtpModel.deleteOne({ _id: otpRecord._id });
            throw new Error("Too many failed attempts. Please request a new verification code.");
        }
        if (otpRecord.otpHash !== candidateHash) {
            otpRecord.attempts += 1;
            await otpRecord.save();
            throw new Error(`Incorrect verification code. ${this.MAX_VERIFY_ATTEMPTS - otpRecord.attempts} attempts remaining.`);
        }
        // OTP matched successfully - delete it to prevent replay attacks
        await otp_model_js_1.OtpModel.deleteOne({ _id: otpRecord._id });
        return true;
    }
}
exports.OtpService = OtpService;
