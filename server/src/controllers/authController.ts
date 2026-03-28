import type { Request, Response } from "express";
import { config, refreshCookieOptions } from "../config.js";
import {
  loginUser,
  registerUser,
  revokeRefreshToken,
  rotateRefreshToken,
} from "../services/authService.js";
import { getServiceErrorResponse } from "../services/errors.js";

export const register = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    await registerUser(email, password);

    return res.status(201).json({ message: "User registered successfully" });
  } catch (err) {
    const { statusCode, message } = getServiceErrorResponse(err);
    console.log("REGISTER ERROR:", err);
    return res.status(statusCode).json({ error: message });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    const { accessToken, refreshToken } = await loginUser(email, password);

    res.cookie(config.REFRESH_COOKIE_NAME, refreshToken, refreshCookieOptions);

    return res.json({ accessToken });
  } catch (err) {
    const { statusCode, message } = getServiceErrorResponse(err);
    console.log("LOGIN ERROR:", err);
    return res.status(statusCode).json({ error: message });
  }
};

export const refresh = async (req: Request, res: Response) => {
  try {
    const refreshToken = req.cookies?.[config.REFRESH_COOKIE_NAME];

    if (typeof refreshToken !== "string" || refreshToken.trim() === "") {
      return res.status(401).json({ error: "Invalid refresh token" });
    }

    const rotated = await rotateRefreshToken(refreshToken);

    res.cookie(
      config.REFRESH_COOKIE_NAME,
      rotated.refreshToken,
      refreshCookieOptions,
    );

    return res.json({ accessToken: rotated.accessToken });
  } catch (err) {
    const { statusCode, message } = getServiceErrorResponse(err);
    return res.status(statusCode).json({ error: message });
  }
};

export const logout = async (req: Request, res: Response) => {
  try {
    const refreshToken = req.cookies?.[config.REFRESH_COOKIE_NAME];

    if (typeof refreshToken === "string" && refreshToken.trim() !== "") {
      await revokeRefreshToken(refreshToken);
    }

    res.clearCookie(config.REFRESH_COOKIE_NAME, refreshCookieOptions);

    return res.json({ message: "Logged out" });
  } catch (err) {
    const { statusCode, message } = getServiceErrorResponse(err);
    return res.status(statusCode).json({ error: message });
  }
};
