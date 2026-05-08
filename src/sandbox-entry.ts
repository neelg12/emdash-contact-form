/**
 * EmDash Contact Form — sandbox entrypoint.
 *
 * EmDash's native plugin loader imports `createPlugin` from this module at
 * runtime and calls it with the plugin descriptor's options. The function
 * returns a fully-resolved plugin definition (hooks, routes, admin config).
 */
import { definePlugin } from "emdash";
import type { PluginContext } from "emdash";
import type { ContactFormPluginOptions } from "./types.js";
import { handleAdminInteraction } from "./admin/index.js";
import { handleSubmit } from "./routes/submit.js";
import { handleSubmissions } from "./routes/submissions.js";
import { handleSubmission } from "./routes/submission.js";
import { handleFormConfig } from "./routes/form-config.js";
import { LOADER_JS } from "./routes/loader.js";
import { DEFAULT_SUCCESS_MESSAGE } from "./types.js";

/**
 * Build the contact-form plugin. Called by EmDash at runtime via:
 *   import { createPlugin } from "@incsub/emdash-contact-form/sandbox";
 *   createPlugin(descriptor.options);
 *
 * Options are forwarded from `contactFormPlugin(options)` in the consumer's
 * astro.config.mjs. Currently informational only — runtime behaviour is
 * controlled by KV settings editable in the admin UI.
 */
