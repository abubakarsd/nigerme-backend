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
exports.OrganizationModel = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const OrganizationSchema = new mongoose_1.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
    },
    domain: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
        index: true,
    },
    ownerId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true,
    },
    plan: {
        type: String,
        enum: ["tier1", "tier2", "tier3", "enterprise"],
        default: "tier1",
    },
    walletBalance: {
        type: Number,
        default: 0,
        min: 0,
    },
    dedicatedVirtualAccount: {
        accountNumber: String,
        accountName: String,
        bankName: String,
        assignedAt: Date,
    },
    dnsVerification: {
        spfStatus: { type: String, enum: ["not_started", "pending", "verified", "failed"], default: "not_started" },
        dkimStatus: { type: String, enum: ["not_started", "pending", "verified", "failed"], default: "not_started" },
        dmarcStatus: { type: String, enum: ["not_started", "pending", "verified", "failed"], default: "not_started" },
        mxStatus: { type: String, enum: ["not_started", "pending", "verified", "failed"], default: "not_started" },
        lastCheckedAt: Date,
    },
    resendDomainId: {
        type: String,
        index: true,
    },
    resendStatus: {
        type: String,
        default: "not_started",
    },
    resendRegion: {
        type: String,
        default: "us-east-1",
    },
    resendRecords: [
        {
            record: String,
            name: String,
            type: { type: String },
            value: String,
            ttl: String,
            status: String,
            priority: Number,
        },
    ],
    kycStatus: {
        type: String,
        enum: ["unverified", "submitted", "verified", "rejected"],
        default: "unverified",
        index: true,
    },
    trustLevel: {
        type: String,
        enum: ["Tier 1 Sovereign", "Tier 2 Sovereign", "Tier 3 Sovereign"],
        default: "Tier 1 Sovereign",
    },
    dailySendingLimit: {
        type: Number,
        default: 1000,
    },
    emailsSentToday: {
        type: Number,
        default: 0,
    },
    subscribedPackages: {
        type: [String],
        default: ["org-email"],
    },
    billingCycle: {
        type: String,
        enum: ["MONTHLY", "ANNUAL"],
        default: "MONTHLY",
    },
    autoDebitWallet: {
        type: Boolean,
        default: true,
    },
    totalSeats: {
        type: Number,
        default: 0,
    },
    usedSeats: {
        type: Number,
        default: 0,
    },
    subscriptionStatus: {
        type: String,
        enum: ["TRIAL", "ACTIVE", "PAST_DUE", "GRACE_PERIOD", "SUSPENDED", "CANCELLED"],
        default: "TRIAL",
        index: true,
    },
    trialStartsAt: {
        type: Date,
        default: Date.now,
    },
    trialEndsAt: {
        type: Date,
        default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 Days Free Trial
    },
    subscriptionStartsAt: Date,
    subscriptionExpiresAt: {
        type: Date,
        default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
    gracePeriodEndsAt: Date,
    isSuspended: {
        type: Boolean,
        default: false,
        index: true,
    },
    lastBillingReminderSentAt: Date,
    lastBillingReminderType: String,
    industry: {
        type: String,
        default: "Technology & Enterprise Systems",
    },
    phone: {
        type: String,
        default: "",
    },
    supportEmail: {
        type: String,
        default: "support@nigerme.com",
    },
    departments: {
        type: [mongoose_1.Schema.Types.Mixed],
        default: [],
    },
    roles: {
        type: [mongoose_1.Schema.Types.Mixed],
        default: [],
    },
}, {
    timestamps: true,
});
exports.OrganizationModel = mongoose_1.default.model("Organization", OrganizationSchema);
