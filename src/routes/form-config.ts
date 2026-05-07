import type { PluginContext } from "emdash";
import { getFixedFormDefinition } from "../fixed-form.js";

// PUBLIC. GET /_emdash/api/plugins/contact-form/form-config
//
// Returns the visitor-facing fields needed to render a form.
//
// IMPORTANT: We return a plain object, NOT a Response. EmDash's plugin route
// wrapper drops Response bodies (it serializes the Response object itself,
// not its body). Plain objects get wrapped automatically into `{"data": ...}`.
// The loader script's `unwrapApiPayload` knows how to peel that envelope.
export async function handleFormConfig(routeCtx: any, ctx: PluginContext): Promise<unknown> {
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
    privacyNote: form.privacyNote ?? "",
  };
}
