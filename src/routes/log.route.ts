import { Hono } from "hono";
import { authMiddleware, roleGuard } from "../middlewares/auth.middleware";
import { listLogsController } from "../controllers/log.controller";

export const logRoute = new Hono();

logRoute.use("*", authMiddleware, roleGuard("ADMIN"));

logRoute.get("/", listLogsController);
