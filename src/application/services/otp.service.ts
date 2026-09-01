import crypto from "crypto";
import { OtpModel } from "../../infrastructure/database/models/otp.model.js";
import { TermiiClient } from "../../infrastructure/external/termii.client.js";
import { ResendEmailService } from "../../services/resend/index.js";

export class OtpService {
  private static readonly OTP_VALIDITY_MINUTES = 10;
  private static readonly MAX_VERIFY_ATTEMPTS = 5;

  /**
   * Generates, stores, and dispatches a secure 6-digit Email OTP via Resend
   */
  static async sendEmailOtp(
    email: string,
    name = "Workspace Administrator",
    purpose: "signup" | "login_2fa" | "password_reset" | "email_verification" = "email_verification"
  ): Promise<{ message: string; expiresInMinutes: number }> {
    const formattedEmail = email.toLowerCase().trim();

    // Rate-limiting check: Prevent more than 5 OTP requests within 15 minutes
    const recentOtpCount = await OtpModel.countDocuments({
      identifier: formattedEmail,
      createdAt: { $gte: new Date(Date.now() - 15 * 60 * 1000) },
    });

    if (recentOtpCount >= 5) {
      throw new Error("Too many OTP requests. Please wait 15 minutes before requesting another code.");
    }

    // Generate cryptographically secure 6-digit code
    const rawOtp = crypto.randomInt(100000, 999999).toString();
    const otpHash = crypto.createHash("sha256").update(rawOtp).digest("hex");

    const expiresAt = new Date(Date.now() + this.OTP_VALIDITY_MINUTES * 60 * 1000);

    // Remove any previous unused OTP for this email + purpose
    await OtpModel.deleteMany({ identifier: formattedEmail, purpose });

    await OtpModel.create({
      identifier: formattedEmail,
      otpHash,
      purpose,
      expiresAt,
      attempts: 0,
    });

    // Send Email via Resend
    const result = await ResendEmailService.sendOtpEmail(formattedEmail, name, rawOtp, this.OTP_VALIDITY_MINUTES);
    if (!result.success && result.error) {
      console.warn("⚠️ Resend email delivery issue:", result.error);
    }

    return {
      message: `A 6-digit verification code has been dispatched to ${formattedEmail}.`,
      expiresInMinutes: this.OTP_VALIDITY_MINUTES,
    };
  }

  /**
   * Generates and dispatches an IDENTICAL 6-digit 2FA code to both Email and Phone simultaneously
   */
  static async sendUnified2faOtp(
    email: string,
    name = "Workspace Administrator",
    phone?: string | null
  ): Promise<{ message: string; expiresInMinutes: number }> {
    const formattedEmail = email.toLowerCase().trim();
    const rawOtp = crypto.randomInt(100000, 999999).toString();
    const otpHash = crypto.createHash("sha256").update(rawOtp).digest("hex");
    const expiresAt = new Date(Date.now() + this.OTP_VALIDITY_MINUTES * 60 * 1000);

    // Save for email identifier
    await OtpModel.deleteMany({ identifier: formattedEmail, purpose: "login_2fa" });
    await OtpModel.create({
      identifier: formattedEmail,
      otpHash,
      purpose: "login_2fa",
      expiresAt,
      attempts: 0,
    });

    // If phone exists, also save for phone identifier so either identifier can verify
    if (phone) {
      try {
        const formattedPhone = TermiiClient.formatNigerianPhone(phone);
        await OtpModel.deleteMany({ identifier: formattedPhone, purpose: "login_2fa" });
        await OtpModel.create({
          identifier: formattedPhone,
          otpHash,
          purpose: "login_2fa",
          expiresAt,
          attempts: 0,
        });

        // Send SMS via Termii
        await TermiiClient.sendOtp(formattedPhone, rawOtp).catch((err) =>
          console.warn("⚠️ Termii SMS dispatch failed:", err)
        );
      } catch (err) {
        console.warn("⚠️ Could not format phone for 2FA SMS:", err);
      }
    }

    // Send Email via Resend
    await ResendEmailService.sendOtpEmail(formattedEmail, name, rawOtp, this.OTP_VALIDITY_MINUTES).catch((err) =>
      console.warn("⚠️ Resend email dispatch failed:", err)
    );

    return {
      message: `A 6-digit verification code has been sent to ${formattedEmail}${phone ? ` and ${phone}` : ""}.`,
      expiresInMinutes: this.OTP_VALIDITY_MINUTES,
    };
  }

