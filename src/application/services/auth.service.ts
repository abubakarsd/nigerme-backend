import { UserModel } from "../../infrastructure/database/models/user.model.js";
import { OrganizationModel } from "../../infrastructure/database/models/organization.model.js";
import { SubscriptionModel } from "../../infrastructure/database/models/subscription.model.js";
import { TokenManager, TokenPayload } from "../../infrastructure/security/token.manager.js";
import { OtpService } from "./otp.service.js";
import { ResendEmailService } from "../../services/resend/index.js";

export interface AdminSignupDto {
  name: string;
  email: string;
  password: string;
  phone?: string;
  organizationName?: string;
  domain?: string;
}

export interface LoginDto {
  email: string;
  password: string;
}

export interface SetInitialPasswordDto {
  email: string;
  temporaryPassword: string;
  newPassword: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    userType: "saas_admin" | "email_user";
    phone?: string | null;
    organizationId?: string | null;
    isEmailVerified: boolean;
    isPhoneVerified: boolean;
    twoFactorEnabled: boolean;
    mustChangePassword?: boolean | null;
    canAccessEmail: boolean;
    avatarUrl?: string | null;
    status: string;
    lastLoginAt?: string | null;
    createdAt: string;
  };
}

export class AuthService {
  /**
   * 1. SaaS Admin Portal: Registers a new SaaS tenant administrator and creates their company organization
   */
  static async signup(dto: AdminSignupDto): Promise<AuthTokens> {
    const existingUser = await UserModel.findOne({ email: dto.email.toLowerCase() });
    if (existingUser) {
      throw new Error("An account with this email address already exists.");
    }

    const domainName = (dto.domain || dto.organizationName || "mycorp")
      .toLowerCase()
      .replace(/[^a-z0-9.-]/g, "")
      .replace(/^https?:\/\//, "");

    const existingOrg = await OrganizationModel.findOne({ domain: domainName });
    if (existingOrg) {
      throw new Error("This domain is already registered. Please contact your administrator.");
    }

    const passwordHash = await TokenManager.hashPassword(dto.password);

    const user = await UserModel.create({
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

    const organization = await OrganizationModel.create({
      name: dto.organizationName || `${dto.name}'s Organization`,
      domain: domainName,
      ownerId: user._id,
      plan: "tier1",
      walletBalance: 0,
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

    user.organizationId = organization._id as any;
    await user.save();

    // Create initial 7-day free trial subscription record
    await SubscriptionModel.create({
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

    const payload: Omit<TokenPayload, "iat" | "exp"> = {
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
      userType: user.userType,
      organizationId: organization._id.toString(),
    };

    const accessToken = TokenManager.generateAccessToken(payload);
    const refreshToken = TokenManager.generateRefreshToken(payload);

    // Asynchronously dispatch welcome onboarding email via Resend
    ResendEmailService.sendWelcomeEmail(
      user.email,
      user.name,
      organization.name,
      organization.domain
    ).catch((err) => console.error("⚠️ Failed to send welcome email:", err));

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
  static async login(dto: LoginDto): Promise<
    | { requiresTwoFactor: false; tokens: AuthTokens }
    | { requiresTwoFactor: true; phone: string; message: string }
  > {
    const user = await UserModel.findOne({ email: dto.email.toLowerCase() }).select("+passwordHash");
    if (!user) {
      throw new Error("Invalid email or password.");
    }

    const isMatch = await TokenManager.comparePassword(dto.password, user.passwordHash);
    if (!isMatch) {
      throw new Error("Invalid email or password.");
    }

    if (user.status === "suspended") {
      throw new Error("Your account has been suspended. Please contact support.");
    }

    // Security: Always dispatch 2FA OTP verification code to Phone and Email
    if (user.phone) {
      await OtpService.sendPhoneOtp(user.phone, "login_2fa").catch((err) =>
        console.warn("⚠️ Phone 2FA dispatch warning:", err)
      );
    }
    await OtpService.sendEmailOtp(user.email, user.name, "login_2fa").catch((err) =>
      console.warn("⚠️ Email 2FA dispatch warning:", err)
    );

    return {
      requiresTwoFactor: true,
      phone: user.phone || user.email,
      message: "A 6-digit 2FA verification code has been dispatched to your phone and email.",
    };
  }

  /**
   * 3. Webmail User Login: For added organization email users only
   * (Users CANNOT publicly sign up; they can only log in once added by their admin)
   */
  static async mailLogin(dto: LoginDto): Promise<
    | { requiresTwoFactor: false; mustChangePassword?: boolean; tokens: AuthTokens }
    | { requiresTwoFactor: true; phone: string; message: string }
  > {
    const user = await UserModel.findOne({ email: dto.email.toLowerCase() }).select("+passwordHash");
    if (!user) {
      throw new Error(
        "Mailbox account not found. Please contact your organization administrator to add your email address."
      );
    }

    // Must belong to an organization
    if (!user.organizationId) {
      throw new Error("This account is not associated with an active organization mailbox.");
    }

    const org = await OrganizationModel.findById(user.organizationId);
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

    const isMatch = await TokenManager.comparePassword(dto.password, user.passwordHash);
    if (!isMatch) {
      throw new Error("Incorrect mailbox password.");
    }

    // Security: Always dispatch 2FA OTP verification code to Phone and Email
    if (user.phone) {
      await OtpService.sendPhoneOtp(user.phone, "login_2fa").catch((err) =>
        console.warn("⚠️ Phone 2FA dispatch warning:", err)
      );
    }
    await OtpService.sendEmailOtp(user.email, user.name, "login_2fa").catch((err) =>
      console.warn("⚠️ Email 2FA dispatch warning:", err)
    );

    return {
      requiresTwoFactor: true,
      phone: user.phone || user.email,
      message: "A 6-digit 2FA verification code has been dispatched to your phone and email.",
    };
  }

  /**
   * 4. Initial Password Setup: Allows newly added email users to set a permanent password
   */
  static async setInitialPassword(dto: SetInitialPasswordDto): Promise<AuthTokens> {
    const user = await UserModel.findOne({ email: dto.email.toLowerCase() }).select("+passwordHash");
    if (!user) {
      throw new Error("User account not found.");
    }

    const isMatch = await TokenManager.comparePassword(dto.temporaryPassword, user.passwordHash);
    if (!isMatch) {
      throw new Error("Invalid temporary password.");
    }

    user.passwordHash = await TokenManager.hashPassword(dto.newPassword);
    user.mustChangePassword = false;
    user.lastLoginAt = new Date();
    await user.save();

    const payload: Omit<TokenPayload, "iat" | "exp"> = {
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
      userType: user.userType,
      organizationId: user.organizationId?.toString(),
    };

    return {
      accessToken: TokenManager.generateAccessToken(payload),
      refreshToken: TokenManager.generateRefreshToken(payload),
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
  static async verify2faAndLogin(identifier: string, code: string): Promise<AuthTokens> {
    const cleanId = (identifier || "").trim();
    const isEmail = cleanId.includes("@");
    let verified = false;

    if (isEmail) {
      verified = await OtpService.verifyEmailOtp(cleanId, code, "login_2fa");
    } else {
      try {
        verified = await OtpService.verifyPhoneOtp(cleanId, code, "login_2fa");
      } catch (phoneErr) {
        // Fallback: Check if identifier matches a user's phone or email
        const userByPhone = await UserModel.findOne({ phone: cleanId });
        if (userByPhone) {
          verified = await OtpService.verifyEmailOtp(userByPhone.email, code, "login_2fa");
        } else {
          throw phoneErr;
        }
      }
    }

    if (!verified) {
      throw new Error("Invalid verification code. Please try again.");
    }

    const user = isEmail
      ? await UserModel.findOne({ email: cleanId.toLowerCase() })
      : (await UserModel.findOne({ phone: cleanId })) || (await UserModel.findOne({ email: cleanId.toLowerCase() }));

    if (!user) {
      throw new Error("User associated with this account not found.");
    }

    user.lastLoginAt = new Date();
    await user.save();

    const payload: Omit<TokenPayload, "iat" | "exp"> = {
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
      userType: user.userType,
      organizationId: user.organizationId?.toString(),
    };

    return {
      accessToken: TokenManager.generateAccessToken(payload),
      refreshToken: TokenManager.generateRefreshToken(payload),
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
  static async refreshSession(refreshToken: string): Promise<{ accessToken: string }> {
    const payload = TokenManager.verifyRefreshToken(refreshToken);
    const user = await UserModel.findById(payload.userId);
    if (!user || user.status !== "active") {
      throw new Error("User session invalid or revoked.");
    }

    const newAccessToken = TokenManager.generateAccessToken({
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
      userType: user.userType,
      organizationId: user.organizationId?.toString(),
    });

    return { accessToken: newAccessToken };
  }
}
