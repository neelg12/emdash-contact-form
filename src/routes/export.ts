import type { PluginContext } from "emdash";
import type { ContactFormSubmission } from "../types.js";
import { submissionsToCSV } from "../csv.js";

// GET /_emdash/api/plugins/contact-form/submissions/export
// Query params: status, formId, dateFrom (ISO), dateTo (ISO)
export async function handleExport(routeCtx: any, ctx: PluginContext): Promise<unknown> {
  if (routeCtx.request.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  const url = new URL(routeCtx.request.url);
  const statusFilter = url.searchParams.get("status") ?? undefined;
  const formIdFilter = url.searchParams.get("formId") ?? undefined;
  const dateFrom = url.searchParams.get("dateFrom") ?? undefined;
  const dateTo = url.searchParams.get("dateTo") ?? undefined;

  // Fetch all non-deleted submissions (paginate internally for large sets).
  const all: Array<{ id: string; data: ContactFormSubmission }> = [];
  let cursor: string | undefined;

  do {
    const result: any = await (ctx.storage["submissions"] as any).query({
      orderBy: { submittedAt: "desc" },
      limit: 500,
      ...(cursor ? { cursor } : {}),
    });

    for (const item of result.items) {
      const d = item.data as ContactFormSubmission;
      if (d.status === "deleted") continue;
      if (statusFilter && d.status !== statusFilter) continue;
      if (formIdFilter && d.formId !== formIdFilter) continue;
      if (dateFrom && d.submittedAt < dateFrom) continue;
      if (dateTo && d.submittedAt > dateTo) continue;
      all.push(item);
    }

    cursor = result.hasMore ? result.cursor : undefined;
  } while (cursor);

  const csv = submissionsToCSV(all);
  const filename = `contact-form-submissions-${new Date().toISOString().slice(0, 10)}.csv`;

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
