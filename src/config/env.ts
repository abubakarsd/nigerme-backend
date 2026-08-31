import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(5000),
  API_BASE_URL: z.string().url().default("http://localhost:5000"),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),

  // MongoDB
  MONGODB_URI: z.string().default("mongodb://127.0.0.1:27017/nigerme_enterprise"),
  MONGODB_MAX_POOL_SIZE: z.coerce.number().default(50),

  // Security & JWT
  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_ACCESS_EXPIRES_IN: z.string().default("15m"),
  JWT_REFRESH_EXPIRES_IN: z.string().default("7d"),
  DATA_ENCRYPTION_KEY: z.string().min(32),

  // AWS S3 Storage
  STORAGE_PROVIDER: z.string().default("s3"),
  AWS_REGION: z.string().default("us-east-1"),
  AWS_S3_BUCKET: z.string(),
  AWS_S3_ACCESS_POINT: z.string().optional(),
  AWS_S3_ACCESS_POINT_ARN: z.string().optional(),
  AWS_ACCOUNT_ID: z.string().optional(),
  AWS_VPC_ID: z.string().optional(),
  AWS_ACCESS_KEY_ID: z.string(),
  AWS_SECRET_ACCESS_KEY: z.string(),
  AWS_S3_BASE_FOLDER: z.string().default("buytok-medias"),
  AWS_S3_CUSTOM_DOMAIN: z.string().optional().default(""),

  // Provn KYC
  PROVN_API_KEY: z.string(),
  PROVN_ACCESS_KEY: z.string(),
  PROVN_URL: z.string().url().default("https://api.provn.ng"),

  // Termii OTP SMS
  TERMII_BASE_URL: z.string().url().default("https://api.ng.termii.com/api"),
  TERMII_API_LIVE: z.string(),
  TERMII_SECRET_KEY: z.string(),
  TERMII_SENDER_ID: z.string().default("buystreem"),

  // Paystack
  PAYSTACK_SECRET_KEY: z.string(),
  PAYSTACK_PUBLIC_KEY: z.string(),
  PAYSTACK_WEBHOOK_SECRET: z.string(),
  PAYSTACK_BASE_URL: z.string().url().default("https://api.paystack.co"),
});

const parseEnv = () => {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error("❌ Invalid environment variables:", result.error.format());
    throw new Error("Invalid backend environment configuration.");
  }
  return result.data;
};

export const env = parseEnv();
export const ENV = env;
export default env;
