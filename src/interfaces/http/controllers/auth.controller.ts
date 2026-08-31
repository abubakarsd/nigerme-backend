import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { AuthService } from "../../../application/services/auth.service.js";
import { OtpService } from "../../../application/services/otp.service.js";

export const signupSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  phone: z.string().optional(),
  organizationName: z.string().optional(),
  domain: z.string().optional(),
});

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export const setInitialPasswordSchema = z.object({
  email: z.string().email("Invalid email address"),
  temporaryPassword: z.string().min(1, "Temporary password is required"),
  newPassword: z.string().min(8, "New password must be at least 8 characters"),
});

export const verifyOtpSchema = z.object({
  phone: z.string().min(10, "Phone number is required"),
  code: z.string().length(6, "Verification code must be 6 digits"),
});

export class AuthController {
  /**
   * 1. SaaS Admin Signup: Organization owner registration
   */
  static async signup(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await AuthService.signup(req.body);
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  /**
   * 2. SaaS Admin Login: Organization Owners and Workspace Administrators
   */
  static async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await AuthService.login(req.body);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  /**
   * 3. Webmail User Login: For added organization email members only
   */
  static async mailLogin(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await AuthService.mailLogin(req.body);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  /**
   * 4. Set Initial Password: First-time login password setup for added email users
   */
  static async setInitialPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await AuthService.setInitialPassword(req.body);
      res.status(200).json({ success: true, data: result, message: "Password initialized successfully." });
    } catch (error) {
      next(error);
    }
  }

  /**
   * 5. Verify 2FA OTP
   */
  static async verify2fa(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { phone, code } = req.body;
      const result = await AuthService.verify2faAndLogin(phone, code);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  /**
   * 6. Request SMS OTP via Termii
   */
  static async requestPhoneOtp(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { phone, purpose } = req.body;
      const result = await OtpService.sendPhoneOtp(phone, purpose || "phone_verification");
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  /**
   * 7. Refresh JWT Token
   */
  static async refreshToken(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { refreshToken } = req.body;
      if (!refreshToken) {
        res.status(400).json({ success: false, error: { message: "Refresh token is required." } });
        return;
      }
      const result = await AuthService.refreshSession(refreshToken);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
}
