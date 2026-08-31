"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserController = exports.toggle2faSchema = exports.changePasswordSchema = exports.updateProfileSchema = void 0;
const zod_1 = require("zod");
const user_service_js_1 = require("../../../application/services/user.service.js");
const audit_service_js_1 = require("../../../application/services/audit.service.js");
exports.updateProfileSchema = zod_1.z.object({
    name: zod_1.z.string().min(2).optional(),
    phone: zod_1.z.string().optional(),
    avatarUrl: zod_1.z.string().url().optional(),
});
exports.changePasswordSchema = zod_1.z.object({
    currentPassword: zod_1.z.string().min(1, "Current password is required"),
    newPassword: zod_1.z.string().min(8, "New password must be at least 8 characters"),
});
exports.toggle2faSchema = zod_1.z.object({
    enabled: zod_1.z.boolean(),
});
class UserController {
    static async getProfile(req, res, next) {
        try {
            const userId = req.user.userId;
            const user = await user_service_js_1.UserService.getProfile(userId);
            res.status(200).json({ success: true, data: user });
        }
        catch (error) {
            next(error);
        }
    }
    static async updateProfile(req, res, next) {
        try {
            const userId = req.user.userId;
            const user = await user_service_js_1.UserService.updateProfile(userId, req.body);
            res.status(200).json({ success: true, data: user });
        }
        catch (error) {
            next(error);
        }
    }
    static async changePassword(req, res, next) {
        try {
            const userId = req.user.userId;
            const { currentPassword, newPassword } = req.body;
            await user_service_js_1.UserService.changePassword(userId, currentPassword, newPassword);
            await audit_service_js_1.AuditService.record({
                actorId: userId,
                actorEmail: req.user.email,
                actorRole: req.user.role,
                action: "PASSWORD_CHANGED",
                targetResource: `user:${userId}`,
                organizationId: req.user.organizationId,
                details: "User successfully updated their password",
            });
            res.status(200).json({ success: true, message: "Password updated successfully." });
        }
        catch (error) {
            next(error);
        }
    }
    static async toggle2fa(req, res, next) {
        try {
            const userId = req.user.userId;
            const { enabled } = req.body;
            const user = await user_service_js_1.UserService.toggleTwoFactor(userId, enabled);
            await audit_service_js_1.AuditService.record({
                actorId: userId,
                actorEmail: req.user.email,
                actorRole: req.user.role,
                action: enabled ? "2FA_ENABLED" : "2FA_DISABLED",
                targetResource: `user:${userId}`,
                organizationId: req.user.organizationId,
                details: `Two-factor authentication ${enabled ? "enabled" : "disabled"}`,
            });
            res.status(200).json({ success: true, data: user });
        }
        catch (error) {
            next(error);
        }
    }
    static async listUsers(req, res, next) {
        try {
            const organizationId = req.user.organizationId;
            if (!organizationId) {
                res.status(400).json({ success: false, error: { message: "No organization associated" } });
                return;
            }
            const users = await user_service_js_1.UserService.listOrganizationUsers(organizationId);
            res.status(200).json({ success: true, data: users });
        }
        catch (error) {
            next(error);
        }
    }
}
exports.UserController = UserController;
