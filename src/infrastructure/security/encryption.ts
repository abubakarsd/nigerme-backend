import crypto from "crypto";
import { env } from "../../config/env.js";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

/**
 * Derives a 32-byte encryption key buffer from DATA_ENCRYPTION_KEY
 */
function getKeyBuffer(): Buffer {
  return crypto.createHash("sha256").update(env.DATA_ENCRYPTION_KEY).digest();
}

export interface EncryptedData {
  encryptedText: string; // Base64 ciphertext
  iv: string; // Base64 IV
  authTag: string; // Base64 Auth Tag
}

/**
 * Encrypts plaintext string using AES-256-GCM
 */
export function encryptData(plainText: string): EncryptedData {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getKeyBuffer(), iv);

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
export function decryptData(encrypted: EncryptedData): string {
  const iv = Buffer.from(encrypted.iv, "base64");
  const authTag = Buffer.from(encrypted.authTag, "base64");
  const decipher = crypto.createDecipheriv(ALGORITHM, getKeyBuffer(), iv);

  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted.encryptedText, "base64", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

/**
 * Masks sensitive identifiers (e.g., BVN or NIN) for safe display
 * e.g., 22234567890 -> *******7890
 */
export function maskIdentifier(identifier: string): string {
  if (!identifier || identifier.length < 4) return "****";
  const lastFour = identifier.slice(-4);
  return "*".repeat(Math.max(0, identifier.length - 4)) + lastFour;
}
