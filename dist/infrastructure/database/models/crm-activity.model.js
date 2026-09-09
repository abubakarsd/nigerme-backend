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
exports.CRMActivityModel = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const CRMActivitySchema = new mongoose_1.Schema({
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
    type: {
        type: String,
        enum: [
            "EMAIL_SENT",
            "EMAIL_RECEIVED",
            "TICKET_OPENED",
            "TICKET_REPLIED",
            "TICKET_RESOLVED",
            "TASK_CREATED",
            "CALENDAR_FOLLOWUP_SCHEDULED",
            "DEAL_CREATED",
            "DEAL_STAGE_CHANGED",
            "QUOTE_CREATED",
            "QUOTE_ACCEPTED",
            "INVOICE_GENERATED",
            "NOTE_ADDED",
            "CALL_LOGGED",
        ],
        required: true,
        index: true,
    },
    title: {
        type: String,
        required: true,
    },
    description: {
        type: String,
    },
    metadata: {
        type: mongoose_1.Schema.Types.Mixed,
        default: {},
    },
    actorName: {
        type: String,
        required: true,
    },
    actorEmail: {
        type: String,
        required: true,
    },
}, {
    timestamps: true,
});
CRMActivitySchema.index({ customerId: 1, createdAt: -1 });
exports.CRMActivityModel = mongoose_1.default.model("CRMActivity", CRMActivitySchema);
