import { GraphQLContext, requireAuth } from "./context.js";
import { AuthService } from "../services/auth/index.js";
import { TermiiOtpService } from "../services/termii/index.js";
import { ProvnKycService } from "../services/provn/index.js";
import { AwsS3Service } from "../services/aws/index.js";
import { PaystackService } from "../services/paystack/index.js";
import { ResendEmailService, ResendDomainService } from "../services/resend/index.js";
import { OrganizationService } from "../application/services/organization.service.js";
import { AuditService } from "../application/services/audit.service.js";
import { AbuseService } from "../application/services/abuse.service.js";
import { PackageService } from "../application/services/package.service.js";
import { UserModel, OrganizationModel, TransactionModel, KycRecordModel, SubscriptionModel, RoleModel, PermissionModel, EmailModel, CalendarEventModel } from "../models/index.js";
import { TokenManager } from "../infrastructure/security/token.manager.js";
import { OtpService } from "../application/services/otp.service.js";
import { INITIAL_PACKAGES } from "../infrastructure/database/seeds/package.seed.js";
import { seedPermissions } from "../infrastructure/database/seeds/permission.seed.js";
import { seedOrganizationDefaultRoles, seedOrganizationDefaultDepartments } from "../infrastructure/database/seeds/role.seed.js";

async function formatUserWithPermissions(userDoc: any) {
  if (!userDoc) return null;
  const user = userDoc.toObject ? userDoc.toObject() : userDoc;
  
  let roleName = user.role || "Standard Team Member";
  let canAccessPayroll = false;
  let canAccessPos = false;
  let canAccessLogistics = false;
  let canAccessHotel = false;
  let canAccessAdminConsole = user.role === "admin" || user.userType === "saas_admin" || user.role === "owner";
  let accessiblePackages = ["org-email"];

  // 1. If SaaS Admin or Org Owner
  if (user.userType === "saas_admin" || user.role === "admin" || user.role === "owner") {
    canAccessPayroll = true;
    canAccessPos = true;
    canAccessLogistics = true;
    canAccessHotel = true;
    canAccessAdminConsole = true;
    accessiblePackages = ["org-email", "org-pos", "org-payroll", "org-logistics", "org-hotel"];
  } else {
    // 2. Lookup assigned RoleModel if roleId or slug exists
    let role = null;
    if (user.roleId) {
      role = await RoleModel.findById(user.roleId);
    } else if (user.organizationId && user.role) {
      role = await RoleModel.findOne({ organizationId: user.organizationId, slug: user.role.toLowerCase() });
    }

    if (role) {
      roleName = role.name;
      canAccessPayroll = !!role.permissions?.canAccessPayroll;
      canAccessPos = !!role.permissions?.canAccessPos;
      canAccessLogistics = !!role.permissions?.canAccessLogistics;
      canAccessHotel = !!role.permissions?.canAccessHotel;
      canAccessAdminConsole = !!role.permissions?.canAccessAdminConsole;
    }

    // 3. Lookup department in organization for role name override
    if (user.organizationId && (user.departmentId || user.department)) {
      const org = await OrganizationModel.findById(user.organizationId);
      if (org && org.departments) {
        const dept = org.departments.find(
          (d: any) =>
            (user.departmentId && d.id === user.departmentId) ||
            (user.department && d.name?.toLowerCase() === user.department?.toLowerCase())
        );
        if (dept) {
          if (dept.roleName && !role) roleName = dept.roleName;
        }
      }
    }

    const pkgs = new Set<string>(["org-email"]);
    if (canAccessPos) pkgs.add("org-pos");
    if (canAccessPayroll) pkgs.add("org-payroll");
    if (canAccessLogistics) pkgs.add("org-logistics");
    if (canAccessHotel) pkgs.add("org-hotel");
    accessiblePackages = Array.from(pkgs);
  }

  return {
    ...user,
    id: user._id?.toString() || user.id,
    roleId: user.roleId?.toString() || null,
    roleName,
    department: user.department || null,
    departmentId: user.departmentId || null,
    canAccessEmail: user.canAccessEmail ?? true,
    canAccessPayroll,
    canAccessPos,
    canAccessLogistics,
    canAccessHotel,
    canAccessAdminConsole,
    accessiblePackages,
  };
}

