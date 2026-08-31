import { AuditLogModel, IAuditLog } from "../../infrastructure/database/models/audit-log.model.js";

export interface CreateAuditLogDto {
  actorId?: string;
  actorEmail: string;
  actorRole: string;
  action: string;
  targetResource: string;
  organizationId?: string;
  details?: string;
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

export class AuditService {
  static async record(dto: CreateAuditLogDto): Promise<IAuditLog> {
    return AuditLogModel.create({
      ...dto,
      actorId: dto.actorId as any,
      organizationId: dto.organizationId as any,
    });
  }

  static async getLogs(organizationId?: string, limit = 50): Promise<IAuditLog[]> {
    const filter = organizationId ? { organizationId } : {};
    return AuditLogModel.find(filter).sort({ createdAt: -1 }).limit(limit);
  }
}
