import { Hono } from "hono";
import { authMiddleware } from "../middlewares/auth.middleware";
import {
  updateProfileController,
  updateProfilePasswordController,
} from "../controllers/profile.controller";

export const profileRoute = new Hono();

profileRoute.use("*", authMiddleware);

profileRoute.patch("/", updateProfileController);
profileRoute.patch("/password", updateProfilePasswordController);
