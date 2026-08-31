"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuditController = void 0;
const audit_service_js_1 = require("../../../application/services/audit.service.js");
class AuditController {
    static async getLogs(req, res, next) {
        try {
            const organizationId = req.user.organizationId;
            const limit = req.query.limit ? parseInt(req.query.limit, 10) : 50;
            const logs = await audit_service_js_1.AuditService.getLogs(organizationId, limit);
            res.status(200).json({ success: true, data: logs });
        }
        catch (error) {
            next(error);
        }
    }
}
exports.AuditController = AuditController;
