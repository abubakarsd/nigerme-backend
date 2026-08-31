"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuditService = void 0;
const audit_log_model_js_1 = require("../../infrastructure/database/models/audit-log.model.js");
class AuditService {
    static async record(dto) {
        return audit_log_model_js_1.AuditLogModel.create({
            ...dto,
            actorId: dto.actorId,
            organizationId: dto.organizationId,
        });
    }
    static async getLogs(organizationId, limit = 50) {
        const filter = organizationId ? { organizationId } : {};
        return audit_log_model_js_1.AuditLogModel.find(filter).sort({ createdAt: -1 }).limit(limit);
    }
}
exports.AuditService = AuditService;
