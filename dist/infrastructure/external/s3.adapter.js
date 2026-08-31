"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.S3StorageAdapter = void 0;
const client_s3_1 = require("@aws-sdk/client-s3");
const s3_request_presigner_1 = require("@aws-sdk/s3-request-presigner");
const aws_s3_js_1 = require("../../config/aws-s3.js");
const env_js_1 = require("../../config/env.js");
const crypto_1 = __importDefault(require("crypto"));
class S3StorageAdapter {
    /**
     * Generates a pre-signed URL for direct, secure client-to-S3 file uploads.
     * Prevents proxying large binaries through the API server.
     */
    static async generatePresignedUploadUrl(folder, fileName, contentType, expiresIn = 900 // 15 minutes
    ) {
        const cleanFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
        const uniquePrefix = `${Date.now()}-${crypto_1.default.randomBytes(6).toString("hex")}`;
        const fileKey = `${env_js_1.env.AWS_S3_BASE_FOLDER}/${folder}/${uniquePrefix}-${cleanFileName}`;
        const command = new client_s3_1.PutObjectCommand({
            Bucket: env_js_1.env.AWS_S3_BUCKET,
            Key: fileKey,
            ContentType: contentType,
        });
        const uploadUrl = await (0, s3_request_presigner_1.getSignedUrl)(aws_s3_js_1.s3Client, command, { expiresIn });
        const publicUrl = env_js_1.env.AWS_S3_CUSTOM_DOMAIN
            ? `https://${env_js_1.env.AWS_S3_CUSTOM_DOMAIN}/${fileKey}`
            : `https://${env_js_1.env.AWS_S3_BUCKET}.s3.${env_js_1.env.AWS_REGION}.amazonaws.com/${fileKey}`;
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
    static async generatePresignedReadUrl(fileKey, expiresIn = 3600) {
        const command = new client_s3_1.GetObjectCommand({
            Bucket: env_js_1.env.AWS_S3_BUCKET,
            Key: fileKey,
        });
        return (0, s3_request_presigner_1.getSignedUrl)(aws_s3_js_1.s3Client, command, { expiresIn });
    }
    /**
     * Deletes an object from AWS S3
     */
    static async deleteFile(fileKey) {
        const command = new client_s3_1.DeleteObjectCommand({
            Bucket: env_js_1.env.AWS_S3_BUCKET,
            Key: fileKey,
        });
        await aws_s3_js_1.s3Client.send(command);
    }
}
exports.S3StorageAdapter = S3StorageAdapter;
