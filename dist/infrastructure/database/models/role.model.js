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
exports.RoleModel = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const RolePermissionsSchema = new mongoose_1.Schema({
    canAccessEmail: { type: Boolean, default: true },
    canAccessPayroll: { type: Boolean, default: false },
    canAccessPos: { type: Boolean, default: false },
    canAccessLogistics: { type: Boolean, default: false },
    canAccessHotel: { type: Boolean, default: false },
    canAccessAdminConsole: { type: Boolean, default: false },
    canManageBilling: { type: Boolean, default: false },
    canManageUsers: { type: Boolean, default: false },
    canManageDomains: { type: Boolean, default: false },
}, { _id: false });
const RoleSchema = new mongoose_1.Schema({
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
    slug: {
        type: String,
        trim: true,
        lowercase: true,
    },
    description: {
        type: String,
        default: "",
    },
    isSystem: {
        type: Boolean,
        default: false,
    },
    memberCount: {
        type: Number,
        default: 0,
    },
    permissions: {
        type: RolePermissionsSchema,
        required: true,
        default: () => ({
            canAccessEmail: true,
            canAccessPayroll: false,
            canAccessPos: false,
            canAccessLogistics: false,
            canAccessHotel: false,
            canAccessAdminConsole: false,
            canManageBilling: false,
            canManageUsers: false,
            canManageDomains: false,
        }),
    },
}, {
    timestamps: true,
});
RoleSchema.index({ organizationId: 1, name: 1 }, { unique: true });
exports.RoleModel = mongoose_1.default.model("Role", RoleSchema);
