import { Request, Response, NextFunction } from "express";
import { TokenManager, TokenPayload } from "../../../infrastructure/security/token.manager.js";

declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload;
    }
  }
}

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ success: false, error: { message: "Authentication required. Bearer token missing." } });
    return;
  }

  const token = authHeader.split(" ")[1];
  try {
    const payload = TokenManager.verifyAccessToken(token);
    req.user = payload;
    next();
  } catch (error) {
    res.status(401).json({ success: false, error: { message: "Invalid or expired access token." } });
  }
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ success: false, error: { message: "Forbidden. Insufficient permissions." } });
      return;
    }
    next();
  };
}
