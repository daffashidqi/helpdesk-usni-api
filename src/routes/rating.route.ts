import { Hono } from "hono";
import { authMiddleware, roleGuard } from "../middlewares/auth.middleware";
import { listRatingsController } from "../controllers/rating.controller";

export const ratingRoute = new Hono();

ratingRoute.use("*", authMiddleware, roleGuard("ADMIN", "IT", "AKADEMIK", "BUSP"));

ratingRoute.get("/", listRatingsController);
