import type { NextFunction, Request, Response } from "express";

export const stripKeystrokeContent = (
  req: Request,
  _res: Response,
  next: NextFunction,
) => {
  if (req.body && typeof req.body === "object" && !Array.isArray(req.body)) {
    const payload = req.body as Record<string, unknown>;
    delete payload.content;

    const keystrokes = payload.keystrokes;
    if (Array.isArray(keystrokes)) {
      for (const item of keystrokes) {
        if (item && typeof item === "object" && !Array.isArray(item)) {
          delete (item as Record<string, unknown>).content;
        }
      }
    }
  }

  next();
};
