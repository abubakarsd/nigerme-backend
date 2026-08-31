import {
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3Client } from "../../config/aws-s3.js";
import { env } from "../../config/env.js";
import crypto from "crypto";

export interface PresignedUploadResponse {
  uploadUrl: string;
  fileKey: string;
  publicUrl: string;
  expiresInSeconds: number;
}

export class S3StorageAdapter {
  /**
   * Generates a pre-signed URL for direct, secure client-to-S3 file uploads.
   * Prevents proxying large binaries through the API server.
   */
  static async generatePresignedUploadUrl(
    folder: string,
    fileName: string,
    contentType: string,
    expiresIn = 900 // 15 minutes
  ): Promise<PresignedUploadResponse> {
    const cleanFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const uniquePrefix = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}`;
    const fileKey = `${env.AWS_S3_BASE_FOLDER}/${folder}/${uniquePrefix}-${cleanFileName}`;

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
   * Generates a temporary pre-signed read URL for private KYC documents
   */
  static async generatePresignedReadUrl(fileKey: string, expiresIn = 3600): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: env.AWS_S3_BUCKET,
      Key: fileKey,
    });

    return getSignedUrl(s3Client, command, { expiresIn });
  }

  /**
   * Deletes an object from AWS S3
   */
  static async deleteFile(fileKey: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: env.AWS_S3_BUCKET,
      Key: fileKey,
    });

    await s3Client.send(command);
  }
}
