"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AwsS3Service = exports.s3Client = void 0;
const client_s3_1 = require("@aws-sdk/client-s3");
const s3_request_presigner_1 = require("@aws-sdk/s3-request-presigner");
const env_js_1 = require("../../config/env.js");
const crypto_1 = __importDefault(require("crypto"));
exports.s3Client = new client_s3_1.S3Client({
    region: env_js_1.env.AWS_REGION,
    credentials: {
        accessKeyId: env_js_1.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: env_js_1.env.AWS_SECRET_ACCESS_KEY,
    },
});
class AwsS3Service {
    /**
     * Generates a pre-signed URL for direct client-to-S3 file uploads.
     */
    static async getPresignedUploadUrl(folder, fileName, contentType, expiresIn = 900 // 15 mins
    ) {
        const allowedTypes = [
            "image/jpeg",
            "image/png",
            "image/webp",
            "application/pdf",
            "application/vnd.ms-excel",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ];
        if (!allowedTypes.includes(contentType)) {
            throw new Error(`Unsupported file type '${contentType}'. Allowed types: JPEG, PNG, WEBP, PDF, XLSX.`);
        }
        const cleanFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
        const uniquePrefix = `${Date.now()}-${crypto_1.default.randomBytes(6).toString("hex")}`;
        const fileKey = `${env_js_1.env.AWS_S3_BASE_FOLDER}/${folder}/${uniquePrefix}-${cleanFileName}`;
        const command = new client_s3_1.PutObjectCommand({
            Bucket: env_js_1.env.AWS_S3_BUCKET,
            Key: fileKey,
            ContentType: contentType,
        });
        const uploadUrl = await (0, s3_request_presigner_1.getSignedUrl)(exports.s3Client, command, { expiresIn });
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
     * Generates a temporary secure pre-signed read URL for private KYC documents
     */
    static async getSecureFileUrl(fileKey, expiresIn = 3600) {
        const command = new client_s3_1.GetObjectCommand({
            Bucket: env_js_1.env.AWS_S3_BUCKET,
            Key: fileKey,
        });
        return (0, s3_request_presigner_1.getSignedUrl)(exports.s3Client, command, { expiresIn });
    }
    /**
     * Deletes a file from AWS S3 bucket
     */
    static async deleteFile(fileKey) {
        const command = new client_s3_1.DeleteObjectCommand({
            Bucket: env_js_1.env.AWS_S3_BUCKET,
            Key: fileKey,
        });
        await exports.s3Client.send(command);
    }
}
exports.AwsS3Service = AwsS3Service;
