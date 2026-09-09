import mongoose, { Schema, Document } from "mongoose";

export interface ICustomer extends Document {
  organizationId: mongoose.Types.ObjectId;
  name: string;
  email: string;
  phone?: string;
  companyId?: mongoose.Types.ObjectId;
  companyName?: string;
  status: "NEW" | "ACTIVE" | "INACTIVE" | "CHURNED";
  assignedAgentId?: mongoose.Types.ObjectId;
  assignedAgentName?: string;
  source: "EMAIL" | "WEBSITE" | "MANUAL" | "REFERRAL" | "IMPORT";
  tags: string[];
  totalSpent: number;
  customFields?: Record<string, any>;
  lastInteractionAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const CustomerSchema = new Schema<ICustomer>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    companyId: {
      type: Schema.Types.ObjectId,
      ref: "Company",
    },
    companyName: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ["NEW", "ACTIVE", "INACTIVE", "CHURNED"],
      default: "NEW",
      index: true,
    },
    assignedAgentId: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    assignedAgentName: {
      type: String,
      trim: true,
    },
    source: {
      type: String,
      enum: ["EMAIL", "WEBSITE", "MANUAL", "REFERRAL", "IMPORT"],
      default: "EMAIL",
    },
    tags: {
      type: [String],
      default: [],
    },
    totalSpent: {
      type: Number,
      default: 0,
    },
    customFields: {
      type: Schema.Types.Mixed,
      default: {},
    },
    lastInteractionAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

CustomerSchema.index({ organizationId: 1, email: 1 });
CustomerSchema.index({ organizationId: 1, name: "text", email: "text", companyName: "text" });

export const CustomerModel = mongoose.model<ICustomer>("Customer", CustomerSchema);
