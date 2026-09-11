import mongoose from "mongoose";
import { NotificationModel, INotification } from "../../infrastructure/database/models/notification.model.js";
import { RealtimeService } from "../realtime/realtime.service.js";

export interface CreateNotificationParams {
  organizationId: string | mongoose.Types.ObjectId;
  userId: string | mongoose.Types.ObjectId;
  title: string;
  message: string;
  type: "TASK" | "TICKET" | "EMAIL" | "CALENDAR" | "SECURITY" | "SYSTEM";
  link?: string;
  metadata?: any;
}

export class NotificationService {
  /**
   * Formats a notification document for GraphQL and SSE clients
   */
  static formatNotification(doc: INotification | any) {
    return {
      id: doc._id?.toString() || doc.id,
      organizationId: doc.organizationId?.toString(),
      userId: doc.userId?.toString(),
      title: doc.title,
      message: doc.message,
      type: doc.type,
      read: Boolean(doc.read),
      link: doc.link || "",
      metadata: doc.metadata || {},
      createdAt: (doc.createdAt instanceof Date ? doc.createdAt : new Date(doc.createdAt || Date.now())).toISOString(),
    };
  }

  /**
   * Creates a notification in the database and immediately pushes it in real time to the user
   */
  static async sendNotification(params: CreateNotificationParams) {
    try {
      const doc = await NotificationModel.create({
        organizationId: params.organizationId,
        userId: params.userId,
        title: params.title.trim(),
        message: params.message.trim(),
        type: params.type,
        read: false,
        link: params.link || undefined,
        metadata: params.metadata || {},
      });

      const formatted = this.formatNotification(doc);

      // Real-time live push to recipient user
      RealtimeService.emitToUser(params.userId.toString(), "notification:new", formatted);

      return formatted;
    } catch (err: any) {
      console.warn("⚠️ NotificationService.sendNotification error:", err?.message || err);
      return null;
    }
  }

  /**
   * Broadcasts a notification to all members of an organization
   */
  static async broadcastOrgNotification(
    organizationId: string | mongoose.Types.ObjectId,
    userIds: Array<string | mongoose.Types.ObjectId>,
    params: Omit<CreateNotificationParams, "organizationId" | "userId">
  ) {
    const promises = userIds.map((userId) =>
      this.sendNotification({
        organizationId,
        userId,
        ...params,
      })
    );
    return await Promise.allSettled(promises);
  }
}
