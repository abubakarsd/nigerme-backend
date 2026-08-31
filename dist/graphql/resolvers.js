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
            return index_js_7.OrganizationModel.findById(authUser.organizationId);
        },
        getOrganizationMembers: async (_, __, context) => {
            const authUser = (0, context_js_1.requireAuth)(context);
            if (!authUser.organizationId)
                return [];
            return index_js_7.UserModel.find({ organizationId: authUser.organizationId }).sort({ createdAt: -1 });
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
            return index_js_7.TransactionModel.find({ organizationId: authUser.organizationId })
                .sort({ createdAt: -1 })
                .limit(limit);
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
        // ─── Organization & Domain ───
        verifyDomainDns: async (_, __, context) => {
            const authUser = (0, context_js_1.requireAuth)(context);
            if (!authUser.organizationId)
                throw new Error("No organization found");
            return organization_service_js_1.OrganizationService.verifyDomainDns(authUser.organizationId);
        },
        inviteMember: async (_, { input }, context) => {
            const authUser = (0, context_js_1.requireAuth)(context);
            if (!authUser.organizationId)
                throw new Error("No organization found");
            return organization_service_js_1.OrganizationService.inviteMember(authUser.organizationId, input);
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
        // ─── Payment Mutations (Paystack) ───
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
