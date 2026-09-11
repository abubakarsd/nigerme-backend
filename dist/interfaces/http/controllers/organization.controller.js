"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrganizationController = exports.inviteMemberSchema = exports.updateOrgSchema = void 0;
const zod_1 = require("zod");
const organization_service_js_1 = require("../../../application/services/organization.service.js");
const audit_service_js_1 = require("../../../application/services/audit.service.js");
const index_js_1 = require("../../../services/aws/index.js");
exports.updateOrgSchema = zod_1.z.object({
    name: zod_1.z.string().min(2).optional(),
    plan: zod_1.z.enum(["tier1", "tier2", "tier3", "enterprise"]).optional(),
    dailySendingLimit: zod_1.z.number().min(100).optional(),
    logoUrl: zod_1.z.string().nullable().optional(),
});
exports.inviteMemberSchema = zod_1.z.object({
    name: zod_1.z.string().min(2, "Name is required"),
    email: zod_1.z.string().email("Invalid email address"),
    role: zod_1.z.enum(["admin", "user", "support"]).default("user"),
    phone: zod_1.z.string().optional(),
});
class OrganizationController {
    static async getMyOrganization(req, res, next) {
        try {
            const orgId = req.user.organizationId;
            if (!orgId) {
                res.status(404).json({ success: false, error: { message: "No organization attached to account" } });
                return;
            }
            const org = await organization_service_js_1.OrganizationService.getById(orgId);
            res.status(200).json({ success: true, data: org });
        }
        catch (error) {
            next(error);
        }
    }
    static async updateOrganization(req, res, next) {
        try {
            const orgId = req.user.organizationId;
            if (!orgId) {
                res.status(400).json({ success: false, error: { message: "Organization ID is required" } });
                return;
            }
            const updated = await organization_service_js_1.OrganizationService.update(orgId, req.body);
            await audit_service_js_1.AuditService.record({
                actorId: req.user.userId,
                actorEmail: req.user.email,
                actorRole: req.user.role,
                action: "ORGANIZATION_UPDATED",
                targetResource: `org:${orgId}`,
                organizationId: orgId,
                details: `Updated organization settings: ${JSON.stringify(req.body)}`,
            });
            res.status(200).json({ success: true, data: updated });
        }
        catch (error) {
            next(error);
        }
    }
    static async verifyDns(req, res, next) {
        try {
            const orgId = req.user.organizationId;
            if (!orgId) {
                res.status(400).json({ success: false, error: { message: "Organization ID required" } });
                return;
            }
            const org = await organization_service_js_1.OrganizationService.verifyDomainDns(orgId);
            await audit_service_js_1.AuditService.record({
                actorId: req.user.userId,
                actorEmail: req.user.email,
                actorRole: req.user.role,
                action: "DNS_VERIFIED",
                targetResource: `org:${orgId}:dns`,
                organizationId: orgId,
                details: `Verified SPF, DKIM, DMARC, and MX DNS records for ${org?.domain}`,
            });
            res.status(200).json({ success: true, data: org });
        }
        catch (error) {
            next(error);
        }
    }
    static async getMembers(req, res, next) {
        try {
            const orgId = req.user.organizationId;
            if (!orgId) {
                res.status(400).json({ success: false, error: { message: "Organization ID required" } });
                return;
            }
            const members = await organization_service_js_1.OrganizationService.getMembers(orgId);
            res.status(200).json({ success: true, data: members });
        }
        catch (error) {
            next(error);
        }
    }
    static async inviteMember(req, res, next) {
        try {
            const orgId = req.user.organizationId;
            if (!orgId) {
                res.status(400).json({ success: false, error: { message: "Organization ID required" } });
                return;
            }
            const { user, temporaryPassword } = await organization_service_js_1.OrganizationService.inviteMember(orgId, req.body);
            await audit_service_js_1.AuditService.record({
                actorId: req.user.userId,
                actorEmail: req.user.email,
                actorRole: req.user.role,
                action: "MEMBER_INVITED",
                targetResource: `user:${user._id}`,
                organizationId: orgId,
                details: `Invited user ${user.email} with role ${user.role}`,
            });
            res.status(201).json({ success: true, data: { user, temporaryPassword } });
        }
        catch (error) {
            next(error);
        }
    }
    static async getUsageStats(req, res, next) {
        try {
            const orgId = req.user.organizationId;
            if (!orgId) {
                res.status(400).json({ success: false, error: { message: "Organization ID required" } });
                return;
            }
            const stats = await organization_service_js_1.OrganizationService.getUsageStats(orgId);
            res.status(200).json({ success: true, data: stats });
        }
        catch (error) {
            next(error);
        }
    }
    static async getBranding(req, res, next) {
        try {
            const orgId = req.user.organizationId;
            if (!orgId) {
                res.status(404).json({ success: false, error: { message: "No organization attached to account" } });
                return;
            }
            const org = await organization_service_js_1.OrganizationService.getById(orgId);
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
        }
        catch (error) {
            next(error);
        }
    }
    static async updateLogo(req, res, next) {
        try {
            const orgId = req.user.organizationId;
            if (!orgId) {
                res.status(400).json({ success: false, error: { message: "Organization ID is required" } });
                return;
            }
            const role = req.user.role;
            const userType = req.user.userType;
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
            const updated = await organization_service_js_1.OrganizationService.update(orgId, { logoUrl });
            await audit_service_js_1.AuditService.record({
                actorId: req.user.userId,
                actorEmail: req.user.email,
                actorRole: req.user.role,
                action: "ORGANIZATION_LOGO_UPDATED",
                targetResource: `org:${orgId}:logo`,
                organizationId: orgId,
                details: `Updated organization logo to ${logoUrl}`,
            });
            res.status(200).json({ success: true, data: updated });
        }
        catch (error) {
            next(error);
        }
    }
    static async deleteLogo(req, res, next) {
        try {
            const orgId = req.user.organizationId;
            if (!orgId) {
                res.status(400).json({ success: false, error: { message: "Organization ID is required" } });
                return;
            }
            const role = req.user.role;
            const userType = req.user.userType;
            const isAdmin = userType === "saas_admin" || role === "admin" || role === "owner" || role === "superadmin";
            if (!isAdmin) {
                res.status(403).json({ success: false, error: { message: "Forbidden: Admin privileges required to delete logo." } });
                return;
            }
            const org = await organization_service_js_1.OrganizationService.getById(orgId);
            if (org?.logoUrl) {
                index_js_1.AwsS3Service.deleteFileByUrlOrKey(org.logoUrl).catch((err) => console.warn("Could not delete S3 logo on removal:", err?.message || err));
            }
            const updated = await organization_service_js_1.OrganizationService.update(orgId, { logoUrl: null });
            await audit_service_js_1.AuditService.record({
                actorId: req.user.userId,
                actorEmail: req.user.email,
                actorRole: req.user.role,
                action: "ORGANIZATION_LOGO_DELETED",
                targetResource: `org:${orgId}:logo`,
                organizationId: orgId,
                details: "Removed organization branding logo",
            });
            res.status(200).json({ success: true, data: updated });
        }
        catch (error) {
            next(error);
        }
    }
}
exports.OrganizationController = OrganizationController;
