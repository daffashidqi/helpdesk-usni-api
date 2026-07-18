import { Hono } from "hono";
import { authMiddleware, roleGuard } from "../middlewares/auth.middleware";
import {
  createCategoryController,
  deleteCategoryController,
  listCategoriesController,
  updateCategoryController,
} from "../controllers/category.controller";

export const categoryRoute = new Hono();

categoryRoute.use("*", authMiddleware);

// Bisa diakses semua role yang login (dropdown saat buat tiket)
categoryRoute.get("/", listCategoriesController);

categoryRoute.post("/", roleGuard("ADMIN"), createCategoryController);
categoryRoute.patch("/:id", roleGuard("ADMIN"), updateCategoryController);
categoryRoute.delete("/:id", roleGuard("ADMIN"), deleteCategoryController);
