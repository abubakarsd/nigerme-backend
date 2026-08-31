"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentController = exports.fundWalletSchema = void 0;
const zod_1 = require("zod");
const payment_service_js_1 = require("../../../application/services/payment.service.js");
const paystack_client_js_1 = require("../../../infrastructure/external/paystack.client.js");
const transaction_model_js_1 = require("../../../infrastructure/database/models/transaction.model.js");
const organization_model_js_1 = require("../../../infrastructure/database/models/organization.model.js");
exports.fundWalletSchema = zod_1.z.object({
    amountInNaira: zod_1.z.number().min(100, "Minimum funding amount is NGN 100"),
    callbackUrl: zod_1.z.string().url().optional(),
});
class PaymentController {
    static async initializeFunding(req, res, next) {
        try {
            const { amountInNaira, callbackUrl } = req.body;
            const organizationId = req.user.organizationId;
            const userId = req.user.userId;
            const userEmail = req.user.email;
            const result = await payment_service_js_1.PaymentService.initializeWalletFunding({
                organizationId,
                userId,
                userEmail,
                amountInNaira,
                callbackUrl,
            });
            res.status(200).json({ success: true, data: result });
        }
        catch (error) {
            next(error);
        }
    }
    static async verifyPayment(req, res, next) {
        try {
            const reference = req.query.reference;
            if (!reference) {
                res.status(400).json({ success: false, error: { message: "Transaction reference is required" } });
                return;
            }
            const paystackData = await paystack_client_js_1.PaystackClient.verifyTransaction(reference);
            if (paystackData.status === "success") {
                const transaction = await transaction_model_js_1.TransactionModel.findOne({ reference });
                if (transaction && transaction.status !== "success") {
                    transaction.status = "success";
                    transaction.paidAt = new Date(paystackData.paid_at || Date.now());
                    await transaction.save();
                    if (transaction.type === "wallet_funding") {
                        await organization_model_js_1.OrganizationModel.findByIdAndUpdate(transaction.organizationId, {
                            $inc: { walletBalance: transaction.amount },
                        });
                    }
                }
            }
            res.status(200).json({ success: true, data: paystackData });
        }
        catch (error) {
            next(error);
        }
    }
    static async getTransactions(req, res, next) {
        try {
            const organizationId = req.user.organizationId;
            if (!organizationId) {
                res.status(400).json({ success: false, error: { message: "No organization associated" } });
                return;
            }
            const limit = req.query.limit ? parseInt(req.query.limit, 10) : 50;
            const transactions = await transaction_model_js_1.TransactionModel.find({ organizationId }).sort({ createdAt: -1 }).limit(limit);
            res.status(200).json({ success: true, data: transactions });
        }
        catch (error) {
            next(error);
        }
    }
    static async handleWebhook(req, res, next) {
        try {
            const signature = req.headers["x-paystack-signature"];
            const rawBody = req.rawBody || JSON.stringify(req.body);
            const isValid = paystack_client_js_1.PaystackClient.verifyWebhookSignature(signature, rawBody);
            if (!isValid) {
                res.status(400).json({ success: false, error: { message: "Invalid Paystack signature" } });
                return;
            }
            const result = await payment_service_js_1.PaymentService.handleWebhookEvent(req.body);
            res.status(200).json({ status: "success", data: result });
        }
        catch (error) {
            next(error);
        }
    }
}
exports.PaymentController = PaymentController;
