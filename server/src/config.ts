import dotenv from "dotenv";
import path from "path";
import { z } from "zod";

dotenv.config({
  path: path.resolve(process.cwd(), ".env"),
});

const envSchema = z.object({
  MONGODB_URI: z.string().trim().min(1, "MONGODB_URI is required"),
  JWT_SECRET: z.string().trim().min(1, "JWT_SECRET is required"),
  JWT_REFRESH_SECRET: z
    .string()
    .trim()
    .min(1, "JWT_REFRESH_SECRET is required"),
  JWT_ACCESS_EXPIRES_IN: z.string().trim().default("15m"),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(7),
  REFRESH_COOKIE_NAME: z.string().trim().min(1).default("refreshToken"),
  CLIENT_ORIGIN: z.string().trim().url().default("http://127.0.0.1:5173"),
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().positive().default(3001),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  const details = parsedEnv.error.issues
    .map((issue) => `${issue.path.join(".") || "env"}: ${issue.message}`)
    .join("; ");

  throw new Error(`Invalid environment configuration: ${details}`);
}

export const config = parsedEnv.data;

export const refreshCookieOptions = {
  httpOnly: true,
  secure: config.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/api/auth",
  maxAge: config.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
};
