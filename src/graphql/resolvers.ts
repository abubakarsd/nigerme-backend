import { GraphQLContext, requireAuth } from "./context.js";
import { AuthService } from "../services/auth/index.js";
import { TermiiOtpService } from "../services/termii/index.js";
import { ProvnKycService } from "../services/provn/index.js";
import { AwsS3Service } from "../services/aws/index.js";
import { PaystackService } from "../services/paystack/index.js";
import { ResendEmailService } from "../services/resend/index.js";
import { OrganizationService } from "../application/services/organization.service.js";
import { AuditService } from "../application/services/audit.service.js";
import { AbuseService } from "../application/services/abuse.service.js";
import { UserModel, OrganizationModel, TransactionModel, KycRecordModel } from "../models/index.js";
import { TokenManager } from "../infrastructure/security/token.manager.js";

export const resolvers = {
  Query: {
    healthCheck: () => "Nigerme Sovereign GraphQL Backend is operational.",

    me: async (_: any, __: any, context: GraphQLContext) => {
      const authUser = requireAuth(context);
      const user = await UserModel.findById(authUser.userId);
      if (!user) throw new Error("User not found.");
      return user;
    },

    myOrganization: async (_: any, __: any, context: GraphQLContext) => {
      const authUser = requireAuth(context);
      if (!authUser.organizationId) return null;
      return OrganizationModel.findById(authUser.organizationId);
    },

    getOrganizationMembers: async (_: any, __: any, context: GraphQLContext) => {
      const authUser = requireAuth(context);
      if (!authUser.organizationId) return [];
      return UserModel.find({ organizationId: authUser.organizationId }).sort({ createdAt: -1 });
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
      return TransactionModel.find({ organizationId: authUser.organizationId })
        .sort({ createdAt: -1 })
        .limit(limit);
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

    setInitialPassword: async (_: any, { input }: { input: any }) => {
      return AuthService.setInitialPassword(input);
    },

    verify2fa: async (_: any, { phone, code }: { phone: string; code: string }) => {
      return AuthService.verify2faAndLogin(phone, code);
    },

    requestPhoneOtp: async (_: any, { phone, purpose }: { phone: string; purpose?: string }) => {
      return TermiiOtpService.sendPhoneOtp(phone, (purpose as any) || "phone_verification");
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

    // ─── Organization & Domain ───
    verifyDomainDns: async (_: any, __: any, context: GraphQLContext) => {
      const authUser = requireAuth(context);
      if (!authUser.organizationId) throw new Error("No organization found");
      return OrganizationService.verifyDomainDns(authUser.organizationId);
    },

    inviteMember: async (_: any, { input }: { input: any }, context: GraphQLContext) => {
      const authUser = requireAuth(context);
      if (!authUser.organizationId) throw new Error("No organization found");
      return OrganizationService.inviteMember(authUser.organizationId, input);
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

    // ─── Payment Mutations (Paystack) ───
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

    // ─── Email Dispatch Mutations (Resend) ───
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
  },
};
