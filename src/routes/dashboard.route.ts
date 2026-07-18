import { Hono } from "hono";
import { authMiddleware, roleGuard } from "../middlewares/auth.middleware";
import {
  csatController,
  mttrController,
  slaBreachRateController,
  summaryController,
} from "../controllers/dashboard.controller";

export const dashboardRoute = new Hono();

dashboardRoute.use("*", authMiddleware, roleGuard("ADMIN", "IT", "AKADEMIK", "BUSP"));

dashboardRoute.get("/summary", summaryController);
dashboardRoute.get("/mttr", mttrController);
dashboardRoute.get("/sla-breach-rate", slaBreachRateController);
dashboardRoute.get("/csat", csatController);
