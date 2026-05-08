// src/sandbox-entry.ts
import { definePlugin } from "emdash";

// src/types.ts
var DEFAULT_FIELDS = [
  { type: "text", name: "name", label: "Name", required: true, placeholder: "Your name" },
  { type: "email", name: "email", label: "Email", required: true, placeholder: "your@email.com" },
  {
    type: "textarea",
    name: "message",
    label: "Message",
    required: true,
    placeholder: "Your message",
    maxLength: 5e3
  }
];
var DEFAULT_SUCCESS_MESSAGE = "Thank you for your message! We\u2019ll get back to you soon.";
function generateId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

// src/fixed-form.ts
var FIXED_FORM_ID = "contact";
var FIXED_FORM_SLUG = "contact";
var FIXED_FORM_TITLE = "Contact Us";
async function getFixedFormDefinition(ctx) {
  const successMessage = await ctx.kv.get("settings:successMessage") ?? DEFAULT_SUCCESS_MESSAGE;
  const privacyNote = await ctx.kv.get("settings:privacyNote") ?? "";
  return {
    id: FIXED_FORM_ID,
    slug: FIXED_FORM_SLUG,
    title: FIXED_FORM_TITLE,
    description: "",
    successMessage,
    submitLabel: "Send Message",
    privacyNote,
    fields: DEFAULT_FIELDS,
    createdAt: "",
    updatedAt: ""
  };
}

