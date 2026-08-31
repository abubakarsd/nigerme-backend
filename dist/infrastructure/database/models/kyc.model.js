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
exports.KycRecordModel = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const encryption_js_1 = require("../../security/encryption.js");
const KycRecordSchema = new mongoose_1.Schema({
    userId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true,
    },
    organizationId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "Organization",
        index: true,
    },
    idType: {
        type: String,
        enum: ["nin", "bvn", "drivers_license", "voters_card", "cac"],
        required: true,
    },
    encryptedIdNumber: {
        encryptedText: { type: String, required: true },
        iv: { type: String, required: true },
        authTag: { type: String, required: true },
    },
    maskedIdNumber: {
        type: String,
        required: true,
    },
    idDocumentS3Key: String,
    idDocumentUrl: String,
    utilityBillS3Key: String,
    utilityBillUrl: String,
    cacCertificateS3Key: String,
    cacCertificateUrl: String,
    verificationStatus: {
        type: String,
        enum: ["pending", "verified", "failed", "manual_review"],
        default: "pending",
        index: true,
    },
    provnReferenceId: {
        type: String,
        index: true,
    },
    provnPayloadSnapshot: {
        type: mongoose_1.Schema.Types.Mixed,
        select: false, // Never return raw KYC snapshot in API output
    },
    failureReason: String,
    verifiedAt: Date,
}, {
    timestamps: true,
    toJSON: {
        virtuals: true,
        transform: (_, ret) => {
            delete ret.encryptedIdNumber;
            delete ret.provnPayloadSnapshot;
            delete ret.__v;
            return ret;
        },
    },
});
KycRecordSchema.methods.getDecryptedIdNumber = function () {
    return (0, encryption_js_1.decryptData)(this.encryptedIdNumber);
};
exports.KycRecordModel = mongoose_1.default.model("KycRecord", KycRecordSchema);
