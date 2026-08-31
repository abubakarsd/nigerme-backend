"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.KycController = exports.manualReviewSchema = exports.submitKycSchema = void 0;
const zod_1 = require("zod");
const kyc_service_js_1 = require("../../../application/services/kyc.service.js");
const audit_service_js_1 = require("../../../application/services/audit.service.js");
exports.submitKycSchema = zod_1.z.object({
    idType: zod_1.z.enum(["nin", "bvn", "drivers_license", "voters_card", "cac"]),
    idNumber: zod_1.z.string().min(6, "ID number must be provided"),
    firstName: zod_1.z.string().optional(),
    lastName: zod_1.z.string().optional(),
    dateOfBirth: zod_1.z.string().optional(),
    phoneNumber: zod_1.z.string().optional(),
    idDocumentS3Key: zod_1.z.string().optional(),
    idDocumentUrl: zod_1.z.string().optional(),
    cacCertificateS3Key: zod_1.z.string().optional(),
    cacCertificateUrl: zod_1.z.string().optional(),
});
exports.manualReviewSchema = zod_1.z.object({
    recordId: zod_1.z.string().min(1, "recordId is required"),
    status: zod_1.z.enum(["verified", "failed", "manual_review"]),
    reason: zod_1.z.string().optional(),
});
class KycController {
    static async submitKyc(req, res, next) {
        try {
            const userId = req.user.userId;
            const organizationId = req.user.organizationId;
            const record = await kyc_service_js_1.KycService.submitAndVerify({
                ...req.body,
                userId,
                organizationId,
            });
            // Audit Log
            await audit_service_js_1.AuditService.record({
                actorId: userId,
                actorEmail: req.user.email,
                actorRole: req.user.role,
                action: "KYC_SUBMITTED",
                targetResource: `kyc:${record._id}`,
                organizationId,
                details: `KYC submission for idType: ${req.body.idType}, status: ${record.verificationStatus}`,
            });
            res.status(200).json({
                success: true,
                data: {
                    id: record._id,
                    idType: record.idType,
                    maskedIdNumber: record.maskedIdNumber,
                    verificationStatus: record.verificationStatus,
                    verifiedAt: record.verifiedAt,
                    failureReason: record.failureReason,
                },
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async getStatus(req, res, next) {
        try {
            const userId = req.user.userId;
            const record = await kyc_service_js_1.KycService.getKycStatus(userId);
            res.status(200).json({ success: true, data: record });
        }
        catch (error) {
            next(error);
        }
    }
    static async getOrganizationRecords(req, res, next) {
        try {
            const organizationId = req.user.organizationId;
            if (!organizationId) {
                res.status(400).json({ success: false, error: { message: "No organization associated with user" } });
                return;
            }
            const records = await kyc_service_js_1.KycService.getOrganizationKycRecords(organizationId);
            res.status(200).json({ success: true, data: records });
        }
        catch (error) {
            next(error);
        }
    }
    static async manualReview(req, res, next) {
        try {
            const { recordId, status, reason } = req.body;
            const record = await kyc_service_js_1.KycService.manualReview(recordId, status, reason);
            await audit_service_js_1.AuditService.record({
                actorId: req.user.userId,
                actorEmail: req.user.email,
                actorRole: req.user.role,
                action: "KYC_MANUAL_REVIEW",
                targetResource: `kyc:${recordId}`,
                organizationId: req.user.organizationId,
                details: `KYC status manually set to ${status}. Reason: ${reason || "N/A"}`,
            });
            res.status(200).json({ success: true, data: record });
        }
        catch (error) {
            next(error);
        }
    }
}
exports.KycController = KycController;
