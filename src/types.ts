export type FieldType = "text" | "email" | "phone" | "textarea" | "select" | "checkbox" | "hidden";

export interface FieldOption {
  value: string;
  label: string;
}

export interface ContactFormField {
  type: FieldType;
  name: string;
  label: string;
  required?: boolean;
  placeholder?: string;
  helpText?: string;
  defaultValue?: string | boolean;
  options?: FieldOption[];
  maxLength?: number;
}

export interface FormDefinition {
  id: string;
  slug: string;
  title: string;
  description?: string;
  successMessage?: string;
  submitLabel?: string;
  privacyNote?: string;
  fields: ContactFormField[];
  createdAt: string;
  updatedAt: string;
}

export interface ContactFormSubmission {
  formId: string;
  formTitle?: string;
  pageId?: string;
  pageSlug?: string;
  fields: Record<string, unknown>;
  /** "deleted" is used for soft-delete; not shown in default UI */
  status: "new" | "read" | "archived" | "deleted";
  submittedAt: string;
  readAt?: string;
  archivedAt?: string;
  deletedAt?: string;
  meta: {
    ip?: string;
    userAgent?: string;
    referrer?: string;
  };
}

export interface ContactFormPluginOptions {
  requireHoneypot?: boolean;
  maxMessageLength?: number;
  retentionDays?: number | null;
}

export interface SubmitPayload {
  formId: string;
  pageId?: string;
  pageSlug?: string;
  fields: Record<string, unknown>;
  meta?: {
    userAgent?: string;
    referrer?: string;
  };
  honeypot?: string;
  _submitTime?: number;
}

export interface ValidationResult {
  ok: boolean;
  fields: Record<string, string>;
}

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

export const DEFAULT_SUCCESS_MESSAGE =
  "Thank you for your message! We’ll get back to you soon.";

export function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}
