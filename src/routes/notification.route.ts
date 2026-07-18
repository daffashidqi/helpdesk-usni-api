import { Hono } from "hono";
import { authMiddleware } from "../middlewares/auth.middleware";
import {
  listNotificationsController,
  markAllNotificationsReadController,
  markNotificationReadController,
} from "../controllers/notification.controller";

export const notificationRoute = new Hono();

notificationRoute.use("*", authMiddleware);

notificationRoute.get("/", listNotificationsController);
notificationRoute.patch("/read-all", markAllNotificationsReadController);
notificationRoute.patch("/:id/read", markNotificationReadController);
