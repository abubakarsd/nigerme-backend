"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.encryptData = encryptData;
exports.decryptData = decryptData;
exports.maskIdentifier = maskIdentifier;
const crypto_1 = __importDefault(require("crypto"));
const env_js_1 = require("../../config/env.js");
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
/**
 * Derives a 32-byte encryption key buffer from DATA_ENCRYPTION_KEY
 */
function getKeyBuffer() {
    return crypto_1.default.createHash("sha256").update(env_js_1.env.DATA_ENCRYPTION_KEY).digest();
}
/**
 * Encrypts plaintext string using AES-256-GCM
 */
function encryptData(plainText) {
    const iv = crypto_1.default.randomBytes(IV_LENGTH);
    const cipher = crypto_1.default.createCipheriv(ALGORITHM, getKeyBuffer(), iv);
    let encrypted = cipher.update(plainText, "utf8", "base64");
    encrypted += cipher.final("base64");
    const authTag = cipher.getAuthTag();
    return {
        encryptedText: encrypted,
        iv: iv.toString("base64"),
        authTag: authTag.toString("base64"),
    };
}
/**
 * Decrypts AES-256-GCM ciphertext
 */
function decryptData(encrypted) {
    const iv = Buffer.from(encrypted.iv, "base64");
    const authTag = Buffer.from(encrypted.authTag, "base64");
    const decipher = crypto_1.default.createDecipheriv(ALGORITHM, getKeyBuffer(), iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encrypted.encryptedText, "base64", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
}
/**
 * Masks sensitive identifiers (e.g., BVN or NIN) for safe display
 * e.g., 22234567890 -> *******7890
 */
function maskIdentifier(identifier) {
    if (!identifier || identifier.length < 4)
        return "****";
    const lastFour = identifier.slice(-4);
    return "*".repeat(Math.max(0, identifier.length - 4)) + lastFour;
}
