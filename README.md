# Portfolio

A bilingual (EN / ქართული), dual-theme developer portfolio that showcases the standalone
HTML tools living in the repo root as **live, embedded projects**.

- **Client** — React 18 + Vite + TypeScript, React Router, react-i18next, React Three Fiber
- **Server** — Node + Express: contact form endpoint, project manifest API, production static hosting

## Commands (run from `portfolio/`)

| Command | What it does |
|---|---|
| `npm install` | installs both workspaces |
| `npm run dev` | Vite dev server (`:5173`, proxies `/api`) + Express (`:5174`), concurrently |
| `npm run build` | type-checks and builds the client into `client/dist` |
| `npm run lint` | ESLint over the client |
| `npm run sync` | re-syncs the HTML tools from the repo root (also runs before dev/build) |
| `npm run start` | Express serves `client/dist` + API on `:5174` (production mode) |

## How the showcased tools work

`client/scripts/sync-projects.mjs` scans the **repo root** for tool folders (any directory
with an `index.html`) and standalone `.html` files, copies them into
`client/public/projects/<slug>/` (verbatim — internal relative paths keep working), extracts
each `<title>`, and writes `client/src/data/projects.generated.json`.

Presentation metadata (pretty slug, accent color, glyph, tags, ordering) lives in
`client/src/data/project-meta.json`, keyed by folder/file name. **Drop a new tool folder in
the repo root and it appears automatically** with defaults; add a meta entry + a
`projects.<slug>.desc` string in `client/src/i18n/locales/*.json` to polish it.

The originals in the repo root stay untouched and remain the source of truth.

## Notes & TODOs

- The showcased tools load fonts/libs (Google Fonts, jsPDF, gif.js) from CDNs — they need
  network access, same as before.
- `src/data/site.ts` holds personal facts — **the GitHub link is a placeholder (TODO)**.
- Contact form: in production (Vercel) `api/contact.js` emails messages via Resend and
  needs the `RESEND_API_KEY` env var. The local Express server instead saves them to
  `server/data/messages.json` and logs them.
- Georgian copy was machine-authored — worth a native read-through.
- Theme: system preference by default, manual toggle persisted in `localStorage`.
- Hero: WebGL terrain (React Three Fiber) with device-tier quality, scroll-based dimming,
  reduced-motion static frame, and a pure-CSS fallback on small screens / no WebGL —
  the three.js chunk is only downloaded when the scene actually renders.
