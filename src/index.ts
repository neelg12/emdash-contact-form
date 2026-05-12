import type { PluginDescriptor } from "emdash";
import type { ContactFormPluginOptions } from "./types.js";

export type { ContactFormPluginOptions };

/**
 * Build the EmDash plugin descriptor for the contact form.
 *
 * Add to your `astro.config.mjs`:
 *
 * ```ts
 * import { contactFormPlugin } from "@incsub/emdash-contact-form";
 *
 * emdash({
 *   plugins: [contactFormPlugin()],
 * });
 * ```
 *
 * Options are forwarded to `createPlugin` at runtime. They're informational
 * for v0.2 — runtime behaviour is controlled by KV settings editable in the
 * admin Form Settings page.
 */
export function contactFormPlugin(
  options: ContactFormPluginOptions = {},
): PluginDescriptor<ContactFormPluginOptions> {
  return {
    id: "contact-form",
    version: "0.2.1",
    // Native format — required to ship Astro components and Portable Text
    // blocks. (Standard format runs in V8 isolates on Cloudflare; native
    // runs in-host.)
    format: "native",
    entrypoint: "@incsub/emdash-contact-form/sandbox",
    componentsEntry: "@incsub/emdash-contact-form/astro",
    options,
    // Note: capabilities, storage, admin pages/widgets are declared inside
    // createPlugin() in sandbox-entry.ts (the source of truth for native).
  };
}
