import { connectDatabase, disconnectDatabase } from "../config/database.js";
import { seedPackages } from "../infrastructure/database/seeds/package.seed.js";

async function runSeed() {
  console.log("🚀 Starting database seeding...");
  try {
    await connectDatabase();
    await seedPackages(true); // Force update to sync all package definitions
    console.log("🎉 Database seeding completed successfully!");
  } catch (error) {
    console.error("❌ Seeding failed:", error);
    process.exit(1);
  } finally {
    await disconnectDatabase();
    process.exit(0);
  }
}

runSeed();
