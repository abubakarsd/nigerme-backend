"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthController = exports.verifyOtpSchema = exports.setInitialPasswordSchema = exports.loginSchema = exports.signupSchema = void 0;
const zod_1 = require("zod");
const auth_service_js_1 = require("../../../application/services/auth.service.js");
const otp_service_js_1 = require("../../../application/services/otp.service.js");
exports.signupSchema = zod_1.z.object({
    name: zod_1.z.string().min(2, "Name must be at least 2 characters"),
    email: zod_1.z.string().email("Invalid email address"),
    password: zod_1.z.string().min(8, "Password must be at least 8 characters"),
    phone: zod_1.z.string().optional(),
    organizationName: zod_1.z.string().optional(),
    domain: zod_1.z.string().optional(),
});
exports.loginSchema = zod_1.z.object({
    email: zod_1.z.string().email("Invalid email address"),
    password: zod_1.z.string().min(1, "Password is required"),
});
exports.setInitialPasswordSchema = zod_1.z.object({
    email: zod_1.z.string().email("Invalid email address"),
    temporaryPassword: zod_1.z.string().min(1, "Temporary password is required"),
    newPassword: zod_1.z.string().min(8, "New password must be at least 8 characters"),
});
exports.verifyOtpSchema = zod_1.z.object({
    phone: zod_1.z.string().min(10, "Phone number is required"),
    code: zod_1.z.string().length(6, "Verification code must be 6 digits"),
});
class AuthController {
    /**
     * 1. SaaS Admin Signup: Organization owner registration
     */
    static async signup(req, res, next) {
        try {
            const result = await auth_service_js_1.AuthService.signup(req.body);
            res.status(201).json({ success: true, data: result });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * 2. SaaS Admin Login: Organization Owners and Workspace Administrators
     */
    static async login(req, res, next) {
        try {
            const result = await auth_service_js_1.AuthService.login(req.body);
            res.status(200).json({ success: true, data: result });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * 3. Webmail User Login: For added organization email members only
     */
    static async mailLogin(req, res, next) {
        try {
            const result = await auth_service_js_1.AuthService.mailLogin(req.body);
            res.status(200).json({ success: true, data: result });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * 4. Set Initial Password: First-time login password setup for added email users
     */
    static async setInitialPassword(req, res, next) {
        try {
            const result = await auth_service_js_1.AuthService.setInitialPassword(req.body);
            res.status(200).json({ success: true, data: result, message: "Password initialized successfully." });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * 5. Verify 2FA OTP
     */
    static async verify2fa(req, res, next) {
        try {
            const { phone, code } = req.body;
            const result = await auth_service_js_1.AuthService.verify2faAndLogin(phone, code);
            res.status(200).json({ success: true, data: result });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * 6. Request SMS OTP via Termii
     */
    static async requestPhoneOtp(req, res, next) {
        try {
            const { phone, purpose } = req.body;
            const result = await otp_service_js_1.OtpService.sendPhoneOtp(phone, purpose || "phone_verification");
            res.status(200).json({ success: true, data: result });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * 7. Refresh JWT Token
     */
    static async refreshToken(req, res, next) {
        try {
            const { refreshToken } = req.body;
            if (!refreshToken) {
                res.status(400).json({ success: false, error: { message: "Refresh token is required." } });
                return;
            }
            const result = await auth_service_js_1.AuthService.refreshSession(refreshToken);
            res.status(200).json({ success: true, data: result });
        }
        catch (error) {
            next(error);
        }
    }
}
exports.AuthController = AuthController;
