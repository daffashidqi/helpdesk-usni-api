import { Hono } from "hono";
import { cors } from "hono/cors";
import { serveStatic } from "hono/bun";
import { authRoute } from "./routes/auth.route";
import { roleRoute } from "./routes/role.route";
import { divisionRoute } from "./routes/division.route";
import { userRoute } from "./routes/user.route";
import { profileRoute } from "./routes/profile.route";
import { ticketRoute } from "./routes/ticket.route";
import { categoryRoute } from "./routes/category.route";
import { faqRoute } from "./routes/faq.route";
import { notificationRoute } from "./routes/notification.route";
import { dashboardRoute } from "./routes/dashboard.route";
import { ratingRoute } from "./routes/rating.route";
import { settingsRoute } from "./routes/settings.route";

const app = new Hono();

const frontendUrl = process.env.FRONTEND_URL ?? "http://localhost:3000";

app.use(
  "*",
  cors({
    origin: frontendUrl,
    credentials: true,
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
  })
);

app.get("/", (c) => c.json({ status: "ok", service: "helpdesk-usni-api" }));
app.get("/health", (c) => c.json({ status: "ok" }));

// File lampiran tiket (local disk untuk versi awal, gampang dipindah ke S3/MinIO nanti)
app.use(
  "/uploads/*",
  serveStatic({
    root: (process.env.UPLOAD_DIR ?? "./uploads").replace(/^\.\//, ""),
    rewriteRequestPath: (path) => path.replace(/^\/uploads/, ""),
  })
);

app.route("/auth", authRoute);
app.route("/roles", roleRoute);
app.route("/divisions", divisionRoute);
app.route("/users", userRoute);
app.route("/profile", profileRoute);
app.route("/tickets", ticketRoute);
app.route("/categories", categoryRoute);
app.route("/faq", faqRoute);
app.route("/notifications", notificationRoute);
app.route("/dashboard", dashboardRoute);
app.route("/ratings", ratingRoute);
app.route("/settings", settingsRoute);

app.notFound((c) => c.json({ message: "Endpoint tidak ditemukan" }, 404));

app.onError((err, c) => {
  console.error("[Unhandled Error]", err);
  return c.json({ message: "Terjadi kesalahan pada server" }, 500);
});

const port = Number(process.env.PORT ?? 4000);

console.log(`helpdesk-usni-api berjalan di http://localhost:${port}`);

export default {
  port,
  fetch: app.fetch,
};
