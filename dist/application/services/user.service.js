"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserService = void 0;
const user_model_js_1 = require("../../infrastructure/database/models/user.model.js");
const token_manager_js_1 = require("../../infrastructure/security/token.manager.js");
class UserService {
    static async getProfile(userId) {
        return user_model_js_1.UserModel.findById(userId);
    }
    static async updateProfile(userId, dto) {
        return user_model_js_1.UserModel.findByIdAndUpdate(userId, { $set: dto }, { new: true });
    }
    static async changePassword(userId, currentPass, newPass) {
        const user = await user_model_js_1.UserModel.findById(userId).select("+passwordHash");
        if (!user)
            throw new Error("User not found");
        const isMatch = await token_manager_js_1.TokenManager.comparePassword(currentPass, user.passwordHash);
        if (!isMatch) {
            throw new Error("Incorrect current password");
        }
        user.passwordHash = await token_manager_js_1.TokenManager.hashPassword(newPass);
        await user.save();
        return true;
    }
    static async toggleTwoFactor(userId, enabled) {
        const user = await user_model_js_1.UserModel.findById(userId);
        if (!user)
            throw new Error("User not found");
        if (enabled && !user.phone) {
            throw new Error("Phone number must be registered and verified before enabling 2FA");
        }
        user.twoFactorEnabled = enabled;
        return user.save();
    }
    static async listOrganizationUsers(organizationId) {
        return user_model_js_1.UserModel.find({ organizationId }).sort({ createdAt: -1 });
    }
    static async updateUserStatus(userId, role, status) {
        const update = {};
        if (role)
            update.role = role;
        if (status)
            update.status = status;
        return user_model_js_1.UserModel.findByIdAndUpdate(userId, { $set: update }, { new: true });
    }
}
exports.UserService = UserService;
