"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrganizationController = exports.inviteMemberSchema = exports.updateOrgSchema = void 0;
const zod_1 = require("zod");
const organization_service_js_1 = require("../../../application/services/organization.service.js");
const audit_service_js_1 = require("../../../application/services/audit.service.js");
exports.updateOrgSchema = zod_1.z.object({
    name: zod_1.z.string().min(2).optional(),
    plan: zod_1.z.enum(["tier1", "tier2", "tier3", "enterprise"]).optional(),
    dailySendingLimit: zod_1.z.number().min(100).optional(),
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
}
exports.OrganizationController = OrganizationController;
