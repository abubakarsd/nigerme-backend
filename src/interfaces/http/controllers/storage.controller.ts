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
}
