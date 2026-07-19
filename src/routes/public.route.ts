import { Hono } from "hono";
import { listPublicFaqController } from "../controllers/public.controller";

// Route tanpa autentikasi sama sekali — dipakai homepage sebelum user login.
export const publicRoute = new Hono();

publicRoute.get("/faq", listPublicFaqController);
