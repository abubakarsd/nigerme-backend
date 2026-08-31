import mongoose, { Schema, Document } from "mongoose";
import { encryptData, decryptData, maskIdentifier } from "../../security/encryption.js";

export interface IKycRecord extends Document {
  userId: mongoose.Types.ObjectId;
  organizationId?: mongoose.Types.ObjectId;
  idType: "nin" | "bvn" | "drivers_license" | "voters_card" | "cac";
  encryptedIdNumber: {
    encryptedText: string;
    iv: string;
    authTag: string;
  };
  maskedIdNumber: string;
  idDocumentS3Key?: string;
  idDocumentUrl?: string;
  utilityBillS3Key?: string;
  utilityBillUrl?: string;
  cacCertificateS3Key?: string;
  cacCertificateUrl?: string;
  verificationStatus: "pending" | "verified" | "failed" | "manual_review";
  provnReferenceId?: string;
  provnPayloadSnapshot?: any;
  failureReason?: string;
  verifiedAt?: Date;
  createdAt: Date;
  updatedAt: Date;

  // Helper methods
  getDecryptedIdNumber(): string;
}

const KycRecordSchema = new Schema<IKycRecord>(
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
      index: true,
    },
    idType: {
      type: String,
      enum: ["nin", "bvn", "drivers_license", "voters_card", "cac"],
      required: true,
    },
    encryptedIdNumber: {
      encryptedText: { type: String, required: true },
      iv: { type: String, required: true },
      authTag: { type: String, required: true },
    },
    maskedIdNumber: {
      type: String,
      required: true,
    },
    idDocumentS3Key: String,
    idDocumentUrl: String,
    utilityBillS3Key: String,
    utilityBillUrl: String,
    cacCertificateS3Key: String,
    cacCertificateUrl: String,
    verificationStatus: {
      type: String,
      enum: ["pending", "verified", "failed", "manual_review"],
      default: "pending",
      index: true,
    },
    provnReferenceId: {
      type: String,
      index: true,
    },
    provnPayloadSnapshot: {
      type: Schema.Types.Mixed,
      select: false, // Never return raw KYC snapshot in API output
    },
    failureReason: String,
    verifiedAt: Date,
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_, ret) => {
        delete (ret as any).encryptedIdNumber;
        delete (ret as any).provnPayloadSnapshot;
        delete (ret as any).__v;
        return ret;
      },
    },
  }
);

KycRecordSchema.methods.getDecryptedIdNumber = function (): string {
  return decryptData(this.encryptedIdNumber);
};

export const KycRecordModel = mongoose.model<IKycRecord>("KycRecord", KycRecordSchema);
