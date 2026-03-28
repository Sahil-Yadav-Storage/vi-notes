import rateLimit from "express-rate-limit";
import type { Request, Response } from "express";

const jsonErrorHandler = (message: string) => {
  return {
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req: Request, res: Response) => {
      res.status(429).json({ error: message });
    },
  };
};

export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  ...jsonErrorHandler("Too many login attempts. Try again later."),
});

export const registerRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  ...jsonErrorHandler("Too many registration attempts. Try again later."),
});
