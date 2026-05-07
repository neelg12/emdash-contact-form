/**
 * Public types for `@incsub/emdash-contact-form`.
 *
 * Re-exported from the package root so consumers can import them via:
 *   `import type { ContactFormPluginOptions } from "@incsub/emdash-contact-form";`
 */

/** Field input types supported by the contact form. */
export type FieldType =
  | "text"
  | "email"
  | "phone"
  | "textarea"
  | "select"
  | "checkbox"
  | "hidden";

/** A single option in a `select` field. */
export interface FieldOption {
  value: string;
  label: string;
}

/** Definition of one field on the contact form. */
export interface ContactFormField {
  type: FieldType;
  /** Machine name — used as the key in stored submissions. */
  name: string;
  /** Human label rendered above the input. */
  label: string;
  required?: boolean;
  placeholder?: string;
  helpText?: string;
  /** Pre-filled initial value (text fields) or default state (checkbox). */
  defaultValue?: string | boolean;
  /** Required for `select`. Ignored for other field types. */
  options?: FieldOption[];
  /** Character cap. Falls back to the global `maxMessageLength` setting. */
  maxLength?: number;
}

/** A complete form definition. */
export interface FormDefinition {
  id: string;
  slug: string;
  title: string;
  description?: string;
  successMessage?: string;
  submitLabel?: string;
  privacyNote?: string;
  fields: ContactFormField[];
  /** ISO timestamp. May be empty for the built-in fixed form. */
  createdAt: string;
  /** ISO timestamp. May be empty for the built-in fixed form. */
  updatedAt: string;
}

/** A stored submission. */
export interface ContactFormSubmission {
  formId: string;
  formTitle?: string;
  pageId?: string;
  pageSlug?: string;
  /** Raw field values as submitted, keyed by `ContactFormField.name`. */
  fields: Record<string, unknown>;
  /** "deleted" is used for soft-delete; not shown in default UI. */
  status: "new" | "read" | "archived" | "deleted";
  /** ISO timestamp of submission. */
  submittedAt: string;
  readAt?: string;
  archivedAt?: string;
  deletedAt?: string;
  /** Captured request metadata. `ip` may be undefined for direct connections. */
  meta: {
    ip?: string;
    userAgent?: string;
    referrer?: string;
  };
}

/** Options accepted by `contactFormPlugin(options)` in `astro.config.mjs`. */
export interface ContactFormPluginOptions {
  /** Default for the `requireHoneypot` setting on first install. */
  requireHoneypot?: boolean;
  /** Default for `maxMessageLength` on first install. */
  maxMessageLength?: number;
  /** Default for `retentionDays` on first install. `0` / `null` disables. */
  retentionDays?: number | null;
}

/** The JSON body the loader script sends to `/submit`. */
export interface SubmitPayload {
  formId: string;
  pageId?: string;
  pageSlug?: string;
  fields: Record<string, unknown>;
  meta?: {
    userAgent?: string;
    referrer?: string;
  };
  /** Honeypot trap field. Bots fill it; humans don't. */
  honeypot?: string;
  /** Client-side timestamp from when the form rendered. Used to enforce minimum submit time. */
  _submitTime?: number;
}

/** Result of running per-field validation against a `SubmitPayload`. */
export interface ValidationResult {
  ok: boolean;
  /** Field-name → error-message. Empty when `ok` is true. */
  fields: Record<string, string>;
}

/** Hardcoded fields used by the single built-in form. */
export const DEFAULT_FIELDS: ContactFormField[] = [
  { type: "text", name: "name", label: "Name", required: true, placeholder: "Your name" },
  { type: "email", name: "email", label: "Email", required: true, placeholder: "your@email.com" },
  {
    type: "textarea",
    name: "message",
    label: "Message",
    required: true,
    placeholder: "Your message",
    maxLength: 5000,
  },
];

/** Default text shown after a successful submission. */
export const DEFAULT_SUCCESS_MESSAGE =
  "Thank you for your message! We’ll get back to you soon.";

/**
 * Generate a non-cryptographic ID with a human-readable prefix.
 * Used for submission IDs only — not security-sensitive.
 */
export function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}
