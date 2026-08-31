import mongoose, { Schema, Document } from "mongoose";

export interface IAbuseCase extends Document {
  organizationId: mongoose.Types.ObjectId;
  organizationName: string;
  targetDomain: string;
  senderEmail: string;
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  triggerReason: string;
  sendingVelocityHourly: number;
  bounceRatePercent: number;
  status: "UNDER_REVIEW" | "QUARANTINED" | "CLEARED" | "SUSPENDED";
  details?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const AbuseCaseSchema = new Schema<IAbuseCase>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    organizationName: {
      type: String,
      required: true,
    },
    targetDomain: {
      type: String,
      required: true,
      index: true,
    },
    senderEmail: {
      type: String,
      required: true,
      index: true,
    },
    riskLevel: {
      type: String,
      enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
      default: "LOW",
      index: true,
    },
    triggerReason: {
      type: String,
      required: true,
    },
    sendingVelocityHourly: {
      type: Number,
      default: 0,
    },
    bounceRatePercent: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ["UNDER_REVIEW", "QUARANTINED", "CLEARED", "SUSPENDED"],
      default: "UNDER_REVIEW",
      index: true,
    },
    details: {
      type: String,
    },
    metadata: {
      type: Schema.Types.Mixed,
    },
  },
  {
    timestamps: true,
  }
);

export const AbuseCaseModel = mongoose.model<IAbuseCase>("AbuseCase", AbuseCaseSchema);
