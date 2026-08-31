"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = errorHandler;
const env_js_1 = require("../../../config/env.js");
function errorHandler(err, _req, res, _next) {
    console.error("❌ Global API Exception:", err);
    const statusCode = err.statusCode || (err.name === "ValidationError" ? 400 : 500);
    const message = err.message || "An unexpected internal server error occurred.";
    res.status(statusCode).json({
        success: false,
        error: {
            message,
            statusCode,
            ...(env_js_1.env.NODE_ENV === "development" ? { stack: err.stack } : {}),
        },
    });
}
