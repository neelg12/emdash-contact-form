/**
 * Block Kit element/block builder helpers.
 *
 * These are thin constructors that produce the JSON shapes EmDash's admin
 * renderer expects (header, section, divider, columns, actions, button,
 * etc.). All shapes match `@emdash-cms/blocks`'s exported types.
 *
 * We use `Record<string, unknown>` as the return type instead of the formal
 * Block union so we don't have to import block types here — the helpers are
 * data factories, not type-checked block constructors.
 */

export type Block = Record<string, unknown>;

export function header(text: string): Block {
  return { type: "header", text };
}

export function section(text: string, accessory?: Block): Block {
  return accessory ? { type: "section", text, accessory } : { type: "section", text };
}

export function divider(): Block {
  return { type: "divider" };
}

export function banner(
  title: string,
  description: string,
  variant: "default" | "alert" | "error" = "default",
): Block {
  return { type: "banner", title, description, variant };
}

export function actions(elements: Block[]): Block {
  return { type: "actions", elements };
}

/**
 * EmDash's ColumnsBlock schema: `{ type: "columns", columns: Block[][] }`.
 * Each item in the outer array is a column; each column is a vertical
 * stack of blocks. All columns are equal-width.
 */
export function columns(...cols: Block[][]): Block {
  return {
    type: "columns",
    columns: cols,
  };
}

export function btn(
  text: string,
  actionId: string,
  opts: {
    value?: string;
    style?: "primary" | "danger";
    confirm?: { title: string; text: string; confirm: string; deny: string };
    url?: string;
  } = {},
): Block {
  const el: Block = {
    type: "button",
    label: text,
    action_id: actionId,
  };
  if (opts.value !== undefined) el["value"] = opts.value;
  if (opts.style) el["style"] = opts.style;
  if (opts.confirm) el["confirm"] = opts.confirm;
  if (opts.url) el["url"] = opts.url;
  return el;
}

export function codeBlock(code: string, language = "ts"): Block {
  return { type: "code", code, language };
}

export function context(text: string): Block {
  return { type: "context", text };
}

// ───────────────────────────────────────────────────────────────────────────
// Domain helpers
// ───────────────────────────────────────────────────────────────────────────

/** Map a submission status to a short human label with leading icon. */
export function statusBadge(status: string): string {
  const map: Record<string, string> = {
    new: "🔵 New",
    read: "✓ Read",
    archived: "📦 Archived",
    deleted: "🗑 Deleted",
  };
  return map[status] ?? status;
}

/** Coarse relative-time formatter ("just now", "5m ago", "3h ago", etc.). */
export function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

/** Truncate a string with an ellipsis if longer than `max`. */
export function truncate(s: string, max = 80): string {
  if (s.length <= max) return s;
  return s.slice(0, max) + "…";
}

/** Encode arbitrary state into a string for embedding in button `value` payloads. */
export function encodeState(state: Record<string, unknown>): string {
  return JSON.stringify(state);
}

/** Inverse of `encodeState`. Returns `{}` on parse failure. */
export function decodeState(value: string): Record<string, unknown> {
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return {};
  }
}
