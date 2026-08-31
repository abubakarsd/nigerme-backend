import mongoose, { Schema, Document } from "mongoose";

export interface IOtp extends Document {
  identifier: string; // phone number or email address
  otpHash: string;
  attempts: number;
  purpose: "signup" | "login_2fa" | "password_reset" | "phone_verification";
  expiresAt: Date;
  createdAt: Date;
}

const OtpSchema = new Schema<IOtp>(
  {
    identifier: {
      type: String,
      required: true,
      index: true,
    },
    otpHash: {
      type: String,
      required: true,
    },
    attempts: {
      type: Number,
      default: 0,
    },
    purpose: {
      type: String,
      enum: ["signup", "login_2fa", "password_reset", "phone_verification"],
      default: "login_2fa",
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 }, // Auto-delete document upon expiration via MongoDB TTL index
    },
  },
  {
    timestamps: true,
  }
);

export const OtpModel = mongoose.model<IOtp>("Otp", OtpSchema);
