import { S3StorageAdapter, PresignedUploadResponse } from "../../infrastructure/external/s3.adapter.js";

export class StorageService {
  /**
   * Request a pre-signed URL to upload KYC documents, profile avatars, or email attachments directly to AWS S3.
   */
  static async requestUploadUrl(
    folder: "kyc-documents" | "avatars" | "attachments" | "receipts",
    fileName: string,
    contentType: string
  ): Promise<PresignedUploadResponse> {
    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "application/pdf",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ];

    if (!allowedTypes.includes(contentType)) {
      throw new Error(`File format '${contentType}' is not supported. Allowed formats: JPEG, PNG, WEBP, PDF, XLSX.`);
    }

    return S3StorageAdapter.generatePresignedUploadUrl(folder, fileName, contentType, 900);
  }

  /**
   * Generates a temporary pre-signed read URL for private KYC documents
   */
  static async getSecureFileUrl(fileKey: string): Promise<string> {
    return S3StorageAdapter.generatePresignedReadUrl(fileKey, 3600);
  }

  /**
   * Deletes a file from AWS S3
   */
  static async removeFile(fileKey: string): Promise<void> {
    return S3StorageAdapter.deleteFile(fileKey);
  }
}