export function createPlugin(_options: ContactFormPluginOptions = {}) {
  return definePlugin({
    // ─────────────────────────────────────────────────────────────────────
    // Native-format identity fields (required so definePlugin returns a
    // ResolvedPlugin rather than a StandardPluginDefinition).
    // ─────────────────────────────────────────────────────────────────────
    id: "contact-form",
    version: "0.2.0",
    capabilities: ["hooks.page-fragments:register"],

    storage: {
      submissions: { indexes: ["submittedAt", "formId", "status"] },
    },

    // ─────────────────────────────────────────────────────────────────────
    // Hooks
    // ─────────────────────────────────────────────────────────────────────
    hooks: {
      "plugin:install": {
        handler: async (_event: unknown, ctx: PluginContext) => {
          // Seed default settings (only if not already present).
          const defaults: Record<string, unknown> = {
            "settings:requireHoneypot": true,
            "settings:maxMessageLength": 5000,
            "settings:retentionDays": 0,
            "settings:successMessage": DEFAULT_SUCCESS_MESSAGE,
            "settings:privacyNote": "",
          };

          for (const [key, value] of Object.entries(defaults)) {
            const existing = await ctx.kv.get(key);
            if (existing === null) await ctx.kv.set(key, value);
          }

          ctx.log.info("Contact Form plugin installed");
        },
      },

      "plugin:activate": {
        handler: async (_event: unknown, ctx: PluginContext) => {
          // Schedule daily retention purge if cron is available.
          if (ctx.cron) {
            await ctx.cron.schedule("retention-purge", { schedule: "0 2 * * *" });
          }
        },
      },

      "plugin:uninstall": {
        handler: async (event: { deleteData?: boolean }, ctx: PluginContext) => {
          if (!event.deleteData) return;

          const subResult = await (ctx.storage["submissions"] as any).query({ limit: 1000 });
          await (ctx.storage["submissions"] as any).deleteMany(
            subResult.items.map((i: { id: string }) => i.id),
          );
        },
      },

      // Auto-inject the loader script into every public page that uses
      // <EmDashHead />. We inline the JS directly rather than using
      // `external-script` because EmDash's plugin route wrapper coerces all
      // route responses to JSON (`{"data": ...}`), so a plain JS file can't
      // be served from a plugin route. Inlining bypasses that entirely —
      // the JS ships in the HTML head of every public page.
      "page:fragments": {
        handler: async () => {
          return [
            {
              kind: "inline-script",
              placement: "head",
              code: LOADER_JS,
              key: "contact-form-loader",
            },
          ];
        },
      },

      cron: {
        handler: async (event: { name: string }, ctx: PluginContext) => {
          if (event.name !== "retention-purge") return;

          const retentionDays = (await ctx.kv.get<number>("settings:retentionDays")) ?? 0;
          if (!retentionDays || retentionDays <= 0) return;

          const cutoff = new Date(Date.now() - retentionDays * 86_400_000).toISOString();
          let cursor: string | undefined;
          let deleted = 0;

          interface QueryResult {
            items: Array<{ id: string; data: { submittedAt: string } }>;
            hasMore: boolean;
            cursor?: string;
          }

          do {
            const result: QueryResult = await (ctx.storage["submissions"] as any).query({
              orderBy: { submittedAt: "asc" },
              limit: 200,
              ...(cursor ? { cursor } : {}),
            });

            const toDelete: string[] = result.items
              .filter((i) => i.data.submittedAt < cutoff)
              .map((i) => i.id);

            if (toDelete.length > 0) {
              await (ctx.storage["submissions"] as any).deleteMany(toDelete);
              deleted += toDelete.length;
            }

            cursor = result.hasMore && result.items.length > 0 ? result.cursor : undefined;
          } while (cursor);

          ctx.log.info(
            `Contact Form retention purge: deleted ${deleted} submissions older than ${retentionDays} days`,
          );
        },
      },
    },

    // ─────────────────────────────────────────────────────────────────────
    // Admin — sidebar pages, dashboard widget, Portable Text block,
    // and the auto-generated settings schema.
    // ─────────────────────────────────────────────────────────────────────
    admin: {
      pages: [
        { path: "/submissions", label: "Form Submissions", icon: "list" },
        { path: "/settings", label: "Form Settings", icon: "settings" },
      ],
      widgets: [
        { id: "recent-submissions", title: "Recent Submissions", size: "half" },
      ],
      portableTextBlocks: [
        {
          // EmDash always shows an insert modal — declaring a custom `fields`
          // array overrides the default URL input. We can't suppress the
          // modal entirely, so we pre-fill it: the user just clicks Insert.
          // Whatever value lands on the block is ignored by ContactForm.astro
          // anyway (single-form plugin — slug is always "contact").
          type: "contactForm",
          label: "Contact Form",
          icon: "code",
          description: "Insert your contact form",
          category: "Forms",
          placeholder: "Contact form",
          fields: [
            {
              type: "text_input",
              action_id: "id",
              label: "Just click Insert — there's only one form",
              placeholder: "contact",
              initial_value: "contact",
            },
          ],
        },
      ],
      settingsSchema: {
        successMessage: {
          type: "string",
          label: "Default Success Message",
          multiline: true,
          default: DEFAULT_SUCCESS_MESSAGE,
        },
        requireHoneypot: {
          type: "boolean",
          label: "Enable Honeypot Spam Protection",
          default: true,
        },
        maxMessageLength: {
          type: "number",
          label: "Max Message Length (characters)",
          min: 100,
          max: 50000,
          default: 5000,
        },
        retentionDays: {
          type: "number",
          label: "Data Retention (days)",
          description: "Auto-delete submissions older than this many days. Set to 0 to disable.",
          min: 0,
          default: 0,
        },
        privacyNote: {
          type: "string",
          label: "Default Privacy Note",
          description: "Shown below all forms unless overridden per-form.",
          multiline: true,
          default: "",
        },
      },
    },

    // ─────────────────────────────────────────────────────────────────────
    // Routes
    // ─────────────────────────────────────────────────────────────────────
    routes: {
      // ── Public ────────────────────────────────────────────────────────

      // Visitor form submission.
      submit: {
        public: true,
        handler: async (routeCtx: any) => handleSubmit(routeCtx, routeCtx as PluginContext),
      },

      // Public form configuration (consumed by the inlined loader script).
      "form-config": {
        public: true,
        handler: async (routeCtx: any) => handleFormConfig(routeCtx, routeCtx as PluginContext),
      },

      // (No `loader.js` route — the script is inlined into every public
      //  page via the page:fragments hook above. EmDash's plugin route
      //  wrapper coerces responses to JSON, so a JS file can't be served.)

      // ── Admin (auto-protected by EmDash session middleware) ───────────

      // REST endpoints for external integrations (webhooks, scripts, CLI
      // tooling). Not used by the in-admin UI — those flow through the
      // `admin` route below.
      submissions: {
        handler: async (routeCtx: any) => handleSubmissions(routeCtx, routeCtx as PluginContext),
      },
      submission: {
        handler: async (routeCtx: any) => handleSubmission(routeCtx, routeCtx as PluginContext),
      },

      // (No `submissions/export` route — CSV is generated inline in the
      //  admin view as a data: URI link. Avoids EmDash's body-stripping.)

      // Block Kit dispatcher — every admin UI interaction routes through
      // this single endpoint. The dispatcher in admin/index.ts decodes the
      // interaction and renders the appropriate response.
      admin: {
        handler: async (routeCtx: any) => {
          let interaction: Record<string, unknown>;
          try {
            interaction = (await routeCtx.request.json()) as Record<string, unknown>;
          } catch {
            interaction = (routeCtx.input ?? {}) as Record<string, unknown>;
          }
          return handleAdminInteraction(interaction as any, routeCtx as PluginContext);
        },
      },
    },
  });
}

export default createPlugin;
