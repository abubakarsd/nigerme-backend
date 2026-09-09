import mongoose, { Schema, Document } from "mongoose";

export interface IDeal extends Document {
  organizationId: mongoose.Types.ObjectId;
  title: string;
  customerId: mongoose.Types.ObjectId;
  customerName: string;
  companyName?: string;
  amount: number;
  currency: string;
  stage: "LEAD" | "CONTACTED" | "QUALIFIED" | "PROPOSAL" | "NEGOTIATION" | "WON" | "LOST";
  probability: number;
  expectedClosingDate?: Date;
  assignedAgentId?: mongoose.Types.ObjectId;
  assignedAgentName?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const DealSchema = new Schema<IDeal>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    customerId: {
      type: Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
      index: true,
    },
    customerName: {
      type: String,
      required: true,
    },
    companyName: {
      type: String,
    },
    amount: {
      type: Number,
      required: true,
      default: 0,
    },
    currency: {
      type: String,
      default: "NGN",
    },
    stage: {
      type: String,
      enum: ["LEAD", "CONTACTED", "QUALIFIED", "PROPOSAL", "NEGOTIATION", "WON", "LOST"],
      default: "LEAD",
      index: true,
    },
    probability: {
      type: Number,
      default: 10,
      min: 0,
      max: 100,
    },
    expectedClosingDate: {
      type: Date,
    },
    assignedAgentId: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    assignedAgentName: {
      type: String,
    },
    notes: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

DealSchema.index({ organizationId: 1, stage: 1 });

export const DealModel = mongoose.model<IDeal>("Deal", DealSchema);
