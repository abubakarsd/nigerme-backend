import mongoose, { Schema, Document } from "mongoose";

export interface ISubscription extends Document {
  organizationId: mongoose.Types.ObjectId;
  packageIds: string[];
  billingCycle: "MONTHLY" | "ANNUAL";
  seatCount: number;
  totalAmount: number; // in Kobo (e.g. 500000 = 5,000 NGN)
  currency: string;
  status: "TRIAL" | "ACTIVE" | "PAST_DUE" | "GRACE_PERIOD" | "SUSPENDED" | "CANCELLED" | "EXPIRED";
  paymentMethod: "WALLET" | "CARD" | "FREE_TRIAL" | "BANK_TRANSFER";
  trialStartsAt?: Date;
  trialEndsAt?: Date;
  currentPeriodStartsAt: Date;
  currentPeriodEndsAt: Date;
  gracePeriodEndsAt?: Date;
  autoDebit: boolean;
  cancelledAt?: Date;
  cancellationReason?: string;
  lastPaymentReference?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const SubscriptionSchema = new Schema<ISubscription>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    packageIds: {
      type: [String],
      required: true,
      default: ["org-email"],
    },
    billingCycle: {
      type: String,
      enum: ["MONTHLY", "ANNUAL"],
      default: "MONTHLY",
    },
    seatCount: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    totalAmount: {
      type: Number,
      required: true,
      default: 0,
    },
    currency: {
      type: String,
      default: "NGN",
    },
    status: {
      type: String,
      enum: ["TRIAL", "ACTIVE", "PAST_DUE", "GRACE_PERIOD", "SUSPENDED", "CANCELLED", "EXPIRED"],
      default: "TRIAL",
      index: true,
    },
    paymentMethod: {
      type: String,
      enum: ["WALLET", "CARD", "FREE_TRIAL", "BANK_TRANSFER"],
      default: "FREE_TRIAL",
    },
    trialStartsAt: Date,
    trialEndsAt: Date,
    currentPeriodStartsAt: {
      type: Date,
      default: Date.now,
    },
    currentPeriodEndsAt: {
      type: Date,
      required: true,
    },
    gracePeriodEndsAt: Date,
    autoDebit: {
      type: Boolean,
      default: true,
    },
    cancelledAt: Date,
    cancellationReason: String,
    lastPaymentReference: String,
    metadata: Schema.Types.Mixed,
  },
  {
    timestamps: true,
  }
);

export const SubscriptionModel = mongoose.model<ISubscription>("Subscription", SubscriptionSchema);
