"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StorageService = void 0;
const s3_adapter_js_1 = require("../../infrastructure/external/s3.adapter.js");
class StorageService {
    /**
     * Request a pre-signed URL to upload KYC documents, profile avatars, or email attachments directly to AWS S3.
     */
    static async requestUploadUrl(folder, fileName, contentType) {
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
        return s3_adapter_js_1.S3StorageAdapter.generatePresignedUploadUrl(folder, fileName, contentType, 900);
    }
    /**
     * Generates a temporary pre-signed read URL for private KYC documents
     */
    static async getSecureFileUrl(fileKey) {
        return s3_adapter_js_1.S3StorageAdapter.generatePresignedReadUrl(fileKey, 3600);
    }
    /**
     * Deletes a file from AWS S3
     */
    static async removeFile(fileKey) {
        return s3_adapter_js_1.S3StorageAdapter.deleteFile(fileKey);
    }
}
exports.StorageService = StorageService;
