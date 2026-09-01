import { OrganizationModel, IOrganization } from "../../infrastructure/database/models/organization.model.js";
import { UserModel, IUser } from "../../infrastructure/database/models/user.model.js";
import { TokenManager } from "../../infrastructure/security/token.manager.js";
import { ResendEmailService, ResendDomainService } from "../../services/resend/index.js";

export interface UpdateOrganizationDto {
  name?: string;
  plan?: "tier1" | "tier2" | "tier3" | "enterprise";
  dailySendingLimit?: number;
}

export interface InviteMemberDto {
  name: string;
  email: string;
  personalEmail?: string;
  role?: "admin" | "user" | "support";
  phone?: string;
  password?: string;
}

export interface InvitedMemberResponse {
  user: IUser;
  temporaryPassword?: string;
}

export class OrganizationService {
  /**
   * Helper to derive DNS verification flags and dispatch email alerts on state transitions
   */
  private static async syncAndNotifyDnsStatus(org: IOrganization, prevStatus?: string): Promise<void> {
    const isDomainVerified = org.resendStatus === "verified";
    const spfRec = org.resendRecords?.find((r) => r.record === "SPF" || r.type === "TXT");
    const dkimRec = org.resendRecords?.find((r) => r.record === "DKIM");
    const mxRec = org.resendRecords?.find((r) => r.type === "MX");

    const prevWasVerified = prevStatus === "verified" || org.dnsVerification?.spfStatus === "verified";

    org.dnsVerification = {
      spfStatus: isDomainVerified || spfRec?.status === "verified" ? "verified" : (spfRec?.status as any) || "pending",
      dkimStatus: isDomainVerified || dkimRec?.status === "verified" ? "verified" : (dkimRec?.status as any) || "pending",
      dmarcStatus: "verified",
      mxStatus: isDomainVerified || mxRec?.status === "verified" ? "verified" : (mxRec?.status as any) || "pending",
      lastCheckedAt: new Date(),
    };

    // If previously verified and now disconnected
    if (prevWasVerified && !isDomainVerified && (spfRec?.status === "failed" || dkimRec?.status === "failed" || mxRec?.status === "failed")) {
      const disconnected: string[] = [];
      if (spfRec?.status !== "verified") disconnected.push("SPF Outbound Authorization");
      if (dkimRec?.status !== "verified") disconnected.push("DKIM Cryptographic Key");
      if (mxRec?.status !== "verified") disconnected.push("MX Mail Exchange Routing");

      UserModel.findById(org.ownerId).then((owner) => {
        if (owner?.email) {
          ResendEmailService.sendDnsDisconnectionAlertEmail(
            owner.email,
            owner.name,
            org.name,
            org.domain,
            disconnected
          ).catch((err) => console.error("⚠️ Failed to dispatch DNS disconnection email:", err));
        }
      });
    } else if (prevStatus && prevStatus !== "verified" && isDomainVerified) {
      // Newly verified domain
      UserModel.findById(org.ownerId).then((owner) => {
        if (owner?.email) {
          ResendEmailService.sendDnsConnectedConfirmationEmail(
            owner.email,
            owner.name,
            org.name,
            org.domain
          ).catch((err) => console.error("⚠️ Failed to dispatch DNS connected email:", err));
        }
      });
    }
  }

  static async getById(orgId: string): Promise<IOrganization | null> {
    const org = await OrganizationModel.findById(orgId);
    if (!org) return null;

    // 1. If org has domain but no resendRecords, auto-provision lazily
    if (org.domain && (!org.resendDomainId || !org.resendRecords || org.resendRecords.length === 0)) {
      try {
        const domResult = await ResendDomainService.findOrCreateDomain(org.domain);
        if (domResult.success && domResult.data) {
          org.resendDomainId = domResult.data.id;
          org.resendStatus = domResult.data.status;
          org.resendRegion = domResult.data.region || "us-east-1";
          org.resendRecords = domResult.data.records || [];
          await this.syncAndNotifyDnsStatus(org);
          await org.save();
        }
      } catch (err: any) {
        console.warn(`Could not auto-sync Resend domain for ${org.domain}:`, err.message);
      }
    } else if (org.resendDomainId) {
      // 2. Fetch live domain records from Resend API if not checked in the last 30 seconds
      const lastCheck = org.dnsVerification?.lastCheckedAt ? new Date(org.dnsVerification.lastCheckedAt).getTime() : 0;
      const shouldCheck = Date.now() - lastCheck > 30000;

      if (shouldCheck) {
        try {
          const prevStatus = org.resendStatus;
          const liveDom = await ResendDomainService.getDomain(org.resendDomainId);
          if (liveDom.success && liveDom.data) {
            org.resendStatus = liveDom.data.status;
            if (liveDom.data.records && liveDom.data.records.length > 0) {
              org.resendRecords = liveDom.data.records;
            }
            await this.syncAndNotifyDnsStatus(org, prevStatus);
            await org.save();
          }
        } catch (err: any) {
          console.warn(`Failed to poll live Resend domain status for ${org.domain}:`, err.message);
        }
      }
    }

    return org;
  }

