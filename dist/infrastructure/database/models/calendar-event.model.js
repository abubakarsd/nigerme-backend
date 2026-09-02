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
exports.CalendarEventModel = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const CalendarAttendeeSchema = new mongoose_1.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    userId: { type: mongoose_1.Schema.Types.ObjectId, ref: "User" },
    status: {
        type: String,
        enum: ["ACCEPTED", "DECLINED", "PENDING"],
        default: "PENDING",
    },
}, { _id: false });
const CalendarEventSchema = new mongoose_1.Schema({
    organizationId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "Organization",
        required: true,
        index: true,
    },
    organizerId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true,
    },
    organizerName: {
        type: String,
        required: true,
        trim: true,
    },
    organizerEmail: {
        type: String,
        required: true,
        lowercase: true,
        trim: true,
        index: true,
    },
    title: {
        type: String,
        required: true,
        trim: true,
    },
    description: {
        type: String,
        default: "",
    },
    start: {
        type: Date,
        required: true,
        index: true,
    },
    end: {
        type: Date,
        required: true,
    },
    allDay: {
        type: Boolean,
        default: false,
    },
    timezone: {
        type: String,
        default: "Africa/Lagos",
    },
    location: {
        type: String,
        default: "Nigerme Meet Virtual Room",
    },
    meetUrl: {
        type: String,
        default: "",
    },
    attendees: {
        type: [CalendarAttendeeSchema],
        default: [],
    },
    color: {
        type: String,
        default: "bg-[#84cc16]",
    },
    type: {
        type: String,
        enum: ["ORGANIZATION", "PERSONAL", "TEAM"],
        default: "ORGANIZATION",
        index: true,
    },
    relatedTaskId: {
        type: String,
    },
    relatedEmailId: {
        type: String,
    },
}, {
    timestamps: true,
});
// Compound index for querying events by org and date range
CalendarEventSchema.index({ organizationId: 1, start: 1 });
CalendarEventSchema.index({ "attendees.email": 1 });
exports.CalendarEventModel = mongoose_1.default.model("CalendarEvent", CalendarEventSchema);
