"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AbuseService = void 0;
const abuse_model_js_1 = require("../../infrastructure/database/models/abuse.model.js");
const organization_model_js_1 = require("../../infrastructure/database/models/organization.model.js");
class AbuseService {
    static async listCases(organizationId) {
        const filter = organizationId ? { organizationId } : {};
        return abuse_model_js_1.AbuseCaseModel.find(filter).sort({ createdAt: -1 });
    }
    static async reportCase(data) {
        const org = await organization_model_js_1.OrganizationModel.findById(data.organizationId);
        const orgName = org ? org.name : "Unknown Organization";
        return abuse_model_js_1.AbuseCaseModel.create({
            organizationId: data.organizationId,
            organizationName: orgName,
            targetDomain: data.targetDomain,
            senderEmail: data.senderEmail,
            riskLevel: data.riskLevel,
            triggerReason: data.triggerReason,
            sendingVelocityHourly: data.sendingVelocityHourly || 0,
            bounceRatePercent: data.bounceRatePercent || 0,
            status: "UNDER_REVIEW",
            details: data.details,
        });
    }
    static async updateCaseStatus(caseId, status, details) {
        const update = { status };
        if (details)
            update.details = details;
        return abuse_model_js_1.AbuseCaseModel.findByIdAndUpdate(caseId, { $set: update }, { new: true });
    }
}
exports.AbuseService = AbuseService;
