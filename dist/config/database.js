"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.connectDatabase = connectDatabase;
exports.disconnectDatabase = disconnectDatabase;
const mongoose_1 = __importDefault(require("mongoose"));
const env_js_1 = require("./env.js");
async function connectDatabase() {
    try {
        mongoose_1.default.set("strictQuery", true);
        const conn = await mongoose_1.default.connect(env_js_1.env.MONGODB_URI, {
            maxPoolSize: env_js_1.env.MONGODB_MAX_POOL_SIZE,
            autoIndex: env_js_1.env.NODE_ENV !== "production",
            serverSelectionTimeoutMS: 5000,
        });
        console.log(`✅ MongoDB Connected successfully: ${conn.connection.host}/${conn.connection.name}`);
        // Auto-seed and migrate packages table if empty
        import("../infrastructure/database/seeds/package.seed.js")
            .then(({ seedPackages }) => seedPackages())
            .catch((err) => console.error("⚠️ Failed to auto-seed packages:", err));
        return conn;
    }
    catch (error) {
        console.error("❌ MongoDB Connection Error:", error);
        // Don't crash immediately in dev if mongo daemon is starting up
        if (env_js_1.env.NODE_ENV === "production") {
            process.exit(1);
        }
        throw error;
    }
}
async function disconnectDatabase() {
    await mongoose_1.default.disconnect();
    console.log("🔌 MongoDB disconnected.");
}