// src/admin/render.ts
function header(text) {
  return { type: "header", text };
}
function section(text, accessory) {
  return accessory ? { type: "section", text, accessory } : { type: "section", text };
}
function divider() {
  return { type: "divider" };
}
function banner(title, description, variant = "default") {
  return { type: "banner", title, description, variant };
}
function actions(elements) {
  return { type: "actions", elements };
}
function columns(...cols) {
  return {
    type: "columns",
    columns: cols
  };
}
function btn(text, actionId, opts = {}) {
  const el = {
    type: "button",
    label: text,
    action_id: actionId
  };
  if (opts.value !== void 0) el["value"] = opts.value;
  if (opts.style) el["style"] = opts.style;
  if (opts.confirm) el["confirm"] = opts.confirm;
  if (opts.url) el["url"] = opts.url;
  return el;
}
function codeBlock(code, language = "ts") {
  return { type: "code", code, language };
}
function context(text) {
  return { type: "context", text };
}
function statusBadge(status) {
  const map = {
    new: "\u{1F535} New",
    read: "\u2713 Read",
    archived: "\u{1F4E6} Archived",
    deleted: "\u{1F5D1} Deleted"
  };
  return map[status] ?? status;
}
function relativeTime(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 6e4);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}
function truncate(s, max = 80) {
  if (s.length <= max) return s;
  return s.slice(0, max) + "\u2026";
}
function encodeState(state) {
  return JSON.stringify(state);
}
function decodeState(value) {
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

// src/admin/submissions.ts
function metaLine(data) {
  const parts = [statusBadge(data.status), relativeTime(data.submittedAt)];
  if (data.pageSlug) parts.push(data.pageSlug);
  return parts.join("  \xB7  ");
}
var PAGE_SIZE = 10;
function submissionTitle(data, fallbackId) {
  const name = String(data.fields["name"] ?? "").trim();
  const email = String(data.fields["email"] ?? "").trim();
  if (name && email) return `${name} \u2022 ${email}`;
  if (name) return name;
  if (email) return email;
  return fallbackId;
}
async function buildSubmissionsList(filters, ctx, toast) {
  const submissions = ctx.storage["submissions"];
  const [newCount, readCount, allResult] = await Promise.all([
    submissions.count({ status: "new" }),
    submissions.count({ status: "read" }),
    submissions.query({
      orderBy: { submittedAt: "desc" },
      limit: 500
    })
  ]);
  const totalCount = newCount + readCount;
  let items = allResult.items.filter(
    (i) => i.data.status !== "deleted"
  );
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
  let offset = 0;
  if (filters.cursor) {
    const state = decodeState(filters.cursor);
    offset = typeof state["offset"] === "number" ? state["offset"] : 0;
  }
  const page = items.slice(offset, offset + PAGE_SIZE);
  const hasPrev = offset > 0;
  const hasNext = offset + PAGE_SIZE < totalFiltered;
  const activeStatus = filters.status ?? "";
  const chip = (label, value, count) => {
    const isActive = activeStatus === value;
    return btn(`${isActive ? "\u25CF " : ""}${label} (${count})`, "filter_status", {
      value: encodeState({ status: value, search: filters.search ?? "" }),
      ...isActive ? { style: "primary" } : {}
    });
  };
  const topActions = [
    chip("All", "", totalCount),
    chip("New", "new", newCount),
    chip("Read", "read", readCount),
    {
      type: "text_input",
      action_id: "search_input",
      placeholder: "Search name, email, message, or page\u2026  (press Enter)",
      initial_value: filters.search ?? "",
      dispatch_action: true
    },
    btn("Search", "apply_search_button", {
      value: encodeState({ status: activeStatus, search: filters.search ?? "" })
    })
  ];
  const blocks = [
    header("Form Submissions"),
    context("Messages received through your contact form. Click View to read and reply."),
    actions(topActions),
    divider()
  ];
  if (page.length === 0) {
    const hasFilters = filters.status || filters.search || filters.formId;
    if (hasFilters) {
      blocks.push(
        banner(
          "No submissions match these filters",
          "Try clearing the search box or switching to All.",
          "default"
        )
      );
    } else {
      blocks.push(
        banner(
          "No submissions yet",
          "Messages will appear here once visitors use your contact form.",
          "default"
        ),
        divider(),
        section("Add the form to a page"),
        context(
          'Open any page in the editor, type "/", choose Contact Form, then save. Or paste this shortcode directly into Astro markup:'
        ),
        codeBlock(`<div data-form-slug="${FIXED_FORM_SLUG}"></div>`, "html")
      );
    }
  } else {
    for (const { id, data } of page) {
      const title = submissionTitle(data, id);
      blocks.push(
        columns(
          [section(title), context(metaLine(data))],
          [
            actions([
              btn("View", "view_submission", { value: id }),
              btn("Delete", "delete_submission", {
                value: id,
                style: "danger",
                confirm: {
                  title: "Delete submission?",
                  text: "This will soft-delete the submission.",
                  confirm: "Delete",
                  deny: "Cancel"
                }
              })
            ])
          ]
        ),
        divider()
      );
    }
  }
  if (hasPrev || hasNext) {
    const paginationButtons = [];
    if (hasPrev) {
      paginationButtons.push(
        btn("\u2190 Prev", "submissions_prev", {
          value: encodeState({ ...filters, cursor: encodeState({ offset: offset - PAGE_SIZE }) })
        })
      );
    }
    if (hasNext) {
      paginationButtons.push(
        btn("Next \u2192", "submissions_next", {
          value: encodeState({ ...filters, cursor: encodeState({ offset: offset + PAGE_SIZE }) })
        })
      );
    }
    blocks.push(actions(paginationButtons));
    blocks.push(context(`Showing ${offset + 1}\u2013${Math.min(offset + PAGE_SIZE, totalFiltered)} of ${totalFiltered}`));
  }
  return { blocks, ...toast ? { toast } : {} };
}
async function buildSubmissionDetail(submissionId, ctx, toast) {
  const data = await ctx.storage["submissions"].get(submissionId);
  if (!data) {
    return {
      blocks: [
        header("Submission Not Found"),
        banner("Submission not found", "It may have been deleted.", "error"),
        actions([btn("\u2190 Back to Submissions", "back_to_submissions_list")])
      ]
    };
  }
  if (data.status === "new") {
    data.status = "read";
    data.readAt = (/* @__PURE__ */ new Date()).toISOString();
    await ctx.storage["submissions"].put(submissionId, data);
  }
  const title = submissionTitle(data, submissionId);
  const fieldBlocks = Object.entries(data.fields).flatMap(([k, v]) => {
    const label = k.charAt(0).toUpperCase() + k.slice(1);
    const value = String(v ?? "\u2014").trim() || "\u2014";
    return [context(label), section(value)];
  });
  const blocks = [
    actions([btn("\u2190 Back", "back_to_submissions_list")]),
    header(title),
    context(metaLine(data)),
    divider(),
    ...fieldBlocks,
    divider(),
    context(
      `Submitted ${new Date(data.submittedAt).toLocaleString()}  \xB7  IP ${data.meta.ip ?? "\u2014"}  \xB7  ${truncate(data.meta.userAgent ?? "\u2014", 60)}`
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
          deny: "Cancel"
        }
      })
    ])
  ];
  return { blocks, ...toast ? { toast } : {} };
}
async function updateStatus(id, newStatus, ctx) {
  const data = await ctx.storage["submissions"].get(id);
  if (!data) return;
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const updated = {
    ...data,
    status: newStatus,
    ...newStatus === "read" && !data.readAt ? { readAt: now } : {},
    ...newStatus === "archived" ? { archivedAt: now } : {},
    ...newStatus === "deleted" ? { deletedAt: now } : {}
  };
  await ctx.storage["submissions"].put(id, updated);
}
async function handleDelete(id, ctx) {
  await updateStatus(id, "deleted", ctx);
  return buildSubmissionsList({}, ctx, { message: "Submission deleted.", type: "success" });
}
async function buildSubmissionsWidget(ctx) {
  const submissions = ctx.storage["submissions"];
  const [newCount, totalResult] = await Promise.all([
    submissions.count({ status: "new" }),
    submissions.query({ orderBy: { submittedAt: "desc" }, limit: 5 })
  ]);
  const recent = totalResult.items.filter((i) => i.data.status !== "deleted");
  const blocks = [
    context(`${newCount} new  \xB7  ${recent.length} recent`),
    ...recent.length === 0 ? [section("No submissions yet.")] : recent.map((item) => {
      const name = String(item.data.fields["name"] ?? item.data.fields["email"] ?? "Unknown");
      return section(`${statusBadge(item.data.status)}  ${truncate(name, 30)}  \u2022  ${relativeTime(item.data.submittedAt)}`);
    })
  ];
  return { blocks };
}

