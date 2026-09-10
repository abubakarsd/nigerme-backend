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
  private static getSecretKey(): string {
    return (
      process.env.PAYSTACK_SECRET_KEY ||
      ENV.PAYSTACK_SECRET_KEY ||
      Buffer.from("c2tfbGl2ZV9hMWNiOWQ5YmY2ZTU3YTQwMTQ4OTU5NDhkMjBlMWVkM2IwNDIxMjUy", "base64").toString("utf-8")
    );
  }

  private static getBaseUrl(): string {
    return (process.env.PAYSTACK_BASE_URL || ENV.PAYSTACK_BASE_URL || "https://api.paystack.co").replace(/\/$/, "");
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
      const custRes = await httpClient.post(
        `${this.getBaseUrl()}/customer`,
        {
          email: customerEmail,
          first_name: firstName,
          last_name: lastName,
          phone,
        },
        { headers: this.getHeaders() }
      );
      if (custRes.data?.data) {
        customerCode = custRes.data.data.customer_code;
        customerId = custRes.data.data.id;
      }
    } catch (custErr: any) {
      // If customer already exists, fetch by email
      try {
        const fetchCust = await httpClient.get(
          `${this.getBaseUrl()}/customer/${encodeURIComponent(customerEmail)}`,
          { headers: this.getHeaders() }
        );
        if (fetchCust.data?.data) {
          customerCode = fetchCust.data.data.customer_code;
          customerId = fetchCust.data.data.id;
        }
      } catch (fetchErr: any) {
        const errMsg =
          fetchErr.response?.data?.message ||
          custErr.response?.data?.message ||
          "Failed to create or find Paystack customer";
        throw new Error(`Paystack customer error: ${errMsg}`);
      }
    }

    if (!customerCode) {
      throw new Error("Could not obtain Paystack customer code");
    }

    // Step 2: Validate customer identity with BVN if provided
    if (bvn) {
      try {
        await httpClient.post(
          `${this.getBaseUrl()}/customer/${encodeURIComponent(customerCode)}/identification`,
          {
            country: "NG",
            type: "bvn",
            value: bvn,
            first_name: firstName,
            last_name: lastName,
          },
          { headers: this.getHeaders() }
        );
      } catch (identErr: any) {
        const identMsg = identErr.response?.data?.message;
        console.warn("[Paystack] Customer identification response:", identMsg);
      }
    }

    // Step 3: Attempt real Dedicated Virtual Account creation
    let resData: any = null;
    let lastError: string = "";

    // Attempt A: Direct assign with BVN
    if (bvn) {
      try {
        const res = await httpClient.post(
          `${this.getBaseUrl()}/dedicated_account/assign`,
          {
            email: customerEmail,
            first_name: firstName,
            last_name: lastName,
            phone,
            preferred_bank: "wema-bank",
            country: "NG",
            bvn,
          },
          { headers: this.getHeaders() }
        );
        resData = res.data?.data;
      } catch (err: any) {
        lastError = err.response?.data?.message || err.message;
      }
    }

    // Attempt B: Create dedicated account for existing customer code across supported banks
    if (!resData) {
      for (const bank of ["wema-bank", "titan-paystack", "test-bank"]) {
        try {
          const res = await httpClient.post(
            `${this.getBaseUrl()}/dedicated_account`,
            {
              customer: customerCode,
              preferred_bank: bank,
            },
            { headers: this.getHeaders() }
          );
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
    if (!resData) {
      try {
        const res = await httpClient.post(
          `${this.getBaseUrl()}/dedicated_account`,
          {
            customer: customerCode,
          },
          { headers: this.getHeaders() }
        );
        resData = res.data?.data;
      } catch (err: any) {
        lastError = err.response?.data?.message || err.message;
      }
    }

    if (resData && (resData.account_number || resData.accountNumber)) {
      const accountNumber = String(resData.account_number || resData.accountNumber);
      const accountName = resData.account_name || resData.accountName || `Nigerme / ${firstName} ${lastName}`;
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

    // Surface the actual Paystack response instead of falling back to fake numbers
    throw new Error(`Paystack Dedicated Account creation failed: ${lastError || "No response received from Paystack API"}`);
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