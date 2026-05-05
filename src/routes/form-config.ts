import type { PluginContext } from "emdash";
import { getFixedFormDefinition } from "../fixed-form.js";

// PUBLIC. GET /_emdash/api/plugins/contact-form/form-config?id=<formId>
// or  ?slug=<slug>
//
// Returns the visitor-facing fields needed to render a form.
// Sensitive admin-only metadata (createdAt, updatedAt) is omitted.
export async function handleFormConfig(routeCtx: any, ctx: PluginContext): Promise<unknown> {
  if (routeCtx.request.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  const form = await getFixedFormDefinition(ctx);

  // Public projection — only what the visitor's browser needs to render the form.
  const publicConfig = {
    id: form.id,
    slug: form.slug,
    title: form.title,
    description: form.description ?? "",
    fields: form.fields,
    submitLabel: form.submitLabel ?? "Send Message",
    successMessage: form.successMessage,
    privacyNote: form.privacyNote ?? "",
  };

  return new Response(JSON.stringify(publicConfig), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=60",
    },
  });
}
