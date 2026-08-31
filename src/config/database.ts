import mongoose from "mongoose";
import { env } from "./env.js";

export async function connectDatabase(): Promise<typeof mongoose> {
  try {
    mongoose.set("strictQuery", true);

    const conn = await mongoose.connect(env.MONGODB_URI, {
      maxPoolSize: env.MONGODB_MAX_POOL_SIZE,
      autoIndex: env.NODE_ENV !== "production",
      serverSelectionTimeoutMS: 5000,
    });

    console.log(`✅ MongoDB Connected successfully: ${conn.connection.host}/${conn.connection.name}`);

    // Auto-seed and migrate packages table if empty
    import("../infrastructure/database/seeds/package.seed.js")
      .then(({ seedPackages }) => seedPackages())
      .catch((err) => console.error("⚠️ Failed to auto-seed packages:", err));

    return conn;
  } catch (error) {
    console.error("❌ MongoDB Connection Error:", error);
    // Don't crash immediately in dev if mongo daemon is starting up
    if (env.NODE_ENV === "production") {
      process.exit(1);
    }
    throw error;
  }
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
  console.log("🔌 MongoDB disconnected.");
}
