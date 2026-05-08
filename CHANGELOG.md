# Changelog

All notable changes to `@incsub/emdash-contact-form` are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] — 2026-05-08

### Changed

- **Now ships compiled JavaScript and TypeScript declarations from `dist/`** instead of raw TypeScript source. Build is performed by `tsup` and runs automatically on `npm install` via the `prepare` script. Consumers no longer need the `vite.ssr.noExternal` hint in their Astro config — install becomes a single `plugins: [contactFormPlugin()]` line. This aligns with standard npm package convention and gives consumers proper IDE type-completion for plugin options.
- Astro components (`ContactForm.astro`) continue to ship as source — they cannot be bundled.

### Migration from 0.1.x

Bump the dependency in your `package.json`:

```diff
- "@incsub/emdash-contact-form": "github:neelg12/emdash-contact-form#v0.1.0"
+ "@incsub/emdash-contact-form": "github:neelg12/emdash-contact-form#v0.2.0"
```

Remove the `vite.ssr.noExternal` block from your `astro.config.mjs` (still required if installing via `file:` / `link:`):

```diff
  export default defineConfig({
    integrations: [emdash({ plugins: [contactFormPlugin()] })],
-   vite: {
-     ssr: { noExternal: ["@incsub/emdash-contact-form"] },
-   },
  });
```

Then `npm install` and rebuild. No code changes required.

## [0.1.0] — 2026-05-07

Initial release.

### Added
- Single built-in contact form with Name / Email / Message fields
- Auto-injected loader script via the `page:fragments` hook (no manual `<script>` tag needed)
- Portable Text editor block for inserting the form into a page
- Admin UI: Form Submissions list, Form Settings page, dashboard widget
- Submission lifecycle: new → read (auto on view) → soft-deleted
- Status filter chips (All / New / Read), search across name/email/message/page
- Spam protection: honeypot, minimum-submit-time, per-IP rate limit (5 / 15 min) with global fallback (60 / 15 min)
- Same-origin check on the public submit endpoint
- 64 KB body size guard before JSON parse
- CSV formula-injection neutralizer in stored exports
- Configurable settings: success message, privacy note, honeypot toggle, max message length, retention days
- Daily retention purge cron (`0 2 * * *`) auto-deletes submissions older than `retentionDays`
- Soft-delete model: deletions are reversible until the retention purge runs
- REST API for external integrations: `/submissions`, `/submission`, `/submit`, `/form-config`
- Editor-friendly insert flow with pre-filled slug

### Known limitations
- Single fixed form only (Name / Email / Message). No multi-form support.
- No file uploads.
- No CAPTCHA (clean extension point in `routes/submit.ts`).
- In-memory rate limiter is per-process. Multi-instance deployments need edge-level limits.
- The loader script is inlined (~3 KB) on every public page rather than served as a cacheable external file. This is a workaround for EmDash's plugin route wrapper, which JSON-serializes all responses and would mangle a JavaScript file.
- CSV export of submissions is generated but not surfaced in the admin UI for the same reason. The utility (`src/csv.ts`) is retained for direct use.

[0.2.0]: https://github.com/neelg12/emdash-contact-form/releases/tag/v0.2.0
[0.1.0]: https://github.com/neelg12/emdash-contact-form/releases/tag/v0.1.0
