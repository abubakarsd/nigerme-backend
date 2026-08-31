import mongoose, { Schema, Document } from "mongoose";

export interface ITransaction extends Document {
  organizationId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  reference: string;
  paystackReference?: string;
  type: "wallet_funding" | "subscription_charge" | "sms_usage" | "domain_registration" | "tax_filing";
  amount: number; // in Kobo
  status: "pending" | "success" | "failed" | "abandoned";
  channel: "card" | "bank_transfer" | "ussd" | "wallet";
  currency: string;
  metadata?: Record<string, any>;
  paidAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const TransactionSchema = new Schema<ITransaction>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    reference: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    paystackReference: {
      type: String,
      index: true,
    },
    type: {
      type: String,
      enum: ["wallet_funding", "subscription_charge", "sms_usage", "domain_registration", "tax_filing"],
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "success", "failed", "abandoned"],
      default: "pending",
      index: true,
    },
    channel: {
      type: String,
      enum: ["card", "bank_transfer", "ussd", "wallet"],
      default: "card",
    },
    currency: {
      type: String,
      default: "NGN",
    },
    metadata: Schema.Types.Mixed,
    paidAt: Date,
  },
  {
    timestamps: true,
  }
);

export const TransactionModel = mongoose.model<ITransaction>("Transaction", TransactionSchema);
