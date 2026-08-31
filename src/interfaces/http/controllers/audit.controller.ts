import { Request, Response, NextFunction } from "express";
import { AuditService } from "../../../application/services/audit.service.js";

export class AuditController {
  static async getLogs(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const organizationId = req.user!.organizationId;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;

      const logs = await AuditService.getLogs(organizationId, limit);
      res.status(200).json({ success: true, data: logs });
    } catch (error) {
      next(error);
    }
  }
}
