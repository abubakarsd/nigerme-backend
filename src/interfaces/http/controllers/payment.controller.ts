import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { PaymentService } from "../../../application/services/payment.service.js";
import { PaystackClient } from "../../../infrastructure/external/paystack.client.js";
import { TransactionModel } from "../../../infrastructure/database/models/transaction.model.js";
import { OrganizationModel } from "../../../infrastructure/database/models/organization.model.js";

export const fundWalletSchema = z.object({
  amountInNaira: z.number().min(100, "Minimum funding amount is NGN 100"),
  callbackUrl: z.string().url().optional(),
});

export class PaymentController {
  static async initializeFunding(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { amountInNaira, callbackUrl } = req.body;
      const organizationId = req.user!.organizationId!;
      const userId = req.user!.userId;
      const userEmail = req.user!.email;

      const result = await PaymentService.initializeWalletFunding({
        organizationId,
        userId,
        userEmail,
        amountInNaira,
        callbackUrl,
      });

      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  static async verifyPayment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const reference = req.query.reference as string;
      if (!reference) {
        res.status(400).json({ success: false, error: { message: "Transaction reference is required" } });
        return;
      }

      const paystackData = await PaystackClient.verifyTransaction(reference);

      if (paystackData.status === "success") {
        const transaction = await TransactionModel.findOne({ reference });
        if (transaction && transaction.status !== "success") {
          transaction.status = "success";
          transaction.paidAt = new Date(paystackData.paid_at || Date.now());
          await transaction.save();

          if (transaction.type === "wallet_funding") {
            await OrganizationModel.findByIdAndUpdate(transaction.organizationId, {
              $inc: { walletBalance: transaction.amount },
            });
          }
        }
      }

      res.status(200).json({ success: true, data: paystackData });
    } catch (error) {
      next(error);
    }
  }

  static async getTransactions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const organizationId = req.user!.organizationId;
      if (!organizationId) {
        res.status(400).json({ success: false, error: { message: "No organization associated" } });
        return;
      }

      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
      const transactions = await TransactionModel.find({ organizationId }).sort({ createdAt: -1 }).limit(limit);

      res.status(200).json({ success: true, data: transactions });
    } catch (error) {
      next(error);
    }
  }

  static async handleWebhook(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const signature = req.headers["x-paystack-signature"] as string | undefined;
      const rawBody = (req as any).rawBody || JSON.stringify(req.body);

      const isValid = PaystackClient.verifyWebhookSignature(signature, rawBody);
      if (!isValid) {
        res.status(400).json({ success: false, error: { message: "Invalid Paystack signature" } });
        return;
      }

      const result = await PaymentService.handleWebhookEvent(req.body);
      res.status(200).json({ status: "success", data: result });
    } catch (error) {
      next(error);
    }
  }
}
