"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.KycService = void 0;
const kyc_model_js_1 = require("../../infrastructure/database/models/kyc.model.js");
const organization_model_js_1 = require("../../infrastructure/database/models/organization.model.js");
const provn_client_js_1 = require("../../infrastructure/external/provn.client.js");
const encryption_js_1 = require("../../infrastructure/security/encryption.js");
class KycService {
    static verifyAndRecordKyc = KycService.submitAndVerify;
    /**
     * Submits and verifies KYC identity with Provn API, encrypting sensitive identifiers before DB persistence
     */
    static async submitAndVerify(dto) {
        // 1. Verify with Provn API
        const provnResult = await provn_client_js_1.ProvnClient.verifyIdentity({
            idType: dto.idType,
            idNumber: dto.idNumber,
            firstName: dto.firstName,
            lastName: dto.lastName,
            dateOfBirth: dto.dateOfBirth,
            phoneNumber: dto.phoneNumber,
        });
        const isVerified = provnResult.status === "verified";
        // 2. Encrypt the raw ID number using AES-256-GCM
        const encryptedIdNumber = (0, encryption_js_1.encryptData)(dto.idNumber);
        const maskedIdNumber = (0, encryption_js_1.maskIdentifier)(dto.idNumber);
        // 3. Save KYC record to MongoDB
        const kycRecord = await kyc_model_js_1.KycRecordModel.create({
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
            await organization_model_js_1.OrganizationModel.findByIdAndUpdate(dto.organizationId, {
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
    static async getKycStatus(userId) {
        return kyc_model_js_1.KycRecordModel.findOne({ userId }).sort({ createdAt: -1 });
    }
    /**
     * Gets all KYC records for an organization (compliance review)
     */
    static async getOrganizationKycRecords(organizationId) {
        return kyc_model_js_1.KycRecordModel.find({ organizationId }).sort({ createdAt: -1 });
    }
    /**
     * Manual override / review approval for administrative compliance
     */
    static async manualReview(recordId, status, reason) {
        const record = await kyc_model_js_1.KycRecordModel.findById(recordId);
        if (!record)
            throw new Error("KYC record not found");
        record.verificationStatus = status;
        if (status === "verified") {
            record.verifiedAt = new Date();
            record.failureReason = undefined;
            if (record.organizationId) {
                await organization_model_js_1.OrganizationModel.findByIdAndUpdate(record.organizationId, {
                    kycStatus: "verified",
                    trustLevel: "Tier 2 Sovereign",
                    dailySendingLimit: 10000,
                });
            }
        }
        else if (status === "failed") {
            record.failureReason = reason || "Manual review rejected verification";
        }
        return record.save();
    }
}
exports.KycService = KycService;
