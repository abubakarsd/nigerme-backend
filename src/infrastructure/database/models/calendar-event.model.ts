import mongoose, { Schema, Document } from "mongoose";

export interface ICalendarAttendee {
  name: string;
  email: string;
  userId?: mongoose.Types.ObjectId;
  status: "ACCEPTED" | "DECLINED" | "PENDING";
}

export interface ICalendarEvent extends Document {
  organizationId: mongoose.Types.ObjectId;
  organizerId: mongoose.Types.ObjectId;
  organizerName: string;
  organizerEmail: string;
  title: string;
  description?: string;
  start: Date;
  end: Date;
  allDay?: boolean;
  timezone: string;
  location?: string;
  meetUrl?: string;
  attendees: ICalendarAttendee[];
  color: string;
  type: "ORGANIZATION" | "PERSONAL" | "TEAM";
  relatedTaskId?: string;
  relatedEmailId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const CalendarAttendeeSchema = new Schema<ICalendarAttendee>(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    userId: { type: Schema.Types.ObjectId, ref: "User" },
    status: {
      type: String,
      enum: ["ACCEPTED", "DECLINED", "PENDING"],
      default: "PENDING",
    },
  },
  { _id: false }
);

const CalendarEventSchema = new Schema<ICalendarEvent>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    organizerId: {
      type: Schema.Types.ObjectId,
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
  },
  {
    timestamps: true,
  }
);

// Compound index for querying events by org and date range
CalendarEventSchema.index({ organizationId: 1, start: 1 });
CalendarEventSchema.index({ "attendees.email": 1 });

export const CalendarEventModel = mongoose.model<ICalendarEvent>(
  "CalendarEvent",
  CalendarEventSchema
);
