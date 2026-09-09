import mongoose, { Schema, Document } from "mongoose";

export interface ITicketMessage {
  id: string;
  senderType: "CUSTOMER" | "AGENT" | "SYSTEM";
  senderName: string;
  senderEmail: string;
  body: string;
  isInternalNote: boolean;
  emailId?: string;
  createdAt: Date;
}

export interface ITicket extends Document {
  ticketNumber: string;
  organizationId: mongoose.Types.ObjectId;
  customerId: mongoose.Types.ObjectId;
  customerName: string;
  customerEmail: string;
  subject: string;
  type: "SUPPORT" | "BILLING" | "SALES" | "GENERAL";
  department: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  status: "OPEN" | "IN_PROGRESS" | "PENDING" | "RESOLVED" | "CLOSED";
  assignedToUserId?: mongoose.Types.ObjectId;
  assignedToName?: string;
  emailThreadId?: string;
  slaDeadline: Date;
  slaBreached: boolean;
  messages: ITicketMessage[];
  tags: string[];
  resolvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const TicketMessageSchema = new Schema<ITicketMessage>(
  {
    id: { type: String, required: true },
    senderType: {
      type: String,
      enum: ["CUSTOMER", "AGENT", "SYSTEM"],
      required: true,
    },
    senderName: { type: String, required: true },
    senderEmail: { type: String, required: true },
    body: { type: String, required: true },
    isInternalNote: { type: Boolean, default: false },
    emailId: { type: String },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const TicketSchema = new Schema<ITicket>(
  {
    ticketNumber: {
      type: String,
      required: true,
      index: true,
    },
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
    customerName: {
      type: String,
      required: true,
    },
    customerEmail: {
      type: String,
      required: true,
      lowercase: true,
    },
    subject: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ["SUPPORT", "BILLING", "SALES", "GENERAL"],
      default: "SUPPORT",
    },
    department: {
      type: String,
      default: "Customer Support",
    },
    priority: {
      type: String,
      enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
      default: "MEDIUM",
      index: true,
    },
    status: {
      type: String,
      enum: ["OPEN", "IN_PROGRESS", "PENDING", "RESOLVED", "CLOSED"],
      default: "OPEN",
      index: true,
    },
    assignedToUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    assignedToName: {
      type: String,
    },
    emailThreadId: {
      type: String,
      index: true,
    },
    slaDeadline: {
      type: Date,
      required: true,
      index: true,
    },
    slaBreached: {
      type: Boolean,
      default: false,
    },
    messages: {
      type: [TicketMessageSchema],
      default: [],
    },
    tags: {
      type: [String],
      default: [],
    },
    resolvedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

TicketSchema.index({ organizationId: 1, status: 1 });
TicketSchema.index({ organizationId: 1, customerId: 1 });

export const TicketModel = mongoose.model<ITicket>("Ticket", TicketSchema);
