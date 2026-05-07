import type { ContactFormField, FormDefinition, SubmitPayload, ValidationResult } from "./types.js";

// ---------------------------------------------------------------------------
// Rate limiter — in-memory per-IP sliding window.
// NOTE: This is a best-effort limiter for a single process. In production,
// enforce stronger limits at the edge (Nginx, CDN) or use a shared store.
// ---------------------------------------------------------------------------

interface RateEntry {
  count: number;
  windowStart: number;
}

const rateMap = new Map<string, RateEntry>();
const RATE_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_PER_IP = 5;

// Global fallback when we can't identify the client (no x-forwarded-for, no
// x-real-ip). Without this, sites without a reverse proxy bypass rate limiting
// entirely. The cap is generous so legitimate visitors aren't blocked, but it
// prevents a single misconfigured host from being spammed unboundedly.
const RATE_LIMIT_GLOBAL = 60;
const GLOBAL_KEY = "__global__";

// `ip` is optional. Pass `undefined` when the request had no identifiable
// origin and we should fall back to the global counter.
export function checkRateLimit(ip: string | undefined): boolean {
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

// Clean up old entries periodically to avoid memory growth.
setInterval(
  () => {
    const cutoff = Date.now() - RATE_WINDOW_MS;
    for (const [key, entry] of rateMap) {
      if (entry.windowStart < cutoff) rateMap.delete(key);
    }
  },
  5 * 60 * 1000,
);

// ---------------------------------------------------------------------------
// Honeypot + minimum submit time
// ---------------------------------------------------------------------------

const MIN_SUBMIT_MS = 2000;

export function checkHoneypot(payload: SubmitPayload): boolean {
  return (payload.honeypot ?? "") === "";
}

export function checkMinSubmitTime(payload: SubmitPayload): boolean {
  if (!payload._submitTime) return true;
  return Date.now() - payload._submitTime >= MIN_SUBMIT_MS;
}

// ---------------------------------------------------------------------------
// Field + payload validation
// ---------------------------------------------------------------------------

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[\d\s\+\-\(\)]{7,20}$/;

function validateEmail(value: string): boolean {
  return EMAIL_RE.test(value.trim());
}

function validateFieldValue(
  field: ContactFormField,
  rawValue: unknown,
  maxMessageLength: number,
): string | null {
  const strVal = rawValue !== null && rawValue !== undefined ? String(rawValue).trim() : "";

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
      // Default to maxMessageLength for text fields too — prevents unbounded
      // input on fields where the form author forgot to set maxLength.
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
      // Allow "true"/"false"/"on"/"off" or boolean
      break;

    case "hidden":
      break;
  }

  return null;
}

export function validateSubmissionPayload(
  form: FormDefinition,
  payload: SubmitPayload,
  maxMessageLength: number,
): ValidationResult {
  const errors: Record<string, string> = {};

  for (const field of form.fields) {
    if (field.type === "hidden") continue;

    const rawValue = payload.fields[field.name];
    const err = validateFieldValue(field, rawValue, maxMessageLength);
    if (err) errors[field.name] = err;
  }

  return { ok: Object.keys(errors).length === 0, fields: errors };
}

export function getClientIp(request: Request): string | undefined {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    undefined
  );
}
