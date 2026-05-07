import type { PluginContext } from "emdash";
import type { ContactFormSubmission } from "../types.js";

// GET /_emdash/api/plugins/contact-form/submissions
// Query params: status, formId, limit (default 50), cursor
export async function handleSubmissions(routeCtx: any, ctx: PluginContext): Promise<unknown> {
  if (routeCtx.request.method !== "GET") {
    return { error: "method_not_allowed" };
  }

  const url = new URL(routeCtx.request.url);
  const status = url.searchParams.get("status") ?? undefined;
  const formId = url.searchParams.get("formId") ?? undefined;
  const rawLimit = parseInt(url.searchParams.get("limit") ?? "50", 10);
  const limit = Math.min(Math.max(1, isNaN(rawLimit) ? 50 : rawLimit), 100);
  const cursor = url.searchParams.get("cursor") ?? undefined;

  const query: Record<string, unknown> = {
    orderBy: { submittedAt: "desc" },
    limit,
    ...(cursor ? { cursor } : {}),
  };

  if (status) query["where"] = { status };
  else if (formId) query["where"] = { formId };

  const result = await (ctx.storage["submissions"] as any).query(query);

  const items = result.items
    .filter((i: any) => i.data.status !== "deleted")
    .map((i: any) => {
      const d = i.data as ContactFormSubmission;
      return {
        id: i.id,
        status: d.status,
        submittedAt: d.submittedAt,
        formId: d.formId,
        formTitle: d.formTitle,
        pageSlug: d.pageSlug,
        fields: d.fields,
      };
    });

  return { items, cursor: result.cursor, hasMore: result.hasMore };
}
