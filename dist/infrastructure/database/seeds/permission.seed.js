"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.INITIAL_PERMISSIONS = void 0;
exports.seedPermissions = seedPermissions;
const permission_model_js_1 = require("../models/permission.model.js");
exports.INITIAL_PERMISSIONS = [];
async function seedPermissions() {
    try {
        for (const perm of exports.INITIAL_PERMISSIONS) {
            await permission_model_js_1.PermissionModel.findOneAndUpdate({ key: perm.key }, { $set: perm }, { upsert: true, new: true });
        }
        console.log("✅ Seeded initial system permissions successfully.");
    }
    catch (err) {
        console.error("⚠️ Failed to seed permissions:", err);
    }
}
