import type { Context } from "hono";
import {
  adminUpdateTicketSchema,
  createCommentSchema,
  createRatingSchema,
  createTicketSchema,
  listTicketsQuerySchema,
  reassignDivisionSchema,
  updateStatusSchema,
} from "../validations/ticket.validation";
import {
  addComment,
  addRating,
  adminAssignTicket,
  adminUpdateTicket,
  assignTicketToMe,
  createTicket,
  deleteComment,
  deleteTicket,
  getTicketById,
  listTickets,
  reassignDivision,
  reopenTicket,
  updateTicketStatus,
} from "../services/ticket.service";
import { handleError } from "../lib/errors";

export async function createTicketController(c: Context) {
  const user = c.get("user");
  const body = await c.req.parseBody({ all: true }).catch(() => null);
  if (!body) {
    return c.json({ message: "Data tidak valid" }, 400);
  }

  const parsed = createTicketSchema.safeParse({
    title: body.title,
    description: body.description,
    categoryId: body.categoryId,
    urgency: body.urgency || undefined,
  });
  if (!parsed.success) {
    return c.json({ message: "Data tidak valid", errors: parsed.error.flatten() }, 400);
  }

  const rawAttachments = body.attachments;
  const files: File[] = Array.isArray(rawAttachments)
    ? rawAttachments.filter((f): f is File => f instanceof File)
    : rawAttachments instanceof File
      ? [rawAttachments]
      : [];

  try {
    const ticket = await createTicket(user, parsed.data, files);
    return c.json({ ticket }, 201);
  } catch (err) {
    return handleError(c, err);
  }
}

export async function listTicketsController(c: Context) {
  const user = c.get("user");
  const parsed = listTicketsQuerySchema.safeParse(c.req.query());
  if (!parsed.success) {
    return c.json({ message: "Query tidak valid", errors: parsed.error.flatten() }, 400);
  }

  try {
    const result = await listTickets(user, parsed.data);
    return c.json(result, 200);
  } catch (err) {
    return handleError(c, err);
  }
}

export async function getTicketController(c: Context) {
  const user = c.get("user");
  const id = c.req.param("id")!;
  try {
    const ticket = await getTicketById(user, id);
    return c.json({ ticket }, 200);
  } catch (err) {
    return handleError(c, err);
  }
}

export async function adminUpdateTicketController(c: Context) {
  const user = c.get("user");
  const id = c.req.param("id")!;
  const body = await c.req.json().catch(() => null);
  const parsed = adminUpdateTicketSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ message: "Data tidak valid", errors: parsed.error.flatten() }, 400);
  }

  try {
    const ticket = await adminUpdateTicket(user, id, parsed.data);
    return c.json({ ticket }, 200);
  } catch (err) {
    return handleError(c, err);
  }
}

export async function deleteTicketController(c: Context) {
  const user = c.get("user");
  const id = c.req.param("id")!;
  try {
    await deleteTicket(user, id);
    return c.json({ message: "Tiket berhasil dihapus" }, 200);
  } catch (err) {
    return handleError(c, err);
  }
}

export async function assignTicketController(c: Context) {
  const user = c.get("user");
  const id = c.req.param("id")!;

  try {
    if (user.role === "ADMIN") {
      const body = await c.req.json().catch(() => null);
      const assigneeId = body?.assigneeId;
      if (!assigneeId || typeof assigneeId !== "string") {
        return c.json({ message: "assigneeId wajib diisi" }, 400);
      }
      const ticket = await adminAssignTicket(user, id, assigneeId);
      return c.json({ ticket }, 200);
    }

    const ticket = await assignTicketToMe(user, id);
    return c.json({ ticket }, 200);
  } catch (err) {
    return handleError(c, err);
  }
}

export async function reassignDivisionController(c: Context) {
  const user = c.get("user");
  const id = c.req.param("id")!;
  const body = await c.req.json().catch(() => null);
  const parsed = reassignDivisionSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ message: "Data tidak valid", errors: parsed.error.flatten() }, 400);
  }

  try {
    const ticket = await reassignDivision(user, id, parsed.data);
    return c.json({ ticket }, 200);
  } catch (err) {
    return handleError(c, err);
  }
}

export async function updateStatusController(c: Context) {
  const user = c.get("user");
  const id = c.req.param("id")!;
  const body = await c.req.json().catch(() => null);
  const parsed = updateStatusSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ message: "Data tidak valid", errors: parsed.error.flatten() }, 400);
  }

  try {
    const ticket = await updateTicketStatus(user, id, parsed.data);
    return c.json({ ticket }, 200);
  } catch (err) {
    return handleError(c, err);
  }
}

export async function reopenTicketController(c: Context) {
  const user = c.get("user");
  const id = c.req.param("id")!;
  try {
    const ticket = await reopenTicket(user, id);
    return c.json({ ticket }, 200);
  } catch (err) {
    return handleError(c, err);
  }
}

export async function createCommentController(c: Context) {
  const user = c.get("user");
  const id = c.req.param("id")!;
  const body = await c.req.json().catch(() => null);
  const parsed = createCommentSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ message: "Data tidak valid", errors: parsed.error.flatten() }, 400);
  }

  try {
    const comment = await addComment(user, id, parsed.data);
    return c.json({ comment }, 201);
  } catch (err) {
    return handleError(c, err);
  }
}

export async function deleteCommentController(c: Context) {
  const user = c.get("user");
  const id = c.req.param("id")!;
  const commentId = c.req.param("commentId")!;
  try {
    await deleteComment(user, id, commentId);
    return c.json({ message: "Komentar berhasil dihapus" }, 200);
  } catch (err) {
    return handleError(c, err);
  }
}

export async function createRatingController(c: Context) {
  const user = c.get("user");
  const id = c.req.param("id")!;
  const body = await c.req.json().catch(() => null);
  const parsed = createRatingSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ message: "Data tidak valid", errors: parsed.error.flatten() }, 400);
  }

  try {
    const rating = await addRating(user, id, parsed.data);
    return c.json({ rating }, 201);
  } catch (err) {
    return handleError(c, err);
  }
}
