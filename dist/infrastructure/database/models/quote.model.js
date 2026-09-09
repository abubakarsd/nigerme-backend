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
exports.QuoteModel = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const QuoteItemSchema = new mongoose_1.Schema({
    description: { type: String, required: true },
    quantity: { type: Number, required: true, default: 1 },
    unitPrice: { type: Number, required: true, default: 0 },
    total: { type: Number, required: true, default: 0 },
}, { _id: false });
const QuoteSchema = new mongoose_1.Schema({
    quoteNumber: {
        type: String,
        required: true,
        index: true,
    },
    organizationId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "Organization",
        required: true,
        index: true,
    },
    customerId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "Customer",
        required: true,
        index: true,
    },
    customerName: {
        type: String,
        required: true,
    },
    customerEmail: {
        type: String,
        required: true,
        lowercase: true,
    },
    items: {
        type: [QuoteItemSchema],
        default: [],
    },
    subtotal: {
        type: Number,
        required: true,
        default: 0,
    },
    taxAmount: {
        type: Number,
        required: true,
        default: 0,
    },
    discountAmount: {
        type: Number,
        required: true,
        default: 0,
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
        enum: ["DRAFT", "SENT", "ACCEPTED", "REJECTED", "CONVERTED_TO_INVOICE"],
        default: "DRAFT",
        index: true,
    },
    validUntil: {
        type: Date,
    },
    notes: {
        type: String,
    },
    convertedInvoiceId: {
        type: String,
    },
}, {
    timestamps: true,
});
QuoteSchema.index({ organizationId: 1, status: 1 });
exports.QuoteModel = mongoose_1.default.model("Quote", QuoteSchema);
