import type { PluginContext } from "emdash";
import type { ContactFormSubmission } from "../types.js";

/**
 * REST endpoint: `GET /_emdash/api/plugins/contact-form/submissions`
 *
 * Query params:
 *   - `status`  filter by submission status
 *   - `formId`  filter by form id (forward-compat; current plugin has one form)
 *   - `limit`   page size, default 50, capped at 100
 *   - `cursor`  pagination cursor from a previous response
 *
 * Soft-deleted submissions are excluded automatically.
 *
 * Returns `{ ok: true, items, cursor, hasMore }` on success or
 * `{ ok: false, error }` on failure.
 */
export async function handleSubmissions(routeCtx: any, ctx: PluginContext): Promise<unknown> {
  if (routeCtx.request.method !== "GET") {
    return { ok: false, error: "method_not_allowed" };
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

  interface RawItem {
    id: string;
    data: ContactFormSubmission;
  }
  interface QueryResult {
    items: RawItem[];
    cursor?: string;
    hasMore: boolean;
  }

  const result: QueryResult = await (ctx.storage["submissions"] as any).query(query);

  const items = result.items
    .filter((i) => i.data.status !== "deleted")
    .map((i) => ({
      id: i.id,
      status: i.data.status,
      submittedAt: i.data.submittedAt,
      formId: i.data.formId,
      formTitle: i.data.formTitle,
      pageSlug: i.data.pageSlug,
      fields: i.data.fields,
    }));

  return { ok: true, items, cursor: result.cursor, hasMore: result.hasMore };
}
