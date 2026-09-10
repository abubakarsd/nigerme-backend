import mongoose, { Schema, Document } from "mongoose";

export interface ITask extends Document {
  organizationId: mongoose.Types.ObjectId;
  title: string;
  description?: string;
  status: "TODO" | "IN_PROGRESS" | "REVIEW" | "COMPLETED" | "BLOCKED" | "CANCELLED";
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  assigneeId?: mongoose.Types.ObjectId;
  assigneeName?: string;
  creatorId: mongoose.Types.ObjectId;
  creatorName: string;
  dueDate?: Date;
  labels: string[];
  sourceEmailId?: string;
  sourceEmailSubject?: string;
  relatedCalendarEventId?: string;
  customerId?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const TaskSchema = new Schema<ITask>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    status: { type: String, enum: ["TODO", "IN_PROGRESS", "REVIEW", "COMPLETED", "BLOCKED", "CANCELLED"], default: "TODO", index: true },
    priority: { type: String, enum: ["LOW", "MEDIUM", "HIGH", "URGENT"], default: "MEDIUM", index: true },
    assigneeId: { type: Schema.Types.ObjectId, ref: "User" },
    assigneeName: { type: String, trim: true },
    creatorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    creatorName: { type: String, required: true, trim: true },
    dueDate: { type: Date },
    labels: { type: [String], default: [] },
    sourceEmailId: { type: String },
    sourceEmailSubject: { type: String },
    relatedCalendarEventId: { type: String },
    customerId: { type: Schema.Types.ObjectId, ref: "Customer" },
  },
  { timestamps: true }
);

TaskSchema.index({ organizationId: 1, status: 1 });
TaskSchema.index({ organizationId: 1, assigneeId: 1 });
TaskSchema.index({ organizationId: 1, createdAt: -1 });

export const TaskModel = mongoose.model<ITask>("Task", TaskSchema);
