import { Hono } from "hono";
import { authMiddleware, roleGuard } from "../middlewares/auth.middleware";
import {
  bulkUploadUsersController,
  createUserController,
  deleteUserController,
  hardDeleteUserController,
  listUsersController,
  setUserPasswordController,
  updateUserController,
} from "../controllers/user.controller";

export const userRoute = new Hono();

userRoute.use("*", authMiddleware, roleGuard("ADMIN"));

userRoute.get("/", listUsersController);
userRoute.post("/", createUserController);
userRoute.post("/bulk-upload", bulkUploadUsersController);
userRoute.patch("/:id", updateUserController);
userRoute.patch("/:id/password", setUserPasswordController);
userRoute.delete("/:id/permanent", hardDeleteUserController);
userRoute.delete("/:id", deleteUserController);
