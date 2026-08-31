"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticate = authenticate;
exports.requireRole = requireRole;
const token_manager_js_1 = require("../../../infrastructure/security/token.manager.js");
function authenticate(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        res.status(401).json({ success: false, error: { message: "Authentication required. Bearer token missing." } });
        return;
    }
    const token = authHeader.split(" ")[1];
    try {
        const payload = token_manager_js_1.TokenManager.verifyAccessToken(token);
        req.user = payload;
        next();
    }
    catch (error) {
        res.status(401).json({ success: false, error: { message: "Invalid or expired access token." } });
    }
}
function requireRole(...roles) {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            res.status(403).json({ success: false, error: { message: "Forbidden. Insufficient permissions." } });
            return;
        }
        next();
    };
}
