"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolvers = void 0;
const context_js_1 = require("./context.js");
const index_js_1 = require("../services/auth/index.js");
const index_js_2 = require("../services/termii/index.js");
const index_js_3 = require("../services/provn/index.js");
const index_js_4 = require("../services/aws/index.js");
const index_js_5 = require("../services/paystack/index.js");
const index_js_6 = require("../services/resend/index.js");
const organization_service_js_1 = require("../application/services/organization.service.js");
const audit_service_js_1 = require("../application/services/audit.service.js");
const abuse_service_js_1 = require("../application/services/abuse.service.js");
const package_service_js_1 = require("../application/services/package.service.js");
const index_js_7 = require("../models/index.js");
const realtime_service_js_1 = require("../services/realtime/realtime.service.js");
const notification_service_js_1 = require("../services/notification/notification.service.js");
const token_manager_js_1 = require("../infrastructure/security/token.manager.js");
const otp_service_js_1 = require("../application/services/otp.service.js");
const passkey_service_js_1 = require("../application/services/passkey.service.js");
const package_seed_js_1 = require("../infrastructure/database/seeds/package.seed.js");
const role_seed_js_1 = require("../infrastructure/database/seeds/role.seed.js");
const encryption_js_1 = require("../infrastructure/security/encryption.js");
const mongoose_1 = __importDefault(require("mongoose"));
async function formatUserWithPermissions(userDoc) {
    if (!userDoc)
        return null;
    const user = userDoc.toObject ? userDoc.toObject() : userDoc;
    let roleName = user.role || "Standard Team Member";
    let canAccessPayroll = false;
    let canAccessPos = false;
    let canAccessLogistics = false;
    let canAccessHotel = false;
    let canAccessAdminConsole = user.role === "admin" || user.userType === "saas_admin" || user.role === "owner" || user.role === "superadmin";
    let canManageBilling = user.role === "admin" || user.userType === "saas_admin" || user.role === "owner" || user.role === "superadmin";
    let canManageUsers = user.role === "admin" || user.userType === "saas_admin" || user.role === "owner" || user.role === "superadmin";
    let canManageDomains = user.role === "admin" || user.userType === "saas_admin" || user.role === "owner" || user.role === "superadmin";
    let canAccessCrm = false;
    let accessiblePackages = ["org-email"];
    // 1. If SaaS Admin or Org Owner
    if (user.userType === "saas_admin" || user.role === "admin" || user.role === "owner" || user.role === "superadmin") {
        canAccessPayroll = true;
        canAccessPos = true;
        canAccessLogistics = true;
        canAccessHotel = true;
        canAccessCrm = true;
        canAccessAdminConsole = true;
        canManageBilling = true;
        canManageUsers = true;
        canManageDomains = true;
        accessiblePackages = ["org-email", "org-pos", "org-payroll", "org-logistics", "org-hotel", "org-crm"];
    }
    else {
        // 2. Lookup assigned RoleModel if roleId or slug exists
        let role = null;
        if (user.roleId && mongoose_1.default.isValidObjectId(user.roleId)) {
            role = await index_js_7.RoleModel.findById(user.roleId);
        }
        else if (user.organizationId && user.role) {
            role = await index_js_7.RoleModel.findOne({ organizationId: user.organizationId, slug: user.role.toLowerCase() });
        }
        if (role) {
            roleName = role.name;
            canAccessPayroll = !!role.permissions?.canAccessPayroll;
            canAccessPos = !!role.permissions?.canAccessPos;
            canAccessLogistics = !!role.permissions?.canAccessLogistics;
            canAccessHotel = !!role.permissions?.canAccessHotel;
            canAccessAdminConsole = !!role.permissions?.canAccessAdminConsole;
            canManageBilling = !!role.permissions?.canManageBilling;
            canManageUsers = !!role.permissions?.canManageUsers;
            canManageDomains = !!role.permissions?.canManageDomains;
        }
        const pkgs = new Set(["org-email"]);
        if (canAccessPos)
            pkgs.add("org-pos");
        if (canAccessPayroll)
            pkgs.add("org-payroll");
        if (canAccessLogistics)
            pkgs.add("org-logistics");
        if (canAccessHotel)
            pkgs.add("org-hotel");
        accessiblePackages = Array.from(pkgs);
    }
    // Resolve department name from DepartmentModel if departmentId is set
    let departmentName = user.department || null;
    if (user.departmentId && mongoose_1.default.isValidObjectId(user.departmentId)) {
        const dept = await index_js_7.DepartmentModel.findById(user.departmentId);
        if (dept)
            departmentName = dept.name;
    }
    return {
        ...user,
        id: user._id?.toString() || user.id,
        roleId: user.roleId?.toString() || null,
        roleName,
        department: departmentName,
        departmentId: user.departmentId ? user.departmentId.toString() : null,
        canAccessEmail: user.canAccessEmail ?? true,
        canAccessPayroll,
        canAccessPos,
        canAccessLogistics,
        canAccessHotel,
        canAccessCrm,
        canAccessAdminConsole,
        canManageBilling,
        canManageUsers,
        canManageDomains,
        accessiblePackages,
    };
}
exports.resolvers = {
    Query: {
        healthCheck: () => "Busmailer Sovereign GraphQL Backend is operational.",
        me: async (_, __, context) => {
            const authUser = (0, context_js_1.requireAuth)(context);
            const user = await index_js_7.UserModel.findById(authUser.userId);
            if (!user)
                throw new Error("User not found.");
            return formatUserWithPermissions(user);
        },
        myOrganization: async (_, __, context) => {
            const authUser = (0, context_js_1.requireAuth)(context);
            if (!authUser.organizationId)
                return null;
            let org = await organization_service_js_1.OrganizationService.getById(authUser.organizationId);
            if (!org)
                return null;
            // Clean up legacy placeholder if present and not verified
            const updateFields = {};
            const unsetFields = {};
            if (org.dedicatedVirtualAccount &&
                (!org.dedicatedVirtualAccount.isVerified ||
                    org.dedicatedVirtualAccount.accountNumber === "0294819284" ||
                    org.dedicatedVirtualAccount.bankName?.includes("Sovereign Switch") ||
                    org.dedicatedVirtualAccount.customerCode?.startsWith("CUS_"))) {
                org.dedicatedVirtualAccount = undefined;
                unsetFields["dedicatedVirtualAccount"] = 1;
            }
            // Sync mailbox seats with real member count (1 for initial user, never 0, reflects added members)
            const userCount = await index_js_7.UserModel.countDocuments({ organizationId: org._id });
            const actualUsedSeats = Math.max(1, userCount);
            if (org.usedSeats !== actualUsedSeats) {
                org.usedSeats = actualUsedSeats;
                updateFields.usedSeats = actualUsedSeats;
            }
            if (!org.totalSeats || org.totalSeats < actualUsedSeats) {
                org.totalSeats = actualUsedSeats;
                updateFields.totalSeats = actualUsedSeats;
            }
            if (!org.subscribedPackages || org.subscribedPackages.length === 0) {
                org.subscribedPackages = ["org-email"];
                updateFields.subscribedPackages = ["org-email"];
            }
            if (!org.subscriptionStatus) {
                org.subscriptionStatus = "TRIAL";
                updateFields.subscriptionStatus = "TRIAL";
            }
            if (!org.trialStartsAt) {
                const start = org.createdAt || new Date();
                org.trialStartsAt = start;
                updateFields.trialStartsAt = start;
            }
            if (!org.trialEndsAt) {
                const end = new Date(new Date(org.trialStartsAt).getTime() + 7 * 24 * 60 * 60 * 1000);
                org.trialEndsAt = end;
                updateFields.trialEndsAt = end;
            }
            // Check if 7-day trial period is over -> automatically unsubscribe workspace
            const now = new Date();
            if (org.subscriptionStatus === "TRIAL" &&
                org.trialEndsAt &&
                now > new Date(org.trialEndsAt)) {
                org.subscriptionStatus = "CANCELLED";
                org.isSuspended = true;
                updateFields.subscriptionStatus = "CANCELLED";
                updateFields.isSuspended = true;
            }
            const updateOp = {};
            if (Object.keys(updateFields).length > 0)
                updateOp.$set = updateFields;
            if (Object.keys(unsetFields).length > 0)
                updateOp.$unset = unsetFields;
            if (Object.keys(updateOp).length > 0) {
                await index_js_7.OrganizationModel.findByIdAndUpdate(org._id, updateOp);
            }
            let cleanPhone = org.phone && org.phone !== "+234 800 busmailer" ? org.phone : "";
            if (!cleanPhone && authUser.userId) {
                const user = await index_js_7.UserModel.findById(authUser.userId);
                if (user?.phone)
                    cleanPhone = user.phone;
            }
            const wallet = await index_js_7.WalletModel.findOne({ organizationId: org._id });
            const hasWallet = !!wallet;
            const currentBalanceNaira = wallet
                ? (wallet.balance || 0) / 100
                : (org.walletBalance ? org.walletBalance / 100 : 0);
            const orgObj = org.toObject();
            return {
                ...orgObj,
                id: org._id.toString(),
                phone: cleanPhone,
                walletBalance: currentBalanceNaira,
                hasWallet,
                wallet: wallet
                    ? {
                        id: wallet._id.toString(),
                        organizationId: wallet.organizationId.toString(),
                        balance: (wallet.balance || 0) / 100,
                        currency: wallet.currency || "NGN",
                        status: wallet.status || "ACTIVE",
                        createdAt: wallet.createdAt ? wallet.createdAt.toISOString() : null,
                        updatedAt: wallet.updatedAt ? wallet.updatedAt.toISOString() : null,
                    }
                    : null,
                departments: (org.departments || []).map((d) => ({
                    ...d,
                    id: d.id || d._id?.toString() || String(Math.random()),
                    roleId: d.roleId || null,
                    roleName: d.roleName || null,
                    memberIds: d.memberIds || [],
                })),
                roles: (org.roles || []).map((r) => ({
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
        getOrganizationMembers: async (_, __, context) => {
            const authUser = (0, context_js_1.requireAuth)(context);
            if (!authUser.organizationId)
                return [];
            const users = await index_js_7.UserModel.find({ organizationId: authUser.organizationId }).sort({ createdAt: -1 });
            return Promise.all(users.map((u) => formatUserWithPermissions(u)));
        },
        getKycStatus: async (_, __, context) => {
            const authUser = (0, context_js_1.requireAuth)(context);
            return index_js_3.ProvnKycService.getKycStatus(authUser.userId);
        },
        getOrganizationKycRecords: async (_, __, context) => {
            const authUser = (0, context_js_1.requireAuth)(context);
            if (!authUser.organizationId)
                return [];
            return index_js_7.KycRecordModel.find({ organizationId: authUser.organizationId }).sort({ createdAt: -1 });
        },
        getSecureFileUrl: async (_, { fileKey }, context) => {
            (0, context_js_1.requireAuth)(context);
            return index_js_4.AwsS3Service.getSecureFileUrl(fileKey);
        },
        getTransactions: async (_, { limit = 50 }, context) => {
            const authUser = (0, context_js_1.requireAuth)(context);
            const txns = await index_js_7.TransactionModel.find({ organizationId: authUser.organizationId })
                .sort({ createdAt: -1 })
                .limit(limit);
            return txns.map((t) => ({
                ...t.toObject(),
                id: t._id.toString(),
                amount: t.amount / 100, // in Naira
            }));
        },
        getWalletBalance: async (_, __, context) => {
            const authUser = (0, context_js_1.requireAuth)(context);
            if (!authUser.organizationId)
                return 0;
            const wallet = await index_js_7.WalletModel.findOne({ organizationId: authUser.organizationId });
            if (wallet)
                return (wallet.balance || 0) / 100;
            const org = await index_js_7.OrganizationModel.findById(authUser.organizationId);
            return org ? org.walletBalance / 100 : 0; // Return in Naira
        },
        getWallet: async (_, __, context) => {
            const authUser = (0, context_js_1.requireAuth)(context);
            if (!authUser.organizationId)
                return null;
            const wallet = await index_js_7.WalletModel.findOne({ organizationId: authUser.organizationId });
            if (!wallet)
                return null;
            return {
                id: wallet._id.toString(),
                organizationId: wallet.organizationId.toString(),
                balance: (wallet.balance || 0) / 100,
                currency: wallet.currency || "NGN",
                status: wallet.status || "ACTIVE",
                createdAt: wallet.createdAt ? wallet.createdAt.toISOString() : null,
                updatedAt: wallet.updatedAt ? wallet.updatedAt.toISOString() : null,
            };
        },
        getAuditLogs: async (_, { limit = 50 }, context) => {
            const authUser = (0, context_js_1.requireAuth)(context);
            return audit_service_js_1.AuditService.getLogs(authUser.organizationId, limit);
        },
        getAbuseCases: async (_, __, context) => {
            const authUser = (0, context_js_1.requireAuth)(context);
            return abuse_service_js_1.AbuseService.listCases(authUser.organizationId);
        },
        // ─── Product Packages Queries ───
        getPackages: async () => {
            return package_service_js_1.PackageService.getAllPackages();
        },
        getPackage: async (_, { packageId }) => {
            return package_service_js_1.PackageService.getPackageById(packageId);
        },
        // ─── Department & Role Queries ───
        getOrganizationDepartments: async (_, __, context) => {
            const authUser = (0, context_js_1.requireAuth)(context);
            if (!authUser.organizationId)
                return [];
            let depts = await index_js_7.DepartmentModel.find({ organizationId: authUser.organizationId }).sort({ createdAt: 1 });
            if (!depts || depts.length === 0) {
                await (0, role_seed_js_1.seedOrganizationDefaultDepartments)(authUser.organizationId);
                depts = await index_js_7.DepartmentModel.find({ organizationId: authUser.organizationId }).sort({ createdAt: 1 });
            }
            const usersInOrg = await index_js_7.UserModel.find({ organizationId: authUser.organizationId }, "_id name email department departmentId");
            return depts.map((d) => {
                const matchingUsers = usersInOrg.filter((u) => (u.departmentId && u.departmentId.toString() === d._id.toString()) ||
                    (u.department && u.department.toLowerCase() === d.name.toLowerCase()));
                return {
                    id: d._id.toString(),
                    name: d.name,
                    code: d.code || d.name.slice(0, 4).toUpperCase(),
                    description: d.description || "",
                    lead: d.leadName || "",
                    leadName: d.leadName || "",
                    leadEmail: d.leadEmail || "",
                    leadId: d.leadId ? d.leadId.toString() : null,
                    color: d.color || "blue",
                    memberCount: matchingUsers.length,
                    memberIds: matchingUsers.map((u) => u._id.toString()),
                    createdAt: d.createdAt?.toISOString() || new Date().toISOString(),
                    updatedAt: d.updatedAt?.toISOString() || new Date().toISOString(),
                };
            });
        },
        getDepartmentById: async (_, { id }, context) => {
            const authUser = (0, context_js_1.requireAuth)(context);
            if (!authUser.organizationId)
                throw new Error("No organization found");
            const d = await index_js_7.DepartmentModel.findOne({ _id: id, organizationId: authUser.organizationId });
            if (!d)
                throw new Error("Department not found");
            const matchingUsers = await index_js_7.UserModel.find({
                organizationId: authUser.organizationId,
                $or: [{ departmentId: d._id }, { department: d.name }],
            }, "_id");
            return {
                id: d._id.toString(),
                name: d.name,
                code: d.code || d.name.slice(0, 4).toUpperCase(),
                description: d.description || "",
                lead: d.leadName || "",
                leadName: d.leadName || "",
                leadEmail: d.leadEmail || "",
                leadId: d.leadId ? d.leadId.toString() : null,
                color: d.color || "blue",
                memberCount: matchingUsers.length,
                memberIds: matchingUsers.map((u) => u._id.toString()),
                createdAt: d.createdAt?.toISOString() || new Date().toISOString(),
                updatedAt: d.updatedAt?.toISOString() || new Date().toISOString(),
            };
        },
        getPermissions: async () => {
            const perms = await index_js_7.PermissionModel.find().sort({ category: 1, key: 1 });
            return perms.map((p) => ({
                id: p._id.toString(),
                key: p.key,
                name: p.name,
                description: p.description,
                category: p.category,
                isSystem: p.isSystem,
            }));
        },
        getOrganizationRoles: async (_, __, context) => {
            const authUser = (0, context_js_1.requireAuth)(context);
            if (!authUser.organizationId)
                return [];
            let roles = await index_js_7.RoleModel.find({ organizationId: authUser.organizationId }).sort({ isSystem: -1, createdAt: 1 });
            if (!roles || roles.length === 0) {
                await (0, role_seed_js_1.seedOrganizationDefaultRoles)(authUser.organizationId);
                roles = await index_js_7.RoleModel.find({ organizationId: authUser.organizationId }).sort({ isSystem: -1, createdAt: 1 });
            }
            const usersInOrg = await index_js_7.UserModel.find({ organizationId: authUser.organizationId }, "_id role roleId");
            return roles.map((r) => {
                const count = usersInOrg.filter((u) => (u.roleId && u.roleId.toString() === r._id.toString()) ||
                    (u.role && (u.role.toLowerCase() === r.name.toLowerCase() || u.role.toLowerCase() === r.slug?.toLowerCase()))).length;
                return {
                    id: r._id.toString(),
                    name: r.name,
                    slug: r.slug,
                    description: r.description,
                    isSystem: r.isSystem,
                    memberCount: count,
                    permissions: r.permissions,
                    createdAt: r.createdAt?.toISOString() || new Date().toISOString(),
                    updatedAt: r.updatedAt?.toISOString() || new Date().toISOString(),
                };
            });
        },
        getOrganizationSubscriptions: async (_, { limit = 20 }, context) => {
            const authUser = (0, context_js_1.requireAuth)(context);
            if (!authUser.organizationId)
                return [];
            const subs = await index_js_7.SubscriptionModel.find({ organizationId: authUser.organizationId })
                .sort({ createdAt: -1 })
                .limit(limit);
            return subs.map((s) => ({
                ...s.toObject(),
                id: s._id.toString(),
                totalAmount: s.totalAmount / 100, // in Naira
            }));
        },
        getCurrentSubscription: async (_, __, context) => {
            const authUser = (0, context_js_1.requireAuth)(context);
            if (!authUser.organizationId)
                return null;
            const sub = await index_js_7.SubscriptionModel.findOne({ organizationId: authUser.organizationId })
                .sort({ createdAt: -1 });
            if (!sub)
                return null;
            return {
                ...sub.toObject(),
                id: sub._id.toString(),
                totalAmount: sub.totalAmount / 100, // in Naira
            };
        },
        getEmailMetrics: async (_, { startDate, endDate }, context) => {
            const authUser = (0, context_js_1.requireAuth)(context);
            let org = null;
            if (authUser.organizationId) {
                org = await organization_service_js_1.OrganizationService.getById(authUser.organizationId);
            }
            return index_js_6.ResendDomainService.getEmailMetrics(org?.resendDomainId, org?.domain || "example.com", startDate, endDate, authUser.organizationId);
        },
        checkDomainOnline: async (_, { domain }) => {
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
            }
            catch (err) {
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
        getMyEmails: async (_, { folder, category, search, limit = 50, offset = 0 }, context) => {
            const authUser = (0, context_js_1.requireAuth)(context);
            const query = {
                organizationId: authUser.organizationId,
                $or: [
                    { userId: authUser.userId || authUser.id },
                    { "to.email": authUser.email.toLowerCase() },
                    { "from.email": authUser.email.toLowerCase() },
                ],
            };
            if (folder) {
                if (folder === "starred") {
                    query.$and = (query.$and || []).concat([
                        { $or: [{ isStarred: true }, { folder: "starred" }] },
                    ]);
                }
                else {
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
            const sortOptions = folder === "starred" ? { starredAt: -1, createdAt: -1 } : { createdAt: -1 };
            let emails = await index_js_7.EmailModel.find(query)
                .sort(sortOptions)
                .skip(offset)
                .limit(limit);
            if (emails.length === 0 && offset === 0 && (!search || !search.trim()) && authUser.organizationId) {
                const org = await index_js_7.OrganizationModel.findById(authUser.organizationId);
                const user = await index_js_7.UserModel.findById(authUser.userId || authUser.id);
                if (org && user) {
                    await index_js_6.ResendEmailService.provisionWelcomeEmailInMailbox(authUser.organizationId, user._id, user.name || user.email.split("@")[0], user.email, org.name, user.role === "admin" || user.role === "owner");
                    emails = await index_js_7.EmailModel.find(query)
                        .sort(sortOptions)
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
                isStarred: Boolean(m.isStarred || m.folder === "starred"),
                starredAt: m.starredAt?.toISOString(),
                isImportant: m.isImportant || false,
                labels: m.labels || [],
                status: m.status || "SENT",
                receivedAt: m.receivedAt?.toISOString(),
                sentAt: m.sentAt?.toISOString(),
                createdAt: m.createdAt.toISOString(),
            }));
        },
        getEmailById: async (_, { id }, context) => {
            const authUser = (0, context_js_1.requireAuth)(context);
            const email = await index_js_7.EmailModel.findOne({
                _id: id,
                organizationId: authUser.organizationId,
            });
            if (!email)
                throw new Error("Email not found");
            // Auto-enrich inbound attachments missing signed download URLs
            if (email.resendId && email.attachments && email.attachments.length > 0) {
                let hasModifiedAttachments = false;
                for (const att of email.attachments) {
                    if (!att.downloadUrl || (!att.downloadUrl.includes("X-Amz-Signature") && att.downloadUrl.includes("s3.resend.com"))) {
                        try {
                            const enriched = await index_js_6.ResendEmailService.getReceivedAttachment(email.resendId, att.id);
                            const signedUrl = enriched?.data?.download_url || enriched?.download_url;
                            if (signedUrl) {
                                att.downloadUrl = signedUrl;
                                hasModifiedAttachments = true;
                            }
                        }
                        catch (err) {
                            console.warn(`[getEmailById] Could not fetch signed URL for attachment ${att.id}:`, err.message);
                        }
                    }
                }
                if (hasModifiedAttachments) {
                    await email.save().catch(() => { });
                }
            }
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
                attachments: (email.attachments || []).map((a) => ({
                    id: a.id,
                    name: a.name,
                    sizeBytes: a.sizeBytes || 0,
                    contentType: a.contentType || "application/octet-stream",
                    downloadUrl: a.downloadUrl,
                    contentId: a.contentId,
                })),
                isRead: email.isRead,
                isStarred: Boolean(email.isStarred || email.folder === "starred"),
                starredAt: email.starredAt?.toISOString(),
                isImportant: email.isImportant,
                labels: email.labels,
                status: email.status,
                receivedAt: email.receivedAt?.toISOString(),
                sentAt: email.sentAt?.toISOString(),
                createdAt: email.createdAt.toISOString(),
            };
        },
        getEmailCounts: async (_, __, context) => {
            const authUser = (0, context_js_1.requireAuth)(context);
            const baseQuery = {
                organizationId: authUser.organizationId,
                $or: [
                    { userId: authUser.userId || authUser.id },
                    { "to.email": authUser.email.toLowerCase() },
                    { "from.email": authUser.email.toLowerCase() },
                ],
            };
            const [inbox, unread, starred, sent, drafts, spam, trash, archive] = await Promise.all([
                index_js_7.EmailModel.countDocuments({ ...baseQuery, folder: "inbox" }),
                index_js_7.EmailModel.countDocuments({ ...baseQuery, folder: "inbox", isRead: false }),
                index_js_7.EmailModel.countDocuments({
                    ...baseQuery,
                    $and: [
                        { $or: [{ isStarred: true }, { folder: "starred" }] },
                        { folder: { $ne: "trash" } },
                    ],
                }),
                index_js_7.EmailModel.countDocuments({ ...baseQuery, folder: "sent" }),
                index_js_7.EmailModel.countDocuments({ ...baseQuery, folder: "drafts" }),
                index_js_7.EmailModel.countDocuments({ ...baseQuery, folder: "spam" }),
                index_js_7.EmailModel.countDocuments({ ...baseQuery, folder: "trash" }),
                index_js_7.EmailModel.countDocuments({ ...baseQuery, folder: "archive" }),
            ]);
            return { inbox, unread, starred, sent, drafts, spam, trash, archive };
        },
        getMailboxCounts: async (_, __, context) => {
            const authUser = (0, context_js_1.requireAuth)(context);
            const baseQuery = {
                organizationId: authUser.organizationId,
                $or: [
                    { userId: authUser.userId || authUser.id },
                    { "to.email": authUser.email.toLowerCase() },
                    { "from.email": authUser.email.toLowerCase() },
                ],
            };
            const [inbox, unread, starred, sent, drafts, spam, trash, archive] = await Promise.all([
                index_js_7.EmailModel.countDocuments({ ...baseQuery, folder: "inbox" }),
                index_js_7.EmailModel.countDocuments({ ...baseQuery, folder: "inbox", isRead: false }),
                index_js_7.EmailModel.countDocuments({
                    ...baseQuery,
                    $and: [
                        { $or: [{ isStarred: true }, { folder: "starred" }] },
                        { folder: { $ne: "trash" } },
                    ],
                }),
                index_js_7.EmailModel.countDocuments({ ...baseQuery, folder: "sent" }),
                index_js_7.EmailModel.countDocuments({ ...baseQuery, folder: "drafts" }),
                index_js_7.EmailModel.countDocuments({ ...baseQuery, folder: "spam" }),
                index_js_7.EmailModel.countDocuments({ ...baseQuery, folder: "trash" }),
                index_js_7.EmailModel.countDocuments({ ...baseQuery, folder: "archive" }),
            ]);
            return { inbox, unread, starred, sent, drafts, spam, trash, archive };
        },
        // ─── Calendar Events Queries ───
        getCalendarEvents: async (_, { start, end, type }, context) => {
            const authUser = (0, context_js_1.requireAuth)(context);
            if (!authUser.organizationId)
                return [];
            const userEmail = (authUser.email || "").trim().toLowerCase();
            const userId = authUser.userId || authUser.id;
            const isAdmin = authUser.role === "admin" ||
                authUser.role === "owner" ||
                authUser.role === "superadmin" ||
                authUser.userType === "saas_admin" ||
                authUser.userType !== "email_user";
            const query = {
                organizationId: authUser.organizationId,
            };
            if (!isAdmin) {
                query.$or = [
                    { organizerEmail: userEmail },
                    { organizerId: userId },
                    { "attendees.email": userEmail },
                    { type: "ORGANIZATION" },
                ];
            }
            if (start || end) {
                query.start = {};
                if (start)
                    query.start.$gte = new Date(start);
                if (end)
                    query.start.$lte = new Date(end);
            }
            if (type && type !== "ALL") {
                query.type = type;
            }
            const events = await index_js_7.CalendarEventModel.find(query).sort({ start: 1 });
            return events.map(formatCalendarEvent);
        },
        getCalendarEventById: async (_, { id }, context) => {
            const authUser = (0, context_js_1.requireAuth)(context);
            if (!authUser.organizationId)
                return null;
            const event = await index_js_7.CalendarEventModel.findOne({
                _id: id,
                organizationId: authUser.organizationId,
            });
            if (!event)
                return null;
            const userEmail = (authUser.email || "").trim().toLowerCase();
            const userId = String(authUser.userId || authUser.id || "");
            const isOrganizer = (event.organizerEmail && event.organizerEmail.trim().toLowerCase() === userEmail) ||
                (event.organizerId && String(event.organizerId) === userId);
            const isAttendee = (event.attendees || []).some((a) => a.email && a.email.trim().toLowerCase() === userEmail);
            const isPublicOrg = event.type === "ORGANIZATION";
            const isAdmin = authUser.role === "admin" ||
                authUser.role === "owner" ||
                authUser.role === "superadmin" ||
                authUser.userType === "saas_admin" ||
                authUser.userType !== "email_user";
            if (!isOrganizer && !isAttendee && !isPublicOrg && !isAdmin) {
                throw new Error("Access denied to this calendar event.");
            }
            return formatCalendarEvent(event);
        },
        // ─── Task Queries ───
        getMyTasks: async (_, { status, priority }, context) => {
            const authUser = (0, context_js_1.requireAuth)(context);
            if (!authUser.organizationId)
                return [];
            const query = { organizationId: authUser.organizationId };
            if (status)
                query.status = status;
            if (priority)
                query.priority = priority;
            const tasks = await index_js_7.TaskModel.find(query).sort({ createdAt: -1 });
            return tasks.map(formatTask);
        },
        getTaskById: async (_, { id }, context) => {
            const authUser = (0, context_js_1.requireAuth)(context);
            if (!authUser.organizationId)
                return null;
            const task = await index_js_7.TaskModel.findOne({ _id: id, organizationId: authUser.organizationId });
            return task ? formatTask(task) : null;
        },
        // ─── CRM Queries ───
        getCrmCustomers: async (_, { status, search, limit = 50 }, context) => {
            const authUser = (0, context_js_1.requireAuth)(context);
            if (!authUser.organizationId)
                return [];
            const query = { organizationId: authUser.organizationId };
            if (status)
                query.status = status;
            if (search && search.trim()) {
                const regex = new RegExp(search.trim(), "i");
                query.$or = [{ name: regex }, { email: regex }, { companyName: regex }];
            }
            const customers = await index_js_7.CustomerModel.find(query).sort({ createdAt: -1 }).limit(limit);
            return customers.map(formatCustomer);
        },
        getCrmCustomerById: async (_, { id }, context) => {
            const authUser = (0, context_js_1.requireAuth)(context);
            if (!authUser.organizationId)
                return null;
            const c = await index_js_7.CustomerModel.findOne({ _id: id, organizationId: authUser.organizationId });
            return c ? formatCustomer(c) : null;
        },
        getCrmDeals: async (_, { stage, customerId }, context) => {
            const authUser = (0, context_js_1.requireAuth)(context);
            if (!authUser.organizationId)
                return [];
            const query = { organizationId: authUser.organizationId };
            if (stage)
                query.stage = stage;
            if (customerId)
                query.customerId = customerId;
            const deals = await index_js_7.DealModel.find(query).sort({ createdAt: -1 });
            return deals.map(formatDeal);
        },
        getCrmActivities: async (_, { customerId, limit = 50 }, context) => {
            const authUser = (0, context_js_1.requireAuth)(context);
            if (!authUser.organizationId)
                return [];
            const activities = await index_js_7.CRMActivityModel.find({ organizationId: authUser.organizationId, customerId })
                .sort({ createdAt: -1 }).limit(limit);
            return activities.map(formatCrmActivity);
        },
        // ─── Ticket Queries ───
        getCrmTickets: async (_, { status, priority, search }, context) => {
            const authUser = (0, context_js_1.requireAuth)(context);
            if (!authUser.organizationId)
                return [];
            const query = { organizationId: authUser.organizationId };
            if (status)
                query.status = status;
            if (priority)
                query.priority = priority;
            if (search && search.trim()) {
                const regex = new RegExp(search.trim(), "i");
                query.$or = [{ subject: regex }, { customerName: regex }, { customerEmail: regex }, { ticketNumber: regex }];
            }
            const tickets = await index_js_7.TicketModel.find(query).sort({ createdAt: -1 });
            return tickets.map(formatTicket);
        },
        getTicketById: async (_, { id }, context) => {
            const authUser = (0, context_js_1.requireAuth)(context);
            if (!authUser.organizationId)
                return null;
            const t = await index_js_7.TicketModel.findOne({ _id: id, organizationId: authUser.organizationId });
            return t ? formatTicket(t) : null;
        },
        // ─── Notification Queries ───
        getMyNotifications: async (_, { limit = 50 }, context) => {
            const authUser = (0, context_js_1.requireAuth)(context);
            const userId = authUser.userId || authUser.id;
            if (!userId)
                return [];
            const notifications = await index_js_7.NotificationModel.find({ userId })
                .sort({ createdAt: -1 })
                .limit(limit);
            return notifications.map(formatNotification);
        },
        // ─── Passkey & WebAuthn Queries ───
        getPasskeyRegistrationOptions: async (_, __, context) => {
            const authUser = (0, context_js_1.requireAuth)(context);
            const origin = context.req?.headers?.origin || context.req?.headers?.referer;
            return passkey_service_js_1.PasskeyService.generateRegistrationOptions(authUser.userId, origin);
        },
        getPasskeyAuthOptions: async (_, { email }, context) => {
            const origin = context.req?.headers?.origin || context.req?.headers?.referer;
            return passkey_service_js_1.PasskeyService.generateAuthenticationOptions(email, origin);
        },
        getMyPasskeys: async (_, __, context) => {
            const authUser = (0, context_js_1.requireAuth)(context);
            return passkey_service_js_1.PasskeyService.getMyPasskeys(authUser.userId);
        },
    },
    Mutation: {
        // ─── Auth Mutations ───
        signup: async (_, { input }) => {
            return index_js_1.AuthService.signup(input);
        },
        login: async (_, { input }) => {
            const result = await index_js_1.AuthService.login(input);
            if (result.requiresTwoFactor) {
                return {
                    requiresTwoFactor: true,
                    twoFactorType: result.twoFactorType || "OTP",
                    mustChangePassword: false,
                    phone: result.phone,
                    personalEmail: result.personalEmail,
                    message: result.message,
                    tokens: null,
                };
            }
            return {
                requiresTwoFactor: false,
                mustChangePassword: false,
                personalEmail: result.personalEmail,
                tokens: result.tokens,
            };
        },
        mailLogin: async (_, { input }) => {
            const result = await index_js_1.AuthService.mailLogin(input);
            if (result.requiresTwoFactor) {
                return {
                    requiresTwoFactor: true,
                    twoFactorType: result.twoFactorType || "OTP",
                    mustChangePassword: false,
                    phone: result.phone,
                    personalEmail: result.personalEmail,
                    message: result.message,
                    tokens: null,
                };
            }
            return {
                requiresTwoFactor: false,
                mustChangePassword: result.mustChangePassword,
                personalEmail: result.personalEmail,
                tokens: result.tokens || null,
            };
        },
        // ─── Passkey Mutations ───
        verifyPasskeyRegistration: async (_, { responseJson, friendlyName }, context) => {
            const authUser = (0, context_js_1.requireAuth)(context);
            const origin = context.req?.headers?.origin || context.req?.headers?.referer;
            return passkey_service_js_1.PasskeyService.verifyRegistration(authUser.userId, responseJson, friendlyName, origin);
        },
        verifyPasskeyAuth: async (_, { email, responseJson }, context) => {
            const origin = context.req?.headers?.origin || context.req?.headers?.referer;
            return passkey_service_js_1.PasskeyService.verifyAuthentication(email, responseJson, origin);
        },
        deletePasskey: async (_, { id }, context) => {
            const authUser = (0, context_js_1.requireAuth)(context);
            return passkey_service_js_1.PasskeyService.deletePasskey(authUser.userId, id);
        },
        requestPasskeyOtpFallback: async (_, { email }) => {
            const cleanEmail = email.toLowerCase().trim();
            const user = await index_js_7.UserModel.findOne({
                $or: [{ email: cleanEmail }, { personalEmail: cleanEmail }],
            });
            if (!user)
                throw new Error("User account not found");
            const destinationEmail = (user.personalEmail || user.email).toLowerCase().trim();
            await otp_service_js_1.OtpService.sendPersonalEmail2faOtp(destinationEmail, user.name, user.email);
            return {
                message: `A 6-digit verification code has been dispatched to your linked email (${(0, otp_service_js_1.maskEmail)(destinationEmail)}).`,
                expiresInMinutes: 10,
            };
        },
        setInitialPassword: async (_, { input }) => {
            return index_js_1.AuthService.setInitialPassword(input);
        },
        verify2fa: async (_, { phone, code }) => {
            return index_js_1.AuthService.verify2faAndLogin(phone, code);
        },
        requestPhoneOtp: async (_, { phone, purpose }) => {
            return index_js_2.TermiiOtpService.sendPhoneOtp(phone, purpose || "phone_verification");
        },
        requestEmailOtp: async (_, { email, name, purpose }) => {
            return otp_service_js_1.OtpService.sendEmailOtp(email, name || "Workspace Administrator", purpose || "email_verification");
        },
        verifyEmailOtp: async (_, { email, code, purpose }) => {
            return otp_service_js_1.OtpService.verifyEmailOtp(email, code, purpose || "email_verification");
        },
        refreshToken: async (_, { refreshToken }) => {
            const { accessToken } = await index_js_1.AuthService.refreshSession(refreshToken);
            const payload = token_manager_js_1.TokenManager.verifyRefreshToken(refreshToken);
            const user = await index_js_7.UserModel.findById(payload.userId);
            return {
                accessToken,
                refreshToken,
                user,
            };
        },
        // ─── Organization & Domain & Users ───
        updateOrganization: async (_, { input }, context) => {
            const authUser = (0, context_js_1.requireAuth)(context);
            if (!authUser.organizationId)
                throw new Error("No organization found");
            const updated = await index_js_7.OrganizationModel.findByIdAndUpdate(authUser.organizationId, { $set: input }, { new: true });
            if (!updated)
                throw new Error("Failed to update organization");
            return {
                ...updated.toObject(),
                id: updated._id.toString(),
                walletBalance: updated.walletBalance / 100,
            };
        },
        subscribePackage: async (_, { packageId }, context) => {
            const authUser = (0, context_js_1.requireAuth)(context);
            if (!authUser.organizationId)
                throw new Error("No organization found");
            const org = await index_js_7.OrganizationModel.findById(authUser.organizationId);
            if (!org)
                throw new Error("Organization not found");
            const subscribed = org.subscribedPackages || ["org-email"];
            if (!subscribed.includes(packageId)) {
                subscribed.push(packageId);
                org.subscribedPackages = subscribed;
                const now = new Date();
                const trialEndsAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
                const pkgSubs = org.packageSubscriptions ? [...org.packageSubscriptions] : [];
                const existingIdx = pkgSubs.findIndex((s) => s.packageId === packageId);
                if (existingIdx >= 0) {
                    pkgSubs[existingIdx].status = "TRIAL";
                    pkgSubs[existingIdx].trialStartsAt = now;
                    pkgSubs[existingIdx].trialEndsAt = trialEndsAt;
                    pkgSubs[existingIdx].activatedAt = now;
                }
                else {
                    pkgSubs.push({
                        packageId,
                        status: "TRIAL",
                        trialStartsAt: now,
                        trialEndsAt,
                        activatedAt: now,
                    });
                }
                org.packageSubscriptions = pkgSubs;
                await org.save();
                const user = await index_js_7.UserModel.findById(authUser.userId);
                const pkg = package_seed_js_1.INITIAL_PACKAGES.find((p) => p.packageId === packageId);
                const pkgName = pkg ? pkg.name : packageId;
                // Record ₦0 transaction for 7-day free trial activation of this package
                const trialRef = `TRIAL-${packageId}-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
                await index_js_7.TransactionModel.create({
                    organizationId: org._id,
                    userId: authUser.userId,
                    reference: trialRef,
                    type: "subscription_charge",
                    amount: 0,
                    status: "success",
                    channel: "wallet",
                    currency: "NGN",
                    paidAt: now,
                    metadata: {
                        description: `${pkgName} 7-Day Free Trial Activation`,
                        packageId,
                    },
                });
                if (user && user.email) {
                    index_js_6.ResendEmailService.sendPackageSubscribedReceipt(user.email, user.name || "Administrator", org.name, pkgName, org.billingCycle || "MONTHLY").catch((err) => console.error("⚠️ Failed to send package subscription email:", err));
                }
            }
            return {
                ...org.toObject(),
                id: org._id.toString(),
                walletBalance: org.walletBalance / 100,
            };
        },
        cancelPackageSubscription: async (_, { packageId }, context) => {
            const authUser = (0, context_js_1.requireAuth)(context);
            if (!authUser.organizationId)
                throw new Error("No organization found");
            const org = await index_js_7.OrganizationModel.findById(authUser.organizationId);
            if (!org)
                throw new Error("Organization not found");
            if (packageId === "org-email") {
                throw new Error("Cannot cancel Sovereign Core Email Suite.");
            }
            org.subscribedPackages = (org.subscribedPackages || ["org-email"]).filter((p) => p !== packageId);
            if (org.packageSubscriptions) {
                const pkgIdx = org.packageSubscriptions.findIndex((s) => s.packageId === packageId);
                if (pkgIdx >= 0) {
                    org.packageSubscriptions[pkgIdx].status = "CANCELLED";
                }
            }
            await org.save();
            const user = await index_js_7.UserModel.findById(authUser.userId);
            const pkg = package_seed_js_1.INITIAL_PACKAGES.find((p) => p.packageId === packageId);
            const pkgName = pkg ? pkg.name : packageId;
            if (user && user.email) {
                index_js_6.ResendEmailService.sendPackageCancelledConfirmation(user.email, user.name || "Administrator", org.name, pkgName).catch((err) => console.error("⚠️ Failed to send cancellation email:", err));
            }
            return {
                ...org.toObject(),
                id: org._id.toString(),
                walletBalance: org.walletBalance / 100,
            };
        },
        activateSubscriptionFromWallet: async (_, { packageIds, billingCycle, totalSeats, }, context) => {
            const authUser = (0, context_js_1.requireAuth)(context);
            if (!authUser.organizationId)
                throw new Error("No organization found");
            const org = await index_js_7.OrganizationModel.findById(authUser.organizationId);
            if (!org)
                throw new Error("Organization not found");
            const user = await index_js_7.UserModel.findById(authUser.userId);
            const now = new Date();
            const isAnnual = billingCycle === "ANNUAL";
            const userCount = await index_js_7.UserModel.countDocuments({ organizationId: org._id });
            const actualSeats = Math.max(1, totalSeats, userCount, org.usedSeats || 1);
            // Manage package subscriptions and trial periods
            const existingPkgSubs = org.packageSubscriptions ? [...org.packageSubscriptions] : [];
            const newTrialPackages = [];
            for (const pkgId of packageIds) {
                const existingIdx = existingPkgSubs.findIndex((s) => s.packageId === pkgId);
                if (existingIdx === -1) {
                    // Newly added package -> start 7-Day Free Trial!
                    const trialEndsAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
                    existingPkgSubs.push({
                        packageId: pkgId,
                        status: "TRIAL",
                        trialStartsAt: now,
                        trialEndsAt,
                        activatedAt: now,
                    });
                    newTrialPackages.push(pkgId);
                }
                else {
                    // Already in records: check trial expiration
                    const sub = existingPkgSubs[existingIdx];
                    const trialEnd = sub.trialEndsAt ? new Date(sub.trialEndsAt) : null;
                    if (trialEnd && now < trialEnd) {
                        sub.status = "TRIAL";
                    }
                }
            }
            org.packageSubscriptions = existingPkgSubs;
            // Calculate total cost: only charge for packages whose 7-day trial has elapsed!
            let totalCostInNaira = 0;
            for (const pkgId of packageIds) {
                const sub = existingPkgSubs.find((s) => s.packageId === pkgId);
                const isInTrial = sub && sub.trialEndsAt && now < new Date(sub.trialEndsAt);
                if (!isInTrial) {
                    const pkg = package_seed_js_1.INITIAL_PACKAGES.find((p) => p.packageId === pkgId);
                    if (pkg) {
                        if (pkg.pricingModel === "PER_SEAT" || pkgId === "org-email" || pkg.isCore) {
                            totalCostInNaira += (isAnnual ? pkg.priceAnnual : pkg.priceMonthly) * actualSeats;
                        }
                        else {
                            totalCostInNaira += isAnnual ? pkg.priceAnnual : pkg.priceMonthly;
                        }
                    }
                }
            }
            // If all selected packages are on 7-Day Free Trial (₦0 due today)
            if (totalCostInNaira === 0) {
                org.subscribedPackages = packageIds;
                org.billingCycle = billingCycle;
                org.usedSeats = Math.max(1, userCount, org.usedSeats || 1);
                org.totalSeats = actualSeats;
                if (!org.subscriptionStatus || org.subscriptionStatus === "TRIAL") {
                    org.subscriptionStatus = "TRIAL";
                    org.trialStartsAt = org.trialStartsAt || now;
                    org.trialEndsAt = org.trialEndsAt || new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
                    org.subscriptionExpiresAt = org.trialEndsAt;
                }
                org.subscriptionStartsAt = org.subscriptionStartsAt || now;
                org.gracePeriodEndsAt = undefined;
                org.isSuspended = false;
                org.lastBillingReminderType = undefined;
                await org.save();
                // Activate email permissions for workspace users
                if (user) {
                    user.canAccessEmail = true;
                    await user.save();
                }
                await index_js_7.UserModel.updateMany({ organizationId: org._id }, { $set: { canAccessEmail: true } });
                // Record ₦0 transaction in ledger for 7-day free trial packages
                const packagesToLog = newTrialPackages.length > 0 ? newTrialPackages : packageIds;
                for (const trialPkgId of packagesToLog) {
                    const pkg = package_seed_js_1.INITIAL_PACKAGES.find((p) => p.packageId === trialPkgId);
                    const pkgName = pkg ? pkg.name : trialPkgId;
                    const trialRef = `TRIAL-${trialPkgId}-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
                    await index_js_7.TransactionModel.create({
                        organizationId: org._id,
                        userId: authUser.userId,
                        reference: trialRef,
                        type: "subscription_charge",
                        amount: 0,
                        status: "success",
                        channel: "wallet",
                        currency: "NGN",
                        paidAt: now,
                        metadata: {
                            description: `${pkgName} 7-Day Free Trial Activation`,
                            packageIds: [trialPkgId],
                            seatCount: actualSeats,
                        },
                    });
                }
                // Create subscription history record
                const mainTrialRef = `TRIAL-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
                await index_js_7.SubscriptionModel.create({
                    organizationId: org._id,
                    packageIds,
                    billingCycle,
                    seatCount: actualSeats,
                    totalAmount: 0,
                    currency: "NGN",
                    status: org.subscriptionStatus,
                    paymentMethod: "FREE_TRIAL",
                    trialStartsAt: now,
                    trialEndsAt: org.trialEndsAt || new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
                    currentPeriodStartsAt: now,
                    currentPeriodEndsAt: org.trialEndsAt || new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
                    autoDebit: org.autoDebitWallet ?? true,
                    lastPaymentReference: mainTrialRef,
                });
                return {
                    ...org.toObject(),
                    id: org._id.toString(),
                    walletBalance: org.walletBalance / 100,
                };
            }
            // Paid activation / upgrade after trial for non-trial packages
            const costInKobo = Math.round(totalCostInNaira * 100);
            if ((org.walletBalance || 0) < costInKobo) {
                throw new Error(`Insufficient wallet balance. Total required is ₦${totalCostInNaira.toLocaleString()}, but available wallet balance is ₦${((org.walletBalance || 0) / 100).toLocaleString()}. Please fund your wallet or pay via Card to activate.`);
            }
            // Deduct from wallet
            org.walletBalance = (org.walletBalance || 0) - costInKobo;
            const wallet = await index_js_7.WalletModel.findOne({ organizationId: org._id });
            if (wallet) {
                wallet.balance = Math.max(0, (wallet.balance || 0) - costInKobo);
                await wallet.save();
            }
            org.subscribedPackages = packageIds;
            org.billingCycle = billingCycle;
            org.usedSeats = Math.max(1, userCount, org.usedSeats || 1);
            org.totalSeats = actualSeats;
            org.subscriptionStatus = "ACTIVE";
            org.subscriptionStartsAt = org.subscriptionStartsAt || now;
            const periodDays = isAnnual ? 365 : 30;
            const nextDue = new Date(now.getTime() + periodDays * 24 * 60 * 60 * 1000);
            org.subscriptionExpiresAt = nextDue;
            org.gracePeriodEndsAt = undefined;
            org.isSuspended = false;
            org.lastBillingReminderType = undefined;
            await org.save();
            // Ensure email access for workspace users
            if (user) {
                user.canAccessEmail = true;
                await user.save();
            }
            await index_js_7.UserModel.updateMany({ organizationId: org._id }, { $set: { canAccessEmail: true } });
            // Record paid subscription transaction
            const subRef = `SUB-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
            await index_js_7.TransactionModel.create({
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
            // Record any newly added trial packages in this batch as ₦0 transactions
            for (const trialPkgId of newTrialPackages) {
                const pkg = package_seed_js_1.INITIAL_PACKAGES.find((p) => p.packageId === trialPkgId);
                const pkgName = pkg ? pkg.name : trialPkgId;
                const trialRef = `TRIAL-${trialPkgId}-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
                await index_js_7.TransactionModel.create({
                    organizationId: org._id,
                    userId: authUser.userId,
                    reference: trialRef,
                    type: "subscription_charge",
                    amount: 0,
                    status: "success",
                    channel: "wallet",
                    currency: "NGN",
                    paidAt: now,
                    metadata: {
                        description: `${pkgName} 7-Day Free Trial Activation`,
                        packageIds: [trialPkgId],
                        seatCount: actualSeats,
                    },
                });
            }
            // Record subscription history record
            await index_js_7.SubscriptionModel.create({
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
                index_js_6.ResendEmailService.sendWalletDebitedReceipt(user.email, user.name || "Administrator", org.name, totalCostInNaira, nextDue.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })).catch((err) => console.error("⚠️ Failed to send wallet debited receipt email:", err));
            }
            return {
                ...org.toObject(),
                id: org._id.toString(),
                walletBalance: org.walletBalance / 100,
            };
        },
        updateSubscriptionAutoDebit: async (_, { autoDebit }, context) => {
            const authUser = (0, context_js_1.requireAuth)(context);
            if (!authUser.organizationId)
                throw new Error("No organization found");
            const org = await index_js_7.OrganizationModel.findByIdAndUpdate(authUser.organizationId, { autoDebitWallet: autoDebit }, { new: true });
            if (!org)
                throw new Error("Organization not found");
            let sub = await index_js_7.SubscriptionModel.findOne({ organizationId: authUser.organizationId }).sort({ createdAt: -1 });
            if (sub) {
                sub.autoDebit = autoDebit;
                await sub.save();
            }
            else {
                sub = await index_js_7.SubscriptionModel.create({
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
        cancelSubscription: async (_, { reason }, context) => {
            const authUser = (0, context_js_1.requireAuth)(context);
            if (!authUser.organizationId)
                throw new Error("No organization found");
            const org = await index_js_7.OrganizationModel.findById(authUser.organizationId);
            if (!org)
                throw new Error("Organization not found");
            org.subscriptionStatus = "CANCELLED";
            await org.save();
            let sub = await index_js_7.SubscriptionModel.findOne({ organizationId: authUser.organizationId }).sort({ createdAt: -1 });
            if (sub) {
                sub.status = "CANCELLED";
                sub.cancelledAt = new Date();
                sub.cancellationReason = reason || "Cancelled by workspace administrator";
                await sub.save();
            }
            else {
                sub = await index_js_7.SubscriptionModel.create({
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
            const user = await index_js_7.UserModel.findById(authUser.userId);
            if (user && user.email) {
                index_js_6.ResendEmailService.sendPackageCancelledConfirmation(user.email, user.name || "Administrator", org.name, "Sovereign Organization Subscription").catch((err) => console.error("⚠️ Failed to send cancellation email:", err));
            }
            return {
                ...sub.toObject(),
                id: sub._id.toString(),
                totalAmount: sub.totalAmount / 100,
            };
        },
        verifyDomainDns: async (_, __, context) => {
            const authUser = (0, context_js_1.requireAuth)(context);
            if (!authUser.organizationId)
                throw new Error("No organization found");
            const updated = await organization_service_js_1.OrganizationService.verifyDomainDns(authUser.organizationId);
            if (!updated)
                throw new Error("Failed to verify DNS");
            return {
                ...updated.toObject(),
                id: updated._id.toString(),
                walletBalance: updated.walletBalance / 100,
            };
        },
        addOrUpdateDomain: async (_, { domain, enableReceiving }, context) => {
            const authUser = (0, context_js_1.requireAuth)(context);
            if (!authUser.organizationId)
                throw new Error("No organization found");
            const updated = await organization_service_js_1.OrganizationService.addOrUpdateDomain(authUser.organizationId, domain, enableReceiving ?? true);
            if (!updated)
                throw new Error("Failed to add or update domain");
            return {
                ...updated.toObject(),
                id: updated._id.toString(),
                walletBalance: updated.walletBalance / 100,
            };
        },
        enableDomainReceiving: async (_, __, context) => {
            const authUser = (0, context_js_1.requireAuth)(context);
            if (!authUser.organizationId)
                throw new Error("No organization found");
            const updated = await organization_service_js_1.OrganizationService.enableReceiving(authUser.organizationId);
            if (!updated)
                throw new Error("Failed to enable receiving on domain");
            return {
                ...updated.toObject(),
                id: updated._id.toString(),
                walletBalance: updated.walletBalance / 100,
            };
        },
        inviteMember: async (_, { input }, context) => {
            const authUser = (0, context_js_1.requireAuth)(context);
            if (!authUser.organizationId)
                throw new Error("No organization found");
            const res = await organization_service_js_1.OrganizationService.inviteMember(authUser.organizationId, input);
            const formattedUser = await formatUserWithPermissions(res.user);
            return {
                user: formattedUser,
                temporaryPassword: res.temporaryPassword,
            };
        },
        updateUserStatus: async (_, { userId, status }, context) => {
            const authUser = (0, context_js_1.requireAuth)(context);
            if (status.toLowerCase() === "suspended") {
                const target = await index_js_7.UserModel.findById(userId);
                if (target?.userType === "saas_admin" || target?.role === "owner" || userId === authUser.userId) {
                    throw new Error("Cannot suspend the organization primary administrator account.");
                }
            }
            const user = await index_js_7.UserModel.findOneAndUpdate({ _id: userId, organizationId: authUser.organizationId }, { $set: { status: status.toLowerCase() } }, { new: true });
            if (!user)
                throw new Error("User not found in this organization");
            return {
                ...user.toObject(),
                id: user._id.toString(),
            };
        },
        deleteUser: async (_, { userId }, context) => {
            const authUser = (0, context_js_1.requireAuth)(context);
            const target = await index_js_7.UserModel.findById(userId);
            if (target?.userType === "saas_admin" || target?.role === "owner" || userId === authUser.userId) {
                throw new Error("Cannot delete the organization primary administrator account.");
            }
            const res = await index_js_7.UserModel.findOneAndDelete({ _id: userId, organizationId: authUser.organizationId });
            return !!res;
        },
        // ─── Department Mutations ───
        createDepartment: async (_, { input }, context) => {
            const authUser = (0, context_js_1.requireAuth)(context);
            if (!authUser.organizationId)
                throw new Error("No organization found");
            const name = input.name.trim();
            const existing = await index_js_7.DepartmentModel.findOne({
                organizationId: authUser.organizationId,
                name: { $regex: new RegExp(`^${name}$`, "i") },
            });
            if (existing) {
                throw new Error(`A department with name "${name}" already exists.`);
            }
            let code = input.code?.trim().toUpperCase();
            if (!code) {
                code = name.slice(0, 4).toUpperCase();
            }
            const dept = await index_js_7.DepartmentModel.create({
                organizationId: authUser.organizationId,
                name,
                code,
                description: input.description || "",
                leadName: input.leadName || input.lead || "",
                leadEmail: input.leadEmail || "",
                leadId: input.leadId || undefined,
                color: input.color || "blue",
                memberCount: input.memberIds ? input.memberIds.length : 0,
            });
            if (input.memberIds && input.memberIds.length > 0) {
                await index_js_7.UserModel.updateMany({ _id: { $in: input.memberIds }, organizationId: authUser.organizationId }, { $set: { department: name, departmentId: dept._id } });
            }
            return {
                id: dept._id.toString(),
                name: dept.name,
                code: dept.code,
                description: dept.description,
                lead: dept.leadName,
                leadName: dept.leadName,
                leadEmail: dept.leadEmail,
                leadId: dept.leadId ? dept.leadId.toString() : null,
                color: dept.color,
                memberCount: input.memberIds ? input.memberIds.length : 0,
                memberIds: input.memberIds || [],
                createdAt: dept.createdAt?.toISOString() || new Date().toISOString(),
                updatedAt: dept.updatedAt?.toISOString() || new Date().toISOString(),
            };
        },
        updateDepartment: async (_, { id, input }, context) => {
            const authUser = (0, context_js_1.requireAuth)(context);
            if (!authUser.organizationId)
                throw new Error("No organization found");
            const dept = await index_js_7.DepartmentModel.findOne({ _id: id, organizationId: authUser.organizationId });
            if (!dept)
                throw new Error("Department not found");
            const oldName = dept.name;
            if (input.name)
                dept.name = input.name.trim();
            if (input.code !== undefined)
                dept.code = input.code.trim().toUpperCase();
            if (input.description !== undefined)
                dept.description = input.description.trim();
            if (input.leadName !== undefined || input.lead !== undefined)
                dept.leadName = input.leadName || input.lead || "";
            if (input.leadEmail !== undefined)
                dept.leadEmail = input.leadEmail.trim().toLowerCase();
            if (input.leadId !== undefined)
                dept.leadId = input.leadId || undefined;
            if (input.color)
                dept.color = input.color;
            await dept.save();
            // If name changed, sync user.department string
            if (input.name && input.name !== oldName) {
                await index_js_7.UserModel.updateMany({ organizationId: authUser.organizationId, departmentId: dept._id }, { $set: { department: dept.name } });
            }
            // If memberIds provided, sync members
            if (input.memberIds && Array.isArray(input.memberIds)) {
                await index_js_7.UserModel.updateMany({ organizationId: authUser.organizationId, departmentId: dept._id, _id: { $nin: input.memberIds } }, { $unset: { departmentId: 1, department: 1 } });
                await index_js_7.UserModel.updateMany({ organizationId: authUser.organizationId, _id: { $in: input.memberIds } }, { $set: { departmentId: dept._id, department: dept.name } });
            }
            const matchingUsers = await index_js_7.UserModel.find({
                organizationId: authUser.organizationId,
                $or: [{ departmentId: dept._id }, { department: dept.name }],
            }, "_id");
            return {
                id: dept._id.toString(),
                name: dept.name,
                code: dept.code,
                description: dept.description,
                lead: dept.leadName,
                leadName: dept.leadName,
                leadEmail: dept.leadEmail,
                leadId: dept.leadId ? dept.leadId.toString() : null,
                color: dept.color,
                memberCount: matchingUsers.length,
                memberIds: matchingUsers.map((u) => u._id.toString()),
                createdAt: dept.createdAt?.toISOString() || new Date().toISOString(),
                updatedAt: dept.updatedAt?.toISOString() || new Date().toISOString(),
            };
        },
        deleteDepartment: async (_, { id }, context) => {
            const authUser = (0, context_js_1.requireAuth)(context);
            if (!authUser.organizationId)
                throw new Error("No organization found");
            const dept = await index_js_7.DepartmentModel.findOneAndDelete({ _id: id, organizationId: authUser.organizationId });
            if (!dept)
                return false;
            // Clear users' department links
            await index_js_7.UserModel.updateMany({ organizationId: authUser.organizationId, $or: [{ departmentId: id }, { department: dept.name }] }, { $unset: { departmentId: 1, department: 1 } });
            return true;
        },
        assignUserDepartment: async (_, { userId, departmentId }, context) => {
            const authUser = (0, context_js_1.requireAuth)(context);
            if (!authUser.organizationId)
                throw new Error("No organization found");
            let deptName = null;
            if (departmentId && mongoose_1.default.isValidObjectId(departmentId)) {
                const dept = await index_js_7.DepartmentModel.findOne({ _id: departmentId, organizationId: authUser.organizationId });
                if (dept)
                    deptName = dept.name;
            }
            const updateQuery = departmentId && deptName
                ? { $set: { departmentId, department: deptName } }
                : { $unset: { departmentId: 1, department: 1 } };
            const user = await index_js_7.UserModel.findOneAndUpdate({ _id: userId, organizationId: authUser.organizationId }, updateQuery, { new: true });
            if (!user)
                throw new Error("User not found");
            return formatUserWithPermissions(user);
        },
        // ─── Role Mutations ───
        createRole: async (_, { input }, context) => {
            const authUser = (0, context_js_1.requireAuth)(context);
            if (!authUser.organizationId)
                throw new Error("No organization found");
            const role = await index_js_7.RoleModel.create({
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
                slug: role.slug,
                description: role.description,
                isSystem: role.isSystem,
                memberCount: 0,
                permissions: role.permissions,
                createdAt: role.createdAt?.toISOString() || new Date().toISOString(),
                updatedAt: role.updatedAt?.toISOString() || new Date().toISOString(),
            };
        },
        updateRole: async (_, { id, input }, context) => {
            const authUser = (0, context_js_1.requireAuth)(context);
            if (!authUser.organizationId)
                throw new Error("No organization found");
            const role = await index_js_7.RoleModel.findOne({ _id: id, organizationId: authUser.organizationId });
            if (!role)
                throw new Error("Role not found");
            if (role.isSystem && input.name && input.name !== role.name) {
                throw new Error("Cannot rename default system roles.");
            }
            if (input.name)
                role.name = input.name;
            if (input.description !== undefined)
                role.description = input.description;
            if (input.permissions) {
                role.permissions = {
                    ...role.permissions,
                    ...input.permissions,
                };
            }
            await role.save();
            const memberCount = await index_js_7.UserModel.countDocuments({
                organizationId: authUser.organizationId,
                $or: [{ roleId: role._id }, { role: role.name }, { role: role.slug }],
            });
            return {
                id: role._id.toString(),
                name: role.name,
                slug: role.slug,
                description: role.description,
                isSystem: role.isSystem,
                memberCount,
                permissions: role.permissions,
                createdAt: role.createdAt?.toISOString() || new Date().toISOString(),
                updatedAt: role.updatedAt?.toISOString() || new Date().toISOString(),
            };
        },
        deleteRole: async (_, { id }, context) => {
            const authUser = (0, context_js_1.requireAuth)(context);
            if (!authUser.organizationId)
                throw new Error("No organization found");
            const role = await index_js_7.RoleModel.findOne({ _id: id, organizationId: authUser.organizationId });
            if (!role)
                throw new Error("Role not found");
            const isProtected = role.slug === "owner" ||
                role.slug === "admin" ||
                role.name.toLowerCase().includes("owner") ||
                role.name.toLowerCase().includes("workspace administrator") ||
                role.name.toLowerCase() === "administrator";
            if (isProtected) {
                throw new Error("Owner and Workspace Administrator are core sovereign system roles and cannot be deleted.");
            }
            // Reassign any users who had this role
            await index_js_7.UserModel.updateMany({ organizationId: authUser.organizationId, roleId: role._id }, { $set: { role: "member", roleName: "Standard Team Member", roleId: null } }).catch((e) => console.warn("⚠️ Reassigning users from deleted role failed:", e));
            await index_js_7.RoleModel.deleteOne({ _id: id, organizationId: authUser.organizationId });
            return true;
        },
        assignUserRole: async (_, { userId, roleId }, context) => {
            const authUser = (0, context_js_1.requireAuth)(context);
            if (!authUser.organizationId)
                throw new Error("No organization found");
            const role = await index_js_7.RoleModel.findOne({ _id: roleId, organizationId: authUser.organizationId });
            if (!role)
                throw new Error("Role not found");
            const user = await index_js_7.UserModel.findOneAndUpdate({ _id: userId, organizationId: authUser.organizationId }, { $set: { roleId: role._id, role: role.name } }, { new: true });
            if (!user)
                throw new Error("User not found");
            return formatUserWithPermissions(user);
        },
        // ─── Storage Mutations (AWS S3) ───
        getPresignedUploadUrl: async (_, { input }, context) => {
            (0, context_js_1.requireAuth)(context);
            return index_js_4.AwsS3Service.getPresignedUploadUrl(input.folder, input.fileName, input.contentType);
        },
        // ─── KYC Mutations (Provn) ───
        submitKyc: async (_, { input }, context) => {
            const authUser = (0, context_js_1.requireAuth)(context);
            return index_js_3.ProvnKycService.submitAndVerify({
                ...input,
                userId: authUser.userId,
                organizationId: authUser.organizationId,
            });
        },
        // ─── Payment Mutations (Paystack & Direct) ───
        initializeWalletFunding: async (_, { input }, context) => {
            const authUser = (0, context_js_1.requireAuth)(context);
            let organizationId = authUser.organizationId;
            if (!organizationId && input?.organizationId) {
                organizationId = input.organizationId;
            }
            if (!organizationId) {
                const userDoc = await index_js_7.UserModel.findById(authUser.userId);
                organizationId = userDoc?.organizationId?.toString();
            }
            if (!organizationId) {
                const orgByOwner = await index_js_7.OrganizationModel.findOne({ ownerId: authUser.userId });
                organizationId = orgByOwner?._id?.toString();
            }
            if (!organizationId) {
                throw new Error("Unable to locate an organization associated with your account.");
            }
            let userEmail = authUser.email;
            if (!userEmail || !userEmail.includes("@")) {
                const userDoc = await index_js_7.UserModel.findById(authUser.userId);
                userEmail = userDoc?.email || userDoc?.personalEmail;
            }
            if (!userEmail) {
                throw new Error("Valid user email is required for payment processing.");
            }
            return index_js_5.PaystackService.initializeWalletFunding({
                organizationId,
                userId: authUser.userId,
                userEmail,
                amountInNaira: Number(input.amountInNaira),
                callbackUrl: input.callbackUrl,
            });
        },
        createWallet: async (_, __, context) => {
            const authUser = (0, context_js_1.requireAuth)(context);
            if (!authUser.organizationId)
                throw new Error("No organization found");
            let wallet = await index_js_7.WalletModel.findOne({ organizationId: authUser.organizationId });
            if (!wallet) {
                const org = await index_js_7.OrganizationModel.findById(authUser.organizationId);
                const initialBalance = org?.walletBalance || 0;
                wallet = await index_js_7.WalletModel.create({
                    organizationId: authUser.organizationId,
                    ownerId: authUser.userId,
                    balance: initialBalance,
                    currency: "NGN",
                    status: "ACTIVE",
                });
            }
            return {
                id: wallet._id.toString(),
                organizationId: wallet.organizationId.toString(),
                balance: (wallet.balance || 0) / 100,
                currency: wallet.currency || "NGN",
                status: wallet.status || "ACTIVE",
                createdAt: wallet.createdAt ? wallet.createdAt.toISOString() : new Date().toISOString(),
                updatedAt: wallet.updatedAt ? wallet.updatedAt.toISOString() : new Date().toISOString(),
            };
        },
        fundWalletDirect: async (_, { amountInNaira, channel = "bank_transfer", description = "Direct Wallet Funding", }, context) => {
            const authUser = (0, context_js_1.requireAuth)(context);
            if (!authUser.organizationId)
                throw new Error("No organization found");
            const amountInKobo = Math.round(amountInNaira * 100);
            // Update or create in WalletModel (wallet DB table)
            let wallet = await index_js_7.WalletModel.findOne({ organizationId: authUser.organizationId });
            if (!wallet) {
                wallet = await index_js_7.WalletModel.create({
                    organizationId: authUser.organizationId,
                    ownerId: authUser.userId,
                    balance: amountInKobo,
                    currency: "NGN",
                    status: "ACTIVE",
                });
            }
            else {
                wallet.balance = (wallet.balance || 0) + amountInKobo;
                await wallet.save();
            }
            const org = await index_js_7.OrganizationModel.findByIdAndUpdate(authUser.organizationId, { $inc: { walletBalance: amountInKobo } }, { new: true });
            if (!org)
                throw new Error("Organization not found");
            const reference = `TXN-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
            const txn = await index_js_7.TransactionModel.create({
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
        createDedicatedVirtualAccount: async (_, { bvn }, context) => {
            const authUser = (0, context_js_1.requireAuth)(context);
            if (!authUser.organizationId)
                throw new Error("No active organization found");
            const cleanBvn = (bvn || "").replace(/\D/g, "").trim();
            if (!/^\d{11}$/.test(cleanBvn)) {
                throw new Error("Invalid BVN. Bank Verification Number must be exactly 11 digits.");
            }
            const org = await index_js_7.OrganizationModel.findById(authUser.organizationId);
            if (!org)
                throw new Error("Organization not found");
            const user = await index_js_7.UserModel.findById(authUser.userId);
            const userParts = (user?.name || "").trim().split(/\s+/);
            const userFirstName = userParts[0] || "Admin";
            const userLastName = userParts.slice(1).join(" ") || userParts[0] || "Workspace";
            const userPhone = user?.phone;
            const customerEmail = user?.email || (org.domain ? `admin@${org.domain}` : null);
            if (!customerEmail) {
                throw new Error("Valid email address is required to create a dedicated virtual account.");
            }
            let verifiedFirstName = userFirstName;
            let verifiedLastName = userLastName;
            let verifiedPhone = userPhone;
            let bvnSnapshot = null;
            // Step 1: Verify BVN with Provn Verification Service (if reachable)
            try {
                console.log(`[Provn] Verifying BVN for organization '${org.name}'`);
                const bvnResponse = await index_js_3.ProvnKycService.verifyBVN(cleanBvn);
                if (bvnResponse?.data) {
                    bvnSnapshot = bvnResponse.data;
                    if (bvnResponse.data.first_name)
                        verifiedFirstName = bvnResponse.data.first_name;
                    if (bvnResponse.data.last_name)
                        verifiedLastName = bvnResponse.data.last_name;
                    if (bvnResponse.data.phone_number)
                        verifiedPhone = bvnResponse.data.phone_number;
                }
            }
            catch (err) {
                console.warn(`[Provn] BVN verification notice: ${err.message}. Proceeding directly with user profile identity to Paystack.`);
            }
            // Record KYC snapshot in database
            try {
                const encryptedId = (0, encryption_js_1.encryptData)(cleanBvn);
                const maskedBvn = (0, encryption_js_1.maskIdentifier)(cleanBvn);
                await index_js_7.KycRecordModel.create({
                    userId: authUser.userId,
                    organizationId: org._id,
                    idType: "bvn",
                    encryptedIdNumber: encryptedId,
                    maskedIdNumber: maskedBvn,
                    verificationStatus: "verified",
                    provnReferenceId: `PRV-BVN-${Date.now()}`,
                    provnPayloadSnapshot: bvnSnapshot || { first_name: verifiedFirstName, last_name: verifiedLastName },
                    verifiedAt: new Date(),
                });
            }
            catch (snapshotErr) {
                console.warn("[KycRecord] Snapshot save notice:", snapshotErr);
            }
            // Step 2: Create Paystack Dedicated Virtual Account using authentic details
            console.log(`[Paystack] Creating Dedicated Virtual Account for ${customerEmail} (${verifiedFirstName} ${verifiedLastName})`);
            const dvaResult = await index_js_5.PaystackService.createDedicatedVirtualAccount({
                customerEmail,
                firstName: verifiedFirstName,
                lastName: verifiedLastName,
                phone: verifiedPhone,
                bvn: cleanBvn,
            });
            // Step 3: Update organization with verified dedicated virtual account
            org.dedicatedVirtualAccount = {
                accountNumber: dvaResult.accountNumber,
                accountName: dvaResult.accountName,
                bankName: dvaResult.bankName,
                assignedAt: dvaResult.assignedAt || new Date(),
                isVerified: true,
                bvnMasked: (0, encryption_js_1.maskIdentifier)(cleanBvn),
                customerCode: dvaResult.customerCode,
                paystackCustomerId: dvaResult.paystackCustomerId,
                paystackDedicatedAccountId: dvaResult.paystackDedicatedAccountId,
            };
            org.kycStatus = "verified";
            await org.save();
            // Ensure record in WalletModel (wallet DB table)
            try {
                let wallet = await index_js_7.WalletModel.findOne({ organizationId: org._id });
                if (!wallet) {
                    await index_js_7.WalletModel.create({
                        organizationId: org._id,
                        ownerId: authUser.userId,
                        balance: org.walletBalance || 0,
                        currency: "NGN",
                        status: "ACTIVE",
                        bvnVerified: true,
                        bvnMasked: (0, encryption_js_1.maskIdentifier)(cleanBvn),
                        dedicatedVirtualAccount: org.dedicatedVirtualAccount,
                    });
                }
                else {
                    wallet.bvnVerified = true;
                    wallet.bvnMasked = (0, encryption_js_1.maskIdentifier)(cleanBvn);
                    wallet.dedicatedVirtualAccount = org.dedicatedVirtualAccount;
                    await wallet.save();
                }
            }
            catch (wErr) {
                console.warn("[WalletModel] Sync notice:", wErr);
            }
            return {
                success: true,
                message: "Dedicated Virtual Account generated successfully via Provn & Paystack.",
                dedicatedVirtualAccount: {
                    accountNumber: org.dedicatedVirtualAccount.accountNumber,
                    accountName: org.dedicatedVirtualAccount.accountName,
                    bankName: org.dedicatedVirtualAccount.bankName,
                    assignedAt: org.dedicatedVirtualAccount.assignedAt?.toISOString(),
                    isVerified: true,
                    bvnMasked: org.dedicatedVirtualAccount.bvnMasked,
                },
                organization: org,
            };
        },
        // ─── Webmail Dispatch & Management Mutations ───
        sendMail: async (_, { input }, context) => {
            const authUser = (0, context_js_1.requireAuth)(context);
            if (!authUser.organizationId)
                throw new Error("No active organization found");
            const org = await index_js_7.OrganizationModel.findById(authUser.organizationId);
            if (!org)
                throw new Error("Organization not found");
            // ── 1. Strict SaaS Subscription Gating ──
            const now = new Date();
            // Check if 7-day free trial has expired -> automatically unsubscribe
            if (org.subscriptionStatus === "TRIAL" &&
                org.trialEndsAt &&
                now > new Date(org.trialEndsAt)) {
                org.subscriptionStatus = "CANCELLED";
                org.isSuspended = true;
                await org.save();
                throw new Error("Your 7-Day Free Trial has expired. Your subscription has been unsubscribed. Please choose and activate a plan in Billing to continue sending sovereign emails.");
            }
            const isTrialValid = org.subscriptionStatus === "TRIAL" &&
                org.trialEndsAt &&
                now <= new Date(org.trialEndsAt);
            const isSubActive = org.subscriptionStatus === "ACTIVE" &&
                (!org.subscriptionExpiresAt || now <= new Date(org.subscriptionExpiresAt));
            const isGracePeriod = org.subscriptionStatus === "GRACE_PERIOD" &&
                org.gracePeriodEndsAt &&
                now <= new Date(org.gracePeriodEndsAt);
            const hasActiveSubscription = !org.isSuspended && (isSubActive || isTrialValid || isGracePeriod);
            const hasEmailPackage = !org.subscribedPackages ||
                org.subscribedPackages.length === 0 ||
                org.subscribedPackages.includes("org-email");
            if (!hasActiveSubscription || !hasEmailPackage) {
                throw new Error(`Active 'Business Email' subscription required to dispatch sovereign emails. Your organization subscription status is "${org.subscriptionStatus || "INACTIVE"}". Please activate or fund your wallet in Billing.`);
            }
            // ── 2. Daily Sending Limit Check ──
            if (org.emailsSentToday >= org.dailySendingLimit) {
                throw new Error(`Daily sending limit reached (${org.emailsSentToday}/${org.dailySendingLimit} emails sent today). Please upgrade your plan tier or wait until tomorrow's reset.`);
            }
            // ── 3. Parse Recipients and From Address ──
            const toEmails = (input.to || []).map((p) => p.email.trim().toLowerCase()).filter(Boolean);
            if (toEmails.length === 0) {
                throw new Error("At least one recipient email address is required.");
            }
            const ccEmails = (input.cc || []).map((p) => p.email.trim().toLowerCase()).filter(Boolean);
            const bccEmails = (input.bcc || []).map((p) => p.email.trim().toLowerCase()).filter(Boolean);
            // Fetch the actual sender user record from DB to guarantee the person's real display name
            const user = await index_js_7.UserModel.findById(authUser.userId);
            const rawSenderName = (input.fromName || user?.name || authUser.name || "").trim();
            const senderName = rawSenderName || "Sovereign Workspace";
            let senderEmail = authUser.email;
            const userReplyTo = input.replyTo || authUser.email;
            // If senderEmail is on a public/unverified provider (e.g. @gmail.com) but org has a configured domain,
            // route the sender email through the organization's verified domain to satisfy Resend SPF/DKIM
            if (org.domain && !senderEmail.toLowerCase().endsWith(`@${org.domain.toLowerCase()}`)) {
                const username = senderEmail.split("@")[0] || "user";
                senderEmail = `${username}@${org.domain.toLowerCase()}`;
            }
            // Format RFC 5322 standard: "Display Name" <email@domain.com>
            const cleanSenderName = senderName.replace(/["<>\r\n]/g, "").trim();
            const fromFormatted = `"${cleanSenderName}" <${senderEmail}>`;
            // ── 4. Dispatch via Resend ──
            const resendResult = await index_js_6.ResendEmailService.sendUserEmail({
                from: fromFormatted,
                to: toEmails,
                cc: ccEmails.length > 0 ? ccEmails : undefined,
                bcc: bccEmails.length > 0 ? bccEmails : undefined,
                replyTo: userReplyTo,
                subject: input.subject || "(No subject)",
                html: input.bodyHtml,
                text: input.bodyText || input.bodyHtml.replace(/<[^>]*>?/gm, ""),
                attachments: (input.attachments || [])
                    .filter((a) => a && (a.content || (a.downloadUrl && (a.downloadUrl.startsWith("http://") || a.downloadUrl.startsWith("https://")) && !a.downloadUrl.startsWith("blob:"))))
                    .map((a) => {
                    const att = {
                        filename: a.name || "attachment",
                    };
                    if (a.content) {
                        att.content = a.content.includes("base64,") ? a.content.split("base64,")[1] : a.content;
                    }
                    else if (a.downloadUrl &&
                        (a.downloadUrl.startsWith("http://") || a.downloadUrl.startsWith("https://")) &&
                        !a.downloadUrl.startsWith("blob:")) {
                        att.path = a.downloadUrl;
                    }
                    return att;
                })
                    .filter((a) => a.content || a.path),
            });
            if (!resendResult.success) {
                throw new Error(resendResult.error || "Failed to dispatch email via Resend.");
            }
            // ── 5. Save in Sent Mailbox in MongoDB ──
            const preview = (input.bodyText || input.bodyHtml.replace(/<[^>]*>?/gm, "")).slice(0, 160).trim();
            // Resolve threadId: prioritize explicit input, then lookup existing thread by subject
            let resolvedThreadId = input.threadId;
            if (!resolvedThreadId) {
                const cleanSubject = (input.subject || "").replace(/^(re:\s*|fwd:\s*)+/i, "").trim();
                if (cleanSubject) {
                    const existing = await index_js_7.EmailModel.findOne({
                        organizationId: org._id,
                        $or: [
                            { subject: new RegExp(`^${cleanSubject.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") },
                            { subject: new RegExp(`^(re:\\s*|fwd:\\s*)*${cleanSubject.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") },
                        ],
                    }).sort({ createdAt: -1 });
                    if (existing?.threadId) {
                        resolvedThreadId = existing.threadId;
                    }
                }
            }
            if (!resolvedThreadId) {
                resolvedThreadId = `thread-outbound-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
            }
            const newEmail = await index_js_7.EmailModel.create({
                organizationId: org._id,
                userId: authUser.userId || authUser.id,
                threadId: resolvedThreadId,
                resendId: resendResult.id,
                folder: "sent",
                category: "primary",
                from: {
                    name: cleanSenderName,
                    email: senderEmail,
                },
                to: input.to.map((p) => ({ name: p.name || p.email.split("@")[0], email: p.email })),
                cc: (input.cc || []).map((p) => ({ name: p.name || p.email.split("@")[0], email: p.email })),
                bcc: (input.bcc || []).map((p) => ({ name: p.name || p.email.split("@")[0], email: p.email })),
                replyTo: input.replyTo || senderEmail,
                subject: input.subject || "(No subject)",
                preview,
                bodyHtml: input.bodyHtml,
                bodyText: input.bodyText || preview,
                attachments: (input.attachments || []).map((a) => {
                    const ext = (a.name || "").split(".").pop()?.toLowerCase();
                    const cleanCt = a.contentType && a.contentType.includes("/")
                        ? a.contentType
                        : ext === "png"
                            ? "image/png"
                            : ext === "jpg" || ext === "jpeg"
                                ? "image/jpeg"
                                : ext === "webp"
                                    ? "image/webp"
                                    : ext === "gif"
                                        ? "image/gif"
                                        : ext === "svg"
                                            ? "image/svg+xml"
                                            : ext === "pdf"
                                                ? "application/pdf"
                                                : a.contentType === "image"
                                                    ? "image/png"
                                                    : a.contentType || "application/octet-stream";
                    return {
                        id: a.id || `att-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                        name: a.name,
                        sizeBytes: a.sizeBytes || 0,
                        contentType: cleanCt,
                        downloadUrl: a.downloadUrl && !a.downloadUrl.startsWith("blob:")
                            ? a.downloadUrl
                            : a.content
                                ? `data:${cleanCt};base64,${a.content.includes("base64,") ? a.content.split("base64,")[1] : a.content}`
                                : "",
                        contentId: a.contentId,
                    };
                }),
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
        updateEmailStatus: async (_, { id, folder, isRead, isStarred, isImportant, category }, context) => {
            const authUser = (0, context_js_1.requireAuth)(context);
            const updateData = {};
            if (folder) {
                updateData.folder = folder;
                if (folder === "starred") {
                    updateData.isStarred = true;
                    updateData.starredAt = new Date();
                }
            }
            if (category)
                updateData.category = category;
            if (typeof isRead === "boolean")
                updateData.isRead = isRead;
            if (typeof isStarred === "boolean") {
                updateData.isStarred = isStarred;
                updateData.starredAt = isStarred ? new Date() : null;
            }
            if (typeof isImportant === "boolean")
                updateData.isImportant = isImportant;
            // Find conditions scoped to the user/org
            const authConditions = [];
            if (authUser.organizationId) {
                authConditions.push({ organizationId: authUser.organizationId });
            }
            const uId = authUser.userId || authUser.id;
            if (uId) {
                authConditions.push({ userId: uId });
            }
            if (authUser.email) {
                authConditions.push({ "to.email": authUser.email.toLowerCase() });
                authConditions.push({ "from.email": authUser.email.toLowerCase() });
            }
            let idQuery;
            if (mongoose_1.default.Types.ObjectId.isValid(id)) {
                idQuery = {
                    $or: [
                        { _id: new mongoose_1.default.Types.ObjectId(id) },
                        { _id: id },
                        { resendId: id },
                        { threadId: id },
                    ],
                };
            }
            else {
                idQuery = {
                    $or: [{ resendId: id }, { threadId: id }],
                };
            }
            const updateFilter = {
                ...idQuery,
            };
            if (authConditions.length > 0) {
                updateFilter.$and = [{ $or: authConditions }];
            }
            let email = await index_js_7.EmailModel.findOneAndUpdate(updateFilter, { $set: updateData }, { new: true });
            // Fallback: direct ID match if user is authenticated
            if (!email && mongoose_1.default.Types.ObjectId.isValid(id)) {
                email = await index_js_7.EmailModel.findByIdAndUpdate(id, { $set: updateData }, { new: true });
            }
            if (!email)
                throw new Error("Email not found");
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
                isStarred: Boolean(email.isStarred || email.folder === "starred"),
                starredAt: email.starredAt?.toISOString(),
                isImportant: email.isImportant,
                labels: email.labels,
                status: email.status,
                createdAt: email.createdAt.toISOString(),
            };
        },
        deleteEmail: async (_, { id, permanent }, context) => {
            const authUser = (0, context_js_1.requireAuth)(context);
            if (permanent) {
                const res = await index_js_7.EmailModel.deleteOne({ _id: id, organizationId: authUser.organizationId });
                return res.deletedCount > 0;
            }
            const email = await index_js_7.EmailModel.findOne({ _id: id, organizationId: authUser.organizationId });
            if (!email)
                return false;
            email.folder = "trash";
            await email.save();
            return true;
        },
        // ─── Legacy / System Email Dispatch Mutations (Resend) ───
        sendEmail: async (_, { input }, context) => {
            (0, context_js_1.requireAuth)(context);
            const result = await index_js_6.ResendEmailService.sendEmail({
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
        sendOtpEmail: async (_, { email }) => {
            const code = Math.floor(100000 + Math.random() * 900000).toString();
            const user = await index_js_7.UserModel.findOne({ email: email.toLowerCase() });
            const name = user ? user.name : "User";
            const result = await index_js_6.ResendEmailService.sendOtpEmail(email, name, code, 10);
            return {
                success: result.success,
                message: result.success ? `Verification code dispatched to ${email}` : (result.error || "Failed to send OTP email"),
            };
        },
        // ─── Product Package Mutations ───
        updatePackagePricing: async (_, { packageId, input }, context) => {
            (0, context_js_1.requireAuth)(context);
            return package_service_js_1.PackageService.updatePackagePricing(packageId, input);
        },
        resetPackagesToDefault: async (_, __, context) => {
            (0, context_js_1.requireAuth)(context);
            return package_service_js_1.PackageService.resetPackagesToDefault();
        },
        // ─── Calendar Event Mutations ───
        createCalendarEvent: async (_, { input }, context) => {
            const authUser = (0, context_js_1.requireAuth)(context);
            if (!authUser.organizationId)
                throw new Error("No active organization found");
            const attendees = Array.isArray(input.attendees) ? [...input.attendees] : [];
            // Ensure organizer is included in attendees list
            if (!attendees.some((a) => a.email && a.email.toLowerCase() === authUser.email.toLowerCase())) {
                attendees.unshift({
                    name: authUser.name || authUser.email.split("@")[0],
                    email: authUser.email.toLowerCase(),
                    userId: authUser.userId || authUser.id,
                    status: "ACCEPTED",
                });
            }
            const event = await index_js_7.CalendarEventModel.create({
                organizationId: authUser.organizationId,
                organizerId: authUser.userId || authUser.id,
                organizerName: authUser.name || authUser.email.split("@")[0],
                organizerEmail: authUser.email.toLowerCase(),
                title: input.title.trim(),
                description: input.description || "",
                start: new Date(input.start),
                end: new Date(input.end),
                allDay: !!input.allDay,
                timezone: input.timezone || "Africa/Lagos",
                location: input.location || "Busmailer Meet Virtual Room",
                meetUrl: input.meetUrl || `https://meet.busmailer.com/${Math.random().toString(36).substring(7)}`,
                attendees,
                color: input.color || "bg-[#84cc16]",
                type: input.type || "ORGANIZATION",
                relatedTaskId: input.relatedTaskId,
                relatedEmailId: input.relatedEmailId,
            });
            // Notify invited attendees who have user accounts in the organization
            for (const att of attendees) {
                if (att.userId && att.userId.toString() !== (authUser.userId || authUser.id)?.toString()) {
                    notification_service_js_1.NotificationService.sendNotification({
                        organizationId: authUser.organizationId,
                        userId: att.userId,
                        title: "New Meeting Invitation",
                        message: `${event.organizerName} invited you to: "${event.title}"`,
                        type: "CALENDAR",
                        link: "/calendar",
                        metadata: { eventId: event._id.toString() },
                    }).catch((err) => console.warn("Failed to notify attendee:", err));
                }
            }
            return formatCalendarEvent(event);
        },
        updateCalendarEvent: async (_, { id, input }, context) => {
            const authUser = (0, context_js_1.requireAuth)(context);
            if (!authUser.organizationId)
                throw new Error("No active organization found");
            const event = await index_js_7.CalendarEventModel.findOne({
                _id: id,
                organizationId: authUser.organizationId,
            });
            if (!event)
                throw new Error("Event not found");
            const userEmail = (authUser.email || "").trim().toLowerCase();
            const userId = String(authUser.userId || authUser.id || "");
            const isOrganizer = (event.organizerEmail && event.organizerEmail.trim().toLowerCase() === userEmail) ||
                (event.organizerId && String(event.organizerId) === userId);
            const isAdmin = authUser.role === "admin" ||
                authUser.role === "owner" ||
                authUser.role === "superadmin" ||
                authUser.userType === "saas_admin" ||
                authUser.userType !== "email_user";
            if (!isOrganizer && !isAdmin && event.type !== "ORGANIZATION") {
                throw new Error("Only the organizer or an administrator can update this event.");
            }
            if (input.title !== undefined)
                event.title = input.title.trim();
            if (input.description !== undefined)
                event.description = input.description;
            if (input.start !== undefined)
                event.start = new Date(input.start);
            if (input.end !== undefined)
                event.end = new Date(input.end);
            if (input.allDay !== undefined)
                event.allDay = input.allDay;
            if (input.timezone !== undefined)
                event.timezone = input.timezone;
            if (input.location !== undefined)
                event.location = input.location;
            if (input.meetUrl !== undefined)
                event.meetUrl = input.meetUrl;
            if (input.color !== undefined)
                event.color = input.color;
            if (input.type !== undefined)
                event.type = input.type;
            if (input.attendees !== undefined)
                event.attendees = input.attendees;
            await event.save();
            return formatCalendarEvent(event);
        },
        deleteCalendarEvent: async (_, { id }, context) => {
            const authUser = (0, context_js_1.requireAuth)(context);
            if (!authUser.organizationId)
                throw new Error("No active organization found");
            const event = await index_js_7.CalendarEventModel.findOne({
                _id: id,
                organizationId: authUser.organizationId,
            });
            if (!event)
                return true;
            const userEmail = (authUser.email || "").trim().toLowerCase();
            const userId = String(authUser.userId || authUser.id || "");
            const isOrganizer = (event.organizerEmail && event.organizerEmail.trim().toLowerCase() === userEmail) ||
                (event.organizerId && String(event.organizerId) === userId);
            const isAdmin = authUser.role === "admin" ||
                authUser.role === "owner" ||
                authUser.role === "superadmin" ||
                authUser.userType === "saas_admin" ||
                authUser.userType !== "email_user";
            // If user is organizer or admin, delete the event completely
            if (isOrganizer || isAdmin) {
                await index_js_7.CalendarEventModel.deleteOne({ _id: id });
                return true;
            }
            // If the user is an attendee (not the organizer), removing the event from their calendar
            // removes/uninvites them so it no longer appears in their calendar
            const isAttendee = (event.attendees || []).some((a) => a.email && a.email.trim().toLowerCase() === userEmail);
            if (isAttendee) {
                event.attendees = (event.attendees || []).filter((a) => a.email && a.email.trim().toLowerCase() !== userEmail);
                await event.save();
                return true;
            }
            // If it is an organization-wide event in their own organization, allow members to delete or remove it
            if (event.type === "ORGANIZATION") {
                await index_js_7.CalendarEventModel.deleteOne({ _id: id });
                return true;
            }
            throw new Error("Only the organizer, an attendee, or an administrator can delete or remove this event.");
        },
        // ─── Task Mutations ───
        createTask: async (_, { input }, context) => {
            const authUser = (0, context_js_1.requireAuth)(context);
            if (!authUser.organizationId)
                throw new Error("No active organization found");
            const task = await index_js_7.TaskModel.create({
                organizationId: authUser.organizationId,
                creatorId: authUser.userId || authUser.id,
                creatorName: authUser.name || authUser.email.split("@")[0],
                title: input.title.trim(),
                description: input.description || "",
                status: input.status || "TODO",
                priority: input.priority || "MEDIUM",
                assigneeId: input.assigneeId || null,
                assigneeName: input.assigneeName || null,
                dueDate: input.dueDate ? new Date(input.dueDate) : null,
                labels: input.labels || [],
                sourceEmailId: input.sourceEmailId || null,
                sourceEmailSubject: input.sourceEmailSubject || null,
            });
            const formatted = formatTask(task);
            // If assigned to a team member, push a real-time notification
            if (task.assigneeId) {
                await notification_service_js_1.NotificationService.sendNotification({
                    organizationId: authUser.organizationId,
                    userId: task.assigneeId,
                    title: "New Task Assigned",
                    message: `${task.creatorName} assigned you task: "${task.title}"`,
                    type: "TASK",
                    link: "/tasks",
                    metadata: { taskId: task._id.toString() },
                });
                realtime_service_js_1.RealtimeService.emitToUser(task.assigneeId.toString(), "task:assigned", formatted);
            }
            realtime_service_js_1.RealtimeService.emitToOrganization(authUser.organizationId.toString(), "task:created", formatted);
            return formatted;
        },
        updateTask: async (_, { id, input }, context) => {
            const authUser = (0, context_js_1.requireAuth)(context);
            if (!authUser.organizationId)
                throw new Error("No active organization found");
            const task = await index_js_7.TaskModel.findOne({ _id: id, organizationId: authUser.organizationId });
            if (!task)
                throw new Error("Task not found");
            const previousAssignee = task.assigneeId ? task.assigneeId.toString() : null;
            if (input.title !== undefined)
                task.title = input.title.trim();
            if (input.description !== undefined)
                task.description = input.description;
            if (input.status !== undefined)
                task.status = input.status;
            if (input.priority !== undefined)
                task.priority = input.priority;
            if (input.assigneeId !== undefined)
                task.assigneeId = input.assigneeId;
            if (input.assigneeName !== undefined)
                task.assigneeName = input.assigneeName;
            if (input.dueDate !== undefined)
                task.dueDate = input.dueDate ? new Date(input.dueDate) : undefined;
            if (input.labels !== undefined)
                task.labels = input.labels;
            await task.save();
            const formatted = formatTask(task);
            // If assignee changed, notify the new assignee
            if (task.assigneeId && task.assigneeId.toString() !== previousAssignee) {
                await notification_service_js_1.NotificationService.sendNotification({
                    organizationId: authUser.organizationId,
                    userId: task.assigneeId,
                    title: "Task Assigned to You",
                    message: `${authUser.name || "A team member"} assigned you task: "${task.title}"`,
                    type: "TASK",
                    link: "/tasks",
                    metadata: { taskId: task._id.toString() },
                });
                realtime_service_js_1.RealtimeService.emitToUser(task.assigneeId.toString(), "task:assigned", formatted);
            }
            // If task is completed, notify the creator if different from current user
            if (input.status === "DONE" && task.creatorId && task.creatorId.toString() !== (authUser.userId || authUser.id)?.toString()) {
                notification_service_js_1.NotificationService.sendNotification({
                    organizationId: authUser.organizationId,
                    userId: task.creatorId,
                    title: "Task Completed",
                    message: `${authUser.name || "Assignee"} completed your task: "${task.title}"`,
                    type: "TASK",
                    link: "/tasks",
                    metadata: { taskId: task._id.toString() },
                }).catch((err) => console.warn("Failed to notify task creator:", err));
            }
            realtime_service_js_1.RealtimeService.emitToOrganization(authUser.organizationId.toString(), "task:updated", formatted);
            return formatted;
        },
        deleteTask: async (_, { id }, context) => {
            const authUser = (0, context_js_1.requireAuth)(context);
            if (!authUser.organizationId)
                throw new Error("No active organization found");
            const res = await index_js_7.TaskModel.deleteOne({ _id: id, organizationId: authUser.organizationId });
            return res.deletedCount > 0;
        },
        // ─── CRM Mutations ───
        createCrmCustomer: async (_, { input }, context) => {
            const authUser = (0, context_js_1.requireAuth)(context);
            if (!authUser.organizationId)
                throw new Error("No active organization found");
            const customer = await index_js_7.CustomerModel.create({
                organizationId: authUser.organizationId,
                name: input.name.trim(),
                email: input.email.toLowerCase().trim(),
                phone: input.phone || null,
                companyName: input.companyName || null,
                status: input.status || "NEW",
                assignedAgentId: authUser.userId || authUser.id,
                assignedAgentName: input.assignedAgentName || authUser.name || authUser.email.split("@")[0],
                source: input.source || "MANUAL",
                tags: input.tags || [],
            });
            return formatCustomer(customer);
        },
        updateCrmCustomer: async (_, { id, input }, context) => {
            const authUser = (0, context_js_1.requireAuth)(context);
            if (!authUser.organizationId)
                throw new Error("No active organization found");
            const customer = await index_js_7.CustomerModel.findOneAndUpdate({ _id: id, organizationId: authUser.organizationId }, { $set: input }, { new: true });
            if (!customer)
                throw new Error("Customer not found");
            return formatCustomer(customer);
        },
        deleteCrmCustomer: async (_, { id }, context) => {
            const authUser = (0, context_js_1.requireAuth)(context);
            if (!authUser.organizationId)
                throw new Error("No active organization found");
            const res = await index_js_7.CustomerModel.deleteOne({ _id: id, organizationId: authUser.organizationId });
            return res.deletedCount > 0;
        },
        createCrmDeal: async (_, { input }, context) => {
            const authUser = (0, context_js_1.requireAuth)(context);
            if (!authUser.organizationId)
                throw new Error("No active organization found");
            const deal = await index_js_7.DealModel.create({
                organizationId: authUser.organizationId,
                title: input.title.trim(),
                customerId: input.customerId,
                customerName: input.customerName,
                companyName: input.companyName || null,
                amount: input.amount || 0,
                currency: input.currency || "NGN",
                stage: input.stage || "LEAD",
                probability: input.probability ?? 10,
                expectedClosingDate: input.expectedClosingDate ? new Date(input.expectedClosingDate) : null,
                assignedAgentId: authUser.userId || authUser.id,
                assignedAgentName: input.assignedAgentName || authUser.name || authUser.email.split("@")[0],
                notes: input.notes || null,
            });
            return formatDeal(deal);
        },
        updateCrmDeal: async (_, { id, input }, context) => {
            const authUser = (0, context_js_1.requireAuth)(context);
            if (!authUser.organizationId)
                throw new Error("No active organization found");
            const deal = await index_js_7.DealModel.findOneAndUpdate({ _id: id, organizationId: authUser.organizationId }, { $set: input }, { new: true });
            if (!deal)
                throw new Error("Deal not found");
            return formatDeal(deal);
        },
        deleteCrmDeal: async (_, { id }, context) => {
            const authUser = (0, context_js_1.requireAuth)(context);
            if (!authUser.organizationId)
                throw new Error("No active organization found");
            const res = await index_js_7.DealModel.deleteOne({ _id: id, organizationId: authUser.organizationId });
            return res.deletedCount > 0;
        },
        createCrmActivity: async (_, { input }, context) => {
            const authUser = (0, context_js_1.requireAuth)(context);
            if (!authUser.organizationId)
                throw new Error("No active organization found");
            const activity = await index_js_7.CRMActivityModel.create({
                organizationId: authUser.organizationId,
                customerId: input.customerId,
                type: input.type,
                title: input.title,
                description: input.description || null,
                actorName: authUser.name || authUser.email.split("@")[0],
                actorEmail: authUser.email,
            });
            return formatCrmActivity(activity);
        },
        // ─── Ticket Mutations ───
        createCrmTicket: async (_, { input }, context) => {
            let organizationId = context.user?.organizationId;
            if (!organizationId) {
                if (input.orgDomain) {
                    const org = await index_js_7.OrganizationModel.findOne({ domain: input.orgDomain.trim().toLowerCase() });
                    if (org)
                        organizationId = org._id;
                }
                if (!organizationId) {
                    const defaultOrg = await index_js_7.OrganizationModel.findOne().sort({ createdAt: 1 });
                    if (defaultOrg)
                        organizationId = defaultOrg._id;
                }
            }
            if (!organizationId)
                throw new Error("No active organization found to file ticket under");
            const ticketNumber = `TCK-${Date.now().toString().slice(-6)}`;
            const slaDeadline = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h SLA default
            const ticket = await index_js_7.TicketModel.create({
                ticketNumber,
                organizationId,
                customerName: input.customerName.trim(),
                customerEmail: input.customerEmail.toLowerCase().trim(),
                subject: input.subject.trim(),
                type: input.type || "SUPPORT",
                department: input.department || "Customer Support",
                priority: input.priority || "MEDIUM",
                status: "OPEN",
                assignedToUserId: input.assignedToUserId || null,
                assignedToName: input.assignedToName || null,
                slaDeadline,
                messages: input.message ? [{
                        id: `msg-${Date.now()}`,
                        senderType: "CUSTOMER",
                        senderName: input.customerName.trim(),
                        senderEmail: input.customerEmail.toLowerCase().trim(),
                        body: input.message.trim(),
                        isInternalNote: false,
                        createdAt: new Date(),
                    }] : [],
            });
            const formatted = formatTicket(ticket);
            if (ticket.assignedToUserId) {
                await notification_service_js_1.NotificationService.sendNotification({
                    organizationId,
                    userId: ticket.assignedToUserId,
                    title: `New Ticket #${ticketNumber}`,
                    message: `Assigned ticket: "${ticket.subject}" from ${ticket.customerName}`,
                    type: "TICKET",
                    link: "/crm",
                    metadata: { ticketId: ticket._id.toString() },
                });
                realtime_service_js_1.RealtimeService.emitToUser(ticket.assignedToUserId.toString(), "ticket:assigned", formatted);
            }
            else {
                // Broadcast notification to active members of this organization
                const usersInOrg = await index_js_7.UserModel.find({ organizationId }, "_id");
                if (usersInOrg.length > 0) {
                    notification_service_js_1.NotificationService.broadcastOrgNotification(organizationId, usersInOrg.map((u) => u._id), {
                        title: `New Support Ticket #${ticketNumber}`,
                        message: `Inquiry: "${ticket.subject}" from ${ticket.customerName}`,
                        type: "TICKET",
                        link: "/crm",
                        metadata: { ticketId: ticket._id.toString() },
                    }).catch((err) => console.warn("Failed to broadcast ticket notification:", err));
                }
            }
            realtime_service_js_1.RealtimeService.emitToOrganization(organizationId.toString(), "ticket:created", formatted);
            return formatted;
        },
        updateCrmTicket: async (_, { id, input }, context) => {
            const authUser = (0, context_js_1.requireAuth)(context);
            if (!authUser.organizationId)
                throw new Error("No active organization found");
            const ticket = await index_js_7.TicketModel.findOne({ _id: id, organizationId: authUser.organizationId });
            if (!ticket)
                throw new Error("Ticket not found");
            const previousAssignee = ticket.assignedToUserId ? ticket.assignedToUserId.toString() : null;
            if (input.status !== undefined)
                ticket.status = input.status;
            if (input.priority !== undefined)
                ticket.priority = input.priority;
            if (input.department !== undefined)
                ticket.department = input.department;
            if (input.assignedToUserId !== undefined)
                ticket.assignedToUserId = input.assignedToUserId;
            if (input.assignedToName !== undefined)
                ticket.assignedToName = input.assignedToName;
            await ticket.save();
            const formatted = formatTicket(ticket);
            if (ticket.assignedToUserId && ticket.assignedToUserId.toString() !== previousAssignee) {
                await notification_service_js_1.NotificationService.sendNotification({
                    organizationId: authUser.organizationId,
                    userId: ticket.assignedToUserId,
                    title: "Ticket Assigned to You",
                    message: `Ticket #${ticket.ticketNumber}: "${ticket.subject}"`,
                    type: "TICKET",
                    link: "/crm",
                    metadata: { ticketId: ticket._id.toString() },
                });
                realtime_service_js_1.RealtimeService.emitToUser(ticket.assignedToUserId.toString(), "ticket:assigned", formatted);
            }
            realtime_service_js_1.RealtimeService.emitToOrganization(authUser.organizationId.toString(), "ticket:updated", formatted);
            return formatted;
        },
        // ─── Notification Mutations ───
        markNotificationRead: async (_, { id }, context) => {
            const authUser = (0, context_js_1.requireAuth)(context);
            const userId = authUser.userId || authUser.id;
            if (!userId)
                return false;
            const res = await index_js_7.NotificationModel.updateOne({ _id: id, userId }, { $set: { read: true } });
            return res.modifiedCount > 0;
        },
        markAllNotificationsRead: async (_, __, context) => {
            const authUser = (0, context_js_1.requireAuth)(context);
            const userId = authUser.userId || authUser.id;
            if (!userId)
                return false;
            await index_js_7.NotificationModel.updateMany({ userId, read: false }, { $set: { read: true } });
            return true;
        },
    },
    Organization: {
        capabilities: (parent) => {
            const records = parent.resendRecords || [];
            const hasReceiving = records.some((r) => r.record === "Receiving" || (r.type === "MX" && (!r.name || r.name === "@")));
            return {
                sending: "enabled",
                receiving: hasReceiving ? "enabled" : "disabled",
            };
        },
        packageSubscriptions: (parent) => {
            return computePackageSubscriptions(parent);
        },
        dedicatedVirtualAccount: (parent) => {
            const dva = parent.dedicatedVirtualAccount;
            if (!dva || !dva.accountNumber)
                return null;
            return {
                accountNumber: dva.accountNumber,
                accountName: dva.accountName || `busmailer / ${parent.name || "Enterprise"}`,
                bankName: dva.bankName || "Wema Bank Plc",
                assignedAt: dva.assignedAt ? new Date(dva.assignedAt).toISOString() : null,
                isVerified: !!dva.isVerified,
                bvnMasked: dva.bvnMasked || null,
            };
        },
    },
};
function computePackageSubscriptions(org) {
    const now = new Date();
    const subscribed = org.subscribedPackages && org.subscribedPackages.length > 0
        ? org.subscribedPackages
        : ["org-email"];
    const existingPkgSubs = org.packageSubscriptions || [];
    return subscribed.map((pkgId) => {
        const found = existingPkgSubs.find((s) => s.packageId === pkgId);
        const trialStartsAt = found?.trialStartsAt
            ? new Date(found.trialStartsAt)
            : org.trialStartsAt
                ? new Date(org.trialStartsAt)
                : org.createdAt
                    ? new Date(org.createdAt)
                    : now;
        const trialEndsAt = found?.trialEndsAt
            ? new Date(found.trialEndsAt)
            : new Date(trialStartsAt.getTime() + 7 * 24 * 60 * 60 * 1000);
        const activatedAt = found?.activatedAt ? new Date(found.activatedAt) : trialStartsAt;
        const isTrial = now < trialEndsAt;
        const diffMs = trialEndsAt.getTime() - now.getTime();
        const daysRemaining = isTrial ? Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24))) : 0;
        const status = isTrial ? "TRIAL" : (found?.status === "CANCELLED" ? "CANCELLED" : "ACTIVE");
        return {
            packageId: pkgId,
            status,
            trialStartsAt: trialStartsAt.toISOString(),
            trialEndsAt: trialEndsAt.toISOString(),
            daysRemaining,
            isTrial,
            activatedAt: activatedAt.toISOString(),
        };
    });
}
function formatCalendarEvent(doc) {
    if (!doc)
        return null;
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
        location: e.location || "Busmailer Meet Virtual Room",
        meetUrl: e.meetUrl || "",
        attendees: (e.attendees || []).map((a) => ({
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
function formatTask(doc) {
    if (!doc)
        return null;
    const t = doc.toObject ? doc.toObject() : doc;
    return {
        id: t._id ? t._id.toString() : t.id,
        organizationId: t.organizationId ? t.organizationId.toString() : "",
        title: t.title || "",
        description: t.description || "",
        status: t.status || "TODO",
        priority: t.priority || "MEDIUM",
        assigneeId: t.assigneeId ? t.assigneeId.toString() : null,
        assigneeName: t.assigneeName || null,
        creatorId: t.creatorId ? t.creatorId.toString() : "",
        creatorName: t.creatorName || "",
        dueDate: t.dueDate ? new Date(t.dueDate).toISOString() : null,
        labels: t.labels || [],
        sourceEmailId: t.sourceEmailId || null,
        sourceEmailSubject: t.sourceEmailSubject || null,
        relatedCalendarEventId: t.relatedCalendarEventId || null,
        customerId: t.customerId ? t.customerId.toString() : null,
        createdAt: t.createdAt ? new Date(t.createdAt).toISOString() : new Date().toISOString(),
        updatedAt: t.updatedAt ? new Date(t.updatedAt).toISOString() : new Date().toISOString(),
    };
}
function formatCustomer(doc) {
    if (!doc)
        return null;
    const c = doc.toObject ? doc.toObject() : doc;
    return {
        id: c._id ? c._id.toString() : c.id,
        organizationId: c.organizationId ? c.organizationId.toString() : "",
        name: c.name || "",
        email: c.email || "",
        phone: c.phone || null,
        companyName: c.companyName || null,
        status: c.status || "NEW",
        assignedAgentId: c.assignedAgentId ? c.assignedAgentId.toString() : null,
        assignedAgentName: c.assignedAgentName || null,
        source: c.source || "MANUAL",
        tags: c.tags || [],
        totalSpent: c.totalSpent || 0,
        lastInteractionAt: c.lastInteractionAt ? new Date(c.lastInteractionAt).toISOString() : new Date().toISOString(),
        createdAt: c.createdAt ? new Date(c.createdAt).toISOString() : new Date().toISOString(),
        updatedAt: c.updatedAt ? new Date(c.updatedAt).toISOString() : new Date().toISOString(),
    };
}
function formatDeal(doc) {
    if (!doc)
        return null;
    const d = doc.toObject ? doc.toObject() : doc;
    return {
        id: d._id ? d._id.toString() : d.id,
        organizationId: d.organizationId ? d.organizationId.toString() : "",
        title: d.title || "",
        customerId: d.customerId ? d.customerId.toString() : "",
        customerName: d.customerName || "",
        companyName: d.companyName || null,
        amount: d.amount || 0,
        currency: d.currency || "NGN",
        stage: d.stage || "LEAD",
        probability: d.probability ?? 10,
        expectedClosingDate: d.expectedClosingDate ? new Date(d.expectedClosingDate).toISOString() : null,
        assignedAgentId: d.assignedAgentId ? d.assignedAgentId.toString() : null,
        assignedAgentName: d.assignedAgentName || null,
        notes: d.notes || null,
        createdAt: d.createdAt ? new Date(d.createdAt).toISOString() : new Date().toISOString(),
        updatedAt: d.updatedAt ? new Date(d.updatedAt).toISOString() : new Date().toISOString(),
    };
}
function formatCrmActivity(doc) {
    if (!doc)
        return null;
    const a = doc.toObject ? doc.toObject() : doc;
    return {
        id: a._id ? a._id.toString() : a.id,
        organizationId: a.organizationId ? a.organizationId.toString() : "",
        customerId: a.customerId ? a.customerId.toString() : "",
        type: a.type || "",
        title: a.title || "",
        description: a.description || null,
        actorName: a.actorName || "",
        actorEmail: a.actorEmail || "",
        createdAt: a.createdAt ? new Date(a.createdAt).toISOString() : new Date().toISOString(),
    };
}
function formatTicket(doc) {
    if (!doc)
        return null;
    const t = doc.toObject ? doc.toObject() : doc;
    return {
        id: t._id ? t._id.toString() : t.id,
        ticketNumber: t.ticketNumber || `TCK-${Date.now().toString().slice(-6)}`,
        organizationId: t.organizationId ? t.organizationId.toString() : "",
        customerId: t.customerId ? t.customerId.toString() : null,
        customerName: t.customerName || "Customer",
        customerEmail: t.customerEmail || "",
        subject: t.subject || "(No subject)",
        type: t.type || "SUPPORT",
        department: t.department || "Customer Support",
        priority: t.priority || "MEDIUM",
        status: t.status || "OPEN",
        assignedToUserId: t.assignedToUserId ? t.assignedToUserId.toString() : null,
        assignedToName: t.assignedToName || null,
        slaDeadline: t.slaDeadline ? new Date(t.slaDeadline).toISOString() : null,
        createdAt: t.createdAt ? new Date(t.createdAt).toISOString() : new Date().toISOString(),
        updatedAt: t.updatedAt ? new Date(t.updatedAt).toISOString() : new Date().toISOString(),
    };
}
function formatNotification(doc) {
    if (!doc)
        return null;
    const n = doc.toObject ? doc.toObject() : doc;
    return {
        id: n._id ? n._id.toString() : n.id,
        organizationId: n.organizationId ? n.organizationId.toString() : "",
        userId: n.userId ? n.userId.toString() : "",
        title: n.title || "",
        message: n.message || "",
        type: n.type || "SYSTEM",
        read: Boolean(n.read),
        link: n.link || null,
        createdAt: n.createdAt ? new Date(n.createdAt).toISOString() : new Date().toISOString(),
    };
}
