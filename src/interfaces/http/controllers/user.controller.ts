import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { UserService } from "../../../application/services/user.service.js";
import { AuditService } from "../../../application/services/audit.service.js";

export const updateProfileSchema = z.object({
  name: z.string().min(2).optional(),
  phone: z.string().optional(),
  avatarUrl: z.string().url().optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(8, "New password must be at least 8 characters"),
});

export const toggle2faSchema = z.object({
  enabled: z.boolean(),
});

export class UserController {
  static async getProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const user = await UserService.getProfile(userId);
      res.status(200).json({ success: true, data: user });
    } catch (error) {
      next(error);
    }
  }

  static async updateProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const user = await UserService.updateProfile(userId, req.body);
      res.status(200).json({ success: true, data: user });
    } catch (error) {
      next(error);
    }
  }

  static async changePassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { currentPassword, newPassword } = req.body;
      await UserService.changePassword(userId, currentPassword, newPassword);

      await AuditService.record({
        actorId: userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: "PASSWORD_CHANGED",
        targetResource: `user:${userId}`,
        organizationId: req.user!.organizationId,
        details: "User successfully updated their password",
      });

      res.status(200).json({ success: true, message: "Password updated successfully." });
    } catch (error) {
      next(error);
    }
  }

  static async toggle2fa(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { enabled } = req.body;
      const user = await UserService.toggleTwoFactor(userId, enabled);

      await AuditService.record({
        actorId: userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: enabled ? "2FA_ENABLED" : "2FA_DISABLED",
        targetResource: `user:${userId}`,
        organizationId: req.user!.organizationId,
        details: `Two-factor authentication ${enabled ? "enabled" : "disabled"}`,
      });

      res.status(200).json({ success: true, data: user });
    } catch (error) {
      next(error);
    }
  }

  static async listUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const organizationId = req.user!.organizationId;
      if (!organizationId) {
        res.status(400).json({ success: false, error: { message: "No organization associated" } });
        return;
      }
      const users = await UserService.listOrganizationUsers(organizationId);
      res.status(200).json({ success: true, data: users });
    } catch (error) {
      next(error);
    }
  }
}
