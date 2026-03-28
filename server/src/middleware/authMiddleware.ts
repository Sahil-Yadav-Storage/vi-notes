/// <reference path="../types/express.d.ts" />
import type { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../services/authService.js";
import { getServiceErrorResponse } from "../services/errors.js";

export const authMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const token = authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const { userId } = verifyAccessToken(token);

    req.userId = userId;

    return next();
  } catch (err) {
    const { statusCode, message } = getServiceErrorResponse(err);
    
    // Log detailed error info for debugging
    if (err instanceof Error) {
      console.error("[Auth Middleware] JWT verification failed:", {
        error: err.message,
        name: err.name,
        token: token ? `${token.substring(0, 20)}...` : 'none'
      });
    }
    
    return res.status(statusCode).json({ error: message });
  }
};