// src/admin/forms.ts
async function buildOverview(ctx) {
  const subs = ctx.storage["submissions"];
  const [newCount, readCount] = await Promise.all([
    subs.count({ status: "new" }),
    subs.count({ status: "read" })
  ]);
  const total = newCount + readCount;
  const stat = total === 0 ? "No submissions yet \u2014 they'll appear here once visitors use your form." : newCount > 0 ? `${newCount} new ${newCount === 1 ? "message" : "messages"} waiting \xB7 ${total} total.` : `${total} ${total === 1 ? "message" : "messages"} received \xB7 all caught up.`;
  const blocks = [
    header("Contact Form"),
    context("A built-in form for visitors to send you messages. One form, three fields, no setup."),
    section("Status"),
    context(stat),
    divider(),
    section("Add the form to a page"),
    context(
      'Open any page in the editor, type "/", choose Contact Form, then save. Or paste the shortcode below directly into Astro markup.'
    ),
    codeBlock(`<div data-form-slug="${FIXED_FORM_SLUG}"></div>`, "html"),
    section("Manage messages"),
    context("Open Submissions in the sidebar to read, search, and reply."),
    section("Customize"),
    context(
      "Edit the success message, privacy note, spam protection, and retention from Form Settings in the sidebar."
    )
  ];
  return { blocks };
}
async function buildFormsList(ctx) {
  return buildOverview(ctx);
}

// src/admin/settings.ts
async function readSettings(ctx) {
  const [successMessage, requireHoneypot, maxMessageLength, retentionDays, privacyNote] = await Promise.all([
    ctx.kv.get("settings:successMessage"),
    ctx.kv.get("settings:requireHoneypot"),
    ctx.kv.get("settings:maxMessageLength"),
    ctx.kv.get("settings:retentionDays"),
    ctx.kv.get("settings:privacyNote")
  ]);
  return {
    successMessage: successMessage ?? DEFAULT_SUCCESS_MESSAGE,
    requireHoneypot: requireHoneypot ?? true,
    maxMessageLength: maxMessageLength ?? 5e3,
    retentionDays: retentionDays ?? 0,
    privacyNote: privacyNote ?? ""
  };
}
async function buildSettings(ctx, toast) {
  const s = await readSettings(ctx);
  const yesNoOptions = [
    { label: "Yes", text: "Yes", value: "true" },
    { label: "No", text: "No", value: "false" }
  ];
  const blocks = [
    header("Form Settings"),
    context("Configure your contact form. Changes apply immediately to all live forms."),
    divider(),
    {
      type: "form",
      block_id: "settings_form",
      fields: [
        {
          type: "text_input",
          action_id: "successMessage",
          label: "Success message",
          placeholder: "Shown after a visitor submits the form",
          multiline: true,
          initial_value: s.successMessage
        },
        {
          type: "text_input",
          action_id: "privacyNote",
          label: "Privacy note",
          placeholder: "Shown below the form (e.g. how you handle their data)",
          multiline: true,
          initial_value: s.privacyNote
        },
        {
          type: "select",
          action_id: "requireHoneypot",
          label: "Spam protection (honeypot)",
          options: yesNoOptions,
          initial_value: s.requireHoneypot ? "true" : "false"
        },
        {
          type: "text_input",
          action_id: "maxMessageLength",
          label: "Max message length (characters)",
          placeholder: "5000",
          initial_value: String(s.maxMessageLength)
        },
        {
          type: "text_input",
          action_id: "retentionDays",
          label: "Auto-delete submissions after (days, 0 = never)",
          placeholder: "0",
          initial_value: String(s.retentionDays)
        }
      ],
      submit: { label: "Save settings", action_id: "save_settings" }
    }
  ];
  return { blocks, ...toast ? { toast } : {} };
}
async function handleSaveSettings(values, ctx) {
  const v = values ?? {};
  const current = await readSettings(ctx);
  const successMessage = typeof v.successMessage === "string" && v.successMessage.trim() ? v.successMessage : current.successMessage;
  const privacyNote = typeof v.privacyNote === "string" ? v.privacyNote : current.privacyNote;
  const requireHoneypot = v.requireHoneypot === "true";
  const maxRaw = parseInt(v.maxMessageLength ?? "", 10);
  const maxMessageLength = Number.isFinite(maxRaw) ? Math.min(5e4, Math.max(100, maxRaw)) : current.maxMessageLength;
  const retRaw = parseInt(v.retentionDays ?? "", 10);
  const retentionDays = Number.isFinite(retRaw) && retRaw >= 0 ? retRaw : current.retentionDays;
  await Promise.all([
    ctx.kv.set("settings:successMessage", successMessage),
    ctx.kv.set("settings:privacyNote", privacyNote),
    ctx.kv.set("settings:requireHoneypot", requireHoneypot),
    ctx.kv.set("settings:maxMessageLength", maxMessageLength),
    ctx.kv.set("settings:retentionDays", retentionDays)
  ]);
  ctx.log.info("Contact form settings updated", {
    requireHoneypot,
    maxMessageLength,
    retentionDays
  });
  return buildSettings(ctx, { message: "Settings saved.", type: "success" });
}

