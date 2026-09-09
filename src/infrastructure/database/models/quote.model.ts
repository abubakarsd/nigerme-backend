import mongoose, { Schema, Document } from "mongoose";

export interface IQuoteItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface IQuote extends Document {
  quoteNumber: string;
  organizationId: mongoose.Types.ObjectId;
  customerId: mongoose.Types.ObjectId;
  customerName: string;
  customerEmail: string;
  items: IQuoteItem[];
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
  currency: string;
  status: "DRAFT" | "SENT" | "ACCEPTED" | "REJECTED" | "CONVERTED_TO_INVOICE";
  validUntil?: Date;
  notes?: string;
  convertedInvoiceId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const QuoteItemSchema = new Schema<IQuoteItem>(
  {
    description: { type: String, required: true },
    quantity: { type: Number, required: true, default: 1 },
    unitPrice: { type: Number, required: true, default: 0 },
    total: { type: Number, required: true, default: 0 },
  },
  { _id: false }
);

const QuoteSchema = new Schema<IQuote>(
  {
    quoteNumber: {
      type: String,
      required: true,
      index: true,
    },
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    customerId: {
      type: Schema.Types.ObjectId,
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
  },
  {
    timestamps: true,
  }
);

QuoteSchema.index({ organizationId: 1, status: 1 });

export const QuoteModel = mongoose.model<IQuote>("Quote", QuoteSchema);
