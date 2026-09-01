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
exports.UserModel = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const UserSchema = new mongoose_1.Schema({
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
        index: true,
    },
    personalEmail: {
        type: String,
        lowercase: true,
        trim: true,
        index: true,
    },
    passwordHash: {
        type: String,
        required: true,
        select: false, // Never return password hash in regular queries
    },
    name: {
        type: String,
        required: true,
        trim: true,
    },
    phone: {
        type: String,
        trim: true,
        index: true,
    },
    role: {
        type: String,
        default: "user",
        index: true,
    },
    roleId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "Role",
        index: true,
    },
    department: {
        type: String,
        trim: true,
    },
    departmentId: {
        type: String,
        trim: true,
    },
    userType: {
        type: String,
        enum: ["saas_admin", "email_user"],
        default: "email_user",
        index: true,
    },
    organizationId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "Organization",
        index: true,
    },
    isEmailVerified: {
        type: Boolean,
        default: false,
    },
    isPhoneVerified: {
        type: Boolean,
        default: false,
    },
    twoFactorEnabled: {
        type: Boolean,
        default: false,
    },
    twoFactorSecret: {
        type: String,
        select: false,
    },
    mustChangePassword: {
        type: Boolean,
        default: false,
    },
    canAccessEmail: {
        type: Boolean,
        default: true,
    },
    mailboxQuotaMb: {
        type: Number,
        default: 5120, // 5GB default mailbox quota
    },
    mailboxUsedMb: {
        type: Number,
        default: 0,
    },
    avatarUrl: {
        type: String,
    },
    status: {
        type: String,
        enum: ["active", "suspended", "pending"],
        default: "active",
        index: true,
    },
    lastLoginAt: {
        type: Date,
    },
}, {
    timestamps: true,
    toJSON: {
        virtuals: true,
        transform: (_, ret) => {
            delete ret.passwordHash;
            delete ret.twoFactorSecret;
            delete ret.__v;
            return ret;
        },
    },
});
exports.UserModel = mongoose_1.default.model("User", UserSchema);
