import { AbuseCaseModel, IAbuseCase } from "../../infrastructure/database/models/abuse.model.js";
import { OrganizationModel } from "../../infrastructure/database/models/organization.model.js";

export class AbuseService {
  static async listCases(organizationId?: string): Promise<IAbuseCase[]> {
    const filter = organizationId ? { organizationId } : {};
    return AbuseCaseModel.find(filter).sort({ createdAt: -1 });
  }

  static async reportCase(data: {
    organizationId: string;
    targetDomain: string;
    senderEmail: string;
    riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
    triggerReason: string;
    sendingVelocityHourly?: number;
    bounceRatePercent?: number;
    details?: string;
  }): Promise<IAbuseCase> {
    const org = await OrganizationModel.findById(data.organizationId);
    const orgName = org ? org.name : "Unknown Organization";

    return AbuseCaseModel.create({
      organizationId: data.organizationId as any,
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

  static async updateCaseStatus(
    caseId: string,
    status: "UNDER_REVIEW" | "QUARANTINED" | "CLEARED" | "SUSPENDED",
    details?: string
  ): Promise<IAbuseCase | null> {
    const update: any = { status };
    if (details) update.details = details;
    return AbuseCaseModel.findByIdAndUpdate(caseId, { $set: update }, { new: true });
  }
}
