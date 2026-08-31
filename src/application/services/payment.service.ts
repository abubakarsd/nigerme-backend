import { PaystackClient, InitializePaymentResponse } from "../../infrastructure/external/paystack.client.js";
import { TransactionModel } from "../../infrastructure/database/models/transaction.model.js";
import { OrganizationModel } from "../../infrastructure/database/models/organization.model.js";
import crypto from "crypto";

export interface FundWalletDto {
  organizationId: string;
  userId: string;
  userEmail: string;
  amountInNaira: number; // e.g. 10000 = 10,000 NGN
  callbackUrl?: string;
}

export class PaymentService {
  /**
   * Initializes Paystack checkout transaction for wallet funding or subscriptions
   */
  static async initializeWalletFunding(dto: FundWalletDto): Promise<InitializePaymentResponse> {
    const amountInKobo = Math.round(dto.amountInNaira * 100);
    const reference = `NGM-WAL-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;

    // Record pending transaction in MongoDB ledger
    await TransactionModel.create({
      organizationId: dto.organizationId,
      userId: dto.userId,
      reference,
      type: "wallet_funding",
      amount: amountInKobo,
      status: "pending",
      currency: "NGN",
      metadata: {
        amountInNaira: dto.amountInNaira,
      },
    });

    return PaystackClient.initializePayment({
      email: dto.userEmail,
      amountInKobo,
      reference,
      callbackUrl: dto.callbackUrl,
      metadata: {
        organizationId: dto.organizationId,
        userId: dto.userId,
        transactionType: "wallet_funding",
      },
    });
  }

  /**
   * Processes verified Paystack Webhook events (charge.success, transfer.success)
   */
  static async handleWebhookEvent(event: {
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
      return { processed: true, message: `Ignored unhandled event ${event.event}` };
    }

    const { reference, amount, paid_at, metadata } = event.data;

    const transaction = await TransactionModel.findOne({ reference });
    if (!transaction) {
      console.warn(`Webhook received for unknown transaction reference: ${reference}`);
      return { processed: false, message: "Transaction not found" };
    }

    // Idempotency check: Don't credit multiple times if webhook is replayed
    if (transaction.status === "success") {
      return { processed: true, message: "Transaction already processed successfully" };
    }

    transaction.status = "success";
    transaction.paidAt = paid_at ? new Date(paid_at) : new Date();
    await transaction.save();

    // Credit organization wallet balance in Kobo
    if (transaction.type === "wallet_funding") {
      await OrganizationModel.findByIdAndUpdate(transaction.organizationId, {
        $inc: { walletBalance: amount },
      });
    }

    return { processed: true, message: "Wallet funded successfully via Paystack" };
  }
}