export const resolvers = {
  Query: {
    healthCheck: () => "Nigerme Sovereign GraphQL Backend is operational.",

    me: async (_: any, __: any, context: GraphQLContext) => {
      const authUser = requireAuth(context);
      const user = await UserModel.findById(authUser.userId);
      if (!user) throw new Error("User not found.");
      return formatUserWithPermissions(user);
    },

    myOrganization: async (_: any, __: any, context: GraphQLContext) => {
      const authUser = requireAuth(context);
      if (!authUser.organizationId) return null;
      let org = await OrganizationService.getById(authUser.organizationId);
      if (!org) return null;

      if (!org.dedicatedVirtualAccount || !org.dedicatedVirtualAccount.accountNumber) {
        org.dedicatedVirtualAccount = {
          accountNumber: "0294819284",
          accountName: `Nigerme / ${org.name}`,
          bankName: "Wema Bank Plc (Sovereign NIBSS)",
          assignedAt: new Date(),
        };
        await org.save();
      }

      let needsSave = false;
      if (!org.subscribedPackages || org.subscribedPackages.length === 0) {
        org.subscribedPackages = ["org-email"];
        needsSave = true;
      }
      if (!org.subscriptionStatus) {
        org.subscriptionStatus = "TRIAL";
        needsSave = true;
      }
      if (!org.trialStartsAt) {
        org.trialStartsAt = org.createdAt || new Date();
        needsSave = true;
      }
      if (!org.trialEndsAt) {
        org.trialEndsAt = new Date(new Date(org.trialStartsAt).getTime() + 7 * 24 * 60 * 60 * 1000);
        needsSave = true;
      }
      if (needsSave) {
        await org.save();
      }

      let cleanPhone = org.phone && org.phone !== "+234 800 NIGERME" ? org.phone : "";
      if (!cleanPhone && authUser.userId) {
        const user = await UserModel.findById(authUser.userId);
        if (user?.phone) cleanPhone = user.phone;
      }

      const orgObj = org.toObject();
      return {
        ...orgObj,
        id: org._id.toString(),
        phone: cleanPhone,
        walletBalance: org.walletBalance / 100, // Return in Naira
        departments: (org.departments || []).map((d: any) => ({
          ...d,
          id: d.id || d._id?.toString() || String(Math.random()),
          roleId: d.roleId || null,
          roleName: d.roleName || null,
          memberIds: d.memberIds || [],
        })),
        roles: (org.roles || []).map((r: any) => ({
          ...r,
          id: r.id || r._id?.toString() || String(Math.random()),
          memberCount: r.memberCount || 0,
          isSystem: r.isSystem || false,
          permissions: {
            canAccessEmail: r.permissions?.canAccessEmail ?? true,
            canAccessPayroll: r.permissions?.canAccessPayroll ?? false,
            canAccessPos: r.permissions?.canAccessPos ?? false,
            canAccessLogistics: r.permissions?.canAccessLogistics ?? false,
            canAccessHotel: r.permissions?.canAccessHotel ?? false,
            canAccessAdminConsole: r.permissions?.canAccessAdminConsole ?? false,
            canManageBilling: r.permissions?.canManageBilling ?? false,
            canManageUsers: r.permissions?.canManageUsers ?? false,
            canManageDomains: r.permissions?.canManageDomains ?? false,
          },
        })),
      };
    },

    getOrganizationMembers: async (_: any, __: any, context: GraphQLContext) => {
      const authUser = requireAuth(context);
      if (!authUser.organizationId) return [];
      const users = await UserModel.find({ organizationId: authUser.organizationId }).sort({ createdAt: -1 });
      return Promise.all(users.map((u) => formatUserWithPermissions(u)));
    },

    getKycStatus: async (_: any, __: any, context: GraphQLContext) => {
      const authUser = requireAuth(context);
      return ProvnKycService.getKycStatus(authUser.userId);
    },

    getOrganizationKycRecords: async (_: any, __: any, context: GraphQLContext) => {
      const authUser = requireAuth(context);
      if (!authUser.organizationId) return [];
      return KycRecordModel.find({ organizationId: authUser.organizationId }).sort({ createdAt: -1 });
    },

    getSecureFileUrl: async (_: any, { fileKey }: { fileKey: string }, context: GraphQLContext) => {
      requireAuth(context);
      return AwsS3Service.getSecureFileUrl(fileKey);
    },

    getTransactions: async (_: any, { limit = 50 }: { limit?: number }, context: GraphQLContext) => {
      const authUser = requireAuth(context);
      const txns = await TransactionModel.find({ organizationId: authUser.organizationId })
        .sort({ createdAt: -1 })
        .limit(limit);
      return txns.map((t) => ({
        ...t.toObject(),
        id: t._id.toString(),
        amount: t.amount / 100, // in Naira
      }));
    },

    getWalletBalance: async (_: any, __: any, context: GraphQLContext) => {
      const authUser = requireAuth(context);
      const org = await OrganizationModel.findById(authUser.organizationId);
      return org ? org.walletBalance / 100 : 0; // Return in Naira
    },

    getAuditLogs: async (_: any, { limit = 50 }: { limit?: number }, context: GraphQLContext) => {
      const authUser = requireAuth(context);
      return AuditService.getLogs(authUser.organizationId, limit);
    },

    getAbuseCases: async (_: any, __: any, context: GraphQLContext) => {
      const authUser = requireAuth(context);
      return AbuseService.listCases(authUser.organizationId);
    },

    // ─── Product Packages Queries ───
    getPackages: async () => {
      return PackageService.getAllPackages();
    },

    getPackage: async (_: any, { packageId }: { packageId: string }) => {
      return PackageService.getPackageById(packageId);
    },

    // ─── Department & Role Queries ───
    getOrganizationDepartments: async (_: any, __: any, context: GraphQLContext) => {
      const authUser = requireAuth(context);
      if (!authUser.organizationId) return [];
      const org = await OrganizationModel.findById(authUser.organizationId);
      if (!org) return [];

      const uniqueDeptMap = new Map<string, any>();
      for (const d of org.departments || []) {
        const key = (d.name || "").toLowerCase().trim();
        if (key && !uniqueDeptMap.has(key)) {
          uniqueDeptMap.set(key, d);
        }
      }

      return Array.from(uniqueDeptMap.values()).map((d: any) => ({
        ...d,
        id: d.id || d._id?.toString() || String(Math.random()),
        memberIds: d.memberIds || [],
      }));
    },

    getPermissions: async () => {
      const perms = await PermissionModel.find().sort({ category: 1, key: 1 });
      return perms.map((p) => ({
        id: p._id.toString(),
        key: p.key,
        name: p.name,
        description: p.description,
        category: p.category,
        isSystem: p.isSystem,
      }));
    },

    getOrganizationRoles: async (_: any, __: any, context: GraphQLContext) => {
      const authUser = requireAuth(context);
      if (!authUser.organizationId) return [];
      const roles = await RoleModel.find({ organizationId: authUser.organizationId }).sort({ createdAt: 1 });

      const uniqueRoleMap = new Map<string, any>();
      for (const r of roles) {
        const key = r.name.toLowerCase().trim();
        if (!uniqueRoleMap.has(key)) {
          uniqueRoleMap.set(key, r);
        }
      }

      return Array.from(uniqueRoleMap.values()).map((r) => ({
        id: r._id.toString(),
        name: r.name,
        description: r.description,
        isSystem: r.isSystem,
        memberCount: r.memberCount || 0,
        permissions: {
          canAccessEmail: r.permissions?.canAccessEmail ?? true,
          canAccessPayroll: r.permissions?.canAccessPayroll ?? false,
          canAccessPos: r.permissions?.canAccessPos ?? false,
          canAccessLogistics: r.permissions?.canAccessLogistics ?? false,
          canAccessHotel: r.permissions?.canAccessHotel ?? false,
          canAccessAdminConsole: r.permissions?.canAccessAdminConsole ?? false,
          canManageBilling: r.permissions?.canManageBilling ?? false,
          canManageUsers: r.permissions?.canManageUsers ?? false,
          canManageDomains: r.permissions?.canManageDomains ?? false,
        },
      }));
    },

    getOrganizationSubscriptions: async (_: any, { limit = 20 }: { limit?: number }, context: GraphQLContext) => {
      const authUser = requireAuth(context);
      if (!authUser.organizationId) return [];
      const subs = await SubscriptionModel.find({ organizationId: authUser.organizationId })
        .sort({ createdAt: -1 })
        .limit(limit);
      return subs.map((s) => ({
        ...s.toObject(),
        id: s._id.toString(),
        totalAmount: s.totalAmount / 100, // in Naira
      }));
    },

    getCurrentSubscription: async (_: any, __: any, context: GraphQLContext) => {
      const authUser = requireAuth(context);
      if (!authUser.organizationId) return null;
      const sub = await SubscriptionModel.findOne({ organizationId: authUser.organizationId })
        .sort({ createdAt: -1 });
      if (!sub) return null;
      return {
        ...sub.toObject(),
        id: sub._id.toString(),
        totalAmount: sub.totalAmount / 100, // in Naira
      };
    },

    getEmailMetrics: async (
      _: any,
      { startDate, endDate }: { startDate?: string; endDate?: string },
      context: GraphQLContext
    ) => {
      const authUser = requireAuth(context);
      let org = null;
      if (authUser.organizationId) {
        org = await OrganizationService.getById(authUser.organizationId);
      }
      return ResendDomainService.getEmailMetrics(
        org?.resendDomainId,
        org?.domain || "example.com",
        startDate,
        endDate,
        authUser.organizationId
      );
    },

    checkDomainOnline: async (_: any, { domain }: { domain: string }) => {
      const clean = domain
        .toLowerCase()
        .trim()
        .replace(/^https?:\/\//, "")
        .replace(/\/.*$/, "");

      if (!clean || clean.length < 3 || !clean.includes(".")) {
        return {
          domain: clean,
          isOnline: false,
          hasMx: false,
          hasNs: false,
          message: "Please enter a valid domain name format (e.g. yourcompany.com).",
        };
      }

      try {
        const dns = await import("dns/promises");
        const [nsResult, aResult, mxResult, soaResult] = await Promise.allSettled([
          dns.resolveNs(clean),
          dns.resolve4(clean),
          dns.resolveMx(clean),
          dns.resolveSoa(clean),
        ]);

        const hasNs = nsResult.status === "fulfilled" && nsResult.value.length > 0;
        const hasA = aResult.status === "fulfilled" && aResult.value.length > 0;
        const hasMx = mxResult.status === "fulfilled" && mxResult.value.length > 0;
        const hasSoa = soaResult.status === "fulfilled";

        const isOnline = hasNs || hasA || hasMx || hasSoa;

        return {
          domain: clean,
          isOnline,
          hasMx,
          hasNs,
          message: isOnline
            ? `Domain ${clean} is verified active and resolvable online.`
            : `Domain ${clean} is not reachable online. Please verify spelling or ensure nameservers are configured with your registrar.`,
        };
      } catch (err: any) {
        return {
          domain: clean,
          isOnline: false,
          hasMx: false,
          hasNs: false,
          message: `Unable to resolve ${clean} online: ${err?.message || "DNS lookup failed."}`,
        };
      }
    },

    // ─── Webmail Queries ───
    getMyEmails: async (
      _: any,
      { folder, category, search, limit = 50, offset = 0 }: any,
      context: GraphQLContext
    ) => {
      const authUser = requireAuth(context);
      const query: any = {
        organizationId: authUser.organizationId,
        $or: [
          { userId: authUser.userId || (authUser as any).id },
          { "to.email": authUser.email.toLowerCase() },
          { "from.email": authUser.email.toLowerCase() },
        ],
      };

      if (folder) {
        if (folder === "starred") {
          query.isStarred = true;
        } else {
          query.folder = folder;
        }
      }

      if (category && (!folder || folder === "inbox")) {
        query.category = category;
      }

      if (search && search.trim()) {
        const regex = new RegExp(search.trim(), "i");
        query.$or = [
          { subject: regex },
          { preview: regex },
          { "from.name": regex },
          { "from.email": regex },
          { "to.email": regex },
        ];
      }

      let emails = await EmailModel.find(query)
        .sort({ createdAt: -1 })
        .skip(offset)
        .limit(limit);

      if (emails.length === 0 && offset === 0 && (!search || !search.trim()) && authUser.organizationId) {
        const org = await OrganizationModel.findById(authUser.organizationId);
        if (org) {
          await ResendEmailService.provisionWelcomeEmailInMailbox(
            authUser.organizationId,
            authUser.userId || (authUser as any).id,
            authUser.name || authUser.email.split("@")[0],
            authUser.email,
            org.name,
            authUser.role === "admin"
          );
          emails = await EmailModel.find(query)
            .sort({ createdAt: -1 })
            .skip(offset)
            .limit(limit);
        }
      }

      return emails.map((m) => ({
        id: m._id.toString(),
        threadId: m.threadId,
        folder: m.folder,
        category: m.category || "primary",
        from: m.from,
        to: m.to || [],
        cc: m.cc || [],
        bcc: m.bcc || [],
        replyTo: m.replyTo,
        subject: m.subject || "(No subject)",
        preview: m.preview || "",
        bodyHtml: m.bodyHtml || "",
        bodyText: m.bodyText || "",
        attachments: (m.attachments || []).map((a) => ({
          id: a.id,
          name: a.name,
          sizeBytes: a.sizeBytes || 0,
          contentType: a.contentType || "application/octet-stream",
          downloadUrl: a.downloadUrl,
          contentId: a.contentId,
        })),
        isRead: m.isRead,
        isStarred: m.isStarred,
        isImportant: m.isImportant || false,
        labels: m.labels || [],
        status: m.status || "SENT",
        receivedAt: m.receivedAt?.toISOString(),
        sentAt: m.sentAt?.toISOString(),
        createdAt: m.createdAt.toISOString(),
      }));
    },

    getEmailById: async (_: any, { id }: { id: string }, context: GraphQLContext) => {
      const authUser = requireAuth(context);
      const email = await EmailModel.findOne({
        _id: id,
        organizationId: authUser.organizationId,
      });
      if (!email) throw new Error("Email not found");

      if (!email.isRead && email.folder === "inbox") {
        email.isRead = true;
        await email.save();
      }

      return {
        id: email._id.toString(),
        threadId: email.threadId,
        folder: email.folder,
        category: email.category || "primary",
        from: email.from,
        to: email.to || [],
        cc: email.cc || [],
        bcc: email.bcc || [],
        replyTo: email.replyTo,
        subject: email.subject || "(No subject)",
        preview: email.preview || "",
        bodyHtml: email.bodyHtml || "",
        bodyText: email.bodyText || "",
        attachments: (email.attachments || []).map((a) => ({
          id: a.id,
          name: a.name,
          sizeBytes: a.sizeBytes || 0,
          contentType: a.contentType || "application/octet-stream",
          downloadUrl: a.downloadUrl,
          contentId: a.contentId,
        })),
        isRead: email.isRead,
        isStarred: email.isStarred,
        isImportant: email.isImportant || false,
        labels: email.labels || [],
        status: email.status || "SENT",
        receivedAt: email.receivedAt?.toISOString(),
        sentAt: email.sentAt?.toISOString(),
        createdAt: email.createdAt.toISOString(),
      };
    },

    getMailboxCounts: async (_: any, __: any, context: GraphQLContext) => {
      const authUser = requireAuth(context);
      const baseQuery = {
        organizationId: authUser.organizationId,
        $or: [
          { userId: authUser.userId || (authUser as any).id },
          { "to.email": authUser.email.toLowerCase() },
          { "from.email": authUser.email.toLowerCase() },
        ],
      };

      const [inbox, unread, starred, sent, drafts, spam, trash, archive] = await Promise.all([
        EmailModel.countDocuments({ ...baseQuery, folder: "inbox" }),
        EmailModel.countDocuments({ ...baseQuery, folder: "inbox", isRead: false }),
        EmailModel.countDocuments({ ...baseQuery, isStarred: true }),
        EmailModel.countDocuments({ ...baseQuery, folder: "sent" }),
        EmailModel.countDocuments({ ...baseQuery, folder: "drafts" }),
        EmailModel.countDocuments({ ...baseQuery, folder: "spam" }),
        EmailModel.countDocuments({ ...baseQuery, folder: "trash" }),
        EmailModel.countDocuments({ ...baseQuery, folder: "archive" }),
      ]);

      return { inbox, unread, starred, sent, drafts, spam, trash, archive };
    },

    // ─── Calendar Events Queries ───
    getCalendarEvents: async (
      _: any,
      { start, end, type }: { start?: string; end?: string; type?: string },
      context: GraphQLContext
    ) => {
      const authUser = requireAuth(context);
      if (!authUser.organizationId) return [];

      const userEmail = authUser.email.toLowerCase();
      const query: any = {
        organizationId: authUser.organizationId,
        $or: [
          { organizerEmail: userEmail },
          { organizerId: authUser.userId || (authUser as any).id },
          { "attendees.email": userEmail },
          { type: "ORGANIZATION" },
        ],
      };

      if (start || end) {
        query.start = {};
        if (start) query.start.$gte = new Date(start);
        if (end) query.start.$lte = new Date(end);
      }

      if (type && type !== "ALL") {
        query.type = type;
      }

      const events = await CalendarEventModel.find(query).sort({ start: 1 });
      return events.map(formatCalendarEvent);
    },

    getCalendarEventById: async (_: any, { id }: { id: string }, context: GraphQLContext) => {
      const authUser = requireAuth(context);
      if (!authUser.organizationId) return null;

      const event = await CalendarEventModel.findOne({
        _id: id,
        organizationId: authUser.organizationId,
      });

      if (!event) return null;

      const userEmail = authUser.email.toLowerCase();
      const isOrganizer = event.organizerEmail.toLowerCase() === userEmail;
      const isAttendee = (event.attendees || []).some((a) => a.email.toLowerCase() === userEmail);
      const isPublicOrg = event.type === "ORGANIZATION";

      if (!isOrganizer && !isAttendee && !isPublicOrg) {
        throw new Error("Access denied to this calendar event.");
      }

      return formatCalendarEvent(event);
    },
  },

  Mutation: {
    // ─── Auth Mutations ───
    signup: async (_: any, { input }: { input: any }) => {
      return AuthService.signup(input);
    },

    login: async (_: any, { input }: { input: any }) => {
      const result = await AuthService.login(input);
      if (result.requiresTwoFactor) {
        return {
          requiresTwoFactor: true,
          mustChangePassword: false,
          phone: result.phone,
          message: result.message,
          tokens: null,
        };
      }
      return {
        requiresTwoFactor: false,
        mustChangePassword: false,
        tokens: result.tokens,
      };
    },

    mailLogin: async (_: any, { input }: { input: any }) => {
      const result = await AuthService.mailLogin(input);
      if (result.requiresTwoFactor) {
        return {
          requiresTwoFactor: true,
          mustChangePassword: false,
          phone: result.phone,
          personalEmail: (result as any).personalEmail,
          message: result.message,
          tokens: null,
        };
      }
      return {
        requiresTwoFactor: false,
        mustChangePassword: result.mustChangePassword,
        personalEmail: (result as any).personalEmail,
        tokens: (result as any).tokens || null,
      };
    },

    setInitialPassword: async (_: any, { input }: { input: any }) => {
      return AuthService.setInitialPassword(input);
    },

    verify2fa: async (_: any, { phone, code }: { phone: string; code: string }) => {
      return AuthService.verify2faAndLogin(phone, code);
    },

    requestPhoneOtp: async (_: any, { phone, purpose }: { phone: string; purpose?: string }) => {
      return TermiiOtpService.sendPhoneOtp(phone, (purpose as any) || "phone_verification");
    },

    requestEmailOtp: async (_: any, { email, name, purpose }: { email: string; name?: string; purpose?: string }) => {
      return OtpService.sendEmailOtp(email, name || "Workspace Administrator", (purpose as any) || "email_verification");
    },

    verifyEmailOtp: async (_: any, { email, code, purpose }: { email: string; code: string; purpose?: string }) => {
      return OtpService.verifyEmailOtp(email, code, (purpose as any) || "email_verification");
    },

    refreshToken: async (_: any, { refreshToken }: { refreshToken: string }) => {
      const { accessToken } = await AuthService.refreshSession(refreshToken);
      const payload = TokenManager.verifyRefreshToken(refreshToken);
      const user = await UserModel.findById(payload.userId);
      return {
        accessToken,
        refreshToken,
        user,
      };
    },

    // ─── Organization & Domain & Users ───
    updateOrganization: async (_: any, { input }: { input: any }, context: GraphQLContext) => {
      const authUser = requireAuth(context);
      if (!authUser.organizationId) throw new Error("No organization found");
      const updated = await OrganizationModel.findByIdAndUpdate(
        authUser.organizationId,
        { $set: input },
        { new: true }
      );
      if (!updated) throw new Error("Failed to update organization");
      return {
        ...updated.toObject(),
        id: updated._id.toString(),
        walletBalance: updated.walletBalance / 100,
      };
    },

    subscribePackage: async (
      _: any,
      { packageId }: { packageId: string },
      context: GraphQLContext
    ) => {
      const authUser = requireAuth(context);
      if (!authUser.organizationId) throw new Error("No organization found");
      const org = await OrganizationModel.findById(authUser.organizationId);
      if (!org) throw new Error("Organization not found");

      const subscribed = org.subscribedPackages || ["org-email"];
      if (!subscribed.includes(packageId)) {
        subscribed.push(packageId);
        org.subscribedPackages = subscribed;
        await org.save();

        const user = await UserModel.findById(authUser.userId);
        const pkg = INITIAL_PACKAGES.find((p) => p.packageId === packageId);
        const pkgName = pkg ? pkg.name : packageId;
        if (user && user.email) {
          ResendEmailService.sendPackageSubscribedReceipt(
            user.email,
            user.name || "Administrator",
            org.name,
            pkgName,
            org.billingCycle || "MONTHLY"
          ).catch((err: any) => console.error("⚠️ Failed to send package subscription email:", err));
        }
      }

      return {
        ...org.toObject(),
        id: org._id.toString(),
        walletBalance: org.walletBalance / 100,
      };
    },

    cancelPackageSubscription: async (_: any, { packageId }: { packageId: string }, context: GraphQLContext) => {
      const authUser = requireAuth(context);
      if (!authUser.organizationId) throw new Error("No organization found");
      const org = await OrganizationModel.findById(authUser.organizationId);
      if (!org) throw new Error("Organization not found");

      if (packageId === "org-email") {
        throw new Error("Cannot cancel Sovereign Core Email Suite.");
      }

      org.subscribedPackages = (org.subscribedPackages || ["org-email"]).filter((p) => p !== packageId);
      await org.save();

      const user = await UserModel.findById(authUser.userId);
      const pkg = INITIAL_PACKAGES.find((p) => p.packageId === packageId);
      const pkgName = pkg ? pkg.name : packageId;
      if (user && user.email) {
        ResendEmailService.sendPackageCancelledConfirmation(
          user.email,
          user.name || "Administrator",
          org.name,
          pkgName
        ).catch((err: any) => console.error("⚠️ Failed to send cancellation email:", err));
      }

      return {
        ...org.toObject(),
        id: org._id.toString(),
        walletBalance: org.walletBalance / 100,
      };
    },

    activateSubscriptionFromWallet: async (
      _: any,
      {
        packageIds,
        billingCycle,
        totalSeats,
      }: { packageIds: string[]; billingCycle: string; totalSeats: number },
      context: GraphQLContext
    ) => {
      const authUser = requireAuth(context);
      if (!authUser.organizationId) throw new Error("No organization found");
      const org = await OrganizationModel.findById(authUser.organizationId);
      if (!org) throw new Error("Organization not found");

      const user = await UserModel.findById(authUser.userId);
      const now = new Date();
      const isAnnual = billingCycle === "ANNUAL";

      // Calculate total cost
      let totalCostInNaira = 0;
      for (const pkgId of packageIds) {
        const pkg = INITIAL_PACKAGES.find((p) => p.packageId === pkgId);
        if (pkg) {
          if (pkg.pricingModel === "PER_SEAT" || pkgId === "org-email" || pkg.isCore) {
            totalCostInNaira += (isAnnual ? pkg.priceAnnual : pkg.priceMonthly) * totalSeats;
          } else {
            totalCostInNaira += isAnnual ? pkg.priceAnnual : pkg.priceMonthly;
          }
        }
      }

      // 1. Check if first-time activation on 7-Day Free Trial (₦0 due today)
      const isFirstTimeTrial =
        !org.subscriptionStartsAt ||
        org.subscriptionStatus === "TRIAL" ||
        !org.subscriptionStatus;

      if (isFirstTimeTrial) {
        org.subscribedPackages = packageIds;
        org.billingCycle = billingCycle as any;
        org.totalSeats = totalSeats;
        org.subscriptionStatus = "TRIAL";
        org.trialStartsAt = now;
        const trialEndsAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        org.trialEndsAt = trialEndsAt;
        org.subscriptionStartsAt = now;
        org.subscriptionExpiresAt = trialEndsAt;
        org.gracePeriodEndsAt = undefined;
        org.isSuspended = false;
        org.lastBillingReminderType = undefined;
        await org.save();

        // Create subscription history record
        await SubscriptionModel.create({
          organizationId: org._id,
          packageIds,
          billingCycle,
          seatCount: totalSeats,
          totalAmount: 0,
          currency: "NGN",
          status: "TRIAL",
          paymentMethod: "FREE_TRIAL",
          trialStartsAt: now,
          trialEndsAt,
          currentPeriodStartsAt: now,
          currentPeriodEndsAt: trialEndsAt,
          autoDebit: org.autoDebitWallet ?? true,
        });

        return {
          ...org.toObject(),
          id: org._id.toString(),
          walletBalance: org.walletBalance / 100,
        };
      }

      // 2. Paid activation / upgrade after trial
      const costInKobo = Math.round(totalCostInNaira * 100);
      if ((org.walletBalance || 0) < costInKobo) {
        throw new Error(
          `Insufficient wallet balance. Total required is ₦${totalCostInNaira.toLocaleString()}, but available wallet balance is ₦${((org.walletBalance || 0) / 100).toLocaleString()}. Please fund your wallet or pay via Card to activate.`
        );
      }

      // Deduct from wallet
      org.walletBalance = (org.walletBalance || 0) - costInKobo;
      org.subscribedPackages = packageIds;
      org.billingCycle = billingCycle as any;
      org.totalSeats = totalSeats;
      org.subscriptionStatus = "ACTIVE";
      org.subscriptionStartsAt = now;
      const periodDays = isAnnual ? 365 : 30;
      const nextDue = new Date(now.getTime() + periodDays * 24 * 60 * 60 * 1000);
      org.subscriptionExpiresAt = nextDue;
      org.gracePeriodEndsAt = undefined;
      org.isSuspended = false;
      org.lastBillingReminderType = undefined;
      await org.save();

      const subRef = `SUB-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

      // Record transaction
      await TransactionModel.create({
        organizationId: org._id,
        userId: authUser.userId,
        reference: subRef,
        type: "subscription_charge",
        amount: costInKobo,
        status: "success",
        channel: "wallet",
        currency: "NGN",
        paidAt: now,
        metadata: { description: `Subscription Activation (${packageIds.join(", ")})` },
      });

      // Record subscription history record
      await SubscriptionModel.create({
        organizationId: org._id,
        packageIds,
        billingCycle,
        seatCount: totalSeats,
        totalAmount: costInKobo,
        currency: "NGN",
        status: "ACTIVE",
        paymentMethod: "WALLET",
        currentPeriodStartsAt: now,
        currentPeriodEndsAt: nextDue,
        autoDebit: org.autoDebitWallet ?? true,
        lastPaymentReference: subRef,
      });

      // Dispatch receipt email via Resend
      if (user && user.email) {
        ResendEmailService.sendWalletDebitedReceipt(
          user.email,
          user.name || "Administrator",
          org.name,
          totalCostInNaira,
          nextDue.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
        ).catch((err: any) => console.error("⚠️ Failed to send wallet debited receipt email:", err));
      }

      return {
        ...org.toObject(),
        id: org._id.toString(),
        walletBalance: org.walletBalance / 100,
      };
    },

    updateSubscriptionAutoDebit: async (_: any, { autoDebit }: { autoDebit: boolean }, context: GraphQLContext) => {
      const authUser = requireAuth(context);
      if (!authUser.organizationId) throw new Error("No organization found");
      const org = await OrganizationModel.findByIdAndUpdate(
        authUser.organizationId,
        { autoDebitWallet: autoDebit },
        { new: true }
      );
      if (!org) throw new Error("Organization not found");

      let sub = await SubscriptionModel.findOne({ organizationId: authUser.organizationId }).sort({ createdAt: -1 });
      if (sub) {
        sub.autoDebit = autoDebit;
        await sub.save();
      } else {
        sub = await SubscriptionModel.create({
          organizationId: authUser.organizationId,
          packageIds: org.subscribedPackages || ["org-email"],
          billingCycle: org.billingCycle || "MONTHLY",
          seatCount: org.totalSeats || 0,
          totalAmount: 0,
          currency: "NGN",
          status: org.subscriptionStatus || "ACTIVE",
          currentPeriodStartsAt: org.subscriptionStartsAt || new Date(),
          currentPeriodEndsAt: org.subscriptionExpiresAt || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          autoDebit,
        });
      }

      return {
        ...sub.toObject(),
        id: sub._id.toString(),
        totalAmount: sub.totalAmount / 100,
      };
    },

    cancelSubscription: async (_: any, { reason }: { reason?: string }, context: GraphQLContext) => {
      const authUser = requireAuth(context);
      if (!authUser.organizationId) throw new Error("No organization found");
      const org = await OrganizationModel.findById(authUser.organizationId);
      if (!org) throw new Error("Organization not found");

      org.subscriptionStatus = "CANCELLED";
      await org.save();

      let sub = await SubscriptionModel.findOne({ organizationId: authUser.organizationId }).sort({ createdAt: -1 });
      if (sub) {
        sub.status = "CANCELLED";
        sub.cancelledAt = new Date();
        sub.cancellationReason = reason || "Cancelled by workspace administrator";
        await sub.save();
      } else {
        sub = await SubscriptionModel.create({
          organizationId: org._id,
          packageIds: org.subscribedPackages || ["org-email"],
          billingCycle: org.billingCycle || "MONTHLY",
          seatCount: org.totalSeats || 0,
          totalAmount: 0,
          currency: "NGN",
          status: "CANCELLED",
          currentPeriodStartsAt: org.subscriptionStartsAt || new Date(),
          currentPeriodEndsAt: org.subscriptionExpiresAt || new Date(),
          autoDebit: false,
          cancelledAt: new Date(),
          cancellationReason: reason || "Cancelled by workspace administrator",
        });
      }

      const user = await UserModel.findById(authUser.userId);
      if (user && user.email) {
        ResendEmailService.sendPackageCancelledConfirmation(
          user.email,
          user.name || "Administrator",
          org.name,
          "Sovereign Organization Subscription"
        ).catch((err: any) => console.error("⚠️ Failed to send cancellation email:", err));
      }

      return {
        ...sub.toObject(),
        id: sub._id.toString(),
        totalAmount: sub.totalAmount / 100,
      };
    },

    verifyDomainDns: async (_: any, __: any, context: GraphQLContext) => {
      const authUser = requireAuth(context);
      if (!authUser.organizationId) throw new Error("No organization found");
      const updated = await OrganizationService.verifyDomainDns(authUser.organizationId);
      if (!updated) throw new Error("Failed to verify DNS");
      return {
        ...updated.toObject(),
        id: updated._id.toString(),
        walletBalance: updated.walletBalance / 100,
      };
    },

    inviteMember: async (_: any, { input }: { input: any }, context: GraphQLContext) => {
      const authUser = requireAuth(context);
      if (!authUser.organizationId) throw new Error("No organization found");
      const res = await OrganizationService.inviteMember(authUser.organizationId, input);
      const formattedUser = await formatUserWithPermissions(res.user);
      return {
        user: formattedUser,
        temporaryPassword: res.temporaryPassword,
      };
    },

    updateUserStatus: async (
      _: any,
      { userId, status }: { userId: string; status: string },
      context: GraphQLContext
    ) => {
      const authUser = requireAuth(context);
      const user = await UserModel.findOneAndUpdate(
        { _id: userId, organizationId: authUser.organizationId },
        { $set: { status: status.toLowerCase() } },
        { new: true }
      );
      if (!user) throw new Error("User not found in this organization");
      return {
        ...user.toObject(),
        id: user._id.toString(),
      };
    },

    deleteUser: async (_: any, { userId }: { userId: string }, context: GraphQLContext) => {
      const authUser = requireAuth(context);
      const res = await UserModel.findOneAndDelete({ _id: userId, organizationId: authUser.organizationId });
      return !!res;
    },

    // ─── Department Mutations ───
    createDepartment: async (_: any, { input }: { input: any }, context: GraphQLContext) => {
      const authUser = requireAuth(context);
      if (!authUser.organizationId) throw new Error("No organization found");
      const org = await OrganizationModel.findById(authUser.organizationId);
      if (!org) throw new Error("Organization not found");

      let roleName = input.roleName;
      if (input.roleId && !roleName) {
        const r = await RoleModel.findById(input.roleId);
        if (r) roleName = r.name;
      }

      const deptId = `dept-${Date.now()}`;
      const newDept = {
        id: deptId,
        name: input.name,
        description: input.description || "",
        lead: input.lead || "",
        roleId: input.roleId || null,
        roleName: roleName || null,
        memberIds: input.memberIds || [],
        createdAt: new Date().toISOString(),
      };

      org.departments = [...(org.departments || []), newDept];
      await org.save();

      // If members are specified, sync their department info on UserModel
      if (input.memberIds && input.memberIds.length > 0) {
        await UserModel.updateMany(
          { _id: { $in: input.memberIds }, organizationId: authUser.organizationId },
          { $set: { department: input.name, departmentId: deptId, ...(input.roleId ? { roleId: input.roleId } : {}) } }
        ).catch((err) => console.warn("⚠️ Failed to sync user department references:", err));
      }

      return newDept;
    },

    updateDepartment: async (_: any, { id, input }: { id: string; input: any }, context: GraphQLContext) => {
      const authUser = requireAuth(context);
      if (!authUser.organizationId) throw new Error("No organization found");
      const org = await OrganizationModel.findById(authUser.organizationId);
      if (!org) throw new Error("Organization not found");

      const depts = org.departments || [];
      const idx = depts.findIndex((d: any) => d.id === id);
      if (idx === -1) throw new Error("Department not found");

      let roleName = input.roleName;
      if (input.roleId && !roleName) {
        const r = await RoleModel.findById(input.roleId);
        if (r) roleName = r.name;
      }

      const updated = {
        ...depts[idx],
        ...input,
        ...(roleName ? { roleName } : {}),
      };
      depts[idx] = updated;
      org.departments = depts;
      org.markModified("departments");
      await org.save();

      // If memberIds are specified, update their department on UserModel
      if (input.memberIds && input.memberIds.length > 0) {
        await UserModel.updateMany(
          { _id: { $in: input.memberIds }, organizationId: authUser.organizationId },
          { $set: { department: updated.name, departmentId: id, ...(updated.roleId ? { roleId: updated.roleId } : {}) } }
        ).catch((err) => console.warn("⚠️ Failed to sync user department references:", err));
      }

      return updated;
    },

    deleteDepartment: async (_: any, { id }: { id: string }, context: GraphQLContext) => {
      const authUser = requireAuth(context);
      if (!authUser.organizationId) throw new Error("No organization found");
      const org = await OrganizationModel.findById(authUser.organizationId);
      if (!org) return false;

      org.departments = (org.departments || []).filter((d: any) => d.id !== id);
      org.markModified("departments");
      await org.save();
      return true;
    },

    // ─── Role Mutations ───
    createRole: async (_: any, { input }: { input: any }, context: GraphQLContext) => {
      const authUser = requireAuth(context);
      if (!authUser.organizationId) throw new Error("No organization found");

      const role = await RoleModel.create({
        organizationId: authUser.organizationId,
        name: input.name,
        slug: input.name.toLowerCase().replace(/[^a-z0-9]/g, "-"),
        description: input.description || "",
        isSystem: false,
        memberCount: 0,
        permissions: {
          canAccessEmail: input.permissions?.canAccessEmail ?? true,
          canAccessPayroll: input.permissions?.canAccessPayroll ?? false,
          canAccessPos: input.permissions?.canAccessPos ?? false,
          canAccessLogistics: input.permissions?.canAccessLogistics ?? false,
          canAccessHotel: input.permissions?.canAccessHotel ?? false,
          canAccessAdminConsole: input.permissions?.canAccessAdminConsole ?? false,
          canManageBilling: input.permissions?.canManageBilling ?? false,
          canManageUsers: input.permissions?.canManageUsers ?? false,
          canManageDomains: input.permissions?.canManageDomains ?? false,
        },
      });

      return {
        id: role._id.toString(),
        name: role.name,
        description: role.description,
        isSystem: role.isSystem,
        memberCount: 0,
        permissions: role.permissions,
      };
    },

    updateRole: async (_: any, { id, input }: { id: string; input: any }, context: GraphQLContext) => {
      const authUser = requireAuth(context);
      if (!authUser.organizationId) throw new Error("No organization found");

      const role = await RoleModel.findOne({ _id: id, organizationId: authUser.organizationId });
      if (!role) throw new Error("Role not found");

      if (role.isSystem && input.name && input.name !== role.name) {
        throw new Error("Cannot rename default system roles.");
      }

      if (input.name) role.name = input.name;
      if (input.description !== undefined) role.description = input.description;
      if (input.permissions) {
        role.permissions = {
          ...role.permissions,
          ...input.permissions,
        };
      }

      await role.save();

      return {
        id: role._id.toString(),
        name: role.name,
        description: role.description,
        isSystem: role.isSystem,
        memberCount: role.memberCount || 0,
        permissions: role.permissions,
      };
    },

    deleteRole: async (_: any, { id }: { id: string }, context: GraphQLContext) => {
      const authUser = requireAuth(context);
      if (!authUser.organizationId) throw new Error("No organization found");

      const role = await RoleModel.findOne({ _id: id, organizationId: authUser.organizationId });
      if (!role) throw new Error("Role not found");

      const isProtected =
        role.slug === "owner" ||
        role.slug === "admin" ||
        role.name.toLowerCase().includes("owner") ||
        role.name.toLowerCase().includes("workspace administrator") ||
        role.name.toLowerCase() === "administrator";

      if (isProtected) {
        throw new Error("Owner and Workspace Administrator are core sovereign system roles and cannot be deleted.");
      }

      // Reassign any users who had this role
      await UserModel.updateMany(
        { organizationId: authUser.organizationId, roleId: role._id },
        { $set: { role: "member", roleName: "Standard Team Member", roleId: null } }
      ).catch((e) => console.warn("⚠️ Reassigning users from deleted role failed:", e));

      await RoleModel.deleteOne({ _id: id, organizationId: authUser.organizationId });
      return true;
    },

    // ─── Storage Mutations (AWS S3) ───
    getPresignedUploadUrl: async (_: any, { input }: { input: any }, context: GraphQLContext) => {
      requireAuth(context);
      return AwsS3Service.getPresignedUploadUrl(input.folder, input.fileName, input.contentType);
    },

    // ─── KYC Mutations (Provn) ───
    submitKyc: async (_: any, { input }: { input: any }, context: GraphQLContext) => {
      const authUser = requireAuth(context);
      return ProvnKycService.submitAndVerify({
        ...input,
        userId: authUser.userId,
        organizationId: authUser.organizationId,
      });
    },

    // ─── Payment Mutations (Paystack & Direct) ───
    initializeWalletFunding: async (_: any, { input }: { input: any }, context: GraphQLContext) => {
      const authUser = requireAuth(context);
      return PaystackService.initializeWalletFunding({
        organizationId: authUser.organizationId!,
        userId: authUser.userId,
        userEmail: authUser.email,
        amountInNaira: input.amountInNaira,
        callbackUrl: input.callbackUrl,
      });
    },

    fundWalletDirect: async (
      _: any,
      {
        amountInNaira,
        channel = "bank_transfer",
        description = "Direct Wallet Funding",
      }: { amountInNaira: number; channel?: string; description?: string },
      context: GraphQLContext
    ) => {
      const authUser = requireAuth(context);
      if (!authUser.organizationId) throw new Error("No organization found");
      const amountInKobo = Math.round(amountInNaira * 100);

      const org = await OrganizationModel.findByIdAndUpdate(
        authUser.organizationId,
        { $inc: { walletBalance: amountInKobo } },
        { new: true }
      );
      if (!org) throw new Error("Organization not found");

      const reference = `TXN-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
      const txn = await TransactionModel.create({
        organizationId: authUser.organizationId,
        userId: authUser.userId,
        reference,
        type: "wallet_funding",
        amount: amountInKobo,
        status: "success",
        channel: channel || "bank_transfer",
        currency: "NGN",
        paidAt: new Date(),
        metadata: { description },
      });

      return {
        id: txn._id.toString(),
        reference: txn.reference,
        type: txn.type,
        amount: amountInNaira,
        status: txn.status,
        channel: txn.channel,
        currency: txn.currency,
        paidAt: txn.paidAt?.toISOString(),
        createdAt: txn.createdAt.toISOString(),
      };
    },

    // ─── Webmail Dispatch & Management Mutations ───
    sendMail: async (_: any, { input }: { input: any }, context: GraphQLContext) => {
      const authUser = requireAuth(context);
      if (!authUser.organizationId) throw new Error("No active organization found");

      const org = await OrganizationModel.findById(authUser.organizationId);
      if (!org) throw new Error("Organization not found");

      // ── 1. Strict SaaS Subscription Gating ──
      const now = new Date();
      const isTrialValid =
        (org.subscriptionStatus === "TRIAL" || !org.subscriptionStatus) &&
        (!org.trialEndsAt || now <= new Date(org.trialEndsAt));
      const isSubActive =
        org.subscriptionStatus === "ACTIVE" &&
        (!org.subscriptionExpiresAt || now <= new Date(org.subscriptionExpiresAt));
      const isGracePeriod =
        org.subscriptionStatus === "GRACE_PERIOD" &&
        org.gracePeriodEndsAt &&
        now <= new Date(org.gracePeriodEndsAt);

      const hasActiveSubscription =
        !org.isSuspended && (isSubActive || isTrialValid || isGracePeriod);
      const hasEmailPackage =
        !org.subscribedPackages ||
        org.subscribedPackages.length === 0 ||
        org.subscribedPackages.includes("org-email");

      if (!hasActiveSubscription || !hasEmailPackage) {
        throw new Error(
          `Active 'Business Email' subscription required to dispatch sovereign emails. Your organization subscription status is "${org.subscriptionStatus || "INACTIVE"}". Please activate or fund your wallet in Billing.`
        );
      }

      // ── 2. Daily Sending Limit Check ──
      if (org.emailsSentToday >= org.dailySendingLimit) {
        throw new Error(
          `Daily sending limit reached (${org.emailsSentToday}/${org.dailySendingLimit} emails sent today). Please upgrade your plan tier or wait until tomorrow's reset.`
        );
      }

      // ── 3. Parse Recipients and From Address ──
      const toEmails = (input.to || []).map((p: any) => p.email.trim().toLowerCase()).filter(Boolean);
      if (toEmails.length === 0) {
        throw new Error("At least one recipient email address is required.");
      }
      const ccEmails = (input.cc || []).map((p: any) => p.email.trim().toLowerCase()).filter(Boolean);
      const bccEmails = (input.bcc || []).map((p: any) => p.email.trim().toLowerCase()).filter(Boolean);

      const senderName = authUser.name || "Workspace Member";
      const senderEmail = authUser.email;
      const fromFormatted = `${senderName} <${senderEmail}>`;

      // ── 4. Dispatch via Resend ──
      const resendResult = await ResendEmailService.sendUserEmail({
        from: fromFormatted,
        to: toEmails,
        cc: ccEmails.length > 0 ? ccEmails : undefined,
        bcc: bccEmails.length > 0 ? bccEmails : undefined,
        replyTo: input.replyTo || senderEmail,
        subject: input.subject || "(No subject)",
        html: input.bodyHtml,
        text: input.bodyText || input.bodyHtml.replace(/<[^>]*>?/gm, ""),
        attachments: (input.attachments || []).map((a: any) => ({
          filename: a.name,
          content: a.content,
          path: a.downloadUrl,
        })),
      });

      if (!resendResult.success) {
        throw new Error(resendResult.error || "Failed to dispatch email via Resend.");
      }

      // ── 5. Save in Sent Mailbox in MongoDB ──
      const preview = (input.bodyText || input.bodyHtml.replace(/<[^>]*>?/gm, "")).slice(0, 160).trim();
      const newEmail = await EmailModel.create({
        organizationId: org._id,
        userId: authUser.userId || (authUser as any).id,
        threadId: `thread-outbound-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        resendId: resendResult.id,
        folder: "sent",
        category: "primary",
        from: {
          name: senderName,
          email: senderEmail,
        },
        to: input.to.map((p: any) => ({ name: p.name || p.email.split("@")[0], email: p.email })),
        cc: (input.cc || []).map((p: any) => ({ name: p.name || p.email.split("@")[0], email: p.email })),
        bcc: (input.bcc || []).map((p: any) => ({ name: p.name || p.email.split("@")[0], email: p.email })),
        replyTo: input.replyTo || senderEmail,
        subject: input.subject || "(No subject)",
        preview,
        bodyHtml: input.bodyHtml,
        bodyText: input.bodyText || preview,
        attachments: (input.attachments || []).map((a: any) => ({
          id: a.id || `att-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          name: a.name,
          sizeBytes: a.sizeBytes || 0,
          contentType: a.contentType || "application/octet-stream",
          downloadUrl: a.downloadUrl,
          contentId: a.contentId,
        })),
        isRead: true,
        isStarred: false,
        isImportant: false,
        labels: ["sent"],
        status: "SENT",
        sentAt: new Date(),
      });

      // Increment org daily count
      org.emailsSentToday = (org.emailsSentToday || 0) + 1;
      await org.save();

      return {
        id: newEmail._id.toString(),
        threadId: newEmail.threadId,
        folder: newEmail.folder,
        category: newEmail.category,
        from: newEmail.from,
        to: newEmail.to,
        cc: newEmail.cc,
        bcc: newEmail.bcc,
        replyTo: newEmail.replyTo,
        subject: newEmail.subject,
        preview: newEmail.preview,
        bodyHtml: newEmail.bodyHtml,
        bodyText: newEmail.bodyText,
        attachments: newEmail.attachments,
        isRead: newEmail.isRead,
        isStarred: newEmail.isStarred,
        isImportant: newEmail.isImportant,
        labels: newEmail.labels,
        status: newEmail.status,
        sentAt: newEmail.sentAt?.toISOString(),
        createdAt: newEmail.createdAt.toISOString(),
      };
    },

    updateEmailStatus: async (
      _: any,
      { id, folder, isRead, isStarred, isImportant }: any,
      context: GraphQLContext
    ) => {
      const authUser = requireAuth(context);
      const email = await EmailModel.findOne({
        _id: id,
        organizationId: authUser.organizationId,
      });
      if (!email) throw new Error("Email not found");

      if (folder) email.folder = folder;
      if (typeof isRead === "boolean") email.isRead = isRead;
      if (typeof isStarred === "boolean") email.isStarred = isStarred;
      if (typeof isImportant === "boolean") email.isImportant = isImportant;

      await email.save();

      return {
        id: email._id.toString(),
        threadId: email.threadId,
        folder: email.folder,
        category: email.category,
        from: email.from,
        to: email.to,
        cc: email.cc,
        bcc: email.bcc,
        replyTo: email.replyTo,
        subject: email.subject,
        preview: email.preview,
        bodyHtml: email.bodyHtml,
        bodyText: email.bodyText,
        attachments: email.attachments,
        isRead: email.isRead,
        isStarred: email.isStarred,
        isImportant: email.isImportant,
        labels: email.labels,
        status: email.status,
        createdAt: email.createdAt.toISOString(),
      };
    },

    deleteEmail: async (_: any, { id, permanent }: { id: string; permanent?: boolean }, context: GraphQLContext) => {
      const authUser = requireAuth(context);
      if (permanent) {
        const res = await EmailModel.deleteOne({ _id: id, organizationId: authUser.organizationId });
        return res.deletedCount > 0;
      }
      const email = await EmailModel.findOne({ _id: id, organizationId: authUser.organizationId });
      if (!email) return false;
      email.folder = "trash";
      await email.save();
      return true;
    },

    // ─── Legacy / System Email Dispatch Mutations (Resend) ───
    sendEmail: async (_: any, { input }: { input: any }, context: GraphQLContext) => {
      requireAuth(context);
      const result = await ResendEmailService.sendEmail({
        to: input.to,
        subject: input.subject,
        html: input.html,
        text: input.text,
      });
      return {
        success: result.success,
        message: result.success ? `Email sent successfully (ID: ${result.id})` : (result.error || "Failed to send email"),
      };
    },

    sendOtpEmail: async (_: any, { email }: { email: string }) => {
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const user = await UserModel.findOne({ email: email.toLowerCase() });
      const name = user ? user.name : "User";
      const result = await ResendEmailService.sendOtpEmail(email, name, code, 10);
      return {
        success: result.success,
        message: result.success ? `Verification code dispatched to ${email}` : (result.error || "Failed to send OTP email"),
      };
    },

    // ─── Product Package Mutations ───
    updatePackagePricing: async (
      _: any,
      { packageId, input }: { packageId: string; input: any },
      context: GraphQLContext
    ) => {
      requireAuth(context);
      return PackageService.updatePackagePricing(packageId, input);
    },

    resetPackagesToDefault: async (_: any, __: any, context: GraphQLContext) => {
      requireAuth(context);
      return PackageService.resetPackagesToDefault();
    },

    // ─── Calendar Event Mutations ───
    createCalendarEvent: async (_: any, { input }: { input: any }, context: GraphQLContext) => {
      const authUser = requireAuth(context);
      if (!authUser.organizationId) throw new Error("No active organization found");

      const attendees = Array.isArray(input.attendees) ? [...input.attendees] : [];
      // Ensure organizer is included in attendees list
      if (!attendees.some((a) => a.email && a.email.toLowerCase() === authUser.email.toLowerCase())) {
        attendees.unshift({
          name: authUser.name || authUser.email.split("@")[0],
          email: authUser.email.toLowerCase(),
          userId: authUser.userId || (authUser as any).id,
          status: "ACCEPTED",
        });
      }

      const event = await CalendarEventModel.create({
        organizationId: authUser.organizationId,
        organizerId: authUser.userId || (authUser as any).id,
        organizerName: authUser.name || authUser.email.split("@")[0],
        organizerEmail: authUser.email.toLowerCase(),
        title: input.title.trim(),
        description: input.description || "",
        start: new Date(input.start),
        end: new Date(input.end),
        allDay: !!input.allDay,
        timezone: input.timezone || "Africa/Lagos",
        location: input.location || "Nigerme Meet Virtual Room",
        meetUrl: input.meetUrl || `https://meet.nigerme.com/${Math.random().toString(36).substring(7)}`,
        attendees,
        color: input.color || "bg-[#84cc16]",
        type: input.type || "ORGANIZATION",
        relatedTaskId: input.relatedTaskId,
        relatedEmailId: input.relatedEmailId,
      });

      return formatCalendarEvent(event);
    },

    updateCalendarEvent: async (
      _: any,
      { id, input }: { id: string; input: any },
      context: GraphQLContext
    ) => {
      const authUser = requireAuth(context);
      if (!authUser.organizationId) throw new Error("No active organization found");

      const event = await CalendarEventModel.findOne({
        _id: id,
        organizationId: authUser.organizationId,
      });
      if (!event) throw new Error("Event not found");

      const userEmail = authUser.email.toLowerCase();
      const isOrganizer = event.organizerEmail.toLowerCase() === userEmail;
      const isAdmin = authUser.role === "admin" || (authUser as any).userType === "saas_admin";
      if (!isOrganizer && !isAdmin) {
        throw new Error("Only the organizer or an administrator can update this event.");
      }

      if (input.title !== undefined) event.title = input.title.trim();
      if (input.description !== undefined) event.description = input.description;
      if (input.start !== undefined) event.start = new Date(input.start);
      if (input.end !== undefined) event.end = new Date(input.end);
      if (input.allDay !== undefined) event.allDay = input.allDay;
      if (input.timezone !== undefined) event.timezone = input.timezone;
      if (input.location !== undefined) event.location = input.location;
      if (input.meetUrl !== undefined) event.meetUrl = input.meetUrl;
      if (input.color !== undefined) event.color = input.color;
      if (input.type !== undefined) event.type = input.type;
      if (input.attendees !== undefined) event.attendees = input.attendees;

      await event.save();
      return formatCalendarEvent(event);
    },

    deleteCalendarEvent: async (_: any, { id }: { id: string }, context: GraphQLContext) => {
      const authUser = requireAuth(context);
      if (!authUser.organizationId) throw new Error("No active organization found");

      const event = await CalendarEventModel.findOne({
        _id: id,
        organizationId: authUser.organizationId,
      });
      if (!event) return true;

      const userEmail = authUser.email.toLowerCase();
      const isOrganizer = event.organizerEmail.toLowerCase() === userEmail;
      const isAdmin = authUser.role === "admin" || (authUser as any).userType === "saas_admin";
      if (!isOrganizer && !isAdmin) {
        throw new Error("Only the organizer or an administrator can delete this event.");
      }

      await CalendarEventModel.deleteOne({ _id: id });
      return true;
    },
  },
};

