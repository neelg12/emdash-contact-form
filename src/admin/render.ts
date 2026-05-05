// Shared Block Kit block/element builder helpers.

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

// Render counts as a fields block (label/value pairs) — avoids StatsBlockComponent
// runtime shape mismatch. Upgrade to type:"stats" once the exact property contract is confirmed.
export function statCounts(items: Array<{ label: string; value: string | number }>): Block {
  return {
    type: "fields",
    fields: items.map((i) => ({ label: i.label, value: String(i.value) })),
  };
}

export function fields(items: Array<{ label: string; value: string }>): Block {
  return { type: "fields", fields: items };
}

export function actions(elements: Block[]): Block {
  return { type: "actions", elements };
}

export function columns(...cols: Block[][]): Block {
  return {
    type: "columns",
    columns: cols.map((blocks) => ({ blocks })),
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
  // EmDash's runtime uses `label` (matching its form.submit shape).
  // We include both `label` and `text` for max compatibility with future API changes.
  const el: Record<string, unknown> = {
    type: "button",
    label: text,
    text,
    action_id: actionId,
  };
  if (opts.value !== undefined) el["value"] = opts.value;
  if (opts.style) el["style"] = opts.style;
  if (opts.confirm) el["confirm"] = opts.confirm;
  if (opts.url) el["url"] = opts.url;
  return el;
}

export function table(
  columns: Array<{ key: string; label: string; format?: string }>,
  rows: Record<string, unknown>[],
): Block {
  return { type: "table", columns, rows };
}

export function codeBlock(code: string, language = "ts"): Block {
  return { type: "code", code, language };
}

export function context(text: string): Block {
  return { type: "context", text };
}

// ---------------------------------------------------------------------------
// Domain helpers
// ---------------------------------------------------------------------------

export function statusBadge(status: string): string {
  const map: Record<string, string> = {
    new: "🔵 New",
    read: "✓ Read",
    archived: "📦 Archived",
    deleted: "🗑 Deleted",
  };
  return map[status] ?? status;
}

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

export function truncate(s: string, max = 80): string {
  if (s.length <= max) return s;
  return s.slice(0, max) + "…";
}

// Encode filter/cursor state for button values.
export function encodeState(state: Record<string, unknown>): string {
  return JSON.stringify(state);
}

export function decodeState(value: string): Record<string, unknown> {
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return {};
  }
}
