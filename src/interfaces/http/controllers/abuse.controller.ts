import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { AbuseService } from "../../../application/services/abuse.service.js";
import { AuditService } from "../../../application/services/audit.service.js";

export const reportAbuseSchema = z.object({
  targetDomain: z.string().min(1),
  senderEmail: z.string().email(),
  riskLevel: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).default("LOW"),
  triggerReason: z.string().min(1),
  sendingVelocityHourly: z.number().optional(),
  bounceRatePercent: z.number().optional(),
  details: z.string().optional(),
});

export const updateCaseSchema = z.object({
  caseId: z.string().min(1),
  status: z.enum(["UNDER_REVIEW", "QUARANTINED", "CLEARED", "SUSPENDED"]),
  details: z.string().optional(),
});

export class AbuseController {
  static async getCases(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const organizationId = req.user!.organizationId;
      const cases = await AbuseService.listCases(organizationId);
      res.status(200).json({ success: true, data: cases });
    } catch (error) {
      next(error);
    }
  }

  static async reportCase(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const organizationId = req.user!.organizationId!;
      const abuseCase = await AbuseService.reportCase({
        ...req.body,
        organizationId,
      });

      res.status(201).json({ success: true, data: abuseCase });
    } catch (error) {
      next(error);
    }
  }

  static async updateStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { caseId, status, details } = req.body;
      const updated = await AbuseService.updateCaseStatus(caseId, status, details);

      await AuditService.record({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: "SECURITY_CASE_UPDATED",
        targetResource: `abuse:${caseId}`,
        organizationId: req.user!.organizationId,
        details: `Security incident status changed to ${status}. Details: ${details || "N/A"}`,
      });

      res.status(200).json({ success: true, data: updated });
    } catch (error) {
      next(error);
    }
  }
}
