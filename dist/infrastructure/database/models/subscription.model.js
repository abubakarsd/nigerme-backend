"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubscriptionModel = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const SubscriptionSchema = new mongoose_1.Schema({
    organizationId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "Organization",
        required: true,
        index: true,
    },
    packageIds: {
        type: [String],
        required: true,
        default: ["org-email"],
    },
    billingCycle: {
        type: String,
        enum: ["MONTHLY", "ANNUAL"],
        default: "MONTHLY",
    },
    seatCount: {
        type: Number,
        required: true,
        default: 0,
        min: 0,
    },
    totalAmount: {
        type: Number,
        required: true,
        default: 0,
    },
    currency: {
        type: String,
        default: "NGN",
    },
    status: {
        type: String,
        enum: ["TRIAL", "ACTIVE", "PAST_DUE", "GRACE_PERIOD", "SUSPENDED", "CANCELLED", "EXPIRED"],
        default: "TRIAL",
        index: true,
    },
    paymentMethod: {
        type: String,
        enum: ["WALLET", "CARD", "FREE_TRIAL", "BANK_TRANSFER"],
        default: "FREE_TRIAL",
    },
    trialStartsAt: Date,
    trialEndsAt: Date,
    currentPeriodStartsAt: {
        type: Date,
        default: Date.now,
    },
    currentPeriodEndsAt: {
        type: Date,
        required: true,
    },
    gracePeriodEndsAt: Date,
    autoDebit: {
        type: Boolean,
        default: true,
    },
    cancelledAt: Date,
    cancellationReason: String,
    lastPaymentReference: String,
    metadata: mongoose_1.Schema.Types.Mixed,
}, {
    timestamps: true,
});
exports.SubscriptionModel = mongoose_1.default.model("Subscription", SubscriptionSchema);
