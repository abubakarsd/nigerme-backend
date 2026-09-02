import jwt, { SignOptions, JwtPayload } from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { env } from "../../config/env.js";

export interface TokenPayload extends JwtPayload {
  userId: string;
  email: string;
  role: "superadmin" | "admin" | "user" | "support" | "owner" | string;
  userType: "saas_admin" | "email_user";
  organizationId?: string;
  sessionType?: "admin" | "webmail";
}

export class TokenManager {
  private static readonly SALT_ROUNDS = 12;

  /**
   * Hashes plain text password securely using bcrypt with 12 salt rounds
   */
  static async hashPassword(password: string): Promise<string> {
    const salt = await bcrypt.genSalt(this.SALT_ROUNDS);
    return bcrypt.hash(password, salt);
  }

  /**
   * Compares plaintext password against stored hash
   */
  static async comparePassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  /**
   * Signs short-lived JWT Access Token
   */
  static generateAccessToken(payload: Omit<TokenPayload, "iat" | "exp">): string {
    const options: SignOptions = {
      expiresIn: env.JWT_ACCESS_EXPIRES_IN as any,
    };
    return jwt.sign(payload, env.JWT_ACCESS_SECRET, options);
  }

  /**
   * Signs long-lived JWT Refresh Token
   */
  static generateRefreshToken(payload: Omit<TokenPayload, "iat" | "exp">): string {
    const options: SignOptions = {
      expiresIn: env.JWT_REFRESH_EXPIRES_IN as any,
    };
    return jwt.sign(payload, env.JWT_REFRESH_SECRET, options);
  }

  /**
   * Verifies JWT Access Token
   */
  static verifyAccessToken(token: string): TokenPayload {
    return jwt.verify(token, env.JWT_ACCESS_SECRET) as TokenPayload;
  }

  /**
   * Verifies JWT Refresh Token
   */
  static verifyRefreshToken(token: string): TokenPayload {
    return jwt.verify(token, env.JWT_REFRESH_SECRET) as TokenPayload;
  }
}
