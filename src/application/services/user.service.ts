import { UserModel, IUser } from "../../infrastructure/database/models/user.model.js";
import { TokenManager } from "../../infrastructure/security/token.manager.js";

export interface UpdateProfileDto {
  name?: string;
  phone?: string;
  avatarUrl?: string;
}

export class UserService {
  static async getProfile(userId: string): Promise<IUser | null> {
    return UserModel.findById(userId);
  }

  static async updateProfile(userId: string, dto: UpdateProfileDto): Promise<IUser | null> {
    return UserModel.findByIdAndUpdate(userId, { $set: dto }, { new: true });
  }

  static async changePassword(userId: string, currentPass: string, newPass: string): Promise<boolean> {
    const user = await UserModel.findById(userId).select("+passwordHash");
    if (!user) throw new Error("User not found");

    const isMatch = await TokenManager.comparePassword(currentPass, user.passwordHash);
    if (!isMatch) {
      throw new Error("Incorrect current password");
    }

    user.passwordHash = await TokenManager.hashPassword(newPass);
    await user.save();
    return true;
  }

  static async toggleTwoFactor(userId: string, enabled: boolean): Promise<IUser | null> {
    const user = await UserModel.findById(userId);
    if (!user) throw new Error("User not found");

    if (enabled && !user.phone) {
      throw new Error("Phone number must be registered and verified before enabling 2FA");
    }

    user.twoFactorEnabled = enabled;
    return user.save();
  }

  static async listOrganizationUsers(organizationId: string): Promise<IUser[]> {
    return UserModel.find({ organizationId }).sort({ createdAt: -1 });
  }

  static async updateUserStatus(
    userId: string,
    role?: "superadmin" | "admin" | "user" | "support",
    status?: "active" | "suspended" | "pending"
  ): Promise<IUser | null> {
    const update: any = {};
    if (role) update.role = role;
    if (status) update.status = status;

    return UserModel.findByIdAndUpdate(userId, { $set: update }, { new: true });
  }
}
