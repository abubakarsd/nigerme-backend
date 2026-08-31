"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AbuseController = exports.updateCaseSchema = exports.reportAbuseSchema = void 0;
const zod_1 = require("zod");
const abuse_service_js_1 = require("../../../application/services/abuse.service.js");
const audit_service_js_1 = require("../../../application/services/audit.service.js");
exports.reportAbuseSchema = zod_1.z.object({
    targetDomain: zod_1.z.string().min(1),
    senderEmail: zod_1.z.string().email(),
    riskLevel: zod_1.z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).default("LOW"),
    triggerReason: zod_1.z.string().min(1),
    sendingVelocityHourly: zod_1.z.number().optional(),
    bounceRatePercent: zod_1.z.number().optional(),
    details: zod_1.z.string().optional(),
});
exports.updateCaseSchema = zod_1.z.object({
    caseId: zod_1.z.string().min(1),
    status: zod_1.z.enum(["UNDER_REVIEW", "QUARANTINED", "CLEARED", "SUSPENDED"]),
    details: zod_1.z.string().optional(),
});
class AbuseController {
    static async getCases(req, res, next) {
        try {
            const organizationId = req.user.organizationId;
            const cases = await abuse_service_js_1.AbuseService.listCases(organizationId);
            res.status(200).json({ success: true, data: cases });
        }
        catch (error) {
            next(error);
        }
    }
    static async reportCase(req, res, next) {
        try {
            const organizationId = req.user.organizationId;
            const abuseCase = await abuse_service_js_1.AbuseService.reportCase({
                ...req.body,
                organizationId,
            });
            res.status(201).json({ success: true, data: abuseCase });
        }
        catch (error) {
            next(error);
        }
    }
    static async updateStatus(req, res, next) {
        try {
            const { caseId, status, details } = req.body;
            const updated = await abuse_service_js_1.AbuseService.updateCaseStatus(caseId, status, details);
            await audit_service_js_1.AuditService.record({
                actorId: req.user.userId,
                actorEmail: req.user.email,
                actorRole: req.user.role,
                action: "SECURITY_CASE_UPDATED",
                targetResource: `abuse:${caseId}`,
                organizationId: req.user.organizationId,
                details: `Security incident status changed to ${status}. Details: ${details || "N/A"}`,
            });
            res.status(200).json({ success: true, data: updated });
        }
        catch (error) {
            next(error);
        }
    }
}
exports.AbuseController = AbuseController;
