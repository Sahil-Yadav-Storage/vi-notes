import express from "express";
import {
  login,
  logout,
  refresh,
  register,
} from "../controllers/authController.js";
import {
  loginRateLimiter,
  registerRateLimiter,
} from "../middleware/rateLimit.js";

const router = express.Router();

router.post("/register", registerRateLimiter, register);
router.post("/login", loginRateLimiter, login);
router.post("/refresh", refresh);
router.post("/logout", logout);

export default router;
