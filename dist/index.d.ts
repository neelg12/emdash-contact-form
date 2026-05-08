import { PluginDescriptor } from 'emdash';
import { C as ContactFormPluginOptions } from './types-rT5fLnUO.js';

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
declare function contactFormPlugin(options?: ContactFormPluginOptions): PluginDescriptor<ContactFormPluginOptions>;

export { ContactFormPluginOptions, contactFormPlugin };
