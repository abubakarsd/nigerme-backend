import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(5000),
  API_BASE_URL: z.string().default("http://localhost:5000"),
  CORS_ORIGIN: z.string().default("*"),

  // MongoDB
  MONGODB_URI: z.string().min(1, "MONGODB_URI is required"),
  MONGODB_MAX_POOL_SIZE: z.coerce.number().default(10),

  // Security & JWT
  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_ACCESS_EXPIRES_IN: z.string().default("15m"),
  JWT_REFRESH_EXPIRES_IN: z.string().default("7d"),
  DATA_ENCRYPTION_KEY: z.string().min(32),

  // AWS S3 Storage
  STORAGE_PROVIDER: z.string().default("s3"),
  AWS_REGION: z.string().default("us-east-1"),
  AWS_S3_BUCKET: z.string().optional().default("nigerme-media-bucket"),
  AWS_S3_ACCESS_POINT: z.string().optional(),
  AWS_S3_ACCESS_POINT_ARN: z.string().optional(),
  AWS_ACCOUNT_ID: z.string().optional(),
  AWS_VPC_ID: z.string().optional(),
  AWS_ACCESS_KEY_ID: z.string().optional().default(""),
  AWS_SECRET_ACCESS_KEY: z.string().optional().default(""),
  AWS_S3_BASE_FOLDER: z.string().default("nigerme-media"),
  AWS_S3_CUSTOM_DOMAIN: z.string().optional().default(""),

  // Provn KYC
  PROVN_API_KEY: z.string().optional().default(""),
  PROVN_ACCESS_KEY: z.string().optional().default(""),
  PROVN_URL: z.string().url().default("https://api.provn.ng"),

  // Termii OTP SMS
  TERMII_BASE_URL: z.string().url().default("https://api.ng.termii.com/api"),
  TERMII_API_LIVE: z.string().optional().default(""),
  TERMII_SECRET_KEY: z.string().optional().default(""),
  TERMII_SENDER_ID: z.string().default("NIGERME"),

  // Paystack
  PAYSTACK_SECRET_KEY: z.string().optional().default(""),
  PAYSTACK_PUBLIC_KEY: z.string().optional().default(""),
  PAYSTACK_WEBHOOK_SECRET: z.string().optional().default(""),
  PAYSTACK_BASE_URL: z.string().url().default("https://api.paystack.co"),

  // Resend Email Service
  RESEND_API: z.string().optional().default(""),
  RESEND_API_KEY: z.string().optional().default(""),
  EMAIL_SENDER: z.string().default("Nigerme Workspace <no-reply@vynxtechnology.com>"),
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
