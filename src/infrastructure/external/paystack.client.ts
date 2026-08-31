import crypto from "crypto";
import { env } from "../../config/env.js";

export interface InitializePaymentRequest {
  email: string;
  amountInKobo: number; // e.g. 500000 = NGN 5,000.00
  reference?: string;
  callbackUrl?: string;
  metadata?: Record<string, any>;
  channels?: string[];
}

export interface InitializePaymentResponse {
  authorization_url: string;
  access_code: string;
  reference: string;
}

export class PaystackClient {
  private static readonly BASE_URL = env.PAYSTACK_BASE_URL.replace(/\/$/, "");

  private static getHeaders() {
    return {
      Authorization: `Bearer ${env.PAYSTACK_SECRET_KEY}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    };
  }

  /**
   * Initializes standard Paystack card/bank/USSD checkout transaction
   */
  static async initializePayment(
    req: InitializePaymentRequest
  ): Promise<InitializePaymentResponse> {
    const reference = req.reference || `NGM-PAY-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;

    const payload = {
      email: req.email,
      amount: req.amountInKobo,
      reference,
      callback_url: req.callbackUrl,
      metadata: req.metadata,
      channels: req.channels || ["card", "bank", "ussd", "bank_transfer", "qr"],
    };

    const response = await fetch(`${this.BASE_URL}/transaction/initialize`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
    });

    const data: any = await response.json();

    if (!response.ok || !data.status) {
      console.error("Paystack Initialize Error:", data);
      throw new Error(data.message || "Failed to initialize Paystack payment transaction.");
    }

    return {
      authorization_url: data.data.authorization_url,
      access_code: data.data.access_code,
      reference: data.data.reference,
    };
  }

  /**
   * Verifies transaction status on Paystack directly by reference
   */
  static async verifyTransaction(reference: string): Promise<any> {
    const response = await fetch(`${this.BASE_URL}/transaction/verify/${encodeURIComponent(reference)}`, {
      method: "GET",
      headers: this.getHeaders(),
    });

    const data: any = await response.json();

    if (!response.ok || !data.status) {
      throw new Error(data.message || "Failed to verify Paystack transaction.");
    }

    return data.data;
  }

  /**
   * Cryptographically verifies Paystack Webhook signature using HMAC SHA-512
   */
  static verifyWebhookSignature(signatureHeader: string | undefined, rawBody: string | Buffer): boolean {
    if (!signatureHeader) return false;

    const hash = crypto
      .createHmac("sha512", env.PAYSTACK_SECRET_KEY)
      .update(rawBody)
      .digest("hex");

    return crypto.timingSafeEqual(
      Buffer.from(hash, "utf8"),
      Buffer.from(signatureHeader, "utf8")
    );
  }
}