function formatCalendarEvent(doc: any) {
  if (!doc) return null;
  const e = doc.toObject ? doc.toObject() : doc;
  return {
    id: e._id ? e._id.toString() : e.id,
    organizationId: e.organizationId ? e.organizationId.toString() : "",
    organizerId: e.organizerId ? e.organizerId.toString() : "",
    organizerName: e.organizerName || "",
    organizerEmail: e.organizerEmail || "",
    title: e.title || "",
    description: e.description || "",
    start: e.start ? new Date(e.start).toISOString() : new Date().toISOString(),
    end: e.end ? new Date(e.end).toISOString() : new Date().toISOString(),
    allDay: !!e.allDay,
    timezone: e.timezone || "Africa/Lagos",
    location: e.location || "Nigerme Meet Virtual Room",
    meetUrl: e.meetUrl || "",
    attendees: (e.attendees || []).map((a: any) => ({
      name: a.name || "",
      email: a.email || "",
      userId: a.userId ? a.userId.toString() : null,
      status: a.status || "PENDING",
    })),
    color: e.color || "bg-[#84cc16]",
    type: e.type || "ORGANIZATION",
    relatedTaskId: e.relatedTaskId || null,
    relatedEmailId: e.relatedEmailId || null,
    createdAt: e.createdAt ? new Date(e.createdAt).toISOString() : new Date().toISOString(),
    updatedAt: e.updatedAt ? new Date(e.updatedAt).toISOString() : new Date().toISOString(),
  };
}
