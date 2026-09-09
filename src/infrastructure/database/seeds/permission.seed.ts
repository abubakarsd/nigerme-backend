import { PermissionModel } from "../models/permission.model.js";

export const INITIAL_PERMISSIONS: any[] = [];

export async function seedPermissions() {
  try {
    for (const perm of INITIAL_PERMISSIONS) {
      await PermissionModel.findOneAndUpdate(
        { key: perm.key },
        { $set: perm },
        { upsert: true, new: true }
      );
    }
    console.log("✅ Seeded initial system permissions successfully.");
  } catch (err) {
    console.error("⚠️ Failed to seed permissions:", err);
  }
}
