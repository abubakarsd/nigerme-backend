import { KycRecordModel, IKycRecord } from "../../infrastructure/database/models/kyc.model.js";
import { OrganizationModel } from "../../infrastructure/database/models/organization.model.js";
import { ProvnClient } from "../../infrastructure/external/provn.client.js";
import { encryptData, maskIdentifier } from "../../infrastructure/security/encryption.js";

export interface SubmitKycDto {
  userId: string;
  organizationId?: string;
  idType: "nin" | "bvn" | "drivers_license" | "voters_card" | "cac";
  idNumber: string;
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
  phoneNumber?: string;
  idDocumentS3Key?: string;
  idDocumentUrl?: string;
  cacCertificateS3Key?: string;
  cacCertificateUrl?: string;
}

export class KycService {
  static verifyAndRecordKyc = KycService.submitAndVerify;

  /**
   * Submits and verifies KYC identity with Provn API, encrypting sensitive identifiers before DB persistence
   */
  static async submitAndVerify(dto: SubmitKycDto): Promise<IKycRecord> {
    // 1. Verify with Provn API
    const provnResult = await ProvnClient.verifyIdentity({
      idType: dto.idType,
      idNumber: dto.idNumber,
      firstName: dto.firstName,
      lastName: dto.lastName,
      dateOfBirth: dto.dateOfBirth,
      phoneNumber: dto.phoneNumber,
    });

    const isVerified = provnResult.status === "verified";

    // 2. Encrypt the raw ID number using AES-256-GCM
    const encryptedIdNumber = encryptData(dto.idNumber);
    const maskedIdNumber = maskIdentifier(dto.idNumber);

    // 3. Save KYC record to MongoDB
    const kycRecord = await KycRecordModel.create({
      userId: dto.userId,
      organizationId: dto.organizationId,
      idType: dto.idType,
      encryptedIdNumber,
      maskedIdNumber,
      idDocumentS3Key: dto.idDocumentS3Key,
      idDocumentUrl: dto.idDocumentUrl,
      cacCertificateS3Key: dto.cacCertificateS3Key,
      cacCertificateUrl: dto.cacCertificateUrl,
      verificationStatus: isVerified ? "verified" : "failed",
      provnReferenceId: provnResult.referenceId,
      provnPayloadSnapshot: provnResult.rawResponse,
      failureReason: isVerified ? undefined : provnResult.message || "Identity verification failed",
      verifiedAt: isVerified ? new Date() : undefined,
    });

    // 4. Update Organization KYC status & trust tier
    if (dto.organizationId && isVerified) {
      await OrganizationModel.findByIdAndUpdate(dto.organizationId, {
        kycStatus: "verified",
        trustLevel: "Tier 2 Sovereign",
        dailySendingLimit: 10000,
      });
    }

    return kycRecord;
  }

  /**
   * Gets KYC status for an organization or user
   */
  static async getKycStatus(userId: string): Promise<IKycRecord | null> {
    return KycRecordModel.findOne({ userId }).sort({ createdAt: -1 });
  }

  /**
   * Gets all KYC records for an organization (compliance review)
   */
  static async getOrganizationKycRecords(organizationId: string): Promise<IKycRecord[]> {
    return KycRecordModel.find({ organizationId }).sort({ createdAt: -1 });
  }

  /**
   * Manual override / review approval for administrative compliance
   */
  static async manualReview(
    recordId: string,
    status: "verified" | "failed" | "manual_review",
    reason?: string
  ): Promise<IKycRecord | null> {
    const record = await KycRecordModel.findById(recordId);
    if (!record) throw new Error("KYC record not found");

    record.verificationStatus = status;
    if (status === "verified") {
      record.verifiedAt = new Date();
      record.failureReason = undefined;

      if (record.organizationId) {
        await OrganizationModel.findByIdAndUpdate(record.organizationId, {
          kycStatus: "verified",
          trustLevel: "Tier 2 Sovereign",
          dailySendingLimit: 10000,
        });
      }
    } else if (status === "failed") {
      record.failureReason = reason || "Manual review rejected verification";
    }

    return record.save();
  }
}
