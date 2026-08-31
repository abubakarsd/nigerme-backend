import { Request, Response, NextFunction } from "express";
import { env } from "../../../config/env.js";

export function errorHandler(
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  console.error("❌ Global API Exception:", err);

  const statusCode = err.statusCode || (err.name === "ValidationError" ? 400 : 500);
  const message = err.message || "An unexpected internal server error occurred.";

  res.status(statusCode).json({
    success: false,
    error: {
      message,
      statusCode,
      ...(env.NODE_ENV === "development" ? { stack: err.stack } : {}),
    },
  });
}
