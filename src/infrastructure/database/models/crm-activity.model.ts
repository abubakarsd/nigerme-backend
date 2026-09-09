import mongoose, { Schema, Document } from "mongoose";

export interface ICRMActivity extends Document {
  organizationId: mongoose.Types.ObjectId;
  customerId: mongoose.Types.ObjectId;
  type:
    | "EMAIL_SENT"
    | "EMAIL_RECEIVED"
    | "TICKET_OPENED"
    | "TICKET_REPLIED"
    | "TICKET_RESOLVED"
    | "TASK_CREATED"
    | "CALENDAR_FOLLOWUP_SCHEDULED"
    | "DEAL_CREATED"
    | "DEAL_STAGE_CHANGED"
    | "QUOTE_CREATED"
    | "QUOTE_ACCEPTED"
    | "INVOICE_GENERATED"
    | "NOTE_ADDED"
    | "CALL_LOGGED";
  title: string;
  description?: string;
  metadata?: Record<string, any>; // Stores references like ticketId, dealId, taskId
  actorName: string;
  actorEmail: string;
  createdAt: Date;
  updatedAt: Date;
}

const CRMActivitySchema = new Schema<ICRMActivity>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    customerId: {
      type: Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: [
        "EMAIL_SENT",
        "EMAIL_RECEIVED",
        "TICKET_OPENED",
        "TICKET_REPLIED",
        "TICKET_RESOLVED",
        "TASK_CREATED",
        "CALENDAR_FOLLOWUP_SCHEDULED",
        "DEAL_CREATED",
        "DEAL_STAGE_CHANGED",
        "QUOTE_CREATED",
        "QUOTE_ACCEPTED",
        "INVOICE_GENERATED",
        "NOTE_ADDED",
        "CALL_LOGGED",
      ],
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
    },
    description: {
      type: String,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
    actorName: {
      type: String,
      required: true,
    },
    actorEmail: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

CRMActivitySchema.index({ customerId: 1, createdAt: -1 });

export const CRMActivityModel = mongoose.model<ICRMActivity>("CRMActivity", CRMActivitySchema);
