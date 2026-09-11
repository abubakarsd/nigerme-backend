"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RealtimeController = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const env_js_1 = require("../../../config/env.js");
const realtime_service_js_1 = require("../../../services/realtime/realtime.service.js");
class RealtimeController {
    /**
     * Server-Sent Events (SSE) stream endpoint for real-time live events
     * GET /api/realtime/stream?token=<accessToken>
     */
    static handleStream(req, res) {
        // 1. Extract access token from query or Authorization header
        const token = req.query.token ||
            (req.headers.authorization?.startsWith("Bearer ")
                ? req.headers.authorization.slice(7)
                : null);
        if (!token) {
            res.status(401).json({ error: "Missing authentication token for realtime stream" });
            return;
        }
        let decoded;
        try {
            decoded = jsonwebtoken_1.default.verify(token, env_js_1.env.JWT_ACCESS_SECRET);
        }
        catch (err) {
            res.status(401).json({ error: "Invalid or expired authentication token" });
            return;
        }
        const userId = decoded.id || decoded.userId || decoded.sub;
        const orgId = decoded.organizationId || decoded.orgId || "";
        if (!userId) {
            res.status(400).json({ error: "Token payload missing user identifier" });
            return;
        }
        // 2. Configure SSE HTTP Response Headers
        res.writeHead(200, {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache, no-transform",
            Connection: "keep-alive",
            "X-Accel-Buffering": "no", // Disables NGINX buffering
            "Access-Control-Allow-Origin": "*",
        });
        // Flush headers immediately
        res.flushHeaders?.();
        const clientId = `client-${userId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        // 3. Register client in RealtimeService
        realtime_service_js_1.RealtimeService.addClient(clientId, userId.toString(), orgId ? orgId.toString() : "", res);
        // 4. Send initial connected acknowledgment
        res.write(`event: connected\ndata: ${JSON.stringify({
            clientId,
            userId,
            orgId,
            connectedAt: new Date().toISOString(),
            message: "Real-time SSE stream connected successfully.",
        })}\n\n`);
        // 5. Handle client disconnect
        req.on("close", () => {
            realtime_service_js_1.RealtimeService.removeClient(clientId);
        });
    }
    /**
     * Diagnostic statistics endpoint
     * GET /api/realtime/stats
     */
    static getStats(_req, res) {
        res.status(200).json({
            success: true,
            stats: realtime_service_js_1.RealtimeService.getStats(),
            timestamp: new Date().toISOString(),
        });
    }
}
exports.RealtimeController = RealtimeController;
