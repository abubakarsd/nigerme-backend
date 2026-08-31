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
exports.resolvers = {
    Query: {
        healthCheck: () => "Nigerme Sovereign GraphQL Backend is operational.",
        me: async (_, __, context) => {
            const authUser = (0, context_js_1.requireAuth)(context);
            const user = await index_js_7.UserModel.findById(authUser.userId);
            if (!user)
                throw new Error("User not found.");
            return user;
        },
        myOrganization: async (_, __, context) => {
            const authUser = (0, context_js_1.requireAuth)(context);
            if (!authUser.organizationId)
                return null;
            let org = await index_js_7.OrganizationModel.findById(authUser.organizationId);
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
            };
        },
        getOrganizationMembers: async (_, __, context) => {
            const authUser = (0, context_js_1.requireAuth)(context);
            if (!authUser.organizationId)
                return [];
            const users = await index_js_7.UserModel.find({ organizationId: authUser.organizationId }).sort({ createdAt: -1 });
            return users.map((u) => ({
                ...u.toObject(),
                id: u._id.toString(),
            }));
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
                    message: result.message,
                    tokens: null,
                };
            }
            return {
                requiresTwoFactor: false,
                mustChangePassword: result.mustChangePassword,
                tokens: result.tokens,
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
            const user = await index_js_7.UserModel.findById(authUser.userId);
            const current = org.subscribedPackages || ["org-email"];
            if (!current.includes(packageId)) {
                current.push(packageId);
                org.subscribedPackages = current;
                await org.save();
            }
            // Dispatch subscription activation email via Resend
            if (user && user.email) {
                const pkgNames = {
                    "org-email": "Sovereign Business Mailbox",
                    "payroll": "Sovereign Payroll & PAYE",
                    "pos": "Commerce POS & Retail Hub",
                    "logistics": "Fleet & Logistics Tracker",
                    "hotel": "Hotel PMS & FrontDesk",
                };
                const pkgName = pkgNames[packageId] || packageId;
                index_js_6.ResendEmailService.sendSubscriptionActivatedEmail(user.email, user.name || "Administrator", org.name, pkgName).catch((err) => console.error("⚠️ Failed to send subscription email:", err));
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
            const user = await index_js_7.UserModel.findById(authUser.userId);
            const current = org.subscribedPackages || ["org-email"];
            const next = current.filter((id) => id !== packageId);
            org.subscribedPackages = next;
            await org.save();
            // Dispatch cancellation confirmation email via Resend
            if (user && user.email) {
                const pkgNames = {
                    "org-email": "Sovereign Business Mailbox",
                    "payroll": "Sovereign Payroll & PAYE",
                    "pos": "Commerce POS & Retail Hub",
                    "logistics": "Fleet & Logistics Tracker",
                    "hotel": "Hotel PMS & FrontDesk",
                };
                const pkgName = pkgNames[packageId] || packageId;
                index_js_6.ResendEmailService.sendCancellationEmail(user.email, user.name || "Administrator", org.name, pkgName).catch((err) => console.error("⚠️ Failed to send cancellation email:", err));
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
            // Calculate total cost
            let totalCostInNaira = 0;
            for (const pkgId of packageIds) {
                const pkg = package_seed_js_1.INITIAL_PACKAGES.find((p) => p.packageId === pkgId);
                if (pkg) {
                    totalCostInNaira += billingCycle === "ANNUAL" ? pkg.priceAnnual : pkg.priceMonthly;
                }
            }
            if (totalCostInNaira === 0)
                totalCostInNaira = 15000;
            const costInKobo = totalCostInNaira * 100;
            if ((org.walletBalance || 0) < costInKobo) {
                throw new Error(`Insufficient wallet balance. Total required is ₦${totalCostInNaira.toLocaleString()}, but available wallet balance is ₦${((org.walletBalance || 0) / 100).toLocaleString()}. Please fund your wallet to activate.`);
            }
            // Deduct from wallet
            org.walletBalance = (org.walletBalance || 0) - costInKobo;
            org.subscribedPackages = packageIds;
            org.billingCycle = billingCycle;
            org.totalSeats = totalSeats;
            org.subscriptionStatus = "ACTIVE";
            org.subscriptionStartsAt = new Date();
            const periodDays = billingCycle === "ANNUAL" ? 365 : 30;
            const nextDue = new Date(Date.now() + periodDays * 24 * 60 * 60 * 1000);
            org.subscriptionExpiresAt = nextDue;
            org.gracePeriodEndsAt = undefined;
            org.isSuspended = false;
            org.lastBillingReminderType = undefined;
            await org.save();
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
