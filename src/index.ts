import type { PluginDescriptor } from "emdash";
import type { ContactFormPluginOptions } from "./types.js";

export type { ContactFormPluginOptions };

export function contactFormPlugin(options: ContactFormPluginOptions = {}): PluginDescriptor {
  return {
    id: "contact-form",
    version: "0.1.0",
    // Native format — required to ship Astro components and Portable Text blocks.
    // (Standard format runs in V8 isolates on Cloudflare; native runs in-host.)
    format: "native",
    entrypoint: "@incsub/emdash-contact-form/sandbox",
    componentsEntry: "@incsub/emdash-contact-form/astro",
    options,
    // Note: capabilities, storage, admin pages/widgets are declared inside
    // createPlugin() in sandbox-entry.ts (the source of truth for native format).
  };
}
