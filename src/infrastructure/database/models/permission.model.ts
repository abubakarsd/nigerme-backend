import mongoose, { Schema, Document } from "mongoose";

export interface IPermission extends Document {
  key: string;
  name: string;
  description: string;
  category: "Core" | "Productivity" | "Operations" | "Administration" | "Security";
  isSystem: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const PermissionSchema = new Schema<IPermission>(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
    },
    category: {
      type: String,
      enum: ["Core", "Productivity", "Operations", "Administration", "Security"],
      default: "Operations",
    },
    isSystem: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

export const PermissionModel = mongoose.model<IPermission>("Permission", PermissionSchema);
