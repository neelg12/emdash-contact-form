import type { PluginContext } from "emdash";
import type { FormDefinition } from "./types.js";
import { DEFAULT_FIELDS, DEFAULT_SUCCESS_MESSAGE } from "./types.js";

export const FIXED_FORM_ID = "contact";
export const FIXED_FORM_SLUG = "contact";
export const FIXED_FORM_TITLE = "Contact Us";

export async function getFixedFormDefinition(ctx: PluginContext): Promise<FormDefinition> {
  const successMessage =
    (await ctx.kv.get<string>("settings:successMessage")) ?? DEFAULT_SUCCESS_MESSAGE;
  const privacyNote = (await ctx.kv.get<string>("settings:privacyNote")) ?? "";

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
    updatedAt: "",
  };
}