  static async update(orgId: string, dto: UpdateOrganizationDto): Promise<IOrganization | null> {
    return OrganizationModel.findByIdAndUpdate(orgId, { $set: dto }, { new: true });
  }

  static async verifyDomainDns(orgId: string): Promise<IOrganization | null> {
    const org = await OrganizationModel.findById(orgId);
    if (!org) throw new Error("Organization not found");

    const prevStatus = org.resendStatus;

    // 1. If domain is not yet on Resend, provision it
    if (!org.resendDomainId) {
      const domResult = await ResendDomainService.findOrCreateDomain(org.domain);
      if (domResult.success && domResult.data) {
        org.resendDomainId = domResult.data.id;
        org.resendStatus = domResult.data.status;
        org.resendRegion = domResult.data.region || "us-east-1";
        org.resendRecords = domResult.data.records || [];
      }
    }

    // 2. Trigger verification with Resend API
    if (org.resendDomainId) {
      await ResendDomainService.verifyDomain(org.resendDomainId);
      const updatedDom = await ResendDomainService.getDomain(org.resendDomainId);

      if (updatedDom.success && updatedDom.data) {
        org.resendStatus = updatedDom.data.status;
        if (updatedDom.data.records && updatedDom.data.records.length > 0) {
          org.resendRecords = updatedDom.data.records;
        }
      }
    }

    // 3. Derive DNS verification statuses and send alerts if needed
    await this.syncAndNotifyDnsStatus(org, prevStatus);

    return org.save();
  }

  static async getMembers(orgId: string): Promise<IUser[]> {
    return UserModel.find({ organizationId: orgId }).sort({ createdAt: -1 });
  }

  /**
   * Provisions a new email user under the organization
   */
  static async inviteMember(orgId: string, dto: InviteMemberDto): Promise<InvitedMemberResponse> {
    const existing = await UserModel.findOne({ email: dto.email.toLowerCase() });
    if (existing) {
      throw new Error("A user with this email address already exists.");
    }

    const tempPassword = dto.password || `Nigerme@${Math.floor(100000 + Math.random() * 900000)}`;
    const passwordHash = await TokenManager.hashPassword(tempPassword);

    const user = await UserModel.create({
      name: dto.name,
      email: dto.email.toLowerCase(),
      personalEmail: dto.personalEmail ? dto.personalEmail.toLowerCase().trim() : undefined,
      passwordHash,
      phone: dto.phone,
      role: dto.role || "user",
      userType: "email_user",
      organizationId: orgId as any,
      status: "active",
      isEmailVerified: true,
      twoFactorEnabled: false,
      mustChangePassword: true,
      canAccessEmail: true,
      mailboxQuotaMb: 5120,
      mailboxUsedMb: 0,
    });

    // Asynchronously dispatch member invitation email with temporary password to personal email
    OrganizationModel.findById(orgId).then((org) => {
      if (org) {
        const destinationEmail = user.personalEmail || user.email;
        ResendEmailService.sendMemberInvitationEmail(
          destinationEmail,
          user.name,
          org.name,
          user.email,
          tempPassword
        ).catch((err) => console.error("⚠️ Failed to send member invitation email:", err));
      }
    });

    return {
      user,
      temporaryPassword: tempPassword,
    };
  }

  static async getUsageStats(orgId: string): Promise<{
    walletBalanceNaira: number;
    kycStatus: string;
    trustLevel: string;
    dailySendingLimit: number;
    memberCount: number;
  }> {
    const org = await OrganizationModel.findById(orgId);
    if (!org) throw new Error("Organization not found");

    const memberCount = await UserModel.countDocuments({ organizationId: orgId });

    return {
      walletBalanceNaira: org.walletBalance / 100,
      kycStatus: org.kycStatus,
      trustLevel: org.trustLevel,
      dailySendingLimit: org.dailySendingLimit,
      memberCount,
    };
  }
}
