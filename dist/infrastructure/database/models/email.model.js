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
exports.EmailModel = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const EmailAttachmentSchema = new mongoose_1.Schema({
    id: { type: String, required: true },
    name: { type: String, required: true },
    sizeBytes: { type: Number, default: 0 },
    contentType: { type: String, default: "application/octet-stream" },
    downloadUrl: { type: String },
    contentId: { type: String },
}, { _id: false });
const EmailParticipantSchema = new mongoose_1.Schema({
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    avatar: { type: String },
}, { _id: false });
const EmailSchema = new mongoose_1.Schema({
    organizationId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "Organization",
        required: true,
        index: true,
    },
    userId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true,
    },
    threadId: {
        type: String,
        required: true,
        index: true,
    },
    resendId: {
        type: String,
        index: true,
    },
    folder: {
        type: String,
        enum: ["inbox", "sent", "drafts", "starred", "trash", "spam", "archive"],
        default: "inbox",
        index: true,
    },
    category: {
        type: String,
        enum: ["primary", "social", "promotions", "updates"],
        default: "primary",
        index: true,
    },
    from: {
        type: EmailParticipantSchema,
        required: true,
    },
    to: {
        type: [EmailParticipantSchema],
        required: true,
        default: [],
    },
    cc: {
        type: [EmailParticipantSchema],
        default: [],
    },
    bcc: {
        type: [EmailParticipantSchema],
        default: [],
    },
    replyTo: {
        type: String,
        trim: true,
    },
    subject: {
        type: String,
        default: "(No subject)",
        trim: true,
    },
    preview: {
        type: String,
        default: "",
    },
    bodyHtml: {
        type: String,
        default: "",
    },
    bodyText: {
        type: String,
        default: "",
    },
    attachments: {
        type: [EmailAttachmentSchema],
        default: [],
    },
    isRead: {
        type: Boolean,
        default: false,
        index: true,
    },
    isStarred: {
        type: Boolean,
        default: false,
        index: true,
    },
    isImportant: {
        type: Boolean,
        default: false,
    },
    labels: {
        type: [String],
        default: [],
    },
    status: {
        type: String,
        enum: ["QUEUED", "SENT", "DELIVERED", "BOUNCED", "RECEIVED", "QUARANTINED"],
        default: "SENT",
    },
    receivedAt: {
        type: Date,
    },
    sentAt: {
        type: Date,
    },
}, {
    timestamps: true,
});
// Compound indexes for high-speed webmail listing
EmailSchema.index({ userId: 1, folder: 1, createdAt: -1 });
EmailSchema.index({ organizationId: 1, folder: 1, createdAt: -1 });
EmailSchema.index({ "from.email": 1, createdAt: -1 });
EmailSchema.index({ "to.email": 1, createdAt: -1 });
exports.EmailModel = mongoose_1.default.model("Email", EmailSchema);
