import mongoose, { Schema, Document } from "mongoose";

export interface IAuditLog extends Document {
  actorId?: mongoose.Types.ObjectId;
  actorEmail: string;
  actorRole: string;
  action: string;
  targetResource: string;
  organizationId?: mongoose.Types.ObjectId;
  details?: string;
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
}

const AuditLogSchema = new Schema<IAuditLog>(
  {
    actorId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },
    actorEmail: {
      type: String,
      required: true,
      index: true,
    },
    actorRole: {
      type: String,
      required: true,
      default: "user",
    },
    action: {
      type: String,
      required: true,
      index: true,
    },
    targetResource: {
      type: String,
      required: true,
    },
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      index: true,
    },
    details: {
      type: String,
    },
    metadata: {
      type: Schema.Types.Mixed,
    },
    ipAddress: {
      type: String,
    },
    userAgent: {
      type: String,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

AuditLogSchema.index({ organizationId: 1, createdAt: -1 });

export const AuditLogModel = mongoose.model<IAuditLog>("AuditLog", AuditLogSchema);
