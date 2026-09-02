import mongoose, { Schema, Document } from "mongoose";

export interface IDepartment extends Document {
  organizationId: mongoose.Types.ObjectId;
  name: string;
  code?: string;
  description?: string;
  leadName?: string;
  leadEmail?: string;
  leadId?: mongoose.Types.ObjectId;
  color?: string;
  memberCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const DepartmentSchema = new Schema<IDepartment>(
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
    code: {
      type: String,
      trim: true,
      uppercase: true,
      default: "",
    },
    description: {
      type: String,
      default: "",
      trim: true,
    },
    leadName: {
      type: String,
      default: "",
      trim: true,
    },
    leadEmail: {
      type: String,
      default: "",
      trim: true,
      lowercase: true,
    },
    leadId: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    color: {
      type: String,
      default: "blue",
      enum: ["blue", "emerald", "purple", "amber", "rose", "cyan", "indigo", "lime", "neutral"],
    },
    memberCount: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_, ret) => {
        delete (ret as any).__v;
        return ret;
      },
    },
  }
);

DepartmentSchema.index({ organizationId: 1, name: 1 }, { unique: true });

export const DepartmentModel = mongoose.model<IDepartment>("Department", DepartmentSchema);
