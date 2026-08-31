import mongoose, { Schema, Document } from "mongoose";

export interface ISubFeature {
  id: string;
  name: string;
  shortDesc: string;
  badge: string;
  iconName: string;
}

export interface IPackage extends Document {
  packageId: string; // e.g. "org-email", "payroll", "inventory-pos", "logistics", "hotel-booking"
  name: string;
  shortName: string;
  tagline: string;
  description: string;
  category: "PRODUCTIVITY" | "FINANCE_HR" | "COMMERCE_POS" | "LOGISTICS" | "HOSPITALITY" | string;
  badge: string;
  badgeTone: "success" | "purple" | "blue" | "warning" | "danger" | string;
  isCore: boolean;
  autoChecked: boolean;
  priceMonthly: number; // in NGN
  priceAnnual: number; // in NGN
  pricingModel: "PER_SEAT" | "FLAT_MONTHLY";
  priceFormatted: string;
  accentColor: string;
  glowColor: string;
  subFeatures: ISubFeature[];
  keyHighlights: string[];
  systemCapabilities: string[];
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

const SubFeatureSchema = new Schema<ISubFeature>(
  {
    id: { type: String, required: true },
    name: { type: String, required: true },
    shortDesc: { type: String, required: true },
    badge: { type: String, default: "Built-in" },
    iconName: { type: String, default: "CheckSquare" },
  },
  { _id: false }
);

const PackageSchema = new Schema<IPackage>(
  {
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
  },
  {
    timestamps: true,
  }
);

export const PackageModel = mongoose.model<IPackage>("Package", PackageSchema);