// src/admin/index.ts
async function handleAdminInteraction(interaction, ctx) {
  const { type, page, widget_id, action_id, value, values } = interaction;
  if (type === "widget_load" && widget_id === "recent-submissions") {
    return buildSubmissionsWidget(ctx);
  }
  if (type === "page_load") {
    if (page === "/submissions") return buildSubmissionsList({}, ctx);
    if (page === "/settings") return buildSettings(ctx);
    if (page === "/forms") return buildFormsList(ctx);
    if (!page || page === "/" || page === "") return buildOverview(ctx);
    return { blocks: [] };
  }
  if (type === "block_action" && action_id === "filter_status" && value) {
    const state = decodeState(value);
    return buildSubmissionsList(
      {
        status: state["status"] || void 0,
        search: state["search"] || void 0
      },
      ctx
    );
  }
  if (type === "form_submit" && action_id === "save_settings") {
    return handleSaveSettings(values, ctx);
  }
  if (type === "block_action" && action_id === "search_input") {
    return buildSubmissionsList(
      { search: value || void 0 },
      ctx
    );
  }
  if (type === "block_action" && action_id === "apply_search_button" && value) {
    const state = decodeState(value);
    return buildSubmissionsList(
      {
        status: state["status"] || void 0,
        search: state["search"] || void 0
      },
      ctx
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
  if (type === "block_action" && (action_id === "submissions_next" || action_id === "submissions_prev") && value) {
    const state = decodeState(value);
    return buildSubmissionsList(
      {
        status: state["status"],
        formId: state["formId"],
        search: state["search"],
        cursor: state["cursor"]
      },
      ctx
    );
  }
  return { blocks: [] };
}

// src/validation.ts
var rateMap = /* @__PURE__ */ new Map();
var RATE_WINDOW_MS = 15 * 60 * 1e3;
var RATE_LIMIT_PER_IP = 5;
var RATE_LIMIT_GLOBAL = 60;
var GLOBAL_KEY = "__global__";
function checkRateLimit(ip) {
  const key = ip ?? GLOBAL_KEY;
  const cap = ip ? RATE_LIMIT_PER_IP : RATE_LIMIT_GLOBAL;
  const now = Date.now();
  const entry = rateMap.get(key);
  if (!entry || now - entry.windowStart > RATE_WINDOW_MS) {
    rateMap.set(key, { count: 1, windowStart: now });
    return true;
  }
  if (entry.count >= cap) return false;
  entry.count++;
  return true;
}
setInterval(
  () => {
    const cutoff = Date.now() - RATE_WINDOW_MS;
    for (const [key, entry] of rateMap) {
      if (entry.windowStart < cutoff) rateMap.delete(key);
    }
  },
  5 * 60 * 1e3
);
var MIN_SUBMIT_MS = 2e3;
function checkHoneypot(payload) {
  return (payload.honeypot ?? "") === "";
}
function checkMinSubmitTime(payload) {
  if (!payload._submitTime) return true;
  return Date.now() - payload._submitTime >= MIN_SUBMIT_MS;
}
var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
var PHONE_RE = /^[\d\s\+\-\(\)]{7,20}$/;
function validateEmail(value) {
  return EMAIL_RE.test(value.trim());
}
function validateFieldValue(field, rawValue, maxMessageLength) {
  const strVal = rawValue !== null && rawValue !== void 0 ? String(rawValue).trim() : "";
  if (field.required && strVal === "") {
    return `${field.label} is required.`;
  }
  if (strVal === "") return null;
  switch (field.type) {
    case "email":
      if (!validateEmail(strVal)) return "Please enter a valid email address.";
      break;
    case "phone":
      if (!PHONE_RE.test(strVal)) return "Please enter a valid phone number.";
      break;
    case "textarea": {
      const limit = field.maxLength ?? maxMessageLength;
      if (strVal.length > limit) return `Message must be ${limit} characters or fewer.`;
      break;
    }
    case "text": {
      const limit = field.maxLength ?? maxMessageLength;
      if (strVal.length > limit)
        return `${field.label} must be ${limit} characters or fewer.`;
      break;
    }
    case "select":
      if (field.options && !field.options.some((o) => o.value === strVal)) {
        return `Please select a valid option for ${field.label}.`;
      }
      break;
    case "checkbox":
      break;
    case "hidden":
      break;
  }
  return null;
}
function validateSubmissionPayload(form, payload, maxMessageLength) {
  const errors = {};
  for (const field of form.fields) {
    if (field.type === "hidden") continue;
    const rawValue = payload.fields[field.name];
    const err = validateFieldValue(field, rawValue, maxMessageLength);
    if (err) errors[field.name] = err;
  }
  return { ok: Object.keys(errors).length === 0, fields: errors };
}
function getClientIp(request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? request.headers.get("x-real-ip") ?? void 0;
}

// src/routes/submit.ts
var MAX_BODY_BYTES = 64 * 1024;
async function handleSubmit(routeCtx, ctx) {
  const request = routeCtx.request;
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return { ok: false, error: "invalid_content_type" };
  }
  const contentLength = parseInt(request.headers.get("content-length") ?? "0", 10);
  if (contentLength > MAX_BODY_BYTES) {
    return { ok: false, error: "payload_too_large" };
  }
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (origin && host) {
    try {
      const originHost = new URL(origin).host;
      if (originHost !== host) {
        ctx.log.info("Contact form: cross-origin submit rejected", { origin, host });
        return { ok: false, error: "forbidden_origin" };
      }
    } catch {
      return { ok: false, error: "forbidden_origin" };
    }
  }
  const pluginParsedInput = routeCtx.input && typeof routeCtx.input === "object" && !Array.isArray(routeCtx.input) ? routeCtx.input : void 0;
  let payload = pluginParsedInput;
  if (!payload && !request.bodyUsed) {
    try {
      payload = await request.clone().json();
    } catch {
      payload = void 0;
    }
  }
  if (!payload) {
    return { ok: false, error: "invalid_json" };
  }
  if (!payload.fields || typeof payload.fields !== "object" || Array.isArray(payload.fields)) {
    return { ok: false, error: "validation_error", fields: { _form: "Invalid payload." } };
  }
  const submittedFormId = typeof payload.formId === "string" && payload.formId.trim() ? payload.formId.trim() : FIXED_FORM_ID;
  const ip = getClientIp(request);
  if (!checkRateLimit(ip)) {
    return {
      ok: false,
      error: "rate_limited",
      message: "Too many submissions. Please wait a moment."
    };
  }
  const requireHoneypot = await ctx.kv.get("settings:requireHoneypot") ?? true;
  if (requireHoneypot && !checkHoneypot(payload)) {
    ctx.log.info("Contact form: honeypot triggered", { formId: submittedFormId });
    return { ok: true, submissionId: "ignored" };
  }
  if (!checkMinSubmitTime(payload)) {
    ctx.log.info("Contact form: min submit time not met (likely bot)", { formId: submittedFormId });
    return { ok: true, submissionId: "ignored" };
  }
  const form = await getFixedFormDefinition(ctx);
  const maxMessageLength = await ctx.kv.get("settings:maxMessageLength") ?? 5e3;
  const result = validateSubmissionPayload(form, payload, maxMessageLength);
  if (!result.ok) {
    return { ok: false, error: "validation_error", fields: result.fields };
  }
  const id = generateId("sub");
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const submission = {
    formId: FIXED_FORM_ID,
    formTitle: form.title,
    pageId: payload.pageId,
    pageSlug: payload.pageSlug,
    fields: payload.fields,
    status: "new",
    submittedAt: now,
    meta: {
      ip,
      userAgent: payload.meta?.userAgent?.slice(0, 500),
      referrer: payload.meta?.referrer?.slice(0, 500)
    }
  };
  try {
    await ctx.storage["submissions"].put(id, submission);
  } catch (err) {
    ctx.log.error("Contact form: failed to save submission", { error: String(err) });
    return { ok: false, error: "server_error" };
  }
  return { ok: true, submissionId: id };
}

// src/routes/submissions.ts
async function handleSubmissions(routeCtx, ctx) {
  if (routeCtx.request.method !== "GET") {
    return { ok: false, error: "method_not_allowed" };
  }
  const url = new URL(routeCtx.request.url);
  const status = url.searchParams.get("status") ?? void 0;
  const formId = url.searchParams.get("formId") ?? void 0;
  const rawLimit = parseInt(url.searchParams.get("limit") ?? "50", 10);
  const limit = Math.min(Math.max(1, isNaN(rawLimit) ? 50 : rawLimit), 100);
  const cursor = url.searchParams.get("cursor") ?? void 0;
  const query = {
    orderBy: { submittedAt: "desc" },
    limit,
    ...cursor ? { cursor } : {}
  };
  if (status) query["where"] = { status };
  else if (formId) query["where"] = { formId };
  const result = await ctx.storage["submissions"].query(query);
  const items = result.items.filter((i) => i.data.status !== "deleted").map((i) => ({
    id: i.id,
    status: i.data.status,
    submittedAt: i.data.submittedAt,
    formId: i.data.formId,
    formTitle: i.data.formTitle,
    pageSlug: i.data.pageSlug,
    fields: i.data.fields
  }));
  return { ok: true, items, cursor: result.cursor, hasMore: result.hasMore };
}

// src/routes/submission.ts
async function handleSubmission(routeCtx, ctx) {
  const request = routeCtx.request;
  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) {
    return { ok: false, error: "id_required" };
  }
  const method = request.method.toUpperCase();
  if (method === "GET") {
    const data = await ctx.storage["submissions"].get(id);
    if (!data || data.status === "deleted") {
      return { ok: false, error: "not_found" };
    }
    return { ok: true, id, ...data };
  }
  if (method === "POST") {
    let body;
    try {
      body = await request.json();
    } catch {
      return { ok: false, error: "invalid_json" };
    }
    const allowed = ["new", "read", "archived", "deleted"];
    if (!body.status || !allowed.includes(body.status)) {
      return {
        ok: false,
        error: "invalid_status",
        message: `status must be one of: ${allowed.join(", ")}`
      };
    }
    const data = await ctx.storage["submissions"].get(id);
    if (!data) {
      return { ok: false, error: "not_found" };
    }
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const newStatus = body.status;
    const updated = {
      ...data,
      status: newStatus,
      ...newStatus === "read" && !data.readAt ? { readAt: now } : {},
      ...newStatus === "archived" ? { archivedAt: now } : {},
      ...newStatus === "deleted" ? { deletedAt: now } : {}
    };
    await ctx.storage["submissions"].put(id, updated);
    return { ok: true, id, status: newStatus };
  }
  if (method === "DELETE") {
    const data = await ctx.storage["submissions"].get(id);
    if (!data) {
      return { ok: false, error: "not_found" };
    }
    await ctx.storage["submissions"].put(id, {
      ...data,
      status: "deleted",
      deletedAt: (/* @__PURE__ */ new Date()).toISOString()
    });
    return { ok: true, deleted: id };
  }
  return { ok: false, error: "method_not_allowed" };
}

// src/routes/form-config.ts
async function handleFormConfig(routeCtx, ctx) {
  if (routeCtx.request.method !== "GET") {
    return { error: "method_not_allowed" };
  }
  const form = await getFixedFormDefinition(ctx);
  return {
    id: form.id,
    slug: form.slug,
    title: form.title,
    description: form.description ?? "",
    fields: form.fields,
    submitLabel: form.submitLabel ?? "Send Message",
    successMessage: form.successMessage,
    privacyNote: form.privacyNote ?? ""
  };
}

// src/routes/loader.ts
var LOADER_CSS = `
.cf-wrapper{max-width:560px;font-family:system-ui,-apple-system,sans-serif;color:inherit}
.cf-desc{color:#666;margin:0 0 1rem}
.cf-form{display:flex;flex-direction:column;gap:1rem}
.cf-field{display:flex;flex-direction:column;gap:.25rem}
.cf-field--check{flex-direction:row;align-items:center;gap:.5rem}
.cf-label{font-weight:500;font-size:.9rem}
.cf-required{color:#c00}
.cf-help{font-size:.8rem;color:#666}
.cf-input{padding:.5rem .75rem;border:1px solid #ccc;border-radius:6px;font-size:1rem;width:100%;box-sizing:border-box;font-family:inherit;color:inherit;background:transparent}
.cf-input:focus{outline:2px solid #0070f3;border-color:#0070f3}
textarea.cf-input{min-height:120px;resize:vertical}
.cf-btn{padding:.6rem 1.4rem;background:#0070f3;color:#fff;border:none;border-radius:6px;font-size:1rem;cursor:pointer;align-self:flex-start;font-family:inherit}
.cf-btn:disabled{opacity:.6;cursor:not-allowed}
.cf-error-summary{padding:.75rem;background:#fff0f0;border:1px solid #f99;border-radius:6px;font-size:.9rem;color:#c00;white-space:pre-wrap}
.cf-success{padding:1rem;background:#f0fff4;border:1px solid #6dcc7e;border-radius:6px;color:#1a6b2e}
.cf-privacy{font-size:.8rem;color:#777;margin-top:.25rem}
.cf-error{padding:.75rem;color:#c00}
`.trim();
var LOADER_JS = `(function(){
if(window.__emdashContactFormInit)return;window.__emdashContactFormInit=true;
var SUBMIT_URL="/_emdash/api/plugins/contact-form/submit";
var CONFIG_URL="/_emdash/api/plugins/contact-form/form-config";
var CSS=${JSON.stringify(LOADER_CSS)};

function unwrapApiPayload(json){
  if(json&&typeof json==="object"&&json.data&&typeof json.data==="object"){
    return json.data;
  }
  return json;
}

function injectStyles(){
  if(document.getElementById("cf-styles"))return;
  var s=document.createElement("style");s.id="cf-styles";s.textContent=CSS;
  document.head.appendChild(s);
}

function escHtml(str){
  var d=document.createElement("div");
  d.textContent=str==null?"":String(str);
  return d.innerHTML;
}

function buildField(f){
  var id="cf-"+f.name+"-"+Math.random().toString(36).slice(2,7);
  var req=f.required?" required":"";
  var help=f.helpText?'<span class="cf-help">'+escHtml(f.helpText)+'</span>':"";
  var label='<label class="cf-label" for="'+id+'">'+escHtml(f.label)+(f.required?' <span class="cf-required">*</span>':'')+'</label>';
  if(f.type==="textarea"){
    return '<div class="cf-field">'+label+help+'<textarea id="'+id+'" name="'+escHtml(f.name)+'" placeholder="'+escHtml(f.placeholder||"")+'" maxlength="'+(f.maxLength||5000)+'" class="cf-input"'+req+'></textarea></div>';
  }
  if(f.type==="select"&&Array.isArray(f.options)){
    var opts='<option value="">Select\u2026</option>';
    f.options.forEach(function(o){opts+='<option value="'+escHtml(o.value)+'">'+escHtml(o.label)+'</option>';});
    return '<div class="cf-field">'+label+help+'<select id="'+id+'" name="'+escHtml(f.name)+'" class="cf-input"'+req+'>'+opts+'</select></div>';
  }
  if(f.type==="checkbox"){
    return '<div class="cf-field cf-field--check"><input type="checkbox" id="'+id+'" name="'+escHtml(f.name)+'" value="true" class="cf-checkbox"'+req+'>'+label+help+'</div>';
  }
  if(f.type==="hidden"){
    return '<input type="hidden" name="'+escHtml(f.name)+'" value="'+escHtml(f.defaultValue||"")+'">';
  }
  // text, email, phone (plus any unknown type fallback)
  var inputType=f.type==="phone"?"tel":(f.type==="email"?"email":"text");
  return '<div class="cf-field">'+label+help+'<input type="'+inputType+'" id="'+id+'" name="'+escHtml(f.name)+'" placeholder="'+escHtml(f.placeholder||"")+'" class="cf-input"'+req+'></div>';
}

function renderForm(container,config){
  var fieldsHtml=(config.fields||[]).map(buildField).join("");
  container.innerHTML=
    '<div class="cf-wrapper">'+
      (config.title?'<h3 style="margin:0 0 .5rem">'+escHtml(config.title)+'</h3>':"")+
      (config.description?'<p class="cf-desc">'+escHtml(config.description)+'</p>':"")+
      '<form class="cf-form" novalidate>'+
        fieldsHtml+
        '<input type="text" name="_hp" tabindex="-1" aria-hidden="true" autocomplete="off" style="position:absolute;left:-9999px;height:0;width:0;overflow:hidden">'+
        '<input type="hidden" name="_submitTime">'+
        '<div class="cf-error-summary" role="alert" style="display:none"></div>'+
        '<button type="submit" class="cf-btn">'+escHtml(config.submitLabel||"Send Message")+'</button>'+
        (config.privacyNote?'<p class="cf-privacy">'+escHtml(config.privacyNote)+'</p>':"")+
      '</form>'+
      '<div class="cf-success" style="display:none" role="status">'+escHtml(config.successMessage||"Thank you!")+'</div>'+
    '</div>';

  var form=container.querySelector(".cf-form");
  var success=container.querySelector(".cf-success");
  var errEl=container.querySelector(".cf-error-summary");
  var btn=container.querySelector(".cf-btn");
  var stEl=container.querySelector('input[name="_submitTime"]');
  if(stEl)stEl.value=String(Date.now());
  var origLabel=btn.textContent;

  form.addEventListener("submit",function(e){
    e.preventDefault();
    errEl.style.display="none";
    btn.disabled=true;btn.textContent="Sending\u2026";
    var data={};
    var fd=new FormData(form);
    fd.forEach(function(v,k){data[k]=v;});
    var honeypot=data._hp||"";
    var submitTime=parseInt(data._submitTime||"0",10);
    delete data._hp;delete data._submitTime;

    var payload={
      formId:config.id,
      pageSlug:window.location.pathname,
      fields:data,
      honeypot:honeypot,
      _submitTime:submitTime,
      meta:{userAgent:navigator.userAgent,referrer:document.referrer}
    };

    fetch(SUBMIT_URL,{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify(payload)
    }).then(function(r){return r.json();}).then(function(json){
      json=unwrapApiPayload(json);
      if(json.ok){
        form.style.display="none";
        success.style.display="block";
      }else if(json.error==="validation_error"&&json.fields){
        errEl.textContent=Object.values(json.fields).join("\\n");
        errEl.style.display="block";
        btn.disabled=false;btn.textContent=origLabel;
      }else if(json.error==="rate_limited"){
        errEl.textContent=json.message||"Too many submissions. Please wait a moment.";
        errEl.style.display="block";
        btn.disabled=false;btn.textContent=origLabel;
      }else{
        errEl.textContent="Something went wrong. Please try again.";
        errEl.style.display="block";
        btn.disabled=false;btn.textContent=origLabel;
      }
    }).catch(function(){
      errEl.textContent="Network error. Please try again.";
      errEl.style.display="block";
      btn.disabled=false;btn.textContent=origLabel;
    });
  });
}

function hydrate(el){
  var formId=el.getAttribute("data-contact-form");
  var slug=el.getAttribute("data-form-slug");
  if(!formId&&!slug)return;
  if(el.dataset.cfReady)return;
  el.dataset.cfReady="true";
  el.innerHTML='<p style="color:#999">Loading form\u2026</p>';

  var qs=formId?"id="+encodeURIComponent(formId):"slug="+encodeURIComponent(slug);
  fetch(CONFIG_URL+"?"+qs).then(function(r){
    if(!r.ok)throw new Error("not_found");
    return r.json();
  }).then(function(config){
    config=unwrapApiPayload(config);
    renderForm(el,config);
  }).catch(function(){
    el.innerHTML='<p class="cf-error">Contact form unavailable.</p>';
  });
}

function init(){
  injectStyles();
  var nodes=document.querySelectorAll("[data-contact-form],[data-form-slug]");
  for(var i=0;i<nodes.length;i++)hydrate(nodes[i]);

  // Watch for forms inserted dynamically (e.g. by SPA navigation).
  if(typeof MutationObserver!=="undefined"){
    var mo=new MutationObserver(function(muts){
      muts.forEach(function(m){
        m.addedNodes.forEach(function(n){
          if(n.nodeType!==1)return;
          if(n.matches&&n.matches("[data-contact-form],[data-form-slug]"))hydrate(n);
          if(n.querySelectorAll){
            n.querySelectorAll("[data-contact-form],[data-form-slug]").forEach(hydrate);
          }
        });
      });
    });
    mo.observe(document.body,{childList:true,subtree:true});
  }
}

if(document.readyState==="loading"){
  document.addEventListener("DOMContentLoaded",init);
}else{
  init();
}
})();`;

