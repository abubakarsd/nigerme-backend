"use strict";
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
const token_manager_js_1 = require("../infrastructure/security/token.manager.js");
const otp_service_js_1 = require("../application/services/otp.service.js");
const package_seed_js_1 = require("../infrastructure/database/seeds/package.seed.js");
const permission_seed_js_1 = require("../infrastructure/database/seeds/permission.seed.js");
const role_seed_js_1 = require("../infrastructure/database/seeds/role.seed.js");
async function formatUserWithPermissions(userDoc) {
    if (!userDoc)
        return null;
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
    }
    else {
        // 2. Lookup assigned RoleModel if roleId or slug exists
        let role = null;
        if (user.roleId) {
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
        }
        // 3. Lookup department in organization
        if (user.organizationId && (user.departmentId || user.department)) {
            const org = await index_js_7.OrganizationModel.findById(user.organizationId);
            if (org && org.departments) {
                const dept = org.departments.find((d) => (user.departmentId && d.id === user.departmentId) ||
                    (user.department && d.name?.toLowerCase() === user.department?.toLowerCase()));
                if (dept) {
                    if (dept.roleName && !role)
                        roleName = dept.roleName;
                    if (dept.packageAccess && Array.isArray(dept.packageAccess)) {
                        if (dept.packageAccess.includes("org-pos"))
                            canAccessPos = true;
                        if (dept.packageAccess.includes("org-payroll"))
                            canAccessPayroll = true;
                        if (dept.packageAccess.includes("org-logistics"))
                            canAccessLogistics = true;
                        if (dept.packageAccess.includes("org-hotel"))
                            canAccessHotel = true;
                    }
                }
            }
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
exports.resolvers = {
    Query: {
        healthCheck: () => "Nigerme Sovereign GraphQL Backend is operational.",
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
            if (!org.dedicatedVirtualAccount || !org.dedicatedVirtualAccount.accountNumber) {
                org.dedicatedVirtualAccount = {
                    accountNumber: "0294819284",
                    accountName: `Nigerme / ${org.name}`,
                    bankName: "Wema Bank Plc (Sovereign NIBSS)",
                    assignedAt: new Date(),
                };
                await org.save();
            }
            const orgObj = org.toObject();
            return {
                ...orgObj,
                id: org._id.toString(),
                walletBalance: org.walletBalance / 100, // Return in Naira
                departments: (org.departments || []).map((d) => ({
                    ...d,
                    id: d.id || d._id?.toString() || String(Math.random()),
                    roleId: d.roleId || null,
                    roleName: d.roleName || null,
                    memberIds: d.memberIds || [],
                    packageAccess: d.packageAccess || [],
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
            const org = await index_js_7.OrganizationModel.findById(authUser.organizationId);
            return org ? org.walletBalance / 100 : 0; // Return in Naira
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
            const org = await index_js_7.OrganizationModel.findById(authUser.organizationId);
            if (!org)
                return [];
            return (org.departments || []).map((d) => ({
                ...d,
                id: d.id || d._id?.toString() || String(Math.random()),
                memberIds: d.memberIds || [],
                packageAccess: d.packageAccess || [],
            }));
        },
        getPermissions: async () => {
            let perms = await index_js_7.PermissionModel.find().sort({ category: 1, key: 1 });
            if (perms.length === 0) {
                await (0, permission_seed_js_1.seedPermissions)();
                perms = await index_js_7.PermissionModel.find().sort({ category: 1, key: 1 });
            }
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
            let roles = await index_js_7.RoleModel.find({ organizationId: authUser.organizationId }).sort({ createdAt: 1 });
            if (roles.length === 0) {
                roles = (await (0, role_seed_js_1.seedOrganizationDefaultRoles)(authUser.organizationId));
            }
            return roles.map((r) => ({
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
            return index_js_6.ResendDomainService.getEmailMetrics(org?.resendDomainId, org?.domain || "example.com", startDate, endDate);
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
        mailLogin: async (_, { input }) => {
            const result = await index_js_1.AuthService.mailLogin(input);
            if (result.requiresTwoFactor) {
                return {
                    requiresTwoFactor: true,
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
                await org.save();
                const user = await index_js_7.UserModel.findById(authUser.userId);
                const pkg = package_seed_js_1.INITIAL_PACKAGES.find((p) => p.packageId === packageId);
                const pkgName = pkg ? pkg.name : packageId;
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
            // Calculate total cost
            let totalCostInNaira = 0;
            for (const pkgId of packageIds) {
                const pkg = package_seed_js_1.INITIAL_PACKAGES.find((p) => p.packageId === pkgId);
                if (pkg) {
                    if (pkg.pricingModel === "PER_SEAT" || pkgId === "org-email" || pkg.isCore) {
                        totalCostInNaira += (isAnnual ? pkg.priceAnnual : pkg.priceMonthly) * totalSeats;
                    }
                    else {
                        totalCostInNaira += isAnnual ? pkg.priceAnnual : pkg.priceMonthly;
                    }
                }
            }
            // 1. Check if first-time activation on 7-Day Free Trial (₦0 due today)
            const isFirstTimeTrial = !org.subscriptionStartsAt ||
                org.subscriptionStatus === "TRIAL" ||
                !org.subscriptionStatus;
            if (isFirstTimeTrial) {
                org.subscribedPackages = packageIds;
                org.billingCycle = billingCycle;
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
                await index_js_7.SubscriptionModel.create({
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
                throw new Error(`Insufficient wallet balance. Total required is ₦${totalCostInNaira.toLocaleString()}, but available wallet balance is ₦${((org.walletBalance || 0) / 100).toLocaleString()}. Please fund your wallet or pay via Card to activate.`);
            }
            // Deduct from wallet
            org.walletBalance = (org.walletBalance || 0) - costInKobo;
            org.subscribedPackages = packageIds;
            org.billingCycle = billingCycle;
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
        inviteMember: async (_, { input }, context) => {
            const authUser = (0, context_js_1.requireAuth)(context);
            if (!authUser.organizationId)
                throw new Error("No organization found");
            const res = await organization_service_js_1.OrganizationService.inviteMember(authUser.organizationId, input);
            return {
                user: {
                    ...res.user.toObject(),
                    id: res.user._id.toString(),
                },
                temporaryPassword: res.temporaryPassword,
            };
        },
        updateUserStatus: async (_, { userId, status }, context) => {
            const authUser = (0, context_js_1.requireAuth)(context);
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
            const res = await index_js_7.UserModel.findOneAndDelete({ _id: userId, organizationId: authUser.organizationId });
            return !!res;
        },
        // ─── Department Mutations ───
        createDepartment: async (_, { input }, context) => {
            const authUser = (0, context_js_1.requireAuth)(context);
            if (!authUser.organizationId)
                throw new Error("No organization found");
            const org = await index_js_7.OrganizationModel.findById(authUser.organizationId);
            if (!org)
                throw new Error("Organization not found");
            let roleName = input.roleName;
            if (input.roleId && !roleName) {
                const r = await index_js_7.RoleModel.findById(input.roleId);
                if (r)
                    roleName = r.name;
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
                packageAccess: input.packageAccess || ["org-email"],
                createdAt: new Date().toISOString(),
            };
            org.departments = [...(org.departments || []), newDept];
            await org.save();
            // If members are specified, sync their department info on UserModel
            if (input.memberIds && input.memberIds.length > 0) {
                await index_js_7.UserModel.updateMany({ _id: { $in: input.memberIds }, organizationId: authUser.organizationId }, { $set: { department: input.name, departmentId: deptId, ...(input.roleId ? { roleId: input.roleId } : {}) } }).catch((err) => console.warn("⚠️ Failed to sync user department references:", err));
            }
            return newDept;
        },
        updateDepartment: async (_, { id, input }, context) => {
            const authUser = (0, context_js_1.requireAuth)(context);
            if (!authUser.organizationId)
                throw new Error("No organization found");
            const org = await index_js_7.OrganizationModel.findById(authUser.organizationId);
            if (!org)
                throw new Error("Organization not found");
            const depts = org.departments || [];
            const idx = depts.findIndex((d) => d.id === id);
            if (idx === -1)
                throw new Error("Department not found");
            let roleName = input.roleName;
            if (input.roleId && !roleName) {
                const r = await index_js_7.RoleModel.findById(input.roleId);
                if (r)
                    roleName = r.name;
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
                await index_js_7.UserModel.updateMany({ _id: { $in: input.memberIds }, organizationId: authUser.organizationId }, { $set: { department: updated.name, departmentId: id, ...(updated.roleId ? { roleId: updated.roleId } : {}) } }).catch((err) => console.warn("⚠️ Failed to sync user department references:", err));
            }
            return updated;
        },
        deleteDepartment: async (_, { id }, context) => {
            const authUser = (0, context_js_1.requireAuth)(context);
            if (!authUser.organizationId)
                throw new Error("No organization found");
            const org = await index_js_7.OrganizationModel.findById(authUser.organizationId);
            if (!org)
                return false;
            org.departments = (org.departments || []).filter((d) => d.id !== id);
            org.markModified("departments");
            await org.save();
            return true;
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
                description: role.description,
                isSystem: role.isSystem,
                memberCount: 0,
                permissions: role.permissions,
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
            return {
                id: role._id.toString(),
                name: role.name,
                description: role.description,
                isSystem: role.isSystem,
                memberCount: role.memberCount || 0,
                permissions: role.permissions,
            };
        },
        deleteRole: async (_, { id }, context) => {
            const authUser = (0, context_js_1.requireAuth)(context);
            if (!authUser.organizationId)
                throw new Error("No organization found");
            const role = await index_js_7.RoleModel.findOne({ _id: id, organizationId: authUser.organizationId });
            if (!role)
                throw new Error("Role not found");
            if (role.isSystem)
                throw new Error("System default roles cannot be deleted.");
            await index_js_7.RoleModel.deleteOne({ _id: id, organizationId: authUser.organizationId });
            return true;
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
            return index_js_5.PaystackService.initializeWalletFunding({
                organizationId: authUser.organizationId,
                userId: authUser.userId,
                userEmail: authUser.email,
                amountInNaira: input.amountInNaira,
                callbackUrl: input.callbackUrl,
            });
        },
        fundWalletDirect: async (_, { amountInNaira, channel = "bank_transfer", description = "Direct Wallet Funding", }, context) => {
            const authUser = (0, context_js_1.requireAuth)(context);
            if (!authUser.organizationId)
                throw new Error("No organization found");
            const amountInKobo = Math.round(amountInNaira * 100);
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
        // ─── Email Dispatch Mutations (Resend) ───
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
    },
};
