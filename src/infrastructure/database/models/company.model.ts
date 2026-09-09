import mongoose, { Schema, Document } from "mongoose";

export interface ICompany extends Document {
  organizationId: mongoose.Types.ObjectId;
  name: string;
  domain?: string;
  industry?: string;
  phone?: string;
  address?: string;
  assignedAgentId?: mongoose.Types.ObjectId;
  assignedAgentName?: string;
  createdAt: Date;
  updatedAt: Date;
}

const CompanySchema = new Schema<ICompany>(
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
    domain: {
      type: String,
      trim: true,
    },
    industry: {
      type: String,
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    address: {
      type: String,
      trim: true,
    },
    assignedAgentId: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    assignedAgentName: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

CompanySchema.index({ organizationId: 1, name: 1 });

export const CompanyModel = mongoose.model<ICompany>("Company", CompanySchema);
