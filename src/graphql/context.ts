import { Request } from "express";
import { TokenManager, TokenPayload } from "../infrastructure/security/token.manager.js";

export interface GraphQLContext {
  user?: TokenPayload;
  req: Request;
}

export async function buildGraphQLContext({ req }: { req: Request }): Promise<GraphQLContext> {
  const authHeader = req.headers.authorization;
  let user: TokenPayload | undefined;

  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.split(" ")[1];
    try {
      user = TokenManager.verifyAccessToken(token);
    } catch (err) {
      // Invalid/expired token - keep user undefined
    }
  }

  return {
    user,
    req,
  };
}

export function requireAuth(context: GraphQLContext): TokenPayload {
  if (!context.user) {
    throw new Error("Unauthorized. Please provide a valid Bearer JWT access token.");
  }
  return context.user;
}
