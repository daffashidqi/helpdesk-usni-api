import { Hono } from "hono";
import { authMiddleware, roleGuard } from "../middlewares/auth.middleware";
import {
  createDivisionController,
  deleteDivisionController,
  listDivisionsController,
  updateDivisionController,
} from "../controllers/division.controller";

export const divisionRoute = new Hono();

divisionRoute.use("*", authMiddleware);

// Bisa diakses semua role yang login (dropdown kategori/kelola user)
divisionRoute.get("/", listDivisionsController);

divisionRoute.post("/", roleGuard("ADMIN"), createDivisionController);
divisionRoute.patch("/:id", roleGuard("ADMIN"), updateDivisionController);
divisionRoute.delete("/:id", roleGuard("ADMIN"), deleteDivisionController);
