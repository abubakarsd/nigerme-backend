import mongoose, { Schema, Document } from "mongoose";

export interface IOrganization extends Document {
  name: string;
  domain: string;
  ownerId: mongoose.Types.ObjectId;
  plan: "tier1" | "tier2" | "tier3" | "enterprise";
  walletBalance: number; // in Kobo (e.g. 500000 = 5,000 NGN)
  dedicatedVirtualAccount?: {
    accountNumber: string;
    accountName: string;
    bankName: string;
    assignedAt: Date;
  };
  dnsVerification: {
    spfStatus: "pending" | "verified" | "failed";
    dkimStatus: "pending" | "verified" | "failed";
    dmarcStatus: "pending" | "verified" | "failed";
    mxStatus: "pending" | "verified" | "failed";
    lastCheckedAt?: Date;
  };
  kycStatus: "unverified" | "submitted" | "verified" | "rejected";
  trustLevel: "Tier 1 Sovereign" | "Tier 2 Sovereign" | "Tier 3 Sovereign";
  dailySendingLimit: number;
  subscribedPackages?: string[];
  billingCycle?: "MONTHLY" | "ANNUAL";
  autoDebitWallet?: boolean;
  totalSeats?: number;
  usedSeats?: number;
  industry?: string;
  phone?: string;
  supportEmail?: string;
  departments?: any[];
  roles?: any[];
  createdAt: Date;
  updatedAt: Date;
}

const OrganizationSchema = new Schema<IOrganization>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    domain: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    plan: {
      type: String,
      enum: ["tier1", "tier2", "tier3", "enterprise"],
      default: "tier1",
    },
    walletBalance: {
      type: Number,
      default: 0,
      min: 0,
    },
    dedicatedVirtualAccount: {
      accountNumber: String,
      accountName: String,
      bankName: String,
      assignedAt: Date,
    },
    dnsVerification: {
      spfStatus: { type: String, enum: ["pending", "verified", "failed"], default: "pending" },
      dkimStatus: { type: String, enum: ["pending", "verified", "failed"], default: "pending" },
      dmarcStatus: { type: String, enum: ["pending", "verified", "failed"], default: "pending" },
      mxStatus: { type: String, enum: ["pending", "verified", "failed"], default: "pending" },
      lastCheckedAt: Date,
    },
    kycStatus: {
      type: String,
      enum: ["unverified", "submitted", "verified", "rejected"],
      default: "unverified",
      index: true,
    },
    trustLevel: {
      type: String,
      enum: ["Tier 1 Sovereign", "Tier 2 Sovereign", "Tier 3 Sovereign"],
      default: "Tier 1 Sovereign",
    },
    dailySendingLimit: {
      type: Number,
      default: 1000,
    },
    subscribedPackages: {
      type: [String],
      default: ["org-email", "payroll"],
    },
    billingCycle: {
      type: String,
      enum: ["MONTHLY", "ANNUAL"],
      default: "MONTHLY",
    },
    autoDebitWallet: {
      type: Boolean,
      default: true,
    },
    totalSeats: {
      type: Number,
      default: 15,
    },
    usedSeats: {
      type: Number,
      default: 1,
    },
    industry: {
      type: String,
      default: "Technology & Enterprise Systems",
    },
    phone: {
      type: String,
      default: "+234 800 NIGERME",
    },
    supportEmail: {
      type: String,
      default: "support@nigerme.com",
    },
    departments: {
      type: [Schema.Types.Mixed],
      default: [],
    },
    roles: {
      type: [Schema.Types.Mixed],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

export const OrganizationModel = mongoose.model<IOrganization>("Organization", OrganizationSchema);
