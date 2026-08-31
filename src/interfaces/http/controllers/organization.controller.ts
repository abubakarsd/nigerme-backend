import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { OrganizationService } from "../../../application/services/organization.service.js";
import { AuditService } from "../../../application/services/audit.service.js";

export const updateOrgSchema = z.object({
  name: z.string().min(2).optional(),
  plan: z.enum(["tier1", "tier2", "tier3", "enterprise"]).optional(),
  dailySendingLimit: z.number().min(100).optional(),
});

export const inviteMemberSchema = z.object({
  name: z.string().min(2, "Name is required"),
  email: z.string().email("Invalid email address"),
  role: z.enum(["admin", "user", "support"]).default("user"),
  phone: z.string().optional(),
});

export class OrganizationController {
  static async getMyOrganization(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orgId = req.user!.organizationId;
      if (!orgId) {
        res.status(404).json({ success: false, error: { message: "No organization attached to account" } });
        return;
      }

      const org = await OrganizationService.getById(orgId);
      res.status(200).json({ success: true, data: org });
    } catch (error) {
      next(error);
    }
  }

  static async updateOrganization(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orgId = req.user!.organizationId;
      if (!orgId) {
        res.status(400).json({ success: false, error: { message: "Organization ID is required" } });
        return;
      }

      const updated = await OrganizationService.update(orgId, req.body);

      await AuditService.record({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: "ORGANIZATION_UPDATED",
        targetResource: `org:${orgId}`,
        organizationId: orgId,
        details: `Updated organization settings: ${JSON.stringify(req.body)}`,
      });

      res.status(200).json({ success: true, data: updated });
    } catch (error) {
      next(error);
    }
  }

  static async verifyDns(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orgId = req.user!.organizationId;
      if (!orgId) {
        res.status(400).json({ success: false, error: { message: "Organization ID required" } });
        return;
      }

      const org = await OrganizationService.verifyDomainDns(orgId);

      await AuditService.record({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: "DNS_VERIFIED",
        targetResource: `org:${orgId}:dns`,
        organizationId: orgId,
        details: `Verified SPF, DKIM, DMARC, and MX DNS records for ${org?.domain}`,
      });

      res.status(200).json({ success: true, data: org });
    } catch (error) {
      next(error);
    }
  }

  static async getMembers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orgId = req.user!.organizationId;
      if (!orgId) {
        res.status(400).json({ success: false, error: { message: "Organization ID required" } });
        return;
      }

      const members = await OrganizationService.getMembers(orgId);
      res.status(200).json({ success: true, data: members });
    } catch (error) {
      next(error);
    }
  }

  static async inviteMember(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orgId = req.user!.organizationId;
      if (!orgId) {
        res.status(400).json({ success: false, error: { message: "Organization ID required" } });
        return;
      }

      const { user, temporaryPassword } = await OrganizationService.inviteMember(orgId, req.body);

      await AuditService.record({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: "MEMBER_INVITED",
        targetResource: `user:${user._id}`,
        organizationId: orgId,
        details: `Invited user ${user.email} with role ${user.role}`,
      });

      res.status(201).json({ success: true, data: { user, temporaryPassword } });
    } catch (error) {
      next(error);
    }
  }

  static async getUsageStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orgId = req.user!.organizationId;
      if (!orgId) {
        res.status(400).json({ success: false, error: { message: "Organization ID required" } });
        return;
      }

      const stats = await OrganizationService.getUsageStats(orgId);
      res.status(200).json({ success: true, data: stats });
    } catch (error) {
      next(error);
    }
  }
}
