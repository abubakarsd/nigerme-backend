import crypto from "crypto";
import { OtpModel } from "../../infrastructure/database/models/otp.model.js";
import { TermiiClient } from "../../infrastructure/external/termii.client.js";

export class OtpService {
  private static readonly OTP_VALIDITY_MINUTES = 5;
  private static readonly MAX_VERIFY_ATTEMPTS = 5;

  /**
   * Generates, stores, and dispatches a secure 6-digit SMS OTP via Termii
   */
  static async sendPhoneOtp(
    phone: string,
    purpose: "signup" | "login_2fa" | "password_reset" | "phone_verification" = "login_2fa"
  ): Promise<{ message: string; expiresInMinutes: number }> {
    const formattedPhone = TermiiClient.formatNigerianPhone(phone);

    // Rate-limiting check: Prevent more than 3 active OTP requests within 15 minutes
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
   * Verifies an OTP code against stored hash
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
      expiresAt: { $gt: new Date() },
    });

    if (!otpRecord) {
      throw new Error("Invalid or expired verification code.");
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
