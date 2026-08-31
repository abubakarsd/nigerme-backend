import dotenv from "dotenv";
import crypto from "crypto";
import { ENV, env } from "../../config/env.js";
import { OtpModel } from "../../infrastructure/database/models/otp.model.js";

dotenv.config();

export class SMSService {
  private static getApiKey(): string {
    return ENV.TERMII_API_LIVE || ENV.TERMII_SECRET_KEY || process.env.TERMII_API_KEY || "";
  }

  private static getBaseUrl(): string {
    let base = (ENV.TERMII_BASE_URL || "https://api.ng.termii.com/api").trim().replace(/\/$/, "");
    if (!base.endsWith("/api")) {
      base = `${base}/api`;
    }
    return base;
  }

  private static getSenderId(): string {
    return ENV.TERMII_SENDER_ID || "NIGERME";
  }

  /**
   * Core Termii SMS sender with multi-sender candidate and channel fallback
   */
  public static async sendSMS(
    phoneNumber: string,
    messageText: string,
    channel: "dnd" | "generic" = "dnd"
  ): Promise<boolean> {
    let cleanPhone = (phoneNumber || "").replace(/[^0-9]/g, "");
    if (cleanPhone.startsWith("0")) {
      cleanPhone = "234" + cleanPhone.slice(1);
    }

    const endpointUrl = `${this.getBaseUrl()}/sms/send`;
    const senderCandidates = Array.from(new Set([this.getSenderId(), "N-Alert", "Termii"])).filter(Boolean);

    for (const sender of senderCandidates) {
      for (const ch of [channel, "generic"]) {
        try {
          const payload = {
            api_key: this.getApiKey(),
            to: cleanPhone,
            from: sender,
            sms: messageText,
            type: "plain",
            channel: ch,
          };

          console.log(`[SMSService] Sending Termii SMS (${ch} channel via ${sender}) to ${cleanPhone}...`);
          const res = await fetch(endpointUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });

          const data: any = await res.json().catch(() => ({}));

          if (data && (data.message === "Successfully Sent" || data.code === "ok" || data.message_id)) {
            console.log(`[SMSService] Termii SMS sent successfully (${sender}/${ch})`);
            return true;
          }
        } catch (error: any) {
          const errMsg = error.message || "";
          if (errMsg.includes("SENDER_ID_NOT_APPROVED")) {
            console.warn(
              `[SMSService] Sender ID '${sender}' is pending approval on Termii. Falling back...`
            );
            break;
          } else {
            console.warn(`[SMSService] Termii dispatch attempt (${sender}/${ch}) failed:`, errMsg);
          }
        }
      }
    }

    console.error(`[SMSService] All Termii SMS dispatch attempts failed for ${cleanPhone}`);
    return false;
  }

  /**
   * Registration Verification OTP (FREE)
   */
  public static async sendRegistrationOTP(phoneNumber: string, code: string): Promise<boolean> {
    const msg = `Your Nigerme verification code is: ${code}. Valid for 10 minutes. Do not share this code with anyone.`;
    return this.sendSMS(phoneNumber, msg, "dnd");
  }

  /**
   * Login 2FA Verification OTP (FREE)
   */
  public static async sendLogin2FAOTP(phoneNumber: string, code: string): Promise<boolean> {
    const msg = `Your Nigerme login verification OTP is: ${code}. Valid for 5 minutes. If you did not request this, please secure your account immediately.`;
    return this.sendSMS(phoneNumber, msg, "dnd");
  }

  /**
   * Password Reset OTP (FREE)
   */
  public static async sendPasswordResetOTP(phoneNumber: string, code: string): Promise<boolean> {
    const msg = `Use ${code} to reset your Nigerme account password. Code is valid for 10 minutes.`;
    return this.sendSMS(phoneNumber, msg, "dnd");
  }

  /**
   * Unified sendOTP method with purpose support
   */
  public static async sendOTP(
    phoneNumber: string,
    otp: string,
    purpose?: "registration" | "forgotPassword" | "login2FA" | "login_2fa" | "signup" | "phone_verification" | "password_reset"
  ): Promise<boolean> {
    if (purpose === "login2FA" || purpose === "login_2fa") {
      return this.sendLogin2FAOTP(phoneNumber, otp);
    }
    if (purpose === "forgotPassword" || purpose === "password_reset") {
      return this.sendPasswordResetOTP(phoneNumber, otp);
    }
    return this.sendRegistrationOTP(phoneNumber, otp);
  }

  /**
   * Generates and dispatches a secure 6-digit SMS OTP, storing hash with TTL in database
   */
  public static async sendPhoneOtp(
    phone: string,
    purpose: "signup" | "login_2fa" | "password_reset" | "phone_verification" = "login_2fa"
  ): Promise<{ message: string; expiresInMinutes: number }> {
    let cleanPhone = (phone || "").replace(/[^0-9]/g, "");
    if (cleanPhone.startsWith("0")) {
      cleanPhone = "234" + cleanPhone.slice(1);
    }

    const rawOtp = crypto.randomInt(100000, 999999).toString();
    const otpHash = crypto.createHash("sha256").update(rawOtp).digest("hex");
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await OtpModel.deleteMany({ identifier: cleanPhone, purpose });

    await OtpModel.create({
      identifier: cleanPhone,
      otpHash,
      purpose,
      expiresAt,
      attempts: 0,
    });

    await this.sendOTP(cleanPhone, rawOtp, purpose);

    return {
      message: "Verification code sent successfully to your phone number.",
      expiresInMinutes: 5,
    };
  }

  /**
   * Verifies OTP against stored hash
   */
  public static async verifyPhoneOtp(
    phone: string,
    otpCode: string,
    purpose: "signup" | "login_2fa" | "password_reset" | "phone_verification" = "login_2fa"
  ): Promise<boolean> {
    let cleanPhone = (phone || "").replace(/[^0-9]/g, "");
    if (cleanPhone.startsWith("0")) {
      cleanPhone = "234" + cleanPhone.slice(1);
    }

    const candidateHash = crypto.createHash("sha256").update(otpCode.trim()).digest("hex");

    const otpRecord = await OtpModel.findOne({
      identifier: cleanPhone,
      purpose,
      expiresAt: { $gt: new Date() },
    });

    if (!otpRecord) {
      throw new Error("Invalid or expired verification code.");
    }

    if (otpRecord.attempts >= 5) {
      await OtpModel.deleteOne({ _id: otpRecord._id });
      throw new Error("Too many failed attempts. Please request a new verification code.");
    }

    if (otpRecord.otpHash !== candidateHash) {
      otpRecord.attempts += 1;
      await otpRecord.save();
      throw new Error(`Incorrect verification code. ${5 - otpRecord.attempts} attempts remaining.`);
    }

    await OtpModel.deleteOne({ _id: otpRecord._id });
    return true;
  }
}

export { SMSService as TermiiOtpService };
export default SMSService;
