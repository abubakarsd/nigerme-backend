"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentService = void 0;
const paystack_client_js_1 = require("../../infrastructure/external/paystack.client.js");
const transaction_model_js_1 = require("../../infrastructure/database/models/transaction.model.js");
const organization_model_js_1 = require("../../infrastructure/database/models/organization.model.js");
const crypto_1 = __importDefault(require("crypto"));
class PaymentService {
    /**
     * Initializes Paystack checkout transaction for wallet funding or subscriptions
     */
    static async initializeWalletFunding(dto) {
        const amountInKobo = Math.round(dto.amountInNaira * 100);
        const reference = `NGM-WAL-${Date.now()}-${crypto_1.default.randomBytes(4).toString("hex")}`;
        // Record pending transaction in MongoDB ledger
        await transaction_model_js_1.TransactionModel.create({
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
        return paystack_client_js_1.PaystackClient.initializePayment({
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
    static async handleWebhookEvent(event) {
        if (event.event !== "charge.success") {
            return { processed: true, message: `Ignored unhandled event ${event.event}` };
        }
        const { reference, amount, paid_at, metadata } = event.data;
        const transaction = await transaction_model_js_1.TransactionModel.findOne({ reference });
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
            await organization_model_js_1.OrganizationModel.findByIdAndUpdate(transaction.organizationId, {
                $inc: { walletBalance: amount },
            });
        }
        return { processed: true, message: "Wallet funded successfully via Paystack" };
    }
}
exports.PaymentService = PaymentService;
