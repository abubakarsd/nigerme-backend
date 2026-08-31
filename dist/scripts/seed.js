"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const database_js_1 = require("../config/database.js");
const package_seed_js_1 = require("../infrastructure/database/seeds/package.seed.js");
async function runSeed() {
    console.log("🚀 Starting database seeding...");
    try {
        await (0, database_js_1.connectDatabase)();
        await (0, package_seed_js_1.seedPackages)(true); // Force update to sync all package definitions
        console.log("🎉 Database seeding completed successfully!");
    }
    catch (error) {
        console.error("❌ Seeding failed:", error);
        process.exit(1);
    }
    finally {
        await (0, database_js_1.disconnectDatabase)();
        process.exit(0);
    }
}
runSeed();
