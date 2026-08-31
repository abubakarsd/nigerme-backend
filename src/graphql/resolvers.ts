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
import { PackageService } from "../application/services/package.service.js";
import { UserModel, OrganizationModel, TransactionModel, KycRecordModel } from "../models/index.js";
import { TokenManager } from "../infrastructure/security/token.manager.js";
import { OtpService } from "../application/services/otp.service.js";
import { INITIAL_PACKAGES } from "../infrastructure/database/seeds/package.seed.js";

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
      let org = await OrganizationModel.findById(authUser.organizationId);
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

      const orgObj = org.toObject();
      return {
        ...orgObj,
        id: org._id.toString(),
        walletBalance: org.walletBalance / 100, // Return in Naira
      };
    },

    getOrganizationMembers: async (_: any, __: any, context: GraphQLContext) => {
      const authUser = requireAuth(context);
      if (!authUser.organizationId) return [];
      const users = await UserModel.find({ organizationId: authUser.organizationId }).sort({ createdAt: -1 });
      return users.map((u) => ({
        ...u.toObject(),
        id: u._id.toString(),
      }));
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

      const user = await UserModel.findById(authUser.userId);

      const current = org.subscribedPackages || ["org-email"];
      if (!current.includes(packageId)) {
        current.push(packageId);
        org.subscribedPackages = current;
        await org.save();
      }

      // Dispatch subscription activation email via Resend
      if (user && user.email) {
        const pkgNames: Record<string, string> = {
          "org-email": "Sovereign Business Mailbox",
          "payroll": "Sovereign Payroll & PAYE",
          "pos": "Commerce POS & Retail Hub",
          "logistics": "Fleet & Logistics Tracker",
          "hotel": "Hotel PMS & FrontDesk",
        };
        const pkgName = pkgNames[packageId] || packageId;
        ResendEmailService.sendSubscriptionActivatedEmail(
          user.email,
          user.name || "Administrator",
          org.name,
          pkgName
        ).catch((err) => console.error("⚠️ Failed to send subscription email:", err));
      }

      return {
        ...org.toObject(),
        id: org._id.toString(),
        walletBalance: org.walletBalance / 100,
      };
    },

    cancelPackageSubscription: async (
      _: any,
      { packageId }: { packageId: string },
      context: GraphQLContext
    ) => {
      const authUser = requireAuth(context);
      if (!authUser.organizationId) throw new Error("No organization found");
      const org = await OrganizationModel.findById(authUser.organizationId);
      if (!org) throw new Error("Organization not found");

      const user = await UserModel.findById(authUser.userId);

      const current = org.subscribedPackages || ["org-email"];
      const next = current.filter((id) => id !== packageId);
      org.subscribedPackages = next;
      await org.save();

      // Dispatch cancellation confirmation email via Resend
      if (user && user.email) {
        const pkgNames: Record<string, string> = {
          "org-email": "Sovereign Business Mailbox",
          "payroll": "Sovereign Payroll & PAYE",
          "pos": "Commerce POS & Retail Hub",
          "logistics": "Fleet & Logistics Tracker",
          "hotel": "Hotel PMS & FrontDesk",
        };
        const pkgName = pkgNames[packageId] || packageId;
        ResendEmailService.sendCancellationEmail(
          user.email,
          user.name || "Administrator",
          org.name,
          pkgName
        ).catch((err) => console.error("⚠️ Failed to send cancellation email:", err));
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

      // Calculate total cost
      let totalCostInNaira = 0;
      for (const pkgId of packageIds) {
        const pkg = INITIAL_PACKAGES.find((p) => p.packageId === pkgId);
        if (pkg) {
          totalCostInNaira += billingCycle === "ANNUAL" ? pkg.priceAnnual : pkg.priceMonthly;
        }
      }
      if (totalCostInNaira === 0) totalCostInNaira = 15000;

      const costInKobo = totalCostInNaira * 100;
      if ((org.walletBalance || 0) < costInKobo) {
        throw new Error(
          `Insufficient wallet balance. Total required is ₦${totalCostInNaira.toLocaleString()}, but available wallet balance is ₦${((org.walletBalance || 0) / 100).toLocaleString()}. Please fund your wallet to activate.`
        );
      }

      // Deduct from wallet
      org.walletBalance = (org.walletBalance || 0) - costInKobo;
      org.subscribedPackages = packageIds;
      org.billingCycle = billingCycle as any;
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
        ResendEmailService.sendWalletDebitedReceipt(
          user.email,
          user.name || "Administrator",
          org.name,
          totalCostInNaira,
          nextDue.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
        ).catch((err) => console.error("⚠️ Failed to send wallet debited receipt email:", err));
      }

      return {
        ...org.toObject(),
        id: org._id.toString(),
        walletBalance: org.walletBalance / 100,
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
      return {
        user: {
          ...res.user.toObject(),
          id: res.user._id.toString(),
        },
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
  },
};
