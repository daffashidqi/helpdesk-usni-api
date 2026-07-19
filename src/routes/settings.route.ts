import { Hono } from "hono";
import { authMiddleware, roleGuard } from "../middlewares/auth.middleware";
import {
  getSettingsController,
  resetLogoController,
  updateLogoController,
} from "../controllers/settings.controller";

export const settingsRoute = new Hono();

// Publik (tanpa auth) — dipakai halaman login/register untuk menampilkan logo
// sebelum user login.
settingsRoute.get("/", getSettingsController);

settingsRoute.post("/logo", authMiddleware, roleGuard("ADMIN"), updateLogoController);
settingsRoute.delete("/logo", authMiddleware, roleGuard("ADMIN"), resetLogoController);
