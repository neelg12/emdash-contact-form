import type { PluginContext } from "emdash";
import type { ContactFormSubmission } from "../types.js";

/**
 * REST endpoint: `/_emdash/api/plugins/contact-form/submission?id=<id>`
 *
 * - `GET`    fetch one submission (404 if missing or soft-deleted)
 * - `POST`   update status. Body: `{ status: "new" | "read" | "archived" | "deleted" }`
 * - `DELETE` soft-delete (sets status to "deleted")
 *
 * All returns are plain objects (never `Response`). EmDash's plugin route
 * wrapper drops Response bodies, so we let it auto-serialize plain returns
 * into the `{"data": ...}` envelope it sends to clients. Errors follow the
 * `{ ok: false, error: "<machine_code>", message?: "<human_readable>" }`
 * shape used across the plugin.
 */
export async function handleSubmission(routeCtx: any, ctx: PluginContext): Promise<unknown> {
  const request: Request = routeCtx.request;
  const url = new URL(request.url);
  const id = url.searchParams.get("id");

  if (!id) {
    return { ok: false, error: "id_required" };
  }

  const method = request.method.toUpperCase();

  if (method === "GET") {
    const data = (await (ctx.storage["submissions"] as any).get(id)) as ContactFormSubmission | null;
    if (!data || data.status === "deleted") {
      return { ok: false, error: "not_found" };
    }
    return { ok: true, id, ...data };
  }

  if (method === "POST") {
    // Update status: body = { status: "read" | "archived" | "new" | "deleted" }
    let body: { status?: string };
    try {
      body = (await request.json()) as { status?: string };
    } catch {
      return { ok: false, error: "invalid_json" };
    }

    const allowed: ContactFormSubmission["status"][] = ["new", "read", "archived", "deleted"];
    if (!body.status || !allowed.includes(body.status as ContactFormSubmission["status"])) {
      return {
        ok: false,
        error: "invalid_status",
        message: `status must be one of: ${allowed.join(", ")}`,
      };
    }

    const data = (await (ctx.storage["submissions"] as any).get(id)) as ContactFormSubmission | null;
    if (!data) {
      return { ok: false, error: "not_found" };
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
      return { ok: false, error: "not_found" };
    }

    // Soft delete.
    await (ctx.storage["submissions"] as any).put(id, {
      ...data,
      status: "deleted",
      deletedAt: new Date().toISOString(),
    });
    return { ok: true, deleted: id };
  }

  return { ok: false, error: "method_not_allowed" };
}