  /**
   * Verifies an Email OTP code against stored hash
   */
  static async verifyEmailOtp(
    email: string,
    otpCode: string,
    purpose: "signup" | "login_2fa" | "password_reset" | "email_verification" = "email_verification"
  ): Promise<boolean> {
    const formattedEmail = email.toLowerCase().trim();
    const candidateHash = crypto.createHash("sha256").update(otpCode.trim()).digest("hex");

    const otpRecord = await OtpModel.findOne({
      identifier: formattedEmail,
      purpose,
    });

    if (!otpRecord) {
      throw new Error("No active verification code found for this email address. Please request a new code.");
    }

    if (otpRecord.expiresAt <= new Date()) {
      await OtpModel.deleteOne({ _id: otpRecord._id });
      throw new Error(`Your verification code has expired (${this.OTP_VALIDITY_MINUTES} minutes validity). Please click 'Resend code now'.`);
    }

    if (otpRecord.attempts >= this.MAX_VERIFY_ATTEMPTS) {
      await OtpModel.deleteOne({ _id: otpRecord._id });
      throw new Error("Too many failed attempts. For security, please request a new verification code.");
    }

    if (otpRecord.otpHash !== candidateHash) {
      otpRecord.attempts += 1;
      await otpRecord.save();
      throw new Error(`Incorrect verification code. ${this.MAX_VERIFY_ATTEMPTS - otpRecord.attempts} attempts remaining.`);
    }

    // OTP matched successfully - delete it to prevent replay attacks
    await OtpModel.deleteOne({ _id: otpRecord._id });
    return true;
  }

  /**
   * Generates, stores, and dispatches a secure 6-digit SMS OTP via Termii
   */
  static async sendPhoneOtp(
    phone: string,
    purpose: "signup" | "login_2fa" | "password_reset" | "phone_verification" = "login_2fa"
  ): Promise<{ message: string; expiresInMinutes: number }> {
    const formattedPhone = TermiiClient.formatNigerianPhone(phone);

    // Rate-limiting check: Prevent more than 5 active OTP requests within 15 minutes
    const recentOtpCount = await OtpModel.countDocuments({
      identifier: formattedPhone,
      createdAt: { $gte: new Date(Date.now() - 15 * 60 * 1000) },
    });

    if (recentOtpCount >= 5) {
      throw new Error("Too many OTP requests. Please wait 15 minutes before requesting another code.");
    }

    // Generate cryptographically secure 6-digit code
    const rawOtp = crypto.randomInt(100000, 999999).toString();
    const otpHash = crypto.createHash("sha256").update(rawOtp).digest("hex");

    const expiresAt = new Date(Date.now() + this.OTP_VALIDITY_MINUTES * 60 * 1000);

    // Remove any previous unused OTP for this phone + purpose
    await OtpModel.deleteMany({ identifier: formattedPhone, purpose });

    await OtpModel.create({
      identifier: formattedPhone,
      otpHash,
      purpose,
      expiresAt,
      attempts: 0,
    });

    // Send SMS via Termii
    await TermiiClient.sendOtp(formattedPhone, rawOtp);

    return {
      message: "Verification code sent successfully to your phone number.",
      expiresInMinutes: this.OTP_VALIDITY_MINUTES,
    };
  }

  /**
   * Verifies a Phone OTP code against stored hash
   */
  static async verifyPhoneOtp(
    phone: string,
    otpCode: string,
    purpose: "signup" | "login_2fa" | "password_reset" | "phone_verification" = "login_2fa"
  ): Promise<boolean> {
    const formattedPhone = TermiiClient.formatNigerianPhone(phone);
    const candidateHash = crypto.createHash("sha256").update(otpCode.trim()).digest("hex");

    const otpRecord = await OtpModel.findOne({
      identifier: formattedPhone,
      purpose,
    });

    if (!otpRecord) {
      throw new Error("No active verification code found for this phone number. Please request a new code.");
    }

    if (otpRecord.expiresAt <= new Date()) {
      await OtpModel.deleteOne({ _id: otpRecord._id });
      throw new Error(`Your verification code has expired (${this.OTP_VALIDITY_MINUTES} minutes validity). Please request a new code.`);
    }

    if (otpRecord.attempts >= this.MAX_VERIFY_ATTEMPTS) {
      await OtpModel.deleteOne({ _id: otpRecord._id });
      throw new Error("Too many failed attempts. Please request a new verification code.");
    }

    if (otpRecord.otpHash !== candidateHash) {
      otpRecord.attempts += 1;
      await otpRecord.save();
      throw new Error(`Incorrect verification code. ${this.MAX_VERIFY_ATTEMPTS - otpRecord.attempts} attempts remaining.`);
    }

    // OTP matched successfully - delete it to prevent replay attacks
    await OtpModel.deleteOne({ _id: otpRecord._id });
    return true;
  }
}
