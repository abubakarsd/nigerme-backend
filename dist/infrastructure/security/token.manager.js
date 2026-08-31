"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TokenManager = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const env_js_1 = require("../../config/env.js");
class TokenManager {
    static SALT_ROUNDS = 12;
    /**
     * Hashes plain text password securely using bcrypt with 12 salt rounds
     */
    static async hashPassword(password) {
        const salt = await bcryptjs_1.default.genSalt(this.SALT_ROUNDS);
        return bcryptjs_1.default.hash(password, salt);
    }
    /**
     * Compares plaintext password against stored hash
     */
    static async comparePassword(password, hash) {
        return bcryptjs_1.default.compare(password, hash);
    }
    /**
     * Signs short-lived JWT Access Token
     */
    static generateAccessToken(payload) {
        const options = {
            expiresIn: env_js_1.env.JWT_ACCESS_EXPIRES_IN,
        };
        return jsonwebtoken_1.default.sign(payload, env_js_1.env.JWT_ACCESS_SECRET, options);
    }
    /**
     * Signs long-lived JWT Refresh Token
     */
    static generateRefreshToken(payload) {
        const options = {
            expiresIn: env_js_1.env.JWT_REFRESH_EXPIRES_IN,
        };
        return jsonwebtoken_1.default.sign(payload, env_js_1.env.JWT_REFRESH_SECRET, options);
    }
    /**
     * Verifies JWT Access Token
     */
    static verifyAccessToken(token) {
        return jsonwebtoken_1.default.verify(token, env_js_1.env.JWT_ACCESS_SECRET);
    }
    /**
     * Verifies JWT Refresh Token
     */
    static verifyRefreshToken(token) {
        return jsonwebtoken_1.default.verify(token, env_js_1.env.JWT_REFRESH_SECRET);
    }
}
exports.TokenManager = TokenManager;
