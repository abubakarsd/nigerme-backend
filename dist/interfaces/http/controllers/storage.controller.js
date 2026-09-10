"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StorageController = exports.presignedUploadSchema = void 0;
const zod_1 = require("zod");
const storage_service_js_1 = require("../../../application/services/storage.service.js");
exports.presignedUploadSchema = zod_1.z.object({
    folder: zod_1.z.enum(["kyc-documents", "avatars", "attachments", "receipts"]),
    fileName: zod_1.z.string().min(1),
    contentType: zod_1.z.string().min(1),
});
class StorageController {
    static async getPresignedUploadUrl(req, res, next) {
        try {
            const { folder, fileName, contentType } = req.body;
            const result = await storage_service_js_1.StorageService.requestUploadUrl(folder, fileName, contentType);
            res.status(200).json({ success: true, data: result });
        }
        catch (error) {
            next(error);
        }
    }
    static async getSecureFileUrl(req, res, next) {
        try {
            const fileKey = req.query.fileKey;
            if (!fileKey) {
                res.status(400).json({ success: false, error: { message: "fileKey parameter is required" } });
                return;
            }
            const url = await storage_service_js_1.StorageService.getSecureFileUrl(fileKey);
            res.status(200).json({ success: true, data: { url } });
        }
        catch (error) {
            next(error);
        }
    }
    static async proxyFile(req, res, next) {
        try {
            const targetUrl = req.query.url;
            if (!targetUrl || (!targetUrl.startsWith("http://") && !targetUrl.startsWith("https://"))) {
                res.status(400).json({ success: false, error: { message: "Valid url query parameter is required" } });
                return;
            }
            const parsedUrl = new URL(targetUrl);
            const allowedDomains = ["cdn.resend.app", "s3.resend.com", "amazonaws.com", "resend.com"];
            const isAllowed = allowedDomains.some((d) => parsedUrl.hostname.endsWith(d));
            if (!isAllowed) {
                res.status(403).json({ success: false, error: { message: "Host not allowed for proxying" } });
                return;
            }
            const response = await fetch(targetUrl);
            if (!response.ok) {
                res.status(response.status).json({ success: false, error: { message: `Remote fetch failed with status ${response.status}` } });
                return;
            }
            const contentType = response.headers.get("content-type") || "application/octet-stream";
            res.setHeader("Content-Type", contentType);
            res.setHeader("Access-Control-Allow-Origin", "*");
            const buffer = await response.arrayBuffer();
            res.send(Buffer.from(buffer));
        }
        catch (error) {
            next(error);
        }
    }
}
exports.StorageController = StorageController;
