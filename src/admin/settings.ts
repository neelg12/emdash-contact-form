import type { PluginContext } from "emdash";
import { DEFAULT_SUCCESS_MESSAGE } from "../types.js";
import {
  header, context, divider, type Block,
} from "./render.js";

interface BlockResponse {
  blocks: Block[];
  toast?: { message: string; type: "success" | "error" | "info" };
}

interface CurrentSettings {
  successMessage: string;
  requireHoneypot: boolean;
  maxMessageLength: number;
  retentionDays: number;
  privacyNote: string;
}

async function readSettings(ctx: PluginContext): Promise<CurrentSettings> {
  const [successMessage, requireHoneypot, maxMessageLength, retentionDays, privacyNote] =
    await Promise.all([
      ctx.kv.get<string>("settings:successMessage"),
      ctx.kv.get<boolean>("settings:requireHoneypot"),
      ctx.kv.get<number>("settings:maxMessageLength"),
      ctx.kv.get<number>("settings:retentionDays"),
      ctx.kv.get<string>("settings:privacyNote"),
    ]);

  return {
    successMessage: successMessage ?? DEFAULT_SUCCESS_MESSAGE,
    requireHoneypot: requireHoneypot ?? true,
    maxMessageLength: maxMessageLength ?? 5000,
    retentionDays: retentionDays ?? 0,
    privacyNote: privacyNote ?? "",
  };
}

// Render the settings page.
export async function buildSettings(
  ctx: PluginContext,
  toast?: { message: string; type: "success" | "error" | "info" },
): Promise<BlockResponse> {
  const s = await readSettings(ctx);

  const yesNoOptions = [
    { label: "Yes", text: "Yes", value: "true" },
    { label: "No", text: "No", value: "false" },
  ];

  const blocks: Block[] = [
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
          initial_value: s.successMessage,
        },
        {
          type: "text_input",
          action_id: "privacyNote",
          label: "Privacy note",
          placeholder: "Shown below the form (e.g. how you handle their data)",
          multiline: true,
          initial_value: s.privacyNote,
        },
        {
          type: "select",
          action_id: "requireHoneypot",
          label: "Spam protection (honeypot)",
          options: yesNoOptions,
          initial_value: s.requireHoneypot ? "true" : "false",
        },
        {
          type: "text_input",
          action_id: "maxMessageLength",
          label: "Max message length (characters)",
          placeholder: "5000",
          initial_value: String(s.maxMessageLength),
        },
        {
          type: "text_input",
          action_id: "retentionDays",
          label: "Auto-delete submissions after (days, 0 = never)",
          placeholder: "0",
          initial_value: String(s.retentionDays),
        },
      ],
      submit: { label: "Save settings", action_id: "save_settings" },
    },
  ];

  return { blocks, ...(toast ? { toast } : {}) };
}

// Persist settings submitted from the form. Coerces and validates input;
// invalid values fall back to current values rather than crashing.
export async function handleSaveSettings(
  values: Record<string, string> | undefined,
  ctx: PluginContext,
): Promise<BlockResponse> {
  const v = values ?? {};
  const current = await readSettings(ctx);

  const successMessage =
    typeof v.successMessage === "string" && v.successMessage.trim()
      ? v.successMessage
      : current.successMessage;

  const privacyNote = typeof v.privacyNote === "string" ? v.privacyNote : current.privacyNote;

  const requireHoneypot = v.requireHoneypot === "true";

  const maxRaw = parseInt(v.maxMessageLength ?? "", 10);
  const maxMessageLength = Number.isFinite(maxRaw)
    ? Math.min(50000, Math.max(100, maxRaw))
    : current.maxMessageLength;

  const retRaw = parseInt(v.retentionDays ?? "", 10);
  const retentionDays = Number.isFinite(retRaw) && retRaw >= 0 ? retRaw : current.retentionDays;

  await Promise.all([
    ctx.kv.set("settings:successMessage", successMessage),
    ctx.kv.set("settings:privacyNote", privacyNote),
    ctx.kv.set("settings:requireHoneypot", requireHoneypot),
    ctx.kv.set("settings:maxMessageLength", maxMessageLength),
    ctx.kv.set("settings:retentionDays", retentionDays),
  ]);

  ctx.log.info("Contact form settings updated", {
    requireHoneypot,
    maxMessageLength,
    retentionDays,
  });

  return buildSettings(ctx, { message: "Settings saved.", type: "success" });
}
