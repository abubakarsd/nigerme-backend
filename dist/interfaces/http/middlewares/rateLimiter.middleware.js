"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.otpLimiter = exports.authLimiter = exports.globalLimiter = void 0;
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
exports.globalLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 300, // 300 requests per IP
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        error: { message: "Too many requests from this IP. Please try again in 15 minutes." },
    },
});
exports.authLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20, // 20 requests per IP for login/signup
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        error: { message: "Too many authentication attempts. Please try again in 15 minutes." },
    },
});
exports.otpLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 requests per IP
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        error: { message: "Too many OTP requests. Please wait before requesting another code." },
    },
});
