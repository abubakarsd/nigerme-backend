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
exports.CustomerModel = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const CustomerSchema = new mongoose_1.Schema({
    organizationId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "Organization",
        required: true,
        index: true,
    },
    name: {
        type: String,
        required: true,
        trim: true,
    },
    email: {
        type: String,
        required: true,
        lowercase: true,
        trim: true,
        index: true,
    },
    phone: {
        type: String,
        trim: true,
    },
    companyId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "Company",
    },
    companyName: {
        type: String,
        trim: true,
    },
    status: {
        type: String,
        enum: ["NEW", "ACTIVE", "INACTIVE", "CHURNED"],
        default: "NEW",
        index: true,
    },
    assignedAgentId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "User",
    },
    assignedAgentName: {
        type: String,
        trim: true,
    },
    source: {
        type: String,
        enum: ["EMAIL", "WEBSITE", "MANUAL", "REFERRAL", "IMPORT"],
        default: "EMAIL",
    },
    tags: {
        type: [String],
        default: [],
    },
    totalSpent: {
        type: Number,
        default: 0,
    },
    customFields: {
        type: mongoose_1.Schema.Types.Mixed,
        default: {},
    },
    lastInteractionAt: {
        type: Date,
        default: Date.now,
        index: true,
    },
}, {
    timestamps: true,
});
CustomerSchema.index({ organizationId: 1, email: 1 });
CustomerSchema.index({ organizationId: 1, name: "text", email: "text", companyName: "text" });
exports.CustomerModel = mongoose_1.default.model("Customer", CustomerSchema);
