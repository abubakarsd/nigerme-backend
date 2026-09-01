import mongoose, { Schema, Document } from "mongoose";

export interface IRolePermissions {
  canAccessEmail: boolean;
  canAccessPayroll: boolean;
  canAccessPos: boolean;
  canAccessLogistics: boolean;
  canAccessHotel: boolean;
  canAccessAdminConsole: boolean;
  canManageBilling: boolean;
  canManageUsers: boolean;
  canManageDomains: boolean;
}

export interface IRole extends Document {
  organizationId: mongoose.Types.ObjectId;
  name: string;
  slug?: string;
  description: string;
  isSystem: boolean;
  memberCount: number;
  permissions: IRolePermissions;
  createdAt: Date;
  updatedAt: Date;
}

const RolePermissionsSchema = new Schema<IRolePermissions>(
  {
    canAccessEmail: { type: Boolean, default: true },
    canAccessPayroll: { type: Boolean, default: false },
    canAccessPos: { type: Boolean, default: false },
    canAccessLogistics: { type: Boolean, default: false },
    canAccessHotel: { type: Boolean, default: false },
    canAccessAdminConsole: { type: Boolean, default: false },
    canManageBilling: { type: Boolean, default: false },
    canManageUsers: { type: Boolean, default: false },
    canManageDomains: { type: Boolean, default: false },
  },
  { _id: false }
);

const RoleSchema = new Schema<IRole>(
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
    slug: {
      type: String,
      trim: true,
      lowercase: true,
    },
    description: {
      type: String,
      default: "",
    },
    isSystem: {
      type: Boolean,
      default: false,
    },
    memberCount: {
      type: Number,
      default: 0,
    },
    permissions: {
      type: RolePermissionsSchema,
      required: true,
      default: () => ({
        canAccessEmail: true,
        canAccessPayroll: false,
        canAccessPos: false,
        canAccessLogistics: false,
        canAccessHotel: false,
        canAccessAdminConsole: false,
        canManageBilling: false,
        canManageUsers: false,
        canManageDomains: false,
      }),
    },
  },
  {
    timestamps: true,
  }
);

RoleSchema.index({ organizationId: 1, name: 1 }, { unique: true });

export const RoleModel = mongoose.model<IRole>("Role", RoleSchema);
