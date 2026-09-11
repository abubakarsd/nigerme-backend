import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "../../config/env.js";
import crypto from "crypto";

export const s3Client = new S3Client({
  region: env.AWS_REGION,
  credentials: {
    accessKeyId: env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
  },
});

export interface PresignedUploadResponse {
  uploadUrl: string;
  fileKey: string;
  publicUrl: string;
  expiresInSeconds: number;
}

export class AwsS3Service {
  /**
   * Generates a pre-signed URL for direct client-to-S3 file uploads.
   */
  static async getPresignedUploadUrl(
    folder: "kyc-documents" | "avatars" | "attachments" | "receipts" | "branding" | string,
    fileName: string,
    contentType: string,
    expiresIn = 900, // 15 mins
    organizationId?: string
  ): Promise<PresignedUploadResponse> {
    if (folder !== "attachments") {
      const allowedTypes = [
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/svg+xml",
        "application/pdf",
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ];

      if (contentType && !allowedTypes.includes(contentType)) {
        throw new Error(`Unsupported file type '${contentType}'. Allowed types: JPEG, PNG, WEBP, SVG, PDF, XLSX.`);
      }
    }

    const cleanFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const uniquePrefix = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}`;
    
    let targetFolder = folder;
    if (folder === "branding" && organizationId) {
      targetFolder = `organizations/${organizationId}/branding`;
    }

    const fileKey = `${env.AWS_S3_BASE_FOLDER}/${targetFolder}/${uniquePrefix}-${cleanFileName}`;

    const command = new PutObjectCommand({
      Bucket: env.AWS_S3_BUCKET,
      Key: fileKey,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn });

    const publicUrl = env.AWS_S3_CUSTOM_DOMAIN
      ? `https://${env.AWS_S3_CUSTOM_DOMAIN}/${fileKey}`
      : `https://${env.AWS_S3_BUCKET}.s3.${env.AWS_REGION}.amazonaws.com/${fileKey}`;

    return {
      uploadUrl,
      fileKey,
      publicUrl,
      expiresInSeconds: expiresIn,
    };
  }

  /**
   * Safely removes a file from AWS S3 bucket by its public URL or fileKey
   */
  static async deleteFileByUrlOrKey(urlOrKey: string): Promise<void> {
    if (!urlOrKey) return;
    try {
      let fileKey = urlOrKey;
      if (urlOrKey.startsWith("http://") || urlOrKey.startsWith("https://")) {
        const parsed = new URL(urlOrKey);
        fileKey = parsed.pathname.replace(/^\/+/, "");
      }
      await this.deleteFile(fileKey);
    } catch (err: any) {
      console.warn("Could not delete S3 file:", err?.message || err);
    }
  }

  /**
   * Generates a temporary secure pre-signed read URL for private KYC documents
   */
  static async getSecureFileUrl(fileKey: string, expiresIn = 3600): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: env.AWS_S3_BUCKET,
      Key: fileKey,
    });

    return getSignedUrl(s3Client, command, { expiresIn });
  }

  /**
   * Directly uploads file buffer to AWS S3 (server-side, bypassing browser CORS restrictions)
   */
  static async uploadFileBuffer(
    folder: "kyc-documents" | "avatars" | "attachments" | "receipts" | "branding" | string,
    fileName: string,
    contentType: string,
    buffer: Buffer,
    organizationId?: string
  ): Promise<{ fileKey: string; publicUrl: string }> {
    const cleanFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const uniquePrefix = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}`;

    let targetFolder = folder;
    if (folder === "branding" && organizationId) {
      targetFolder = `organizations/${organizationId}/branding`;
    }

    const fileKey = `${env.AWS_S3_BASE_FOLDER}/${targetFolder}/${uniquePrefix}-${cleanFileName}`;

    const command = new PutObjectCommand({
      Bucket: env.AWS_S3_BUCKET,
      Key: fileKey,
      ContentType: contentType,
      Body: buffer,
    });

    await s3Client.send(command);

    const publicUrl = env.AWS_S3_CUSTOM_DOMAIN
      ? `https://${env.AWS_S3_CUSTOM_DOMAIN}/${fileKey}`
      : `https://${env.AWS_S3_BUCKET}.s3.${env.AWS_REGION}.amazonaws.com/${fileKey}`;

    return { fileKey, publicUrl };
  }

  /**
   * Deletes a file from AWS S3 bucket
   */
  static async deleteFile(fileKey: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: env.AWS_S3_BUCKET,
      Key: fileKey,
    });

    await s3Client.send(command);
  }
}
