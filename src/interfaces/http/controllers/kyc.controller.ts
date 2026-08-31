import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { KycService } from "../../../application/services/kyc.service.js";
import { AuditService } from "../../../application/services/audit.service.js";

export const submitKycSchema = z.object({
  idType: z.enum(["nin", "bvn", "drivers_license", "voters_card", "cac"]),
  idNumber: z.string().min(6, "ID number must be provided"),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  dateOfBirth: z.string().optional(),
  phoneNumber: z.string().optional(),
  idDocumentS3Key: z.string().optional(),
  idDocumentUrl: z.string().optional(),
  cacCertificateS3Key: z.string().optional(),
  cacCertificateUrl: z.string().optional(),
});

export const manualReviewSchema = z.object({
  recordId: z.string().min(1, "recordId is required"),
  status: z.enum(["verified", "failed", "manual_review"]),
  reason: z.string().optional(),
});

export class KycController {
  static async submitKyc(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const organizationId = req.user!.organizationId;

      const record = await KycService.submitAndVerify({
        ...req.body,
        userId,
        organizationId,
      });

      // Audit Log
      await AuditService.record({
        actorId: userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
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
    } catch (error) {
      next(error);
    }
  }

  static async getStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const record = await KycService.getKycStatus(userId);
      res.status(200).json({ success: true, data: record });
    } catch (error) {
      next(error);
    }
  }

  static async getOrganizationRecords(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const organizationId = req.user!.organizationId;
      if (!organizationId) {
        res.status(400).json({ success: false, error: { message: "No organization associated with user" } });
        return;
      }
      const records = await KycService.getOrganizationKycRecords(organizationId);
      res.status(200).json({ success: true, data: records });
    } catch (error) {
      next(error);
    }
  }

  static async manualReview(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { recordId, status, reason } = req.body;
      const record = await KycService.manualReview(recordId, status, reason);

      await AuditService.record({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: "KYC_MANUAL_REVIEW",
        targetResource: `kyc:${recordId}`,
        organizationId: req.user!.organizationId,
        details: `KYC status manually set to ${status}. Reason: ${reason || "N/A"}`,
      });

      res.status(200).json({ success: true, data: record });
    } catch (error) {
      next(error);
    }
  }
}
