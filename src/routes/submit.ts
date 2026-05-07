import type { PluginContext } from "emdash";
import type { ContactFormSubmission, SubmitPayload } from "../types.js";
import { generateId } from "../types.js";
import { FIXED_FORM_ID, getFixedFormDefinition } from "../fixed-form.js";
import {
  checkRateLimit,
  checkHoneypot,
  checkMinSubmitTime,
  validateSubmissionPayload,
  getClientIp,
} from "../validation.js";

// Maximum accepted body size in bytes. 64 KB is far more than a typical
// submission needs and small enough that bots can't trivially exhaust memory.
const MAX_BODY_BYTES = 64 * 1024;

// IMPORTANT: Always return plain objects, never `new Response(...)`.
// EmDash's plugin route wrapper drops Response bodies (it serializes the
// Response object itself, not its body). Plain returns get auto-wrapped into
// `{"data": <plain object>}` which the loader handles via `unwrapApiPayload`.
// Status codes are not configurable through this path; the loader checks
// `json.ok` and `json.error` to decide what UI to show.
export async function handleSubmit(routeCtx: any, ctx: PluginContext): Promise<unknown> {
  const request: Request = routeCtx.request;

  // Enforce JSON content-type.
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return { ok: false, error: "invalid_content_type" };
  }

  // Size guard: reject obviously oversized bodies before parsing.
  const contentLength = parseInt(request.headers.get("content-length") ?? "0", 10);
  if (contentLength > MAX_BODY_BYTES) {
    return { ok: false, error: "payload_too_large" };
  }

  // Origin check — only accept submissions from the same site that served the
  // page. Loader uses same-origin fetch, so legitimate clients always send a
  // matching Origin (or none, e.g. older browsers). We only reject when an
  // Origin is present AND it doesn't match the host. Missing Origin is
  // allowed to keep server-to-server tests working.
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
      // Malformed Origin — reject.
      return { ok: false, error: "forbidden_origin" };
    }
  }

  const pluginParsedInput =
    routeCtx.input && typeof routeCtx.input === "object" && !Array.isArray(routeCtx.input)
      ? (routeCtx.input as SubmitPayload)
      : undefined;

  let payload: SubmitPayload | undefined = pluginParsedInput;
  if (!payload && !request.bodyUsed) {
    try {
      payload = (await request.clone().json()) as SubmitPayload;
    } catch {
      payload = undefined;
    }
  }

  if (!payload) {
    return { ok: false, error: "invalid_json" };
  }

  if (!payload.fields || typeof payload.fields !== "object" || Array.isArray(payload.fields)) {
    return { ok: false, error: "validation_error", fields: { _form: "Invalid payload." } };
  }

  const submittedFormId =
    typeof payload.formId === "string" && payload.formId.trim() ? payload.formId.trim() : FIXED_FORM_ID;

  // Rate limit. checkRateLimit handles unidentified clients via a global
  // fallback counter so direct-IP deployments still have a backstop.
  const ip = getClientIp(request);
  if (!checkRateLimit(ip)) {
    return {
      ok: false,
      error: "rate_limited",
      message: "Too many submissions. Please wait a moment.",
    };
  }

  // Spam protection.
  const requireHoneypot = (await ctx.kv.get<boolean>("settings:requireHoneypot")) ?? true;
  if (requireHoneypot && !checkHoneypot(payload)) {
    // Return ok:true to not reveal detection to bots.
    ctx.log.info("Contact form: honeypot triggered", { formId: submittedFormId });
    return { ok: true, submissionId: "ignored" };
  }

  if (!checkMinSubmitTime(payload)) {
    ctx.log.info("Contact form: min submit time not met (likely bot)", { formId: submittedFormId });
    return { ok: true, submissionId: "ignored" };
  }

  // Load the built-in form definition.
  const form = await getFixedFormDefinition(ctx);

  // Validate fields.
  const maxMessageLength = (await ctx.kv.get<number>("settings:maxMessageLength")) ?? 5000;
  const result = validateSubmissionPayload(form, payload, maxMessageLength);

  if (!result.ok) {
    return { ok: false, error: "validation_error", fields: result.fields };
  }

  // Build and store submission.
  const id = generateId("sub");
  const now = new Date().toISOString();

  const submission: ContactFormSubmission = {
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
      referrer: payload.meta?.referrer?.slice(0, 500),
    },
  };

  try {
    await (ctx.storage["submissions"] as any).put(id, submission);
  } catch (err) {
    ctx.log.error("Contact form: failed to save submission", { error: String(err) });
    return { ok: false, error: "server_error" };
  }

  return { ok: true, submissionId: id };
}
