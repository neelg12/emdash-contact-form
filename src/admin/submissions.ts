import type { PluginContext } from "emdash";
import type { ContactFormSubmission } from "../types.js";
import { FIXED_FORM_SLUG } from "../fixed-form.js";
import { submissionsToCSV } from "../csv.js";
import {
  header, section, divider, banner, fields, actions, btn, codeBlock, context,
  statusBadge, relativeTime, truncate, encodeState, decodeState, type Block,
} from "./render.js";

// Tight one-line meta string for each submission card.
function metaLine(data: ContactFormSubmission): string {
  const parts = [statusBadge(data.status), relativeTime(data.submittedAt)];
  if (data.pageSlug) parts.push(data.pageSlug);
  return parts.join("  ·  ");
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ListFilters {
  status?: string;
  formId?: string;
  search?: string;
  cursor?: string;
}

interface BlockResponse {
  blocks: Block[];
  toast?: { message: string; type: "success" | "error" | "info" };
}

const PAGE_SIZE = 10;

function submissionTitle(data: ContactFormSubmission, fallbackId: string): string {
  const name = String(data.fields["name"] ?? "").trim();
  const email = String(data.fields["email"] ?? "").trim();
  if (name && email) return `${name} • ${email}`;
  if (name) return name;
  if (email) return email;
  return fallbackId;
}

function submissionPreview(data: ContactFormSubmission): string {
  const message = String(data.fields["message"] ?? "").trim();
  if (message) return truncate(message.replace(/\s+/g, " "), 160);
  const fallback = Object.entries(data.fields)
    .filter(([key]) => !["name", "email"].includes(key))
    .map(([key, value]) => `${key}: ${String(value ?? "")}`)
    .join(" • ");
  return truncate(fallback || "No message provided.", 160);
}

// ---------------------------------------------------------------------------
// Submissions list
// ---------------------------------------------------------------------------

export async function buildSubmissionsList(
  filters: ListFilters,
  ctx: PluginContext,
  toast?: { message: string; type: "success" | "error" | "info" },
): Promise<BlockResponse> {
  const submissions = ctx.storage["submissions"] as any;

  // Fetch a batch for counting and listing. Filter deleted at the app level.
  const [newCount, readCount, allResult] = await Promise.all([
    submissions.count({ status: "new" }),
    submissions.count({ status: "read" }),
    submissions.query({
      orderBy: { submittedAt: "desc" },
      limit: 500,
    }),
  ]);
  const totalCount = newCount + readCount;

  // All non-deleted submissions
  let items: Array<{ id: string; data: ContactFormSubmission }> = allResult.items.filter(
    (i: any) => i.data.status !== "deleted",
  );

  // Apply filters in JS (pragmatic for typical contact form volumes).
  if (filters.status) {
    items = items.filter((i) => i.data.status === filters.status);
  }
  if (filters.formId) {
    items = items.filter((i) => i.data.formId === filters.formId);
  }
  if (filters.search) {
    const q = filters.search.toLowerCase();
    items = items.filter((i) => {
      const d = i.data;
      const name = String(d.fields["name"] ?? "").toLowerCase();
      const email = String(d.fields["email"] ?? "").toLowerCase();
      const msg = String(d.fields["message"] ?? "").toLowerCase();
      const slug = (d.pageSlug ?? "").toLowerCase();
      return name.includes(q) || email.includes(q) || msg.includes(q) || slug.includes(q);
    });
  }

  const totalFiltered = items.length;

  // Offset-based pagination on the filtered slice.
  let offset = 0;
  if (filters.cursor) {
    const state = decodeState(filters.cursor);
    offset = typeof state["offset"] === "number" ? state["offset"] : 0;
  }
  const page = items.slice(offset, offset + PAGE_SIZE);
  const hasPrev = offset > 0;
  const hasNext = offset + PAGE_SIZE < totalFiltered;

  // Status filter as inline chips (actions block renders horizontally).
  // Each chip carries the current search in its value so clicking preserves it.
  const activeStatus = filters.status ?? "";
  const chip = (label: string, value: string, count: number) => {
    const isActive = activeStatus === value;
    return btn(`${isActive ? "● " : ""}${label} (${count})`, "filter_status", {
      value: encodeState({ status: value, search: filters.search ?? "" }),
      ...(isActive ? { style: "primary" as const } : {}),
    });
  };

  // Build the top action row: chips, search, and (when there's data) Export.
  // `dispatch_action: true` on the text_input fires a block_action when the
  // user presses Enter (the standard Block Kit pattern).
  const topActions: Block[] = [
    chip("All", "", totalCount),
    chip("New", "new", newCount),
    chip("Read", "read", readCount),
    {
      type: "text_input",
      action_id: "search_input",
      placeholder: "Search name, email, message, or page…  (press Enter)",
      initial_value: filters.search ?? "",
      dispatch_action: true,
    },
    btn("Search", "apply_search_button", {
      value: encodeState({ status: activeStatus, search: filters.search ?? "" }),
    }),
  ];

  // (Export rendered separately below — admin button URL/redirect doesn't work
  //  reliably in EmDash's SPA, so we fall back to a plain link.)

  const blocks: Block[] = [
    header("Form Submissions"),
    context("Messages received through your contact form. Click View to read and reply."),
    actions(topActions),
    divider(),
  ];

  if (page.length === 0) {
    const hasFilters = filters.status || filters.search || filters.formId;

    if (hasFilters) {
      // User narrowed too far — just nudge them, don't show setup help.
      blocks.push(
        banner(
          "No submissions match these filters",
          "Try clearing the search box or switching to All.",
          "default",
        ),
      );
    } else {
      // Truly empty — show friendly guidance on how to add the form.
      blocks.push(
        banner(
          "No submissions yet",
          "Messages will appear here once visitors use your contact form.",
          "default",
        ),
        divider(),
        section("Add the form to a page"),
        context(
          "Open any page in the editor, type \"/\", choose Contact Form, then save. " +
          "Or paste this shortcode directly into Astro markup:",
        ),
        codeBlock(`<div data-form-slug="${FIXED_FORM_SLUG}"></div>`, "html"),
      );
    }
  } else {
    for (const { id, data } of page) {
      const title = submissionTitle(data, id);
      const preview = submissionPreview(data);

      blocks.push(
        // Single-line header: who, status, when, where.
        section(`${title}  —  ${metaLine(data)}`),
        // Small grey preview line so the message doesn't dominate the card.
        context(preview),
        actions([
          btn("View", "view_submission", { value: id }),
          btn("Delete", "delete_submission", {
            value: id,
            style: "danger",
            confirm: {
              title: "Delete submission?",
              text: "This will soft-delete the submission. It can be purged later via retention settings.",
              confirm: "Delete",
              deny: "Cancel",
            },
          }),
        ]),
        divider(),
      );
    }
  }

  // Pagination
  if (hasPrev || hasNext) {
    const paginationButtons: Block[] = [];
    if (hasPrev) {
      paginationButtons.push(
        btn("← Prev", "submissions_prev", {
          value: encodeState({ ...filters, cursor: encodeState({ offset: offset - PAGE_SIZE }) }),
        }),
      );
    }
    if (hasNext) {
      paginationButtons.push(
        btn("Next →", "submissions_next", {
          value: encodeState({ ...filters, cursor: encodeState({ offset: offset + PAGE_SIZE }) }),
        }),
      );
    }
    blocks.push(actions(paginationButtons));
    blocks.push(context(`Showing ${offset + 1}–${Math.min(offset + PAGE_SIZE, totalFiltered)} of ${totalFiltered}`));
  }

  // Export — generate CSV inline and embed as a data: URI link.
  // We don't hit /submissions/export because EmDash's plugin route wrapper
  // strips Response bodies, so a plain CSV endpoint can't deliver bytes.
  // The data URI approach works with no server round-trip on click.
  if (totalCount > 0) {
    const csv = submissionsToCSV(items);
    const dataUri = `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`;
    blocks.push(
      divider(),
      section(
        `📥 [Download all ${totalFiltered} ${
          totalFiltered === 1 ? "submission" : "submissions"
        } as CSV](${dataUri})`,
      ),
    );
  }

  return { blocks, ...(toast ? { toast } : {}) };
}

// ---------------------------------------------------------------------------
// Submission detail
// ---------------------------------------------------------------------------

export async function buildSubmissionDetail(
  submissionId: string,
  ctx: PluginContext,
  toast?: { message: string; type: "success" | "error" | "info" },
): Promise<BlockResponse> {
  const data = (await (ctx.storage["submissions"] as any).get(submissionId)) as ContactFormSubmission | null;

  if (!data) {
    return {
      blocks: [
        header("Submission Not Found"),
        banner("Submission not found", "It may have been deleted.", "error"),
        actions([btn("← Back to Submissions", "back_to_submissions_list")]),
      ],
    };
  }

  // Auto-mark new submissions as read when opened. No manual button needed.
  if (data.status === "new") {
    data.status = "read";
    data.readAt = new Date().toISOString();
    await (ctx.storage["submissions"] as any).put(submissionId, data);
  }

  const title = submissionTitle(data, submissionId);

  const blocks: Block[] = [
    actions([btn("← Back", "back_to_submissions_list")]),
    header(title),
    context(metaLine(data)),
    divider(),

    // The submitted fields are the heart of a submission — show them first.
    fields(
      Object.entries(data.fields).map(([k, v]) => ({
        label: k,
        value: String(v ?? "—"),
      })),
    ),

    divider(),
    context(
      `Submitted ${new Date(data.submittedAt).toLocaleString()}  ·  IP ${
        data.meta.ip ?? "—"
      }  ·  ${truncate(data.meta.userAgent ?? "—", 60)}`,
    ),

    divider(),
    actions([
      btn("Delete", "delete_submission", {
        value: submissionId,
        style: "danger",
        confirm: {
          title: "Delete submission?",
          text: "This will soft-delete the submission.",
          confirm: "Delete",
          deny: "Cancel",
        },
      }),
    ]),
  ];

  return { blocks, ...(toast ? { toast } : {}) };
}

// ---------------------------------------------------------------------------
// Status mutations
// ---------------------------------------------------------------------------

async function updateStatus(
  id: string,
  newStatus: ContactFormSubmission["status"],
  ctx: PluginContext,
): Promise<void> {
  const data = (await (ctx.storage["submissions"] as any).get(id)) as ContactFormSubmission | null;
  if (!data) return;

  const now = new Date().toISOString();
  const updated: ContactFormSubmission = {
    ...data,
    status: newStatus,
    ...(newStatus === "read" && !data.readAt ? { readAt: now } : {}),
    ...(newStatus === "archived" ? { archivedAt: now } : {}),
    ...(newStatus === "deleted" ? { deletedAt: now } : {}),
  };

  await (ctx.storage["submissions"] as any).put(id, updated);
}

export async function handleDelete(
  id: string,
  ctx: PluginContext,
): Promise<BlockResponse> {
  await updateStatus(id, "deleted", ctx);
  return buildSubmissionsList({}, ctx, { message: "Submission deleted.", type: "success" });
}

// ---------------------------------------------------------------------------
// Dashboard widget
// ---------------------------------------------------------------------------

export async function buildSubmissionsWidget(ctx: PluginContext): Promise<BlockResponse> {
  const submissions = ctx.storage["submissions"] as any;

  const [newCount, totalResult] = await Promise.all([
    submissions.count({ status: "new" }),
    submissions.query({ orderBy: { submittedAt: "desc" }, limit: 5 }),
  ]);

  const recent = totalResult.items.filter((i: any) => i.data.status !== "deleted");

  const blocks: Block[] = [
    context(`${newCount} new  ·  ${recent.length} recent`),
    ...(recent.length === 0
      ? [section("No submissions yet.")]
      : recent.map((item: any) => {
          const name = String(item.data.fields["name"] ?? item.data.fields["email"] ?? "Unknown");
          return section(`${statusBadge(item.data.status)}  ${truncate(name, 30)}  •  ${relativeTime(item.data.submittedAt)}`);
        })),
  ];

  return { blocks };
}
