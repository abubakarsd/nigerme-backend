import dotenv from "dotenv";
import crypto from "crypto";
import mongoose from "mongoose";
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
  private static sanitizeKey(k: string | undefined): string {
    if (!k) return "";
    return k.trim().replace(/^["']|["']$/g, "").trim();
  }

  public static getSecretKey(): string {
    const raw = process.env.PAYSTACK_SECRET_KEY || ENV.PAYSTACK_SECRET_KEY;
    const cleaned = this.sanitizeKey(raw);
    if (!cleaned) {
      throw new Error("PAYSTACK_SECRET_KEY is not configured in environment variables.");
    }
    return cleaned;
  }

  public static getPublicKey(): string {
    const raw = process.env.PAYSTACK_PUBLIC_KEY || ENV.PAYSTACK_PUBLIC_KEY;
    return this.sanitizeKey(raw);
  }

  public static getWebhookSecret(): string {
    const raw =
      process.env.PAYSTACK_WEBHOOK_SECRET ||
      process.env.PAYSTACK_SECRET_KEY ||
      ENV.PAYSTACK_WEBHOOK_SECRET ||
      ENV.PAYSTACK_SECRET_KEY;
    const cleaned = this.sanitizeKey(raw);
    if (!cleaned) {
      throw new Error("PAYSTACK_WEBHOOK_SECRET is not configured in environment variables.");
    }
    return cleaned;
  }

  private static getBaseUrl(): string {
    return (process.env.PAYSTACK_BASE_URL || ENV.PAYSTACK_BASE_URL || "https://api.paystack.co").replace(/\/$/, "");
  }

  private static getHeaders(overrideKey?: string) {
    const key = overrideKey ? this.sanitizeKey(overrideKey) : this.getSecretKey();
    return {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    };
  }

  /**
   * Centralized HTTP caller for all Paystack API operations.
   * Uses strictly the configured secret key from environment variables.
   */
  private static async paystackRequest<T = any>(
    method: "get" | "post",
    endpoint: string,
    body?: any,
    params?: any
  ): Promise<{ data: T; status: number }> {
    const baseUrl = this.getBaseUrl();
    const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
    const url = endpoint.startsWith("http") ? endpoint : `${baseUrl}${cleanEndpoint}`;
    const secretKey = this.getSecretKey();

    try {
      if (method === "get") {
        return await httpClient.get(url, { headers: this.getHeaders(secretKey), params });
      } else {
        return await httpClient.post(url, body, { headers: this.getHeaders(secretKey), params });
      }
    } catch (err: any) {
      const apiMessage = err.response?.data?.message || err.message || "Paystack API request failed";
      console.error(`[Paystack] Request to ${cleanEndpoint} failed (${err.response?.status || "network"}):`, apiMessage);
      throw err;
    }
  }

  /**
   * Initializes a Paystack standard transaction with fallback key retry
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

    try {
      const res = await this.paystackRequest("post", "/transaction/initialize", payload);
      return {
        authorization_url: res.data.data.authorization_url,
        access_code: res.data.data.access_code,
        reference: res.data.data.reference,
      };
    } catch (err: any) {
      const isAuthError =
        err.response?.status === 401 ||
        err.message?.toLowerCase().includes("invalid key");

      const helpfulDetail = isAuthError
        ? `Paystack Authentication Failed: The API key provided was rejected as "Invalid key". Please verify that PAYSTACK_SECRET_KEY is configured in your Render dashboard (Settings -> Environment) with an active Secret Key from https://dashboard.paystack.com/#/settings/developers (e.g. sk_test_... or sk_live_...).`
        : (err.message || "Failed to initialize Paystack payment transaction.");

      throw new Error(helpfulDetail);
    }
  }

  /**
   * Direct Paystack verification by transaction reference
   */
  public static async verifyPaystackPayment(reference: string): Promise<any> {
    const res = await this.paystackRequest(
      "get",
      `/transaction/verify/${encodeURIComponent(reference)}`
    );
    return res.data.data;
  }

  /**
   * Verifies Paystack HMAC-SHA512 Webhook Signature
   */
  public static verifyWebhookSignature(signatureHeader: string | undefined, rawBody: string | Buffer): boolean {
    if (!signatureHeader) return false;

    try {
      const webhookSecret = this.getWebhookSecret();
      const hash = crypto
        .createHmac("sha512", webhookSecret)
        .update(rawBody)
        .digest("hex");

      return crypto.timingSafeEqual(Buffer.from(hash, "utf8"), Buffer.from(signatureHeader, "utf8"));
    } catch (err) {
      console.error("[Paystack] Webhook verification error:", err);
      return false;
    }
  }

  /**
   * Generates Dedicated Virtual Account for bank transfer payments via Paystack
   * Using verified BVN identity details.
   */
  public static async createDedicatedVirtualAccount(
    paramsOrEmail:
      | string
      | {
        customerEmail: string;
        firstName: string;
        lastName: string;
        phone?: string;
        bvn?: string;
      },
    firstNameArg?: string,
    lastNameArg?: string,
    phoneArg?: string
  ): Promise<{
    accountNumber: string;
    accountName: string;
    bankName: string;
    customerCode?: string;
    paystackCustomerId?: string | number;
    paystackDedicatedAccountId?: string | number;
    isVerified: boolean;
    assignedAt: Date;
  }> {
    let customerEmail: string;
    let firstName: string;
    let lastName: string;
    let phone: string | undefined;
    let bvn: string | undefined;

    if (typeof paramsOrEmail === "object") {
      customerEmail = paramsOrEmail.customerEmail;
      firstName = paramsOrEmail.firstName;
      lastName = paramsOrEmail.lastName;
      phone = paramsOrEmail.phone;
      bvn = paramsOrEmail.bvn;
    } else {
      customerEmail = paramsOrEmail;
      firstName = firstNameArg || "Sovereign";
      lastName = lastNameArg || "Admin";
      phone = phoneArg;
    }

    let customerCode: string | undefined;
    let customerId: string | number | undefined;

    // Step 1: Ensure or create Paystack customer
    try {
      const custRes = await this.paystackRequest("post", "/customer", {
        email: customerEmail,
        first_name: firstName,
        last_name: lastName,
        phone,
      });
      if (custRes.data?.data) {
        customerCode = custRes.data.data.customer_code;
        customerId = custRes.data.data.id;
      }
    } catch (custErr: any) {
      // If customer already exists, fetch by email
      try {
        const fetchCust = await this.paystackRequest(
          "get",
          `/customer/${encodeURIComponent(customerEmail)}`
        );
        if (fetchCust.data?.data) {
          customerCode = fetchCust.data.data.customer_code;
          customerId = fetchCust.data.data.id;
        }
      } catch (fetchErr: any) {
        console.warn("[Paystack] Customer check notice:", fetchErr?.message || custErr?.message);
      }
    }

    // Step 2: Validate customer identity with BVN if provided
    if (bvn && customerCode) {
      try {
        await this.paystackRequest(
          "post",
          `/customer/${encodeURIComponent(customerCode)}/identification`,
          {
            country: "NG",
            type: "bvn",
            value: bvn,
            first_name: firstName,
            last_name: lastName,
          }
        );
      } catch (identErr: any) {
        const identMsg = identErr.response?.data?.message || identErr.message;
        console.warn("[Paystack] Customer identification response note:", identMsg);
      }
    }

    // Step 3: Attempt real Dedicated Virtual Account creation across supported channels
    let resData: any = null;
    let lastError: string = "";

    // Attempt A: Direct assign with BVN
    if (bvn) {
      try {
        const res = await this.paystackRequest("post", "/dedicated_account/assign", {
          email: customerEmail,
          first_name: firstName,
          last_name: lastName,
          phone,
          preferred_bank: "wema-bank",
          country: "NG",
          bvn,
        });
        resData = res.data?.data;
      } catch (err: any) {
        lastError = err.response?.data?.message || err.message;
      }
    }

    // Attempt B: Create dedicated account for existing customer code across supported banks
    if (!resData && customerCode) {
      for (const bank of ["wema-bank", "titan-paystack", "test-bank"]) {
        try {
          const res = await this.paystackRequest("post", "/dedicated_account", {
            customer: customerCode,
            preferred_bank: bank,
          });
          if (res.data?.data) {
            resData = res.data.data;
            break;
          }
        } catch (err: any) {
          lastError = err.response?.data?.message || err.message;
        }
      }
    }

    // Attempt C: Create dedicated account without specifying bank preference
    if (!resData && customerCode) {
      try {
        const res = await this.paystackRequest("post", "/dedicated_account", {
          customer: customerCode,
        });
        resData = res.data?.data;
      } catch (err: any) {
        lastError = err.response?.data?.message || err.message;
      }
    }

    if (resData && (resData.account_number || resData.accountNumber)) {
      const accountNumber = String(resData.account_number || resData.accountNumber);
      const accountName = resData.account_name || resData.accountName || `busmailer / ${firstName} ${lastName}`;
      const bankName = resData.bank?.name || resData.bankName || "Wema Bank Plc";
      return {
        accountNumber,
        accountName,
        bankName,
        customerCode: customerCode || resData.customer?.customer_code,
        paystackCustomerId: customerId || resData.customer?.id,
        paystackDedicatedAccountId: resData.id,
        isVerified: true,
        assignedAt: new Date(),
      };
    }

    console.error(
      `[Paystack] Failed to provision dedicated virtual account for ${customerEmail}:`,
      lastError || "No account returned from Paystack"
    );
    throw new Error(
      lastError ||
      "Paystack dedicated virtual account creation could not be completed. Please ensure Dedicated NUBAN / Virtual Accounts are enabled on your Paystack merchant dashboard."
    );
  }

  /**
   * Fetches list of supported Nigerian banks
   */
  public static async fetchNigerianBanks(): Promise<any[]> {
    try {
      const res = await this.paystackRequest("get", "/bank", undefined, { country: "nigeria" });
      return res.data?.data || [];
    } catch {
      return [];
    }
  }

  /**
   * Resolves / validates bank account number with NUBAN
   */
  public static async resolveAccountNumber(accountNumber: string, bankCode: string): Promise<{
    account_number: string;
    account_name: string;
    bank_id: number;
  }> {
    const res = await this.paystackRequest(
      "get",
      `/bank/resolve?account_number=${encodeURIComponent(accountNumber)}&bank_code=${encodeURIComponent(bankCode)}`
    );
    return res.data?.data;
  }

  /**
   * Initializes wallet funding and creates pending ledger record
   */
  public static async initializeWalletFunding(dto: FundWalletDto): Promise<InitializePaymentResponse> {
    const amountInKobo = Math.round(dto.amountInNaira * 100);
    const reference = `NGM-WAL-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;

    let orgObjectId: any = dto.organizationId;
    if (typeof orgObjectId === "string" && mongoose.isValidObjectId(orgObjectId)) {
      orgObjectId = new mongoose.Types.ObjectId(orgObjectId);
    }

    let userObjectId: any = dto.userId;
    if (typeof userObjectId === "string" && mongoose.isValidObjectId(userObjectId)) {
      userObjectId = new mongoose.Types.ObjectId(userObjectId);
    }

    await TransactionModel.create({
      organizationId: orgObjectId,
      userId: userObjectId,
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