import type { PluginContext } from "emdash";
import { FIXED_FORM_SLUG } from "../fixed-form.js";
import {
  header, section, context, codeBlock, divider, type Block,
} from "./render.js";

interface BlockResponse {
  blocks: Block[];
}

// Plugin landing page — what users see when they click into the plugin in the
// admin sidebar. Brief, friendly, and lists what's actionable.
export async function buildOverview(
  ctx: PluginContext,
): Promise<BlockResponse> {
  const subs = ctx.storage["submissions"] as any;
  const [newCount, readCount] = await Promise.all([
    subs.count({ status: "new" }),
    subs.count({ status: "read" }),
  ]);
  const total = newCount + readCount;

  const stat =
    total === 0
      ? "No submissions yet — they'll appear here once visitors use your form."
      : newCount > 0
        ? `${newCount} new ${newCount === 1 ? "message" : "messages"} waiting · ${total} total.`
        : `${total} ${total === 1 ? "message" : "messages"} received · all caught up.`;

  const blocks: Block[] = [
    header("Contact Form"),
    context("A built-in form for visitors to send you messages. One form, three fields, no setup."),

    section("Status"),
    context(stat),

    divider(),

    section("Add the form to a page"),
    context(
      "Open any page in the editor, type \"/\", choose Contact Form, then save. " +
      "Or paste the shortcode below directly into Astro markup.",
    ),
    codeBlock(`<div data-form-slug="${FIXED_FORM_SLUG}"></div>`, "html"),

    section("Manage messages"),
    context("Open Submissions in the sidebar to read, search, and reply."),

    section("Customize"),
    context(
      "Edit the success message, privacy note, spam protection, and retention from " +
      "the Settings tab.",
    ),
  ];

  return { blocks };
}

// Older /forms route kept for back-compat. Renders the same overview.
export async function buildFormsList(
  ctx: PluginContext,
): Promise<BlockResponse> {
  return buildOverview(ctx);
}
