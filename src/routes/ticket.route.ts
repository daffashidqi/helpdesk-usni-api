import { Hono } from "hono";
import { authMiddleware, roleGuard } from "../middlewares/auth.middleware";
import {
  adminUpdateTicketController,
  assignTicketController,
  createCommentController,
  createRatingController,
  createTicketController,
  deleteCommentController,
  deleteTicketController,
  getTicketController,
  listTicketsController,
  reassignDivisionController,
  reopenTicketController,
  updateStatusController,
} from "../controllers/ticket.controller";

export const ticketRoute = new Hono();

ticketRoute.use("*", authMiddleware);

// Semua role bisa membuat & melihat tiket (filter kepemilikan/divisi dilakukan di service layer)
ticketRoute.post("/", createTicketController);
ticketRoute.get("/", listTicketsController);
ticketRoute.get("/:id", getTicketController);

ticketRoute.patch("/:id", roleGuard("ADMIN"), adminUpdateTicketController);
ticketRoute.delete("/:id", roleGuard("ADMIN"), deleteTicketController);

ticketRoute.patch("/:id/assign", roleGuard("IT", "AKADEMIK", "BUSP", "ADMIN"), assignTicketController);
ticketRoute.patch(
  "/:id/reassign-division",
  roleGuard("IT", "AKADEMIK", "BUSP", "ADMIN"),
  reassignDivisionController
);
// Validasi role/kepemilikan lebih rinci (agent vs pelapor) dilakukan di ticket.service.ts
// karena bergantung pada status tiket saat ini (state machine).
ticketRoute.patch("/:id/status", updateStatusController);
ticketRoute.patch("/:id/reopen", reopenTicketController);

ticketRoute.post("/:id/comments", createCommentController);
ticketRoute.delete("/:id/comments/:commentId", roleGuard("ADMIN"), deleteCommentController);
ticketRoute.post("/:id/rating", createRatingController);
