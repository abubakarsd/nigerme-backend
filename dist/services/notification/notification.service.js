"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationService = void 0;
const notification_model_js_1 = require("../../infrastructure/database/models/notification.model.js");
const realtime_service_js_1 = require("../realtime/realtime.service.js");
class NotificationService {
    /**
     * Formats a notification document for GraphQL and SSE clients
     */
    static formatNotification(doc) {
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
    static async sendNotification(params) {
        try {
            const doc = await notification_model_js_1.NotificationModel.create({
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
            realtime_service_js_1.RealtimeService.emitToUser(params.userId.toString(), "notification:new", formatted);
            return formatted;
        }
        catch (err) {
            console.warn("⚠️ NotificationService.sendNotification error:", err?.message || err);
            return null;
        }
    }
    /**
     * Broadcasts a notification to all members of an organization
     */
    static async broadcastOrgNotification(organizationId, userIds, params) {
        const promises = userIds.map((userId) => this.sendNotification({
            organizationId,
            userId,
            ...params,
        }));
        return await Promise.allSettled(promises);
    }
}
exports.NotificationService = NotificationService;
