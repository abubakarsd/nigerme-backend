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
exports.WalletModel = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const WalletDedicatedAccountSchema = new mongoose_1.Schema({
    accountNumber: { type: String, required: true },
    accountName: { type: String, required: true },
    bankName: { type: String, required: true },
    assignedAt: { type: Date, default: Date.now },
    isVerified: { type: Boolean, default: true },
    bvnMasked: String,
    customerCode: String,
    paystackCustomerId: mongoose_1.Schema.Types.Mixed,
    paystackDedicatedAccountId: mongoose_1.Schema.Types.Mixed,
}, { _id: false });
const WalletSchema = new mongoose_1.Schema({
    organizationId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "Organization",
        required: true,
        unique: true,
        index: true,
    },
    ownerId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "User",
        index: true,
    },
    balance: {
        type: Number,
        default: 0,
        min: 0,
    },
    currency: {
        type: String,
        default: "NGN",
    },
    status: {
        type: String,
        enum: ["ACTIVE", "FROZEN", "PENDING"],
        default: "ACTIVE",
        index: true,
    },
    dedicatedVirtualAccount: WalletDedicatedAccountSchema,
    bvnVerified: {
        type: Boolean,
        default: false,
    },
    bvnMasked: String,
}, {
    timestamps: true,
    versionKey: false,
});
exports.WalletModel = mongoose_1.default.model("Wallet", WalletSchema);
exports.default = exports.WalletModel;
