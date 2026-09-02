import mongoose, { Schema, Document } from "mongoose";

export interface IPasskey extends Document {
  userId: mongoose.Types.ObjectId;
  organizationId: mongoose.Types.ObjectId;
  credentialId: string;
  publicKey: string; // Base64 string of the credential public key
  counter: number;
  deviceType: "singleDevice" | "multiDevice";
  backedUp: boolean;
  transports: string[];
  friendlyName: string;
  currentChallenge?: string;
  createdAt: Date;
  updatedAt: Date;
  lastUsedAt?: Date;
}

const PasskeySchema = new Schema<IPasskey>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    credentialId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    publicKey: {
      type: String,
      required: true,
    },
    counter: {
      type: Number,
      default: 0,
    },
    deviceType: {
      type: String,
      enum: ["singleDevice", "multiDevice"],
      default: "multiDevice",
    },
    backedUp: {
      type: Boolean,
      default: false,
    },
    transports: {
      type: [String],
      default: ["internal", "hybrid"],
    },
    friendlyName: {
      type: String,
      default: "Phone / Security Key",
    },
    currentChallenge: {
      type: String,
    },
    lastUsedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

PasskeySchema.index({ userId: 1, createdAt: -1 });

export const PasskeyModel = mongoose.model<IPasskey>("Passkey", PasskeySchema);
