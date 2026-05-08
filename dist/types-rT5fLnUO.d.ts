/** Options accepted by `contactFormPlugin(options)` in `astro.config.mjs`. */
interface ContactFormPluginOptions {
    /** Default for the `requireHoneypot` setting on first install. */
    requireHoneypot?: boolean;
    /** Default for `maxMessageLength` on first install. */
    maxMessageLength?: number;
    /** Default for `retentionDays` on first install. `0` / `null` disables. */
    retentionDays?: number | null;
}

export type { ContactFormPluginOptions as C };
