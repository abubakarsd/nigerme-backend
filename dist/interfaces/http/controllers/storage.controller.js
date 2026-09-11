"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StorageController = exports.presignedUploadSchema = void 0;
const zod_1 = require("zod");
const storage_service_js_1 = require("../../../application/services/storage.service.js");
const email_service_js_1 = require("../../../services/resend/email.service.js");
const email_model_js_1 = require("../../../infrastructure/database/models/email.model.js");
exports.presignedUploadSchema = zod_1.z.object({
    folder: zod_1.z.enum(["kyc-documents", "avatars", "attachments", "receipts", "branding"]),
    fileName: zod_1.z.string().min(1),
    contentType: zod_1.z.string().min(1),
});
class StorageController {
    static async getPresignedUploadUrl(req, res, next) {
        try {
            const { folder, fileName, contentType } = req.body;
            const orgId = req.user?.organizationId;
            if (folder === "branding") {
                const role = req.user?.role;
                const userType = req.user?.userType;
                const isAdmin = userType === "saas_admin" || role === "admin" || role === "owner" || role === "superadmin";
                if (!isAdmin) {
                    res.status(403).json({
                        success: false,
                        error: { message: "Forbidden: Only organization administrators can upload organization branding logos." },
                    });
                    return;
                }
            }
            const result = await storage_service_js_1.StorageService.requestUploadUrl(folder, fileName, contentType, orgId);
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
            const fetchHeaders = {
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                Accept: "*/*",
            };
            let response = await fetch(targetUrl, { headers: fetchHeaders });
            // If remote fetch returned 403/401 (e.g. expired CloudFront signature on Resend inbound attachment)
            // auto-refresh by fetching a fresh signed download URL from Resend Receiving Attachments API
            if (!response.ok && (response.status === 403 || response.status === 401)) {
                const match = targetUrl.match(/\/receiving\/([a-zA-Z0-9_-]+)\/attachments\/([a-zA-Z0-9_-]+)/);
                if (match) {
                    const [, emailId, attachmentId] = match;
                    try {
                        const fresh = await email_service_js_1.ResendEmailService.getReceivedAttachment(emailId, attachmentId);
                        const freshUrl = fresh?.data?.download_url || fresh?.download_url;
                        if (freshUrl && freshUrl !== targetUrl) {
                            response = await fetch(freshUrl, { headers: fetchHeaders });
                            // Asynchronously update matching attachment downloadUrl in database
                            email_model_js_1.EmailModel.updateOne({ "attachments.id": attachmentId }, { $set: { "attachments.$.downloadUrl": freshUrl } }).catch(() => { });
                        }
                    }
                    catch (refreshErr) {
                        console.warn(`[proxyFile] Could not auto-refresh Resend attachment:`, refreshErr?.message || refreshErr);
                    }
                }
            }
            if (!response.ok) {
                res.status(response.status).json({ success: false, error: { message: `Remote fetch failed with status ${response.status}` } });
                return;
            }
            const contentType = response.headers.get("content-type") || "application/octet-stream";
            res.setHeader("Content-Type", contentType);
            res.setHeader("Access-Control-Allow-Origin", "*");
            res.setHeader("Cache-Control", "public, max-age=3600");
            const buffer = await response.arrayBuffer();
            res.send(Buffer.from(buffer));
        }
        catch (error) {
            next(error);
        }
    }
}
exports.StorageController = StorageController;
