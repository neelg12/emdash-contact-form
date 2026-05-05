import type { PluginContext } from "emdash";
import type { ContactFormSubmission } from "../types.js";

// GET/POST/DELETE /_emdash/api/plugins/contact-form/submission?id=<id>
export async function handleSubmission(routeCtx: any, ctx: PluginContext): Promise<unknown> {
  const request: Request = routeCtx.request;
  const url = new URL(request.url);
  const id = url.searchParams.get("id");

  if (!id) {
    return new Response(JSON.stringify({ error: "id is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const method = request.method.toUpperCase();

  if (method === "GET") {
    const data = (await (ctx.storage["submissions"] as any).get(id)) as ContactFormSubmission | null;
    if (!data || data.status === "deleted") {
      return new Response(JSON.stringify({ error: "Not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }
    return { id, ...data };
  }

  if (method === "POST") {
    // Update status: body = { status: "read" | "archived" | "new" }
    let body: { status?: string };
    try {
      body = (await request.json()) as { status?: string };
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const allowed = ["new", "read", "archived", "deleted"];
    if (!body.status || !allowed.includes(body.status)) {
      return new Response(
        JSON.stringify({ error: `status must be one of: ${allowed.join(", ")}` }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const data = (await (ctx.storage["submissions"] as any).get(id)) as ContactFormSubmission | null;
    if (!data) {
      return new Response(JSON.stringify({ error: "Not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
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
      return new Response(JSON.stringify({ error: "Not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Soft delete.
    await (ctx.storage["submissions"] as any).put(id, {
      ...data,
      status: "deleted",
      deletedAt: new Date().toISOString(),
    });
    return { ok: true, deleted: id };
  }

  return new Response(JSON.stringify({ error: "Method not allowed" }), {
    status: 405,
    headers: { "Content-Type": "application/json" },
  });
}
