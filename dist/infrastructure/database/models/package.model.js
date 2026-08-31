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
exports.PackageModel = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const SubFeatureSchema = new mongoose_1.Schema({
    id: { type: String, required: true },
    name: { type: String, required: true },
    shortDesc: { type: String, required: true },
    badge: { type: String, default: "Built-in" },
    iconName: { type: String, default: "CheckSquare" },
}, { _id: false });
const PackageSchema = new mongoose_1.Schema({
    packageId: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        index: true,
    },
    name: {
        type: String,
        required: true,
        trim: true,
    },
    shortName: {
        type: String,
        required: true,
        trim: true,
    },
    tagline: {
        type: String,
        required: true,
    },
    description: {
        type: String,
        required: true,
    },
    category: {
        type: String,
        required: true,
        index: true,
    },
    badge: {
        type: String,
        default: "Popular",
    },
    badgeTone: {
        type: String,
        default: "success",
    },
    isCore: {
        type: Boolean,
        default: false,
    },
    autoChecked: {
        type: Boolean,
        default: false,
    },
    priceMonthly: {
        type: Number,
        required: true,
        min: 0,
    },
    priceAnnual: {
        type: Number,
        required: true,
        min: 0,
    },
    pricingModel: {
        type: String,
        enum: ["PER_SEAT", "FLAT_MONTHLY"],
        default: "FLAT_MONTHLY",
    },
    priceFormatted: {
        type: String,
        required: true,
    },
    accentColor: {
        type: String,
        default: "#84cc16",
    },
    glowColor: {
        type: String,
        default: "rgba(132, 204, 22, 0.15)",
    },
    subFeatures: {
        type: [SubFeatureSchema],
        default: [],
    },
    keyHighlights: {
        type: [String],
        default: [],
    },
    systemCapabilities: {
        type: [String],
        default: [],
    },
    isActive: {
        type: Boolean,
        default: true,
        index: true,
    },
    sortOrder: {
        type: Number,
        default: 0,
    },
}, {
    timestamps: true,
});
exports.PackageModel = mongoose_1.default.model("Package", PackageSchema);
