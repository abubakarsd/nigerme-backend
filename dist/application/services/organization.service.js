"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrganizationService = void 0;
const organization_model_js_1 = require("../../infrastructure/database/models/organization.model.js");
const user_model_js_1 = require("../../infrastructure/database/models/user.model.js");
const role_model_js_1 = require("../../infrastructure/database/models/role.model.js");
const token_manager_js_1 = require("../../infrastructure/security/token.manager.js");
const index_js_1 = require("../../services/resend/index.js");
class OrganizationService {
    /**
     * Helper to derive DNS verification flags and dispatch email alerts on state transitions
     */
    static async syncAndNotifyDnsStatus(org, prevStatus) {
        const isDomainVerified = org.resendStatus === "verified";
        const spfRec = org.resendRecords?.find((r) => r.record === "SPF" || r.type === "TXT");
        const dkimRec = org.resendRecords?.find((r) => r.record === "DKIM");
        const mxRec = org.resendRecords?.find((r) => r.type === "MX");
        const prevWasVerified = prevStatus === "verified" || org.dnsVerification?.spfStatus === "verified";
        org.dnsVerification = {
            spfStatus: isDomainVerified || spfRec?.status === "verified" ? "verified" : spfRec?.status || "pending",
            dkimStatus: isDomainVerified || dkimRec?.status === "verified" ? "verified" : dkimRec?.status || "pending",
            dmarcStatus: "verified",
            mxStatus: isDomainVerified || mxRec?.status === "verified" ? "verified" : mxRec?.status || "pending",
            lastCheckedAt: new Date(),
        };
        // If previously verified and now disconnected
        if (prevWasVerified && !isDomainVerified && (spfRec?.status === "failed" || dkimRec?.status === "failed" || mxRec?.status === "failed")) {
            const disconnected = [];
            if (spfRec?.status !== "verified")
                disconnected.push("SPF Outbound Authorization");
            if (dkimRec?.status !== "verified")
                disconnected.push("DKIM Cryptographic Key");
            if (mxRec?.status !== "verified")
                disconnected.push("MX Mail Exchange Routing");
            user_model_js_1.UserModel.findById(org.ownerId).then((owner) => {
                if (owner?.email) {
                    index_js_1.ResendEmailService.sendDnsDisconnectionAlertEmail(owner.email, owner.name, org.name, org.domain, disconnected).catch((err) => console.error("⚠️ Failed to dispatch DNS disconnection email:", err));
                }
            });
        }
        else if (prevStatus && prevStatus !== "verified" && isDomainVerified) {
            // Newly verified domain
            user_model_js_1.UserModel.findById(org.ownerId).then((owner) => {
                if (owner?.email) {
                    index_js_1.ResendEmailService.sendDnsConnectedConfirmationEmail(owner.email, owner.name, org.name, org.domain).catch((err) => console.error("⚠️ Failed to dispatch DNS connected email:", err));
                }
            });
        }
    }
    static async getById(orgId) {
        const org = await organization_model_js_1.OrganizationModel.findById(orgId);
        if (!org)
            return null;
        // 1. If org has domain but no resendRecords, auto-provision lazily
        if (org.domain && (!org.resendDomainId || !org.resendRecords || org.resendRecords.length === 0)) {
            try {
                const domResult = await index_js_1.ResendDomainService.findOrCreateDomain(org.domain);
                if (domResult.success && domResult.data) {
                    org.resendDomainId = domResult.data.id;
                    org.resendStatus = domResult.data.status;
                    org.resendRegion = domResult.data.region || "us-east-1";
                    org.resendRecords = domResult.data.records || [];
                    await this.syncAndNotifyDnsStatus(org);
                    await org.save();
                }
            }
            catch (err) {
                console.warn(`Could not auto-sync Resend domain for ${org.domain}:`, err.message);
            }
        }
        else if (org.resendDomainId) {
            // 2. Fetch live domain records from Resend API if not checked in the last 30 seconds
            const lastCheck = org.dnsVerification?.lastCheckedAt ? new Date(org.dnsVerification.lastCheckedAt).getTime() : 0;
            const shouldCheck = Date.now() - lastCheck > 30000;
            if (shouldCheck) {
                try {
                    const prevStatus = org.resendStatus;
                    const liveDom = await index_js_1.ResendDomainService.getDomain(org.resendDomainId);
                    if (liveDom.success && liveDom.data) {
                        org.resendStatus = liveDom.data.status;
                        if (liveDom.data.records && liveDom.data.records.length > 0) {
                            org.resendRecords = liveDom.data.records;
                        }
                        await this.syncAndNotifyDnsStatus(org, prevStatus);
                        await org.save();
                    }
                }
                catch (err) {
                    console.warn(`Failed to poll live Resend domain status for ${org.domain}:`, err.message);
                }
            }
        }
        return org;
    }
    static async update(orgId, dto) {
        return organization_model_js_1.OrganizationModel.findByIdAndUpdate(orgId, { $set: dto }, { new: true });
    }
    static async verifyDomainDns(orgId) {
        const org = await organization_model_js_1.OrganizationModel.findById(orgId);
        if (!org)
            throw new Error("Organization not found");
        const prevStatus = org.resendStatus;
        // 1. If domain is not yet on Resend, provision it
        if (!org.resendDomainId) {
            const domResult = await index_js_1.ResendDomainService.findOrCreateDomain(org.domain);
            if (domResult.success && domResult.data) {
                org.resendDomainId = domResult.data.id;
                org.resendStatus = domResult.data.status;
                org.resendRegion = domResult.data.region || "us-east-1";
                org.resendRecords = domResult.data.records || [];
            }
        }
        // 2. Trigger verification with Resend API
        if (org.resendDomainId) {
            await index_js_1.ResendDomainService.verifyDomain(org.resendDomainId);
            const updatedDom = await index_js_1.ResendDomainService.getDomain(org.resendDomainId);
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
    static async getMembers(orgId) {
        return user_model_js_1.UserModel.find({ organizationId: orgId }).sort({ createdAt: -1 });
    }
    /**
     * Provisions a new email user under the organization
     */
    static async inviteMember(orgId, dto) {
        const existing = await user_model_js_1.UserModel.findOne({ email: dto.email.toLowerCase() });
        if (existing) {
            throw new Error("A user with this email address already exists.");
        }
        const tempPassword = dto.password || `Nigerme@${Math.floor(100000 + Math.random() * 900000)}`;
        const passwordHash = await token_manager_js_1.TokenManager.hashPassword(tempPassword);
        const user = await user_model_js_1.UserModel.create({
            name: dto.name,
            email: dto.email.toLowerCase(),
            personalEmail: dto.personalEmail ? dto.personalEmail.toLowerCase().trim() : undefined,
            passwordHash,
            phone: dto.phone,
            role: dto.role || "user",
            roleId: dto.roleId ? dto.roleId : undefined,
            department: dto.department?.trim(),
            departmentId: dto.departmentId?.trim(),
            userType: "email_user",
            organizationId: orgId,
            status: "active",
            isEmailVerified: true,
            twoFactorEnabled: false,
            mustChangePassword: true,
            canAccessEmail: true,
            mailboxQuotaMb: 5120,
            mailboxUsedMb: 0,
        });
        // Update role member count if roleId provided
        if (dto.roleId) {
            role_model_js_1.RoleModel.findByIdAndUpdate(dto.roleId, { $inc: { memberCount: 1 } }).catch((err) => console.warn("⚠️ Failed to increment role member count:", err));
        }
        // Update organization departments and dispatch invitation email
        organization_model_js_1.OrganizationModel.findById(orgId).then(async (org) => {
            if (org) {
                // If department is assigned, link user to department memberIds
                if (dto.departmentId || dto.department) {
                    const depts = org.departments || [];
                    const matchedDept = depts.find((d) => (dto.departmentId && d.id === dto.departmentId) ||
                        (dto.department && d.name?.toLowerCase() === dto.department.toLowerCase()));
                    if (matchedDept) {
                        matchedDept.memberIds = Array.from(new Set([...(matchedDept.memberIds || []), user._id.toString()]));
                        org.departments = depts;
                        org.markModified("departments");
                        await org.save().catch((err) => console.warn("⚠️ Failed to update department members:", err));
                    }
                }
                const destinationEmail = user.personalEmail || user.email;
                index_js_1.ResendEmailService.sendMemberInvitationEmail(destinationEmail, user.name, org.name, user.email, tempPassword).catch((err) => console.error("⚠️ Failed to send member invitation email:", err));
                // Provision welcome and rules email in the new member's sovereign mailbox
                index_js_1.ResendEmailService.provisionWelcomeEmailInMailbox(orgId, user._id, user.name, user.email, org.name, false).catch((err) => console.warn("⚠️ Welcome mailbox provisioning error:", err));
            }
        });
        return {
            user,
            temporaryPassword: tempPassword,
        };
    }
    static async getUsageStats(orgId) {
        const org = await organization_model_js_1.OrganizationModel.findById(orgId);
        if (!org)
            throw new Error("Organization not found");
        const memberCount = await user_model_js_1.UserModel.countDocuments({ organizationId: orgId });
        return {
            walletBalanceNaira: org.walletBalance / 100,
            kycStatus: org.kycStatus,
            trustLevel: org.trustLevel,
            dailySendingLimit: org.dailySendingLimit,
            memberCount,
        };
    }
}
exports.OrganizationService = OrganizationService;
