import mongoose, { Schema, Document } from "mongoose";

export interface IEmailAttachment {
  id: string;
  name: string;
  sizeBytes: number;
  contentType: string;
  downloadUrl?: string;
  contentId?: string;
}

export interface IEmailParticipant {
  name: string;
  email: string;
  avatar?: string;
}

export interface IEmail extends Document {
  organizationId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId; // Owner of the mailbox view
  threadId: string;
  resendId?: string;
  folder: "inbox" | "sent" | "drafts" | "starred" | "trash" | "spam" | "archive";
  category: "primary" | "social" | "promotions" | "updates";
  from: IEmailParticipant;
  to: IEmailParticipant[];
  cc: IEmailParticipant[];
  bcc: IEmailParticipant[];
  replyTo?: string;
  subject: string;
  preview: string;
  bodyHtml: string;
  bodyText: string;
  attachments: IEmailAttachment[];
  isRead: boolean;
  isStarred: boolean;
  isImportant: boolean;
  labels: string[];
  status: "QUEUED" | "SENT" | "DELIVERED" | "BOUNCED" | "RECEIVED" | "QUARANTINED";
  receivedAt?: Date;
  sentAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const EmailAttachmentSchema = new Schema<IEmailAttachment>(
  {
    id: { type: String, required: true },
    name: { type: String, required: true },
    sizeBytes: { type: Number, default: 0 },
    contentType: { type: String, default: "application/octet-stream" },
    downloadUrl: { type: String },
    contentId: { type: String },
  },
  { _id: false }
);

const EmailParticipantSchema = new Schema<IEmailParticipant>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    avatar: { type: String },
  },
  { _id: false }
);

const EmailSchema = new Schema<IEmail>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    threadId: {
      type: String,
      required: true,
      index: true,
    },
    resendId: {
      type: String,
      index: true,
    },
    folder: {
      type: String,
      enum: ["inbox", "sent", "drafts", "starred", "trash", "spam", "archive"],
      default: "inbox",
      index: true,
    },
    category: {
      type: String,
      enum: ["primary", "social", "promotions", "updates"],
      default: "primary",
      index: true,
    },
    from: {
      type: EmailParticipantSchema,
      required: true,
    },
    to: {
      type: [EmailParticipantSchema],
      required: true,
      default: [],
    },
    cc: {
      type: [EmailParticipantSchema],
      default: [],
    },
    bcc: {
      type: [EmailParticipantSchema],
      default: [],
    },
    replyTo: {
      type: String,
      trim: true,
    },
    subject: {
      type: String,
      default: "(No subject)",
      trim: true,
    },
    preview: {
      type: String,
      default: "",
    },
    bodyHtml: {
      type: String,
      default: "",
    },
    bodyText: {
      type: String,
      default: "",
    },
    attachments: {
      type: [EmailAttachmentSchema],
      default: [],
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
    isStarred: {
      type: Boolean,
      default: false,
      index: true,
    },
    isImportant: {
      type: Boolean,
      default: false,
    },
    labels: {
      type: [String],
      default: [],
    },
    status: {
      type: String,
      enum: ["QUEUED", "SENT", "DELIVERED", "BOUNCED", "RECEIVED", "QUARANTINED"],
      default: "SENT",
    },
    receivedAt: {
      type: Date,
    },
    sentAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for high-speed webmail listing
EmailSchema.index({ userId: 1, folder: 1, createdAt: -1 });
EmailSchema.index({ organizationId: 1, folder: 1, createdAt: -1 });
EmailSchema.index({ "from.email": 1, createdAt: -1 });
EmailSchema.index({ "to.email": 1, createdAt: -1 });

export const EmailModel = mongoose.model<IEmail>("Email", EmailSchema);
