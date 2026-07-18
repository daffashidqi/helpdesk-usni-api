import { Hono } from "hono";
import { authRateLimiter } from "../middlewares/rateLimit.middleware";
import { authMiddleware } from "../middlewares/auth.middleware";
import {
  forgotPasswordController,
  loginController,
  logoutController,
  meController,
  refreshController,
  registerController,
  resetPasswordController,
  verifyEmailController,
} from "../controllers/auth.controller";

export const authRoute = new Hono();

// Endpoint rawan brute force / spam -> pakai rate limiter
authRoute.post("/register", authRateLimiter, registerController);
authRoute.post("/login", authRateLimiter, loginController);
authRoute.post("/forgot-password", authRateLimiter, forgotPasswordController);

// Endpoint lain tidak butuh rate limit ketat
authRoute.get("/verify-email", verifyEmailController);
authRoute.post("/refresh", refreshController);
authRoute.post("/reset-password", resetPasswordController);
authRoute.post("/logout", authMiddleware, logoutController);
authRoute.get("/me", authMiddleware, meController);
