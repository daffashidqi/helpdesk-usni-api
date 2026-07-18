import { Hono } from "hono";
import { authMiddleware, roleGuard } from "../middlewares/auth.middleware";
import {
  createRoleController,
  deleteRoleController,
  listRolesController,
  updateRoleController,
} from "../controllers/role.controller";

export const roleRoute = new Hono();

roleRoute.use("*", authMiddleware);

// Bisa diakses semua role yang login (dropdown kelola user)
roleRoute.get("/", listRolesController);

roleRoute.post("/", roleGuard("ADMIN"), createRoleController);
roleRoute.patch("/:id", roleGuard("ADMIN"), updateRoleController);
roleRoute.delete("/:id", roleGuard("ADMIN"), deleteRoleController);
