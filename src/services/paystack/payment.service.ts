import dotenv from "dotenv";
import crypto from "crypto";
import { ENV, env } from "../../config/env.js";
import { TransactionModel, ITransaction } from "../../infrastructure/database/models/transaction.model.js";
import { OrganizationModel } from "../../infrastructure/database/models/organization.model.js";

dotenv.config();

// Native fetch-based HTTP client
const httpClient = {
  get: async (url: string, config?: { headers?: any; params?: any }) => {
    let finalUrl = url;
    if (config?.params) {
      const u = new URL(url);
      Object.entries(config.params).forEach(([k, v]) => {
        if (v !== undefined && v !== null) u.searchParams.set(k, String(v));
      });
      finalUrl = u.toString();
    }
    const res = await fetch(finalUrl, {
      method: "GET",
      headers: config?.headers || {},
    });
    const data: any = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err: any = new Error(data.message || `HTTP ${res.status}`);
      err.response = { status: res.status, data };
      throw err;
    }
    return { data, status: res.status };
  },
  post: async (url: string, body?: any, config?: { headers?: any; params?: any }) => {
    let finalUrl = url;
    if (config?.params) {
      const u = new URL(url);
      Object.entries(config.params).forEach(([k, v]) => {
        if (v !== undefined && v !== null) u.searchParams.set(k, String(v));
      });
      finalUrl = u.toString();
    }
    const res = await fetch(finalUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(config?.headers || {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const data: any = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err: any = new Error(data.message || `HTTP ${res.status}`);
      err.response = { status: res.status, data };
      throw err;
    }
    return { data, status: res.status };
  },
};

export interface FundWalletDto {
  organizationId: string;
  userId: string;
  userEmail: string;
  amountInNaira: number;
  callbackUrl?: string;
}

import { InitializePaymentResponse } from "./paystack.client.js";

export class PaymentService {
  private static getSecretKey(): string {
    return ENV.PAYSTACK_SECRET_KEY || "";
  }

  private static getBaseUrl(): string {
    return (ENV.PAYSTACK_BASE_URL || "https://api.paystack.co").replace(/\/$/, "");
  }

  private static getHeaders() {
    return {
      Authorization: `Bearer ${this.getSecretKey()}`,
      "Content-Type": "application/json",
    };
  }

  /**
   * Initializes a Paystack standard transaction
   */
  public static async initializePaystackPayment(
    email: string,
    amountInKobo: number,
    reference?: string,
    callbackUrl?: string,
    metadata?: any
  ): Promise<InitializePaymentResponse> {
    const ref = reference || `NGM-PAY-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
    const payload = {
      email,
      amount: amountInKobo,
      reference: ref,
      callback_url: callbackUrl,
      metadata,
    };

    const res = await httpClient.post(`${this.getBaseUrl()}/transaction/initialize`, payload, {
      headers: this.getHeaders(),
    });

    return {
      authorization_url: res.data.data.authorization_url,
      access_code: res.data.data.access_code,
      reference: res.data.data.reference,
    };
  }

  /**
   * Direct Paystack verification by transaction reference
   */
  public static async verifyPaystackPayment(reference: string): Promise<any> {
    const res = await httpClient.get(
      `${this.getBaseUrl()}/transaction/verify/${encodeURIComponent(reference)}`,
      { headers: this.getHeaders() }
    );
    return res.data.data;
  }

  /**
   * Verifies Paystack HMAC-SHA512 Webhook Signature
   */
  public static verifyWebhookSignature(signatureHeader: string | undefined, rawBody: string | Buffer): boolean {
    if (!signatureHeader) return false;

    const hash = crypto
      .createHmac("sha512", this.getSecretKey())
      .update(rawBody)
      .digest("hex");

    return crypto.timingSafeEqual(Buffer.from(hash, "utf8"), Buffer.from(signatureHeader, "utf8"));
  }

  /**
   * Generates Dedicated Virtual Account for bank transfer payments
   */
  public static async createDedicatedVirtualAccount(customerEmail: string, firstName: string, lastName: string, phone?: string) {
    const payload = {
      email: customerEmail,
      first_name: firstName,
      last_name: lastName,
      phone,
    };

    const res = await httpClient.post(`${this.getBaseUrl()}/dedicated_account`, payload, {
      headers: this.getHeaders(),
    });
    return res.data.data;
  }

  /**
   * Fetches list of supported Nigerian banks
   */
  public static async fetchNigerianBanks(): Promise<any[]> {
    const res = await httpClient.get(`${this.getBaseUrl()}/bank?country=nigeria`, {
      headers: this.getHeaders(),
    });
    return res.data.data || [];
  }

  /**
   * Resolves / validates bank account number with NUBAN
   */
  public static async resolveAccountNumber(accountNumber: string, bankCode: string): Promise<{
    account_number: string;
    account_name: string;
    bank_id: number;
  }> {
    const res = await httpClient.get(
      `${this.getBaseUrl()}/bank/resolve?account_number=${encodeURIComponent(accountNumber)}&bank_code=${encodeURIComponent(bankCode)}`,
      { headers: this.getHeaders() }
    );
    return res.data.data;
  }

  /**
   * Initializes wallet funding and creates pending ledger record
   */
  public static async initializeWalletFunding(dto: FundWalletDto): Promise<InitializePaymentResponse> {
    const amountInKobo = Math.round(dto.amountInNaira * 100);
    const reference = `NGM-WAL-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;

    await TransactionModel.create({
      organizationId: dto.organizationId as any,
      userId: dto.userId as any,
      reference,
      type: "wallet_funding",
      amount: amountInKobo,
      status: "pending",
      currency: "NGN",
      metadata: {
        amountInNaira: dto.amountInNaira,
      },
    });

    return this.initializePaystackPayment(
      dto.userEmail,
      amountInKobo,
      reference,
      dto.callbackUrl,
      {
        organizationId: dto.organizationId,
        userId: dto.userId,
        transactionType: "wallet_funding",
      }
    );
  }

  /**
   * Processes webhook events (charge.success) and credits wallet
   */
  public static async handleWebhookEvent(event: {
    event: string;
    data: {
      reference: string;
      status: string;
      amount: number;
      paid_at?: string;
      metadata?: any;
    };
  }): Promise<{ processed: boolean; message: string }> {
    if (event.event !== "charge.success") {
      return { processed: true, message: `Ignored event: ${event.event}` };
    }

    const { reference, amount, paid_at } = event.data;

    const transaction = await TransactionModel.findOne({ reference });
    if (!transaction) {
      return { processed: false, message: "Transaction not found" };
    }

    if (transaction.status === "success") {
      return { processed: true, message: "Transaction already processed" };
    }

    transaction.status = "success";
    transaction.paidAt = paid_at ? new Date(paid_at) : new Date();
    await transaction.save();

    if (transaction.type === "wallet_funding") {
      await OrganizationModel.findByIdAndUpdate(transaction.organizationId, {
        $inc: { walletBalance: amount },
      });
    }

    return { processed: true, message: "Wallet funded successfully" };
  }
}

export { PaymentService as PaystackService };
export default PaymentService;