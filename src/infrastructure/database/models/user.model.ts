import mongoose, { Schema, Document } from "mongoose";

export interface IUser extends Document {
  email: string;
  passwordHash: string;
  name: string;
  phone?: string;
  role: "superadmin" | "admin" | "user" | "support";
  userType: "saas_admin" | "email_user";
  organizationId?: mongoose.Types.ObjectId;
  isEmailVerified: boolean;
  isPhoneVerified: boolean;
  twoFactorEnabled: boolean;
  twoFactorSecret?: string;
  mustChangePassword?: boolean;
  canAccessEmail: boolean;
  mailboxQuotaMb: number;
  mailboxUsedMb: number;
  avatarUrl?: string;
  status: "active" | "suspended" | "pending";
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    passwordHash: {
      type: String,
      required: true,
      select: false, // Never return password hash in regular queries
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
      index: true,
    },
    role: {
      type: String,
      enum: ["superadmin", "admin", "user", "support"],
      default: "user",
      index: true,
    },
    userType: {
      type: String,
      enum: ["saas_admin", "email_user"],
      default: "email_user",
      index: true,
    },
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      index: true,
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    isPhoneVerified: {
      type: Boolean,
      default: false,
    },
    twoFactorEnabled: {
      type: Boolean,
      default: false,
    },
    twoFactorSecret: {
      type: String,
      select: false,
    },
    mustChangePassword: {
      type: Boolean,
      default: false,
    },
    canAccessEmail: {
      type: Boolean,
      default: true,
    },
    mailboxQuotaMb: {
      type: Number,
      default: 5120, // 5GB default mailbox quota
    },
    mailboxUsedMb: {
      type: Number,
      default: 0,
    },
    avatarUrl: {
      type: String,
    },
    status: {
      type: String,
      enum: ["active", "suspended", "pending"],
      default: "active",
      index: true,
    },
    lastLoginAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_, ret) => {
        delete (ret as any).passwordHash;
        delete (ret as any).twoFactorSecret;
        delete (ret as any).__v;
        return ret;
      },
    },
  }
);

export const UserModel = mongoose.model<IUser>("User", UserSchema);
