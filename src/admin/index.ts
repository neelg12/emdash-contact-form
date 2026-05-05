import type { PluginContext } from "emdash";
import {
  buildSubmissionsList,
  buildSubmissionDetail,
  handleDelete,
  buildSubmissionsWidget,
} from "./submissions.js";
import { buildFormsList, buildOverview } from "./forms.js";
import { buildSettings, handleSaveSettings } from "./settings.js";
import { decodeState } from "./render.js";

interface AdminInteraction {
  type: string;
  page?: string;
  widget_id?: string;
  action_id?: string;
  block_id?: string;
  value?: string;
  values?: Record<string, string>;
}

export async function handleAdminInteraction(
  interaction: AdminInteraction,
  ctx: PluginContext,
) {
  const { type, page, widget_id, action_id, value, values } = interaction;

  // ---------------------------------------------------------------------------
  // Widget
  // ---------------------------------------------------------------------------
  if (type === "widget_load" && widget_id === "recent-submissions") {
    return buildSubmissionsWidget(ctx);
  }

  // ---------------------------------------------------------------------------
  // Page loads
  // ---------------------------------------------------------------------------
  if (type === "page_load") {
    if (page === "/submissions") return buildSubmissionsList({}, ctx);
    if (page === "/settings") return buildSettings(ctx);
    if (page === "/forms") return buildFormsList(ctx);
    // Plugin root — `/`, empty string, or undefined depending on EmDash version.
    if (!page || page === "/" || page === "") return buildOverview(ctx);
    return { blocks: [] };
  }

  // ---------------------------------------------------------------------------
  // Submissions page actions
  // ---------------------------------------------------------------------------

  // Status chip clicked — `value` is encoded { status, search } so search persists.
  if (type === "block_action" && action_id === "filter_status" && value) {
    const state = decodeState(value);
    return buildSubmissionsList(
      {
        status: (state["status"] as string) || undefined,
        search: (state["search"] as string) || undefined,
      },
      ctx,
    );
  }

  // Settings form submitted.
  if (type === "form_submit" && action_id === "save_settings") {
    return handleSaveSettings(values, ctx);
  }

  // User pressed Enter in the search input. `dispatch_action: true` on the
  // text_input fires a block_action with the typed text as `value`. Status
  // can't be preserved here (no form state), so it resets to "All". Users can
  // re-pick a chip after searching, which preserves the search text.
  if (type === "block_action" && action_id === "search_input") {
    return buildSubmissionsList(
      { search: value || undefined },
      ctx,
    );
  }

  // User clicked the Search button. We don't have access to the typed text
  // (no form state in actions blocks), so the button just re-applies the
  // current filters as encoded in its value — effectively a refresh.
  if (type === "block_action" && action_id === "apply_search_button" && value) {
    const state = decodeState(value);
    return buildSubmissionsList(
      {
        status: (state["status"] as string) || undefined,
        search: (state["search"] as string) || undefined,
      },
      ctx,
    );
  }

  if (type === "block_action" && action_id === "view_submission" && value) {
    return buildSubmissionDetail(value, ctx);
  }

  if (type === "block_action" && action_id === "delete_submission" && value) {
    return handleDelete(value, ctx);
  }

  if (type === "block_action" && action_id === "back_to_submissions_list") {
    return buildSubmissionsList({}, ctx);
  }

  if (
    type === "block_action" &&
    (action_id === "submissions_next" || action_id === "submissions_prev") &&
    value
  ) {
    const state = decodeState(value);
    return buildSubmissionsList(
      {
        status: state["status"] as string | undefined,
        formId: state["formId"] as string | undefined,
        search: state["search"] as string | undefined,
        cursor: state["cursor"] as string | undefined,
      },
      ctx,
    );
  }

  // ---------------------------------------------------------------------------
  // Fallback
  // ---------------------------------------------------------------------------
  return { blocks: [] };
}
