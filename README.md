# @incsub/emdash-contact-form

A built-in contact form for [EmDash CMS](https://emdash.dev). One form, one shortcode, submissions stored and managed in the admin UI. No SMTP setup, no per-form configuration — install it and it works.

> **Single-form by design.** This plugin ships one fixed contact form (Name / Email / Message). Configurable bits — success message, privacy note, spam protection, retention — live in the plugin Settings. If you need multiple forms with arbitrary fields, this isn't the right plugin.

---

## Features

- **One-line shortcode** — drop `<div data-form-slug="contact"></div>` on any page
- **Editor-friendly** — also available as a Portable Text block in the slash menu
- **Auto-injected loader** — no manual `<script>` tag needed if your layout uses `<EmDashHead />`
- **Submissions admin** — list, search, view, soft-delete, CSV export
- **Spam protection** — honeypot, minimum-submit-time, per-IP and global rate limits, same-origin check
- **Privacy-aware** — soft delete, configurable retention with daily auto-purge
- **Zero external runtime dependencies** — vanilla JS hydration, no NPM extras at runtime

---

## Install

```bash
npm install @incsub/emdash-contact-form
```

(Or `npm install github:incsub/emdash-contact-form` for an unpublished branch, or `npm install file:../path` for local dev.)

Then in `astro.config.mjs`:

```js
import { defineConfig } from "astro/config";
import emdash from "emdash/astro";
import { sqlite } from "emdash/db";
import { contactFormPlugin } from "@incsub/emdash-contact-form";

export default defineConfig({
  output: "server",
  integrations: [
    emdash({
      database: sqlite({ url: "file:./data.db" }),
      plugins: [contactFormPlugin()],
    }),
  ],

  // Required when installing from a local path / symlink (npm `file:` / `link:`).
  // Skip if you installed from npm or GitHub.
  vite: {
    resolve: { dedupe: ["emdash", "astro"] },
    optimizeDeps: { exclude: ["@incsub/emdash-contact-form"] },
    ssr: { noExternal: ["@incsub/emdash-contact-form"] },
  },
});
```

Restart the dev server. The plugin is ready.

---

## Embedding the form

Two equivalent ways:

**A. In the EmDash editor.** Open any page, type `/`, pick **Contact Form** under the "Forms" category, save. The form renders on the published page.

**B. In Astro markup.** Drop this anywhere in any `.astro` page or Markdown file:

```html
<div data-form-slug="contact"></div>
```

The loader script is auto-injected into pages that include `<EmDashHead />` (which all default EmDash layouts do). When you change a setting in the admin, the live form updates automatically.

### Manual fallback

If your layout doesn't include `<EmDashHead />`, add this once inside `<head>`:

```html
<script src="/_emdash/api/plugins/contact-form/loader.js" defer></script>
```

---

## Plugin options

```ts
contactFormPlugin({
  requireHoneypot: true,    // Default: true
  maxMessageLength: 5000,   // Default: 5000
  retentionDays: 0,         // Default: 0 (no auto-deletion)
})
```

These are seeded as KV defaults on first install and can be edited later from **Admin → Plugins → Contact Form → Settings**:

| Setting | Description |
| --- | --- |
| `successMessage` | Shown in place of the form after a successful submission |
| `privacyNote` | Shown below the form |
| `requireHoneypot` | Reject submissions where the hidden honeypot field is filled |
| `maxMessageLength` | Cap on text / textarea field length |
| `retentionDays` | Auto-purge submissions older than N days at 02:00 daily (`0` disables) |

---

## Admin UI

**Admin → Plugins → Submissions** lists everything. Click **View** to open one — opening auto-marks it as read. From there: **Reply by Email** (mailto), **Delete** (soft-delete).

Status filter chips at the top let you switch between **All / New / Read**. Search matches name, email, message body, and page slug.

**Admin → Plugins → Form** shows the embed shortcode and field reference.

---

## Public API routes

All under `/_emdash/api/plugins/contact-form/`.

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| `POST` | `submit` | Public | Visitor submission |
| `GET` | `form-config` | Public | Form config for the loader |
| `GET` | `loader.js` | Public | Hydration script |
| `GET` | `submissions` | Admin | Paginated list |
| `GET` | `submission?id=…` | Admin | Single submission |
| `POST` | `submission?id=…` | Admin | Update status `{status: "read" \| ...}` |
| `DELETE` | `submission?id=…` | Admin | Soft-delete |
| `GET` | `submissions/export` | Admin | CSV download |

Admin routes are protected by EmDash's session middleware automatically.

---

## Privacy & security

| Concern | Mitigation |
| --- | --- |
| **Untrusted input** | Stored raw, never executed; submission body capped at 64 KB; per-field length capped by `maxMessageLength` |
| **Cross-origin spam** | Submit endpoint rejects requests whose `Origin` header doesn't match the host (legitimate same-origin clients always pass) |
| **CSV formula injection** | Cells beginning with `=` `+` `-` `@` are prefixed with `'` so Excel / Sheets treat them as text |
| **Bots** | Hidden `_hp` honeypot rejects filled-honeypot submissions silently; submissions in under 2 s are treated as bot activity |
| **Rate limiting** | 5 / IP / 15 min, plus a global 60 / 15 min fallback for direct-IP deployments without `x-forwarded-for`. **In-process** — for multi-instance hosting, also enforce edge-level rate limits (Nginx, Cloudflare) |
| **IP capture** | Read from `x-forwarded-for` / `x-real-ip`. Document this in your privacy policy |
| **Soft delete** | `status: "deleted"` is hidden from the UI; not erased until the retention purge |
| **Plugin uninstall with `deleteData: true`** | All submissions hard-deleted; KV settings removed by EmDash |

---

## Custom domains / third-party hosting

The plugin uses **only relative paths** (`/_emdash/api/plugins/contact-form/...`), so it works on any custom domain without configuration. The loader fetches form config from the same origin the page was served from. Page slug is captured client-side via `window.location.pathname`.

If your site is mounted at a sub-path (e.g. `example.com/blog/`), EmDash's API still lives at `/_emdash/...` from the root — confirm your reverse proxy isn't stripping `/_emdash/` before requests reach EmDash.

If you serve behind Cloudflare or another reverse proxy, forward `x-forwarded-for` so per-IP rate limits work; otherwise the plugin falls back to its global counter.

---

## Limitations

1. **Single fixed form.** Fields are Name / Email / Message. No per-form customization, no multiple forms.
2. **No file uploads.**
3. **No CAPTCHA.** Wire one in `routes/submit.ts` before `validateSubmissionPayload()` if needed.
4. **In-memory rate limiter** — works per-process. Use edge-level limits for multi-instance.
5. **No GDPR self-service.** Visitors can't request their own data; admins handle deletion.

---

## Contributing / sharing

MIT-licensed. To publish your own variant:

1. Update `name` in `package.json` to your scope (e.g. `@yourorg/emdash-contact-form`).
2. Update `entrypoint` and `componentsEntry` in `src/index.ts` to the new package name.
3. `npm publish` (or push to GitHub for `npm install github:...` consumers).

---

## License

MIT — see [LICENSE](./LICENSE).
