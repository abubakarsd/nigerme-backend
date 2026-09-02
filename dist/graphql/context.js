"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildGraphQLContext = buildGraphQLContext;
exports.requireAuth = requireAuth;
exports.requireAdmin = requireAdmin;
const token_manager_js_1 = require("../infrastructure/security/token.manager.js");
async function buildGraphQLContext({ req }) {
    const authHeader = req.headers.authorization;
    let user;
    if (authHeader && authHeader.startsWith("Bearer ")) {
        const token = authHeader.split(" ")[1];
        try {
            user = token_manager_js_1.TokenManager.verifyAccessToken(token);
        }
        catch (err) {
            // Invalid/expired token - keep user undefined
        }
    }
    return {
        user,
        req,
    };
}
function requireAuth(context) {
    if (!context.user) {
        throw new Error("Unauthorized. Please provide a valid Bearer JWT access token.");
    }
    return context.user;
}
function requireAdmin(context) {
    const user = requireAuth(context);
    if (user.userType === "email_user" &&
        user.role !== "admin" &&
        user.role !== "owner" &&
        user.role !== "superadmin") {
        throw new Error("Forbidden: Administrator privileges required.");
    }
    return user;
}
