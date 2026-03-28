import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import { config } from "./config.js";
import sessionRoutes from "./routes/sessionRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import documentRoutes from "./routes/documentRoutes.js";
import analyticsRoutes from "./routes/analytics.js";

const app = express();

const isAllowedDevOrigin = (origin: string) => {
  return (
    /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0):\d+$/.test(origin) ||
    /^https:\/\/[a-z0-9-]+\.devtunnels\.ms$/.test(origin)
  );
};

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || origin === config.CLIENT_ORIGIN) {
        callback(null, true);
        return;
      }

      if (config.NODE_ENV !== "production" && isAllowedDevOrigin(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  }),
);
app.use(cookieParser());
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/documents", documentRoutes);
app.use("/api/sessions", sessionRoutes);
app.use("/api/analytics", analyticsRoutes);

export default app;
