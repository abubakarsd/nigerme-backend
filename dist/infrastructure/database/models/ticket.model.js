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
exports.TicketModel = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const TicketMessageSchema = new mongoose_1.Schema({
    id: { type: String, required: true },
    senderType: {
        type: String,
        enum: ["CUSTOMER", "AGENT", "SYSTEM"],
        required: true,
    },
    senderName: { type: String, required: true },
    senderEmail: { type: String, required: true },
    body: { type: String, required: true },
    isInternalNote: { type: Boolean, default: false },
    emailId: { type: String },
    createdAt: { type: Date, default: Date.now },
}, { _id: false });
const TicketSchema = new mongoose_1.Schema({
    ticketNumber: {
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
    subject: {
        type: String,
        required: true,
        trim: true,
    },
    type: {
        type: String,
        enum: ["SUPPORT", "BILLING", "SALES", "GENERAL"],
        default: "SUPPORT",
    },
    department: {
        type: String,
        default: "Customer Support",
    },
    priority: {
        type: String,
        enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
        default: "MEDIUM",
        index: true,
    },
    status: {
        type: String,
        enum: ["OPEN", "IN_PROGRESS", "PENDING", "RESOLVED", "CLOSED"],
        default: "OPEN",
        index: true,
    },
    assignedToUserId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "User",
    },
    assignedToName: {
        type: String,
    },
    emailThreadId: {
        type: String,
        index: true,
    },
    slaDeadline: {
        type: Date,
        required: true,
        index: true,
    },
    slaBreached: {
        type: Boolean,
        default: false,
    },
    messages: {
        type: [TicketMessageSchema],
        default: [],
    },
    tags: {
        type: [String],
        default: [],
    },
    resolvedAt: {
        type: Date,
    },
}, {
    timestamps: true,
});
TicketSchema.index({ organizationId: 1, status: 1 });
TicketSchema.index({ organizationId: 1, customerId: 1 });
exports.TicketModel = mongoose_1.default.model("Ticket", TicketSchema);
