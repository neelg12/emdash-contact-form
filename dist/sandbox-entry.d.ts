import * as emdash from 'emdash';
import { C as ContactFormPluginOptions } from './types-rT5fLnUO.js';

/**
 * Build the contact-form plugin. Called by EmDash at runtime via:
 *   import { createPlugin } from "@incsub/emdash-contact-form/sandbox";
 *   createPlugin(descriptor.options);
 *
 * Options are forwarded from `contactFormPlugin(options)` in the consumer's
 * astro.config.mjs. Currently informational only — runtime behaviour is
 * controlled by KV settings editable in the admin UI.
 */
declare function createPlugin(_options?: ContactFormPluginOptions): emdash.ResolvedPlugin<{
    submissions: {
        indexes: string[];
    };
}>;

export { createPlugin, createPlugin as default };
