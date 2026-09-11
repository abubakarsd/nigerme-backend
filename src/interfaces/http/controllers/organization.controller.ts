import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { OrganizationService } from "../../../application/services/organization.service.js";
import { AuditService } from "../../../application/services/audit.service.js";
import { AwsS3Service } from "../../../services/aws/index.js";

export const updateOrgSchema = z.object({
  name: z.string().min(2).optional(),
  plan: z.enum(["tier1", "tier2", "tier3", "enterprise"]).optional(),
  dailySendingLimit: z.number().min(100).optional(),
  logoUrl: z.string().nullable().optional(),
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

  static async getBranding(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orgId = req.user!.organizationId;
      if (!orgId) {
        res.status(404).json({ success: false, error: { message: "No organization attached to account" } });
        return;
      }
      const org = await OrganizationService.getById(orgId);
      if (!org) {
        res.status(404).json({ success: false, error: { message: "Organization not found" } });
        return;
      }
      res.status(200).json({
        success: true,
        data: {
          name: org.name,
          domain: org.domain,
          logoUrl: org.logoUrl || null,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateLogo(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orgId = req.user!.organizationId;
      if (!orgId) {
        res.status(400).json({ success: false, error: { message: "Organization ID is required" } });
        return;
      }
      const role = req.user!.role;
      const userType = req.user!.userType;
      const isAdmin = userType === "saas_admin" || role === "admin" || role === "owner" || role === "superadmin";
      if (!isAdmin) {
        res.status(403).json({ success: false, error: { message: "Forbidden: Admin privileges required to update logo." } });
        return;
      }

      const { logoUrl } = req.body;
      if (!logoUrl || typeof logoUrl !== "string") {
        res.status(400).json({ success: false, error: { message: "Valid logoUrl is required" } });
        return;
      }

      const updated = await OrganizationService.update(orgId, { logoUrl });
      await AuditService.record({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: "ORGANIZATION_LOGO_UPDATED",
        targetResource: `org:${orgId}:logo`,
        organizationId: orgId,
        details: `Updated organization logo to ${logoUrl}`,
      });

      res.status(200).json({ success: true, data: updated });
    } catch (error) {
      next(error);
    }
  }

  static async deleteLogo(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orgId = req.user!.organizationId;
      if (!orgId) {
        res.status(400).json({ success: false, error: { message: "Organization ID is required" } });
        return;
      }
      const role = req.user!.role;
      const userType = req.user!.userType;
      const isAdmin = userType === "saas_admin" || role === "admin" || role === "owner" || role === "superadmin";
      if (!isAdmin) {
        res.status(403).json({ success: false, error: { message: "Forbidden: Admin privileges required to delete logo." } });
        return;
      }

      const org = await OrganizationService.getById(orgId);
      if (org?.logoUrl) {
        AwsS3Service.deleteFileByUrlOrKey(org.logoUrl).catch((err) =>
          console.warn("Could not delete S3 logo on removal:", err?.message || err)
        );
      }

      const updated = await OrganizationService.update(orgId, { logoUrl: null });
      await AuditService.record({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: "ORGANIZATION_LOGO_DELETED",
        targetResource: `org:${orgId}:logo`,
        organizationId: orgId,
        details: "Removed organization branding logo",
      });

      res.status(200).json({ success: true, data: updated });
    } catch (error) {
      next(error);
    }
  }
}
