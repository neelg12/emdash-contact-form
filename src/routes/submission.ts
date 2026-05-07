import type { PluginContext } from "emdash";
import type { ContactFormSubmission } from "../types.js";

// GET/POST/DELETE /_emdash/api/plugins/contact-form/submission?id=<id>
//
// All returns are plain objects (never Response). EmDash's plugin route wrapper
// drops Response bodies, so we let it auto-serialize plain returns into the
// `{"data": ...}` envelope it sends to clients.
export async function handleSubmission(routeCtx: any, ctx: PluginContext): Promise<unknown> {
  const request: Request = routeCtx.request;
  const url = new URL(request.url);
  const id = url.searchParams.get("id");

  if (!id) {
    return { error: "id_required" };
  }

  const method = request.method.toUpperCase();

  if (method === "GET") {
    const data = (await (ctx.storage["submissions"] as any).get(id)) as ContactFormSubmission | null;
    if (!data || data.status === "deleted") {
      return { error: "not_found" };
    }
    return { id, ...data };
  }

  if (method === "POST") {
    // Update status: body = { status: "read" | "archived" | "new" }
    let body: { status?: string };
    try {
      body = (await request.json()) as { status?: string };
    } catch {
      return { error: "invalid_json" };
    }

    const allowed = ["new", "read", "archived", "deleted"];
    if (!body.status || !allowed.includes(body.status)) {
      return { error: `status_must_be_one_of: ${allowed.join(", ")}` };
    }

    const data = (await (ctx.storage["submissions"] as any).get(id)) as ContactFormSubmission | null;
    if (!data) {
      return { error: "not_found" };
    }

    const now = new Date().toISOString();
    const newStatus = body.status as ContactFormSubmission["status"];
    const updated: ContactFormSubmission = {
      ...data,
      status: newStatus,
      ...(newStatus === "read" && !data.readAt ? { readAt: now } : {}),
      ...(newStatus === "archived" ? { archivedAt: now } : {}),
      ...(newStatus === "deleted" ? { deletedAt: now } : {}),
    };

    await (ctx.storage["submissions"] as any).put(id, updated);
    return { ok: true, id, status: newStatus };
  }

  if (method === "DELETE") {
    const data = (await (ctx.storage["submissions"] as any).get(id)) as ContactFormSubmission | null;
    if (!data) {
      return { error: "not_found" };
    }

    // Soft delete.
    await (ctx.storage["submissions"] as any).put(id, {
      ...data,
      status: "deleted",
      deletedAt: new Date().toISOString(),
    });
    return { ok: true, deleted: id };
  }

  return { error: "method_not_allowed" };
}