// src/sandbox-entry.ts
function createPlugin(_options = {}) {
  return definePlugin({
    // ─────────────────────────────────────────────────────────────────────
    // Native-format identity fields (required so definePlugin returns a
    // ResolvedPlugin rather than a StandardPluginDefinition).
    // ─────────────────────────────────────────────────────────────────────
    id: "contact-form",
    version: "0.2.0",
    capabilities: ["hooks.page-fragments:register"],
    storage: {
      submissions: { indexes: ["submittedAt", "formId", "status"] }
    },
    // ─────────────────────────────────────────────────────────────────────
    // Hooks
    // ─────────────────────────────────────────────────────────────────────
    hooks: {
      "plugin:install": {
        handler: async (_event, ctx) => {
          const defaults = {
            "settings:requireHoneypot": true,
            "settings:maxMessageLength": 5e3,
            "settings:retentionDays": 0,
            "settings:successMessage": DEFAULT_SUCCESS_MESSAGE,
            "settings:privacyNote": ""
          };
          for (const [key, value] of Object.entries(defaults)) {
            const existing = await ctx.kv.get(key);
            if (existing === null) await ctx.kv.set(key, value);
          }
          ctx.log.info("Contact Form plugin installed");
        }
      },
      "plugin:activate": {
        handler: async (_event, ctx) => {
          if (ctx.cron) {
            await ctx.cron.schedule("retention-purge", { schedule: "0 2 * * *" });
          }
        }
      },
      "plugin:uninstall": {
        handler: async (event, ctx) => {
          if (!event.deleteData) return;
          const subResult = await ctx.storage["submissions"].query({ limit: 1e3 });
          await ctx.storage["submissions"].deleteMany(
            subResult.items.map((i) => i.id)
          );
        }
      },
      // Auto-inject the loader script into every public page that uses
      // <EmDashHead />. We inline the JS directly rather than using
      // `external-script` because EmDash's plugin route wrapper coerces all
      // route responses to JSON (`{"data": ...}`), so a plain JS file can't
      // be served from a plugin route. Inlining bypasses that entirely —
      // the JS ships in the HTML head of every public page.
      "page:fragments": {
        handler: async () => {
          return [
            {
              kind: "inline-script",
              placement: "head",
              code: LOADER_JS,
              key: "contact-form-loader"
            }
          ];
        }
      },
      cron: {
        handler: async (event, ctx) => {
          if (event.name !== "retention-purge") return;
          const retentionDays = await ctx.kv.get("settings:retentionDays") ?? 0;
          if (!retentionDays || retentionDays <= 0) return;
          const cutoff = new Date(Date.now() - retentionDays * 864e5).toISOString();
          let cursor;
          let deleted = 0;
          do {
            const result = await ctx.storage["submissions"].query({
              orderBy: { submittedAt: "asc" },
              limit: 200,
              ...cursor ? { cursor } : {}
            });
            const toDelete = result.items.filter((i) => i.data.submittedAt < cutoff).map((i) => i.id);
            if (toDelete.length > 0) {
              await ctx.storage["submissions"].deleteMany(toDelete);
              deleted += toDelete.length;
            }
            cursor = result.hasMore && result.items.length > 0 ? result.cursor : void 0;
          } while (cursor);
          ctx.log.info(
            `Contact Form retention purge: deleted ${deleted} submissions older than ${retentionDays} days`
          );
        }
      }
    },
    // ─────────────────────────────────────────────────────────────────────
    // Admin — sidebar pages, dashboard widget, Portable Text block,
    // and the auto-generated settings schema.
    // ─────────────────────────────────────────────────────────────────────
    admin: {
      pages: [
        { path: "/submissions", label: "Form Submissions", icon: "list" },
        { path: "/settings", label: "Form Settings", icon: "settings" }
      ],
      widgets: [
        { id: "recent-submissions", title: "Recent Submissions", size: "half" }
      ],
      portableTextBlocks: [
        {
          // EmDash always shows an insert modal — declaring a custom `fields`
          // array overrides the default URL input. We can't suppress the
          // modal entirely, so we pre-fill it: the user just clicks Insert.
          // Whatever value lands on the block is ignored by ContactForm.astro
          // anyway (single-form plugin — slug is always "contact").
          type: "contactForm",
          label: "Contact Form",
          icon: "code",
          description: "Insert your contact form",
          category: "Forms",
          placeholder: "Contact form",
          fields: [
            {
              type: "text_input",
              action_id: "id",
              label: "Just click Insert \u2014 there's only one form",
              placeholder: "contact",
              initial_value: "contact"
            }
          ]
        }
      ],
      settingsSchema: {
        successMessage: {
          type: "string",
          label: "Default Success Message",
          multiline: true,
          default: DEFAULT_SUCCESS_MESSAGE
        },
        requireHoneypot: {
          type: "boolean",
          label: "Enable Honeypot Spam Protection",
          default: true
        },
        maxMessageLength: {
          type: "number",
          label: "Max Message Length (characters)",
          min: 100,
          max: 5e4,
          default: 5e3
        },
        retentionDays: {
          type: "number",
          label: "Data Retention (days)",
          description: "Auto-delete submissions older than this many days. Set to 0 to disable.",
          min: 0,
          default: 0
        },
        privacyNote: {
          type: "string",
          label: "Default Privacy Note",
          description: "Shown below all forms unless overridden per-form.",
          multiline: true,
          default: ""
        }
      }
    },
    // ─────────────────────────────────────────────────────────────────────
    // Routes
    // ─────────────────────────────────────────────────────────────────────
    routes: {
      // ── Public ────────────────────────────────────────────────────────
      // Visitor form submission.
      submit: {
        public: true,
        handler: async (routeCtx) => handleSubmit(routeCtx, routeCtx)
      },
      // Public form configuration (consumed by the inlined loader script).
      "form-config": {
        public: true,
        handler: async (routeCtx) => handleFormConfig(routeCtx, routeCtx)
      },
      // (No `loader.js` route — the script is inlined into every public
      //  page via the page:fragments hook above. EmDash's plugin route
      //  wrapper coerces responses to JSON, so a JS file can't be served.)
      // ── Admin (auto-protected by EmDash session middleware) ───────────
      // REST endpoints for external integrations (webhooks, scripts, CLI
      // tooling). Not used by the in-admin UI — those flow through the
      // `admin` route below.
      submissions: {
        handler: async (routeCtx) => handleSubmissions(routeCtx, routeCtx)
      },
      submission: {
        handler: async (routeCtx) => handleSubmission(routeCtx, routeCtx)
      },
      // (No `submissions/export` route — CSV is generated inline in the
      //  admin view as a data: URI link. Avoids EmDash's body-stripping.)
      // Block Kit dispatcher — every admin UI interaction routes through
      // this single endpoint. The dispatcher in admin/index.ts decodes the
      // interaction and renders the appropriate response.
      admin: {
        handler: async (routeCtx) => {
          let interaction;
          try {
            interaction = await routeCtx.request.json();
          } catch {
            interaction = routeCtx.input ?? {};
          }
          return handleAdminInteraction(interaction, routeCtx);
        }
      }
    }
  });
}
var sandbox_entry_default = createPlugin;
export {
  createPlugin,
  sandbox_entry_default as default
};
