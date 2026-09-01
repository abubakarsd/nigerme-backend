"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const user_model_js_1 = require("../../infrastructure/database/models/user.model.js");
const organization_model_js_1 = require("../../infrastructure/database/models/organization.model.js");
const subscription_model_js_1 = require("../../infrastructure/database/models/subscription.model.js");
const token_manager_js_1 = require("../../infrastructure/security/token.manager.js");
const otp_service_js_1 = require("./otp.service.js");
const index_js_1 = require("../../services/resend/index.js");
const role_seed_js_1 = require("../../infrastructure/database/seeds/role.seed.js");
class AuthService {
    /**
     * 1. SaaS Admin Portal: Registers a new SaaS tenant administrator and creates their company organization
     */
    static async signup(dto) {
        const existingUser = await user_model_js_1.UserModel.findOne({ email: dto.email.toLowerCase() });
        if (existingUser) {
            throw new Error("An account with this email address already exists.");
        }
        const domainName = (dto.domain || dto.organizationName || "mycorp")
            .toLowerCase()
            .replace(/[^a-z0-9.-]/g, "")
            .replace(/^https?:\/\//, "");
        const existingOrg = await organization_model_js_1.OrganizationModel.findOne({ domain: domainName });
        if (existingOrg) {
            throw new Error("This domain is already registered. Please contact your administrator.");
        }
        const passwordHash = await token_manager_js_1.TokenManager.hashPassword(dto.password);
        const user = await user_model_js_1.UserModel.create({
            name: dto.name,
            email: dto.email.toLowerCase(),
            passwordHash,
            phone: dto.phone,
            role: "admin",
            userType: "saas_admin",
            status: "active",
            isEmailVerified: true,
            twoFactorEnabled: true,
            mustChangePassword: false,
            canAccessEmail: true,
        });
        const trialStartsAt = new Date();
        const trialEndsAt = new Date(trialStartsAt.getTime() + 7 * 24 * 60 * 60 * 1000);
        // Asynchronously or synchronously provision domain in Resend using RESEND_ORG_API
        let resendDomainInfo = null;
        try {
            const domResult = await index_js_1.ResendDomainService.findOrCreateDomain(domainName);
            if (domResult.success && domResult.data) {
                resendDomainInfo = domResult.data;
            }
        }
        catch (err) {
            console.warn("⚠️ Resend domain provisioning warning during signup:", err.message);
        }
        const organization = await organization_model_js_1.OrganizationModel.create({
            name: dto.organizationName || `${dto.name}'s Organization`,
            domain: domainName,
            ownerId: user._id,
            plan: "tier1",
            walletBalance: 0,
            resendDomainId: resendDomainInfo?.id,
            resendStatus: resendDomainInfo?.status || "not_started",
            resendRegion: resendDomainInfo?.region || "us-east-1",
            resendRecords: resendDomainInfo?.records || [],
            kycStatus: "unverified",
            trustLevel: "Tier 1 Sovereign",
            dailySendingLimit: 1000,
            subscribedPackages: ["org-email"],
            totalSeats: 0,
            usedSeats: 0,
            subscriptionStatus: "TRIAL",
            trialStartsAt,
            trialEndsAt,
            subscriptionStartsAt: trialStartsAt,
            subscriptionExpiresAt: trialEndsAt,
            isSuspended: false,
        });
        user.organizationId = organization._id;
        await user.save();
        // Create initial 7-day free trial subscription record
        await subscription_model_js_1.SubscriptionModel.create({
            organizationId: organization._id,
            packageIds: ["org-email"],
            billingCycle: "MONTHLY",
            seatCount: 0,
            totalAmount: 0,
            currency: "NGN",
            status: "TRIAL",
            paymentMethod: "FREE_TRIAL",
            trialStartsAt,
            trialEndsAt,
            currentPeriodStartsAt: trialStartsAt,
            currentPeriodEndsAt: trialEndsAt,
            autoDebit: true,
        });
        // Seed default roles for this new organization in DB (departments created on demand by admin)
        await (0, role_seed_js_1.seedOrganizationDefaultRoles)(organization._id).catch((err) => console.warn("⚠️ Failed to seed default roles during signup:", err));
        const payload = {
            userId: user._id.toString(),
            email: user.email,
            role: user.role,
            userType: user.userType,
            organizationId: organization._id.toString(),
        };
        const accessToken = token_manager_js_1.TokenManager.generateAccessToken(payload);
        const refreshToken = token_manager_js_1.TokenManager.generateRefreshToken(payload);
        // Asynchronously dispatch welcome onboarding email via Resend
        index_js_1.ResendEmailService.sendWelcomeEmail(user.email, user.name, organization.name, organization.domain).catch((err) => console.error("⚠️ Failed to send welcome email:", err));
        return {
            accessToken,
            refreshToken,
            user: {
                id: user._id.toString(),
                email: user.email,
                name: user.name,
                role: user.role,
                userType: user.userType,
                phone: user.phone ?? null,
                organizationId: organization._id.toString(),
                isEmailVerified: user.isEmailVerified ?? true,
                isPhoneVerified: user.isPhoneVerified ?? false,
                twoFactorEnabled: user.twoFactorEnabled ?? false,
                mustChangePassword: user.mustChangePassword ?? false,
                canAccessEmail: user.canAccessEmail ?? true,
                avatarUrl: user.avatarUrl ?? null,
                status: user.status ?? "active",
                lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
                createdAt: user.createdAt ? user.createdAt.toISOString() : new Date().toISOString(),
            },
        };
    }
    /**
     * 2. SaaS Admin Portal Login: Authenticates Organization Owners, Superadmins, and Workspace Managers
     */
    static async login(dto) {
        const user = await user_model_js_1.UserModel.findOne({ email: dto.email.toLowerCase() }).select("+passwordHash");
        if (!user) {
            throw new Error("Invalid email or password.");
        }
        const isMatch = await token_manager_js_1.TokenManager.comparePassword(dto.password, user.passwordHash);
        if (!isMatch) {
            throw new Error("Invalid email or password.");
        }
        if (user.status === "suspended") {
            throw new Error("Your account has been suspended. Please contact support.");
        }
        // Security: Always dispatch a unified 2FA OTP verification code to Phone and Email simultaneously
        await otp_service_js_1.OtpService.sendUnified2faOtp(user.email, user.name, user.phone).catch((err) => console.warn("⚠️ 2FA dispatch warning:", err));
        return {
            requiresTwoFactor: true,
            phone: user.email,
            message: `A 6-digit 2FA verification code has been dispatched to ${user.email}${user.phone ? ` and ${user.phone}` : ""}.`,
        };
    }
    /**
     * 3. Webmail User Login: For added organization email users only
     * (Users CANNOT publicly sign up; they can only log in once added by their admin)
     */
    static async mailLogin(dto) {
        const user = await user_model_js_1.UserModel.findOne({ email: dto.email.toLowerCase() }).select("+passwordHash");
        if (!user) {
            throw new Error("Mailbox account not found. Please contact your organization administrator to add your email address.");
        }
        // Must belong to an organization
        if (!user.organizationId) {
            throw new Error("This account is not associated with an active organization mailbox.");
        }
        const org = await organization_model_js_1.OrganizationModel.findById(user.organizationId);
        if (!org) {
            throw new Error("Organization domain is unavailable or inactive.");
        }
        // Check account status
        if (user.status === "suspended") {
            throw new Error("Your mailbox has been suspended by the organization administrator.");
        }
        if (!user.canAccessEmail) {
            throw new Error("Email access is not enabled for your account. Please contact your administrator.");
        }
        const isMatch = await token_manager_js_1.TokenManager.comparePassword(dto.password, user.passwordHash);
        if (!isMatch) {
            throw new Error("Incorrect mailbox password.");
        }
        // 1. FIRST-TIME LOGIN: User was newly provisioned with a temporary password -> Force password change
        if (user.mustChangePassword) {
            return {
                requiresTwoFactor: false,
                mustChangePassword: true,
                tokens: null,
                personalEmail: user.personalEmail ? (0, otp_service_js_1.maskEmail)(user.personalEmail) : undefined,
            };
        }
        // 2. RETURNING/EXISTING USER: Dispatch 2FA OTP code directly to their personal email
        const targetPersonalEmail = user.personalEmail || user.email;
        const otpRes = await otp_service_js_1.OtpService.sendPersonalEmail2faOtp(targetPersonalEmail, user.name, user.email).catch((err) => {
            console.warn("⚠️ Personal email 2FA dispatch warning:", err);
            return {
                message: `A 6-digit verification code has been dispatched to your personal email (${(0, otp_service_js_1.maskEmail)(targetPersonalEmail)}).`,
                personalEmailMasked: (0, otp_service_js_1.maskEmail)(targetPersonalEmail),
            };
        });
        return {
            requiresTwoFactor: true,
            mustChangePassword: false,
            phone: targetPersonalEmail,
            personalEmail: otpRes.personalEmailMasked || (0, otp_service_js_1.maskEmail)(targetPersonalEmail),
            message: otpRes.message || `A 6-digit verification code has been dispatched to your personal email (${(0, otp_service_js_1.maskEmail)(targetPersonalEmail)}).`,
        };
    }
    /**
     * 4. Initial Password Setup: Allows newly added email users to set a permanent password
     */
    static async setInitialPassword(dto) {
        const user = await user_model_js_1.UserModel.findOne({ email: dto.email.toLowerCase() }).select("+passwordHash");
        if (!user) {
            throw new Error("User account not found.");
        }
        const isMatch = await token_manager_js_1.TokenManager.comparePassword(dto.temporaryPassword, user.passwordHash);
        if (!isMatch) {
            throw new Error("Invalid temporary password.");
        }
        user.passwordHash = await token_manager_js_1.TokenManager.hashPassword(dto.newPassword);
        user.mustChangePassword = false;
        user.lastLoginAt = new Date();
        await user.save();
        const payload = {
            userId: user._id.toString(),
            email: user.email,
            role: user.role,
            userType: user.userType,
            organizationId: user.organizationId?.toString(),
        };
        return {
            accessToken: token_manager_js_1.TokenManager.generateAccessToken(payload),
            refreshToken: token_manager_js_1.TokenManager.generateRefreshToken(payload),
            user: {
                id: user._id.toString(),
                email: user.email,
                name: user.name,
                role: user.role,
                userType: user.userType,
                phone: user.phone ?? null,
                organizationId: user.organizationId?.toString() ?? null,
                isEmailVerified: user.isEmailVerified ?? false,
                isPhoneVerified: user.isPhoneVerified ?? false,
                twoFactorEnabled: true,
                mustChangePassword: false,
                canAccessEmail: user.canAccessEmail ?? false,
                avatarUrl: user.avatarUrl ?? null,
                status: user.status ?? "active",
                lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
                createdAt: user.createdAt ? user.createdAt.toISOString() : new Date().toISOString(),
            },
        };
    }
    /**
     * 5. Finalizes login after 2FA OTP verification (supports phone or email)
     */
    static async verify2faAndLogin(identifier, code) {
        const cleanId = (identifier || "").trim();
        const isEmail = cleanId.includes("@");
        let verified = false;
        if (isEmail) {
            verified = await otp_service_js_1.OtpService.verifyEmailOtp(cleanId, code, "login_2fa");
        }
        else {
            try {
                verified = await otp_service_js_1.OtpService.verifyPhoneOtp(cleanId, code, "login_2fa");
            }
            catch (phoneErr) {
                // Fallback: Check if identifier matches a user's phone or email
                const userByPhone = await user_model_js_1.UserModel.findOne({ phone: cleanId });
                if (userByPhone) {
                    verified = await otp_service_js_1.OtpService.verifyEmailOtp(userByPhone.email, code, "login_2fa");
                }
                else {
                    throw phoneErr;
                }
            }
        }
        if (!verified) {
            throw new Error("Invalid verification code. Please try again.");
        }
        const user = isEmail
            ? await user_model_js_1.UserModel.findOne({ email: cleanId.toLowerCase() })
            : (await user_model_js_1.UserModel.findOne({ phone: cleanId })) || (await user_model_js_1.UserModel.findOne({ email: cleanId.toLowerCase() }));
        if (!user) {
            throw new Error("User associated with this account not found.");
        }
        user.lastLoginAt = new Date();
        await user.save();
        const payload = {
            userId: user._id.toString(),
            email: user.email,
            role: user.role,
            userType: user.userType,
            organizationId: user.organizationId?.toString(),
        };
        return {
            accessToken: token_manager_js_1.TokenManager.generateAccessToken(payload),
            refreshToken: token_manager_js_1.TokenManager.generateRefreshToken(payload),
            user: {
                id: user._id.toString(),
                email: user.email,
                name: user.name,
                role: user.role,
                userType: user.userType,
                phone: user.phone ?? null,
                organizationId: user.organizationId?.toString() ?? null,
                isEmailVerified: user.isEmailVerified ?? false,
                isPhoneVerified: user.isPhoneVerified ?? false,
                twoFactorEnabled: true,
                mustChangePassword: user.mustChangePassword ?? false,
                canAccessEmail: user.canAccessEmail ?? false,
                avatarUrl: user.avatarUrl ?? null,
                status: user.status ?? "active",
                lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
                createdAt: user.createdAt ? user.createdAt.toISOString() : new Date().toISOString(),
            },
        };
    }
    /**
     * 6. Rotates refreshed JWT
     */
    static async refreshSession(refreshToken) {
        const payload = token_manager_js_1.TokenManager.verifyRefreshToken(refreshToken);
        const user = await user_model_js_1.UserModel.findById(payload.userId);
        if (!user || user.status !== "active") {
            throw new Error("User session invalid or revoked.");
        }
        const newAccessToken = token_manager_js_1.TokenManager.generateAccessToken({
            userId: user._id.toString(),
            email: user.email,
            role: user.role,
            userType: user.userType,
            organizationId: user.organizationId?.toString(),
        });
        return { accessToken: newAccessToken };
    }
}
exports.AuthService = AuthService;
