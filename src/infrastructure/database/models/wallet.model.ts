import mongoose, { Schema, Document } from "mongoose";

export interface IWalletDedicatedAccount {
  accountNumber: string;
  accountName: string;
  bankName: string;
  assignedAt: Date;
  isVerified: boolean;
  bvnMasked?: string;
  customerCode?: string;
  paystackCustomerId?: string | number;
  paystackDedicatedAccountId?: string | number;
}

export interface IWallet extends Document {
  organizationId: mongoose.Types.ObjectId;
  ownerId?: mongoose.Types.ObjectId;
  balance: number; // in Kobo (e.g. 500000 = 5,000 NGN)
  currency: string;
  status: "ACTIVE" | "FROZEN" | "PENDING";
  dedicatedVirtualAccount?: IWalletDedicatedAccount;
  bvnVerified: boolean;
  bvnMasked?: string;
  createdAt: Date;
  updatedAt: Date;
}

const WalletDedicatedAccountSchema = new Schema<IWalletDedicatedAccount>(
  {
    accountNumber: { type: String, required: true },
    accountName: { type: String, required: true },
    bankName: { type: String, required: true },
    assignedAt: { type: Date, default: Date.now },
    isVerified: { type: Boolean, default: true },
    bvnMasked: String,
    customerCode: String,
    paystackCustomerId: Schema.Types.Mixed,
    paystackDedicatedAccountId: Schema.Types.Mixed,
  },
  { _id: false }
);

const WalletSchema = new Schema<IWallet>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      unique: true,
      index: true,
    },
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },
    balance: {
      type: Number,
      default: 0,
      min: 0,
    },
    currency: {
      type: String,
      default: "NGN",
    },
    status: {
      type: String,
      enum: ["ACTIVE", "FROZEN", "PENDING"],
      default: "ACTIVE",
      index: true,
    },
    dedicatedVirtualAccount: WalletDedicatedAccountSchema,
    bvnVerified: {
      type: Boolean,
      default: false,
    },
    bvnMasked: String,
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

export const WalletModel = mongoose.model<IWallet>("Wallet", WalletSchema);
export default WalletModel;
