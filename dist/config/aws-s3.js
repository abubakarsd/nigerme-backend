"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.s3Client = void 0;
const client_s3_1 = require("@aws-sdk/client-s3");
const env_js_1 = require("./env.js");
exports.s3Client = new client_s3_1.S3Client({
    region: env_js_1.env.AWS_REGION,
    credentials: {
        accessKeyId: env_js_1.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: env_js_1.env.AWS_SECRET_ACCESS_KEY,
    },
});
