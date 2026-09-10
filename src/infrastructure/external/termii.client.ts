import { env } from "../../config/env.js";

export interface TermiiSendSmsResponse {
  message_id?: string;
  message?: string;
  balance?: number;
  user?: string;
  status?: string;
}

export class TermiiClient {
  private static readonly BASE_URL = env.TERMII_BASE_URL.replace(/\/$/, "");

  /**
   * Formats Nigerian phone numbers to international standard 234...
   */
  static formatNigerianPhone(phone: string): string {
    const cleaned = phone.replace(/[^0-9]/g, "");
    if (cleaned.startsWith("0") && cleaned.length === 11) {
      return `234${cleaned.slice(1)}`;
    }
    if (cleaned.startsWith("234") && cleaned.length === 13) {
      return cleaned;
    }
    if (cleaned.startsWith("+234")) {
      return cleaned.slice(1);
    }
    return cleaned;
  }

  /**
   * Sends a transactional SMS or OTP via Termii API
   */
  static async sendSms(to: string, message: string): Promise<TermiiSendSmsResponse> {
    const formattedPhone = this.formatNigerianPhone(to);

    const apiKey = (process.env.TERMII_API_LIVE || env.TERMII_API_LIVE || "").trim().replace(/^["']|["']$/g, "");

    const payload = {
      to: formattedPhone,
      from: env.TERMII_SENDER_ID,
      sms: message,
      type: "plain",
      channel: "generic",
      api_key: apiKey,
    };

    try {
      const response = await fetch(`${this.BASE_URL}/sms/send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = (await response.json()) as TermiiSendSmsResponse;

      if (!response.ok) {
        console.error("Termii SMS API Error Response:", data);
        if (data.message?.toLowerCase().includes("invalid key") || response.status === 401) {
          throw new Error(
            `Termii SMS Authentication Failed (Invalid key): The configured TERMII_API_LIVE was rejected by Termii. Please verify your TERMII_API_LIVE in Render environment variables.`
          );
        }
        throw new Error(data.message || `Termii SMS sending failed with HTTP ${response.status}`);
      }

      return data;
    } catch (error: any) {
      console.error("Termii Client Network/Dispatch Exception:", error);
      throw new Error(error.message || "Failed to dispatch SMS through Termii.");
    }
  }

  /**
   * Dispatches a secure 6-digit OTP SMS
   */
  static async sendOtp(to: string, otpCode: string): Promise<TermiiSendSmsResponse> {
    const message = `Your Nigerme verification code is ${otpCode}. Valid for 5 minutes. Do not disclose this code to anyone.`;
    return this.sendSms(to, message);
  }
}
