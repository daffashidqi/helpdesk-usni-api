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

// ADMIN bisa kelola kategori semua divisi; agen (IT/AKADEMIK/BUSP) hanya
// divisi mereka sendiri (divalidasi di service layer).
categoryRoute.post("/", roleGuard("ADMIN", "IT", "AKADEMIK", "BUSP"), createCategoryController);
categoryRoute.patch("/:id", roleGuard("ADMIN", "IT", "AKADEMIK", "BUSP"), updateCategoryController);
categoryRoute.delete("/:id", roleGuard("ADMIN", "IT", "AKADEMIK", "BUSP"), deleteCategoryController);
