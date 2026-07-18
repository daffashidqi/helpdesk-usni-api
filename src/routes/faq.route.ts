import { Hono } from "hono";
import { authMiddleware, roleGuard } from "../middlewares/auth.middleware";
import {
  createFaqController,
  deleteFaqController,
  getFaqController,
  listFaqController,
  updateFaqController,
} from "../controllers/faq.controller";

export const faqRoute = new Hono();

faqRoute.use("*", authMiddleware);

faqRoute.get("/", listFaqController);
faqRoute.get("/:id", getFaqController);

faqRoute.post("/", roleGuard("ADMIN", "IT", "AKADEMIK", "BUSP"), createFaqController);
faqRoute.patch("/:id", updateFaqController);
faqRoute.delete("/:id", deleteFaqController);
