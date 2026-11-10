# madebygio.dev

[![Portfolio CI](https://github.com/geopero123/portfolio/actions/workflows/ci.yml/badge.svg?branch=local%2Fcurrent-site)](https://github.com/geopero123/portfolio/actions/workflows/ci.yml)

Gio's developer portfolio. A static Astro site with Tailwind CSS, self-hosted typography, and a small TypeScript interaction layer. No animation libraries.

## Develop and verify

- Install dependencies: `npm install`
- Start the background development server: `npm run dev -- --background`
- Stop it: `npm run astro -- dev stop`
- Check TypeScript and Astro: `npm run check`
- Build production files: `npm run build`
- Build and run browser checks with bundled Chromium: `npm run build && PW_CHANNEL= npm test`
- Preview the production build: `npm run preview`
- Regenerate share images and the Apple touch icon: `npm run social-card`
- Regenerate the résumé PDF: edit `resume/resume.html`, then `node scripts/resume-pdf.mjs` (writes `public/giorgi-resume.pdf`; prefix `PW_CHANNEL=` for Playwright's bundled Chromium)
- Regenerate Tempest Archive screenshots: `node scripts/capture-tempest.mjs` (add `--spoilers` for only the three spoiler-level captures; prefix `PW_CHANNEL=` to use Playwright's bundled Chromium)

The browser suite defaults to installed Chrome. Set `PW_CHANNEL=` to use Playwright's bundled Chromium (`npx playwright install chromium` installs it), or set `PW_CHANNEL` to a different installed browser channel. The suite covers the main layouts at six viewport widths, all eight project pages, the custom 404, navigation and page transitions, keyboard focus, touch and reduced motion, clipboard interaction, on-demand PDF export, the command palette, lazy video, no-JavaScript behaviour, accessibility, structured data, and initial layout shift. Screenshots are saved to the ignored `test-results/` directory.

Portfolio CI runs the same checks and bundled Chromium suite on each push.

## Pages

- `/` - hero, three featured case studies (Tempest Archive, QUIRE, and SiteForge), five more projects, experience and education, written work practices, toolkit, about teaser, contact, and the quality strip.
- `/about` - background, experience and education, interactive project categories, workflow, and selected source.
- `/projects/<slug>/` - eight detail pages generated from `src/data/projects.ts`. The slugs are `tempest-archive`, `quire`, `siteforge`, `tempest-rebirth`, `transmute`, `signal`, `folio`, and `kilo`.
- Unknown routes serve the custom 404 page with links to the homepage and selected work.

## Structure

- `src/data/projects.ts`: the single source of truth for every project - verified descriptions, stacks, links, screenshots, and case-study copy.
- `src/data/experience.ts` supplies the experience timeline and education rows on home and About.
- `src/components/` contains the navigation, hero and sculpture, `Work`, `Experience`, `Skills`, about teaser, contact, footer, and opt-in `CursorSwarm`. Shared components include `BrowserFrame`, `TechStrip`, and `Odometer`. `CommandPalette` opens with Ctrl+K or Cmd+K on any page.
- `src/scripts/motion.ts`: the motion system (see below). `navigation.ts`: header state, sliding indicator, scroll progress, mobile menu. `homepage.ts`: the hero sculpture.
- `src/styles/global.css`: tokens, base layout, hero. `motion.css`: entrance vocabulary, depth, parallax, page transitions. `work.css`: featured projects, tool grid, pinned stories, stack map. `pages.css`: about and project pages. `swarm.css`: the page-build overlay and its controls.
- `src/assets/projects/`: real screenshots, all captured from the live sites - `scripts/capture-tempest.mjs` and `scripts/capture-tools.mjs`.
- `src/lib/quire-pdf.js` is the QUIRE PDF engine. The home editor imports it and its dependencies on demand when exporting. The original sample PDF is available without JavaScript.
- `public/`: favicon, `robots.txt`, generated share images (`social-card.png`, `og-*.png`), `apple-touch-icon.png`, gameplay clips in `media/`, and `samples/quire-field-notes.pdf` (QUIRE's built-in sample, exported from the live app, with its Markdown beside it).

## Motion system

Elements declare what they are with `data-m`, and CSS decides how that kind of thing enters:

| `data-m` | Used for | Behaviour |
| --- | --- | --- |
| `mask` | headings | lines rise out of a clipped box |
| `clip` | paragraphs | wipe down (or from the left with `data-from="left"`) |
| `draw` | rules, SVG strokes | grow from the left |
| `slide` | metadata, list rows | short horizontal movement |
| `scale` | imagery | settle from a tight crop |
| `stagger` | short lists | one item at a time |
| `count` | section numbers and stats | odometer roll |

`motion.ts` only observes and sets variables. It also handles pointer depth (`data-depth`), magnetic controls (`data-magnetic`), scroll-velocity skew on large headings (`data-velocity`), and a developer grid overlay on the `.` key. Parallax and mobile depth are scroll-driven CSS (`animation-timeline: view()`) where supported, with no JavaScript fallback needed. Hidden states only apply under `html.js`, so a failed script leaves every section visible; `prefers-reduced-motion` removes all movement and keeps content visible, and the tests check that.

**Pinned stories** (`[data-story]`, styles in `work.css` with variants in `pages.css`): a sticky column stays put while `[data-chapter]` items scroll past; the chapter in the upper-middle band of the viewport becomes active and lights the matching `[data-screen]`. Used in three places on purpose - the Tempest flagship (real screens swap per chapter), every project page (*The idea / The challenge / The build*), and the About workflow (the step list is the pinned side). On phones the pinned side sits under the header.

**Page build** (`src/scripts/swarm.ts`, markup in `CursorSwarm.astro`): 24 canvas cursor workers type, draw and place the elements on screen. It is opt-in: nothing is hidden on load, and “Replay build” (in the hero and footer, with a floating control while the build runs) assembles only what is currently in view. Skip, or Escape, reveals everything at once. Disabled for reduced motion. The hero's first screen has no entrance animation that hides text, so a reviewer can read and act on it immediately.

**Smooth scrolling** (`src/scripts/scroll.ts`): [Lenis](https://github.com/darkroomengineering/lenis) eases wheel input (`lerp: 0.1`) while the scrollbar, keyboard and touch stay native, so IntersectionObserver, sticky layouts and CSS scroll-driven animations are unaffected. In-page anchors ease to their target with the header offset. Off for touch and reduced motion; re-measured after each page swap. This is the one third-party motion dependency on the site.

The wire sculpture renders its Ribbon, Orbit and Knot geometry at build time. Scroll blends the shapes, pointer and touch interaction tilt the sculpture, and a manual shape selection stays active until leaving the page.

Page transitions use Astro's built-in `ClientRouter`. Project titles and screenshots have matching transition names on home and their detail pages. The header and palette persist across navigations.

## Project provenance

Verified on 9 November 2026 (re-check before changing any numbers):

- Tempest Archive's sitemap lists 304 URLs (84 characters, 85 skills, 59 story records, 36 locations, 26 factions, plus section and policy pages). The live index pages show 39/28/13/10 (Anime), 53/45/21/16 (Moderate) and 84/85/36/26 (Full) characters/skills/locations/factions.
- kilo.madebygio.dev serves an app branded **Smaller** (“Smaller - Image Converter”): a single HTML page with inline JavaScript. The React “KILO” source in `03-image-compressor/src` is not what is deployed there, so the site presents it as Smaller, keeping the `/projects/kilo` route.
- QUIRE's table pagination bug (each cell landing on its own page) was fixed in geopero123/Portfolio-setup#1 and deployed to the `madebygio-quire` Vercel project. `public/samples/quire-field-notes.pdf` is QUIRE's built-in sample document (`quire-field-notes.md`) exported from the live app: 2 pages, 13.4 KB, with the table, selectable text and a link annotation (checked with `pdftotext`, `pdffonts` and `pdfinfo -url`).

Tempest Archive (https://tempestarchive.com/) is a fan companion site for *That Time I Got Reincarnated as a Slime*. Its description and stack on this site were verified against the production build (React, Vite, Tailwind CSS, Motion, Supabase, served from Cloudflare) and the live pages (spoiler levels, separate light-novel / web-novel continuity, story records, dossiers, skills, locations, factions, timeline, search, accounts). The repository is not public, so no source link is shown.

The tools come from [geopero123/Portfolio-setup](https://github.com/geopero123/Portfolio-setup), branch `claude/five-utility-react-apps-ajzt9l`: five browser tools (four React 19 + Vite apps, and Smaller as a single HTML page) deployed as separate Vercel projects at `convert.`, `folio.`, `kilo.`, `qr.` and `quire.madebygio.dev`. Their checked-out deployment sources live under `hosted-projects/`. The homepage presents these five tools alongside Tempest Archive, SiteForge, and Tempest Rebirth. Tool screenshots are captured from the live apps with `node scripts/capture-tools.mjs` (the repos' `docs/screenshot.png` files predate the redesigns); rerun it after a tool changes visually.

## Recording Tempest Rebirth

Run `PW_CHANNEL= node scripts/capture-rebirth-clip.mjs` from the repository root. The script uses the live game's debug checkpoint to stage a fight and unlock the two spells, then captures 600 frames at 60 fixed time steps per second. Review frames 60, 180, 300, 420, and 540. The ignored `frames/` directory stays local.

```sh
ffmpeg -y -framerate 60 -i frames/%06d.jpg -an -c:v libvpx-vp9 -row-mt 1 -threads 8 -cpu-used 2 -b:v 0 -crf 49 -pix_fmt yuv420p public/media/rebirth.webm
ffmpeg -y -framerate 60 -i frames/%06d.jpg -an -c:v libx264 -crf 33 -preset slow -pix_fmt yuv420p -movflags +faststart public/media/rebirth.mp4
```

Verify that each encode has 600 frames at 60 fps and is under 3 MB. Home and the project page attach the video sources only when the preview enters the viewport. The screenshot remains available with reduced motion or without JavaScript.

## Editing content

Update public identity in `src/site.config.ts`. Contact details render only when they have a value: set `socials.email` (a plain address), `socials.linkedin` (full URL) and `resume` (a path such as `/giorgi-resume.pdf`, with the file in `public/`). The current configuration publishes email, GitHub, and the résumé PDF. `siteSource` points at this Astro branch (`local/current-site`), because the repository's default branch holds the older portfolio. Project copy lives in `src/data/projects.ts`; the about page copy lives in `src/pages/about.astro`.

## Deployment

`vercel.json` retains the Astro preset, build command, and `dist` output. The canonical domain is `https://madebygio.dev`. Vercel redirects the www host to the canonical domain and applies security headers across all paths. Production is static. Web Analytics loads on Vercel builds and uses `/_vercel/insights/script.js`. No user-supplied environment variables are needed.
