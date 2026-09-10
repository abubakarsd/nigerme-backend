import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { StorageService } from "../../../application/services/storage.service.js";

export const presignedUploadSchema = z.object({
  folder: z.enum(["kyc-documents", "avatars", "attachments", "receipts"]),
  fileName: z.string().min(1),
  contentType: z.string().min(1),
});

export class StorageController {
  static async getPresignedUploadUrl(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { folder, fileName, contentType } = req.body;
      const result = await StorageService.requestUploadUrl(folder, fileName, contentType);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  static async getSecureFileUrl(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const fileKey = req.query.fileKey as string;
      if (!fileKey) {
        res.status(400).json({ success: false, error: { message: "fileKey parameter is required" } });
        return;
      }
      const url = await StorageService.getSecureFileUrl(fileKey);
      res.status(200).json({ success: true, data: { url } });
    } catch (error) {
      next(error);
    }
  }

  static async proxyFile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const targetUrl = req.query.url as string;
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
    } catch (error) {
      next(error);
    }
  }
}
