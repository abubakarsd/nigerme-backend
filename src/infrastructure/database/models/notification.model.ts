import mongoose, { Schema, Document } from "mongoose";

export interface INotification extends Document {
  organizationId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  title: string;
  message: string;
  type: "TASK" | "TICKET" | "EMAIL" | "CALENDAR" | "SECURITY" | "SYSTEM";
  read: boolean;
  link?: string;
  metadata?: any;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationSchema = new Schema<INotification>(
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
    title: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ["TASK", "TICKET", "EMAIL", "CALENDAR", "SECURITY", "SYSTEM"],
      default: "SYSTEM",
      index: true,
    },
    read: {
      type: Boolean,
      default: false,
      index: true,
    },
    link: {
      type: String,
      trim: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

NotificationSchema.index({ userId: 1, read: 1, createdAt: -1 });
NotificationSchema.index({ organizationId: 1, createdAt: -1 });

export const NotificationModel = mongoose.model<INotification>(
  "Notification",
  NotificationSchema
);
