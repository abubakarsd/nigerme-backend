"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ENV = exports.env = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
const zod_1 = require("zod");
dotenv_1.default.config();
const envSchema = zod_1.z.object({
    NODE_ENV: zod_1.z.enum(["development", "production", "test"]).default("development"),
    PORT: zod_1.z.coerce.number().default(5000),
    API_BASE_URL: zod_1.z.string().default("http://localhost:5000"),
    CORS_ORIGIN: zod_1.z.string().default("*"),
    // MongoDB
    MONGODB_URI: zod_1.z.string().min(1, "MONGODB_URI is required"),
    MONGODB_MAX_POOL_SIZE: zod_1.z.coerce.number().default(10),
    // Security & JWT
    JWT_ACCESS_SECRET: zod_1.z.string().min(16),
    JWT_REFRESH_SECRET: zod_1.z.string().min(16),
    JWT_ACCESS_EXPIRES_IN: zod_1.z.string().default("15m"),
    JWT_REFRESH_EXPIRES_IN: zod_1.z.string().default("7d"),
    DATA_ENCRYPTION_KEY: zod_1.z.string().min(32),
    // AWS S3 Storage
    STORAGE_PROVIDER: zod_1.z.string().default("s3"),
    AWS_REGION: zod_1.z.string().default("us-east-1"),
    AWS_S3_BUCKET: zod_1.z.string().optional().default("nigerme-media-bucket"),
    AWS_S3_ACCESS_POINT: zod_1.z.string().optional(),
    AWS_S3_ACCESS_POINT_ARN: zod_1.z.string().optional(),
    AWS_ACCOUNT_ID: zod_1.z.string().optional(),
    AWS_VPC_ID: zod_1.z.string().optional(),
    AWS_ACCESS_KEY_ID: zod_1.z.string().optional().default(""),
    AWS_SECRET_ACCESS_KEY: zod_1.z.string().optional().default(""),
    AWS_S3_BASE_FOLDER: zod_1.z.string().default("nigerme-media"),
    AWS_S3_CUSTOM_DOMAIN: zod_1.z.string().optional().default(""),
    // Provn KYC
    PROVN_API_KEY: zod_1.z.string().optional().default(""),
    PROVN_ACCESS_KEY: zod_1.z.string().optional().default(""),
    PROVN_URL: zod_1.z.string().url().default("https://api.provn.ng"),
    // Termii OTP SMS
    TERMII_BASE_URL: zod_1.z.string().url().default("https://api.ng.termii.com/api"),
    TERMII_API_LIVE: zod_1.z.string().optional().default(""),
    TERMII_SECRET_KEY: zod_1.z.string().optional().default(""),
    TERMII_SENDER_ID: zod_1.z.string().default("NIGERME"),
    // Paystack
    PAYSTACK_SECRET_KEY: zod_1.z.string().optional().default(""),
    PAYSTACK_PUBLIC_KEY: zod_1.z.string().optional().default(""),
    PAYSTACK_WEBHOOK_SECRET: zod_1.z.string().optional().default(""),
    PAYSTACK_BASE_URL: zod_1.z.string().url().default("https://api.paystack.co"),
    // Resend Email Service
    RESEND_API: zod_1.z.string().optional().default(""),
    RESEND_API_KEY: zod_1.z.string().optional().default(""),
    EMAIL_SENDER: zod_1.z.string().default("Nigerme Workspace <no-reply@vynxtechnology.com>"),
});
const parseEnv = () => {
    const result = envSchema.safeParse(process.env);
    if (!result.success) {
        console.error("❌ Invalid environment variables:", result.error.format());
        throw new Error("Invalid backend environment configuration.");
    }
    return result.data;
};
exports.env = parseEnv();
exports.ENV = exports.env;
exports.default = exports.env;
