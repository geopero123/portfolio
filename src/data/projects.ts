import type { ImageMetadata } from 'astro';
import tempestHome from '../assets/projects/tempest-home.png';
import tempestDossier from '../assets/projects/tempest-dossier.png';
import tempestTimeline from '../assets/projects/tempest-timeline.png';
import tempestCharacters from '../assets/projects/tempest-characters.png';
import tempestMobile from '../assets/projects/tempest-mobile.png';
import quire from '../assets/projects/quire.png';
import kilo from '../assets/projects/kilo.png';
import folio from '../assets/projects/folio.png';
import convert from '../assets/projects/convert.png';
import qr from '../assets/projects/qr.png';
import quirePdfPage from '../assets/projects/quire-pdf-page.png';
import rebirth from '../assets/projects/rebirth.png';
import siteforge from '../assets/projects/siteforge.png';

const toolsBranch = 'https://github.com/geopero123/Portfolio-setup';
const toolsRef = 'claude/five-utility-react-apps-ajzt9l';
const toolsBase = `${toolsBranch}/tree/${toolsRef}`;
/** Link to a file (and optional line) in the tools repository. */
const toolsFile = (path: string, line?: number) => `${toolsBranch}/blob/${toolsRef}/${path}${line ? `#L${line}` : ''}`;

/** Checked against the live sites on 9 November 2026. */
export const VERIFIED_ON = '9 November 2026';

export interface Project {
  slug: string;
  name: string;
  /** Short editorial line shown next to the name. */
  tagline: string;
  /** One-paragraph description for cards and index. */
  description: string;
  /** What kind of project this is. */
  type: string;
  role: string;
  year: string;
  stack: string[];
  live: string;
  liveAccessNote?: string;
  /** Omitted when no public repository exists. */
  source?: string;
  image: ImageMetadata;
  alt: string;
  /** Extra screens used by the detail page and flagship presentation. */
  screens?: { image: ImageMetadata; alt: string; label: string }[];
  mobile?: { image: ImageMetadata; alt: string };
  /** A real output file a reviewer can open (QUIRE's exported PDF). */
  sample?: { href: string; image: ImageMetadata; alt: string; summary: string };
  flagship?: boolean;
  /** Verified facts, phrased for the detail page. Only what actually exists. */
  facts?: { label: string; text: string }[];
  /** Detail-page sections; only present when there's something real to say. */
  story?: { heading: string; body: string[] }[];
  /** Accent used only inside this project's own presentation. */
  accent: string;
  /** Browser-frame chrome that suits the screenshot. Defaults to dark for the flagship, light otherwise. */
  tone?: 'light' | 'dark';
  /** One paragraph for the detail page's Stack section. */
  stackNote?: string;
  /** schema.org applicationCategory for the detail page. */
  schemaCategory?: string;
  /** Homepage feature: what it lets people do, one engineering decision, and evidence to inspect. */
  feature?: {
    does: string;
    decision: { title: string; body: string };
    evidence: { label: string; text: string; href?: string; download?: boolean }[];
  };
}

export const projects: Project[] = [
  {
    slug: 'tempest-archive',
    name: 'Tempest Archive',
    tagline: 'A spoiler-aware Tensura companion',
    description:
      'A reference site and reading companion for That Time I Got Reincarnated as a Slime: original story summaries, character dossiers, skills, locations, factions and a linked timeline, all filtered by the reader\'s chosen spoiler level.',
    type: 'Content archive & web app',
    role: 'Design, frontend, data model',
    year: 'Ongoing',
    stack: ['React', 'Vite', 'Tailwind CSS', 'Motion', 'Supabase', 'Cloudflare'],
    live: 'https://tempestarchive.com/',
    image: tempestHome,
    alt: 'Tempest Archive home page: a dark navy interface with the headline "Enter Tempest", a featured Volume 1 story card, and a spoiler-level switch set to Moderate',
    screens: [
      { image: tempestDossier, alt: 'Rimuru Tempest character dossier with an archive note, role, affiliation and the story records the character appears in', label: 'Character dossier' },
      { image: tempestTimeline, alt: 'The complete event line: a numbered timeline of linked story events grouped into eras', label: 'Timeline' },
      { image: tempestCharacters, alt: 'Characters index with a filter field and alphabetised dossier cards', label: 'Characters index' },
    ],
    mobile: { image: tempestMobile, alt: 'Tempest Archive on a phone, with a bottom tab bar for Archive, Story, Characters and Search' },
    flagship: true,
    accent: '#7cc7dd',
    tone: 'dark',
    stackNote: 'A React application built with Vite, with Motion for interface transitions and Tailwind for styling. Supabase handles accounts, and every route is prerendered and served from Cloudflare.',
    feature: {
      does: 'Readers pick how far they have read or watched (Anime, Moderate or Full) and the whole archive follows: character, skill, location and faction indexes, dossiers and the timeline only show what they have reached.',
      decision: {
        title: 'Characters, skills and events are linked records, not standalone pages.',
        body: 'A skill has owners and evolutions, a character has affiliations and appearances, and a story event ties them together. Modelling them as records that reference each other lets one spoiler setting filter the whole graph at once, so a character you have not met yet drops out of the index, the skill pages and the timeline together, instead of each page being edited by hand.',
      },
      evidence: [
        { label: 'Project scale', text: '304 URLs in the public sitemap: 84 characters, 85 skills, 59 story records, 36 locations and 26 factions.', href: 'https://tempestarchive.com/sitemap.xml' },
        { label: 'Live site', text: 'Change the spoiler level in the header and watch the counts change.', href: 'https://tempestarchive.com/characters/' },
        { label: 'Case study', text: 'The idea, the data-model problem and the build, with real screens.', href: '/projects/tempest-archive' },
      ],
    },
    facts: [
      { label: 'Spoiler levels', text: 'Anime, Moderate and Full. Every list, dossier and timeline entry respects the level the reader picks.' },
      { label: 'Two continuities', text: 'Light-novel and web-novel material are labelled separately and never merged into one false ending.' },
      { label: 'Original writing', text: 'Every summary is written from scratch. No novel prose or dialogue is reproduced.' },
      { label: 'Linked records', text: 'Story records name who was present, what each side wanted, which abilities decided the outcome and what returns later. Characters, skills, places and events link to each other.' },
      { label: 'Indexable', text: 'Every route is prerendered with its own title and description. The public sitemap lists 304 URLs: 84 character, 85 skill, 59 story, 36 location and 26 faction pages, plus the section indexes.' },
      { label: 'Accounts', text: 'Sign-in with Supabase for a personal account, alongside local bookmarks that work without one.' },
    ],
    story: [
      {
        heading: 'The idea',
        body: [
          'Most fan wikis assume you have finished everything. Tempest Archive starts from the opposite premise: you choose how far you have read or watched, and the whole site reshapes itself around that. A character page for someone you have not met yet simply stays out of the way.',
          'It is also written, not scraped. Each story record summarises cause and consequence in the archive\'s own words, which keeps it useful for readers and clear of the source material.',
        ],
      },
      {
        heading: 'The challenge',
        body: [
          'The content is a graph, not a list. A skill has owners and evolutions; a character has affiliations, forms and appearances; an event links all of them. Keeping those relationships consistent, and then filtering the entire graph by spoiler level without breaking links, drove most of the data-model decisions.',
          'The light novel and the older web novel also diverge. Treating them as separate continuities from the start avoided a class of contradictions that would have been painful to untangle later.',
        ],
      },
      {
        heading: 'The build',
        body: [
          'A React application built with Vite, styled with Tailwind, with Motion for the interface transitions. The archive data ships as its own bundle so reference pages render immediately and search works client-side.',
          'Every route is also prerendered to static HTML on Cloudflare, so a character or skill page has real content, a real title and real description before any JavaScript runs. Supabase handles accounts; bookmarks also work locally for readers who never sign in.',
          'Analytics are opt-in, first-party and cookie-free. The prompt says exactly that, and defaults to off.',
        ],
      },
    ],
  },
  {
    slug: 'quire',
    name: 'QUIRE',
    tagline: 'Writing, without the friction',
    description:
      'A focused Markdown editor with a live preview and a PDF export engine. Searchable text, working links and considered typography, all in the browser.',
    type: 'Browser application',
    role: 'Design & development',
    year: '2026',
    stack: ['React 19', 'Vite', 'Tailwind CSS', 'pdf-lib'],
    live: 'https://quire.madebygio.dev',
    source: `${toolsBase}/05-markdown-to-pdf`,
    image: quire,
    alt: 'QUIRE in split view: a Markdown editor with a formatting toolbar on the left and the typeset "Field Notes on Kettle Design" document on the right, with Write, Split, Read and Export controls',
    accent: '#a8c29a',
    sample: {
      href: '/samples/quire-field-notes.pdf',
      image: quirePdfPage,
      alt: 'Page one of a PDF exported from QUIRE: "Field Notes on Kettle Design" set in Times with Helvetica headings, a block quote, numbered and nested bulleted lists, a four-row measurements table and the start of a code block',
      summary: '2 pages · 13.4 KB',
    },
    feature: {
      does: 'Write Markdown with a live, typeset preview, then download a real PDF (selectable, searchable text and clickable links) without the document leaving the browser.',
      decision: {
        title: 'It lays the PDF out itself instead of screenshotting the preview.',
        body: 'The usual shortcut rasterises the page into an image. QUIRE walks the same marked token stream that drives the preview and draws it with pdf-lib in the Standard 14 fonts, so text stays text and every link becomes a real link annotation. pdf-lib is loaded with a dynamic import only when someone exports, and characters the fonts cannot encode are transliterated or reported by name rather than silently dropped.',
      },
      evidence: [
        { label: 'Sample PDF', text: "QUIRE's built-in sample, exported from the live app: 2 pages, 13.4 KB, with a table, extractable text and a working link annotation.", href: '/samples/quire-field-notes.pdf', download: true },
        { label: 'Link annotations', text: 'addLink() in src/lib/pdf.js', href: toolsFile('05-markdown-to-pdf/src/lib/pdf.js', 346) },
        { label: 'Lazy PDF engine', text: 'loadPdfLib() dynamic import', href: toolsFile('05-markdown-to-pdf/src/lib/pdf.js', 20) },
        { label: 'Encoding guard', text: 'toWinAnsi() transliterates or reports', href: toolsFile('05-markdown-to-pdf/src/lib/pdf.js', 102) },
      ],
    },
    facts: [
      { label: 'Live preview', text: 'Write on the left, read the typeset result on the right. Split, write-only and read-only modes.' },
      { label: 'Real PDF export', text: 'Exports selectable, searchable text with working links rather than a screenshot of the page. Its two-page built-in sample, table included, exports from the live app at 13.4 KB.' },
      { label: 'Local autosave', text: 'Drafts persist in the browser. Nothing is uploaded.' },
    ],
    story: [
      { heading: 'Why', body: ['Most "Markdown to PDF" tools rasterise the page or route it through a server. QUIRE lays the document out itself and writes a proper PDF in the browser, so the output stays light, searchable and private.'] },
    ],
  },
  {
    // Route stays /projects/kilo; the app deployed at kilo.madebygio.dev is branded "Smaller".
    slug: 'kilo',
    name: 'Smaller',
    tagline: 'Make images lighter.',
    description:
      'Convert, resize and compress a list of images in the browser. Choose WebP, JPEG, PNG or AVIF, set dimensions and quality, and see the original size, new size and reduction before you download.',
    type: 'Browser application',
    role: 'Design & development',
    year: '2026',
    stack: ['HTML', 'CSS', 'JavaScript', 'Canvas API'],
    live: 'https://kilo.madebygio.dev',
    source: toolsFile('03-image-compressor/index.html'),
    image: kilo,
    alt: 'Smaller image converter on a dark canvas: the headline "Make images lighter", a large dashed drop zone for JPG, PNG, WebP, AVIF, GIF, BMP and SVG, and a "100% private · processed on your device" badge',
    accent: '#c9e28a',
    facts: [
      { label: 'Several images at once', text: 'Drop, choose or paste images into one list; the same export settings apply to every image in it.' },
      { label: 'Size before download', text: 'Each image shows its original size, new size and reduction, and an option keeps the original file when re-encoding it at the same format and size would make it larger.' },
      { label: 'Formats', text: 'Reads JPG, PNG, WebP, AVIF, GIF, BMP, SVG and other browser-supported images; writes WebP, JPEG, PNG, or AVIF where the browser can encode it.' },
    ],
    story: [
      { heading: 'Why', body: ['Image tools that upload your photos to a server are slow and a little uncomfortable. Smaller decodes each image, redraws it at the target size on a canvas and re-encodes it, all in the tab. The whole app is one HTML page with inline CSS and JavaScript, no framework.'] },
    ],
  },
  {
    slug: 'folio',
    name: 'Folio',
    tagline: 'A better home for your PDFs.',
    description:
      'Merge, split and compress PDFs, or move between images and PDF pages, with a visual page-by-page workflow. Documents stay on your device from start to finish.',
    type: 'Browser application',
    role: 'Design & development',
    year: '2026',
    stack: ['React 19', 'Vite', 'Tailwind CSS', 'pdf.js', 'pdf-lib'],
    live: 'https://folio.madebygio.dev',
    source: `${toolsBase}/02-pdf-toolkit`,
    image: folio,
    alt: 'Folio PDF toolkit on a cream background: five numbered operations across the top (Merge, Split, Compress, Images to PDF, PDF to images), the Merge panel selected, and a hatched drop zone reading "Drop PDFs to merge"',
    accent: '#d9b48a',
    facts: [
      { label: 'Five operations', text: 'Merge, split, compress, images to PDF, and PDF to images.' },
      { label: 'Page-level control', text: 'Pages are rendered as thumbnails so you can see what you are reordering or extracting.' },
      { label: 'Private by design', text: 'pdf-lib for writing and pdf.js for reading, both in the browser. Nothing leaves the tab.' },
    ],
    story: [
      { heading: 'Why', body: ['PDF utilities are usually a queue of uploads and a download link at the end. Folio keeps the whole workflow visible and local: you see pages, move them, and get the file immediately.'] },
    ],
  },
  {
    slug: 'transmute',
    name: 'Transmute',
    tagline: 'Files in. Other files out.',
    description:
      'A local-first file converter. Images to PNG, JPG, WebP, GIF or PDF; DOCX to HTML, Markdown or text; CSV, TSV and JSON between each other. Every conversion runs in the tab, and the app works offline after first load.',
    type: 'Browser application',
    role: 'Design & development',
    year: '2026',
    stack: ['React 19', 'Vite', 'Tailwind CSS', 'Canvas API', 'pdf-lib'],
    live: 'https://convert.madebygio.dev',
    source: `${toolsBase}/01-file-converter`,
    image: convert,
    alt: 'Transmute file converter on a dark grid: "Drop files anywhere" with a Browse files button, format groups for Images, Word and Data, and a side panel with a quality slider and a Convert file button',
    accent: '#d8ff3e',
    facts: [
      { label: 'Three families', text: 'Images (PNG, JPG, WebP, GIF, BMP, AVIF, SVG), Word documents (DOCX) and tabular data (CSV, TSV, JSON).' },
      { label: 'Honest edge cases', text: 'JPG has no alpha, so transparency is painted onto a colour you pick. PDF embeds opaque images as JPEG and transparent ones as PNG. Unsupported or broken files are reported per file, with the reason.' },
      { label: 'Loads only what it needs', text: 'The PDF, DOCX and CSV libraries are dynamic imports, so the first paint carries only the image path.' },
      { label: 'No network after load', text: 'No analytics, no telemetry, no upload endpoint. Disconnect and convert anyway.' },
    ],
    story: [
      { heading: 'Why', body: ['Online converters ask you to upload the file to find out what you will get back. Transmute does the work with the Canvas API and a few well-chosen libraries in the browser, then explains exactly what it did with GIF palettes, JPG transparency and PDF page sizes instead of guessing on your behalf.'] },
    ],
  },
  {
    slug: 'signal',
    name: 'SIGNAL',
    tagline: 'Codes that actually scan.',
    description:
      'A QR code and barcode generator. Links, text, Wi-Fi, contact cards, email and SMS as QR codes with styled modules and an optional logo; nine barcode symbologies; PNG or self-contained SVG export. Nothing leaves the tab.',
    type: 'Browser application',
    role: 'Design & development',
    year: '2026',
    stack: ['React 19', 'Vite', 'Tailwind CSS', 'qrcode', 'JsBarcode', 'SVG'],
    live: 'https://qr.madebygio.dev',
    source: `${toolsBase}/04-qr-generator`,
    image: qr,
    alt: 'SIGNAL QR and barcode generator in dark green: an empty preview panel with PNG and SVG export, and content-type tabs (Link, Text, Wi-Fi, Contact, Email, SMS) above module colour, shape, corner-marker, quiet-zone and error-correction controls',
    accent: '#f0a868',
    facts: [
      { label: 'Six QR payloads', text: 'Link, text, Wi-Fi, vCard contact, email and SMS, with the exact encoded string, byte count and error-correction level shown so nothing is a guess.' },
      { label: 'Escaping tested', text: 'Wi-Fi passwords and contact names with reserved characters are escaped correctly, and tests decode the finished image and compare it byte-for-byte.' },
      { label: 'Scannability warnings', text: 'Contrast under 3:1, inverted colours and a short quiet zone are flagged before export. Timing and alignment modules stay square whatever style you pick, because dotted ones stop decoding.' },
      { label: 'Nine barcodes', text: 'Code 128, Code 39, EAN-13, EAN-8, UPC-A, ITF-14, MSI, Pharmacode and Codabar, each with its own input rule and validation.' },
    ],
    story: [
      { heading: 'Why', body: ['Most generators will happily hand you a code that looks right and scans wrong, or not at all. SIGNAL treats a QR code as an engineering artefact: one geometry drives the preview, the PNG and the SVG, so they cannot drift apart, and the tool tells you when a design choice will fail on a real scanner.'] },
    ],
  },
  {
    slug: 'siteforge',
    name: 'SiteForge',
    tagline: 'Find what breaks before your users do.',
    description:
      'Website and code QA. Give it a URL, a GitHub repository or both: it audits the live site in a real browser and scans the repository, then reports every finding with its evidence, its exact location and a suggested fix.',
    type: 'Web application',
    role: 'Design & development',
    year: '2026',
    stack: ['Next.js', 'React', 'TypeScript', 'Tailwind CSS', 'Supabase', 'Playwright', 'axe-core'],
    live: 'https://siteforge.madebygio.dev',
    liveAccessNote: 'Running an audit requires sign-in.',
    source: 'https://github.com/geopero123/siteforge',
    image: siteforge,
    alt: 'SiteForge landing page on a dark background: the headline "Find what breaks before your users do", a field for a site or GitHub repository with a Run audit button, and a sample report scoring accessibility, security, responsiveness and dependencies',
    accent: '#7ee2a8',
    tone: 'dark',
    schemaCategory: 'DeveloperApplication',
    feature: {
      does: 'Audit a live website, a GitHub repository, or both. Each finding includes evidence, its location and a suggested fix.',
      decision: {
        title: 'AI findings must quote real code or they are discarded.',
        body: 'SiteForge checks the quote against the file the finding names. It keeps a suggested patch only if every line the patch removes exists in that file.',
      },
      evidence: [
        { label: 'Product overview', text: 'See the public landing page.', href: 'https://siteforge.madebygio.dev' },
        { label: 'Source repository', text: 'Read the audit and reporting code.', href: 'https://github.com/geopero123/siteforge' },
      ],
    },
    stackNote: 'Next.js and React with TypeScript and Tailwind CSS. Supabase provides sign-in, the database and the audit queue; a separate worker drives Chromium through Playwright and runs axe-core on each page.',
    facts: [
      { label: 'Real browser audits', text: 'Pages are loaded in Chromium at three viewports (1440×900, 768×1024 and 390×844) and checked with axe, along with console errors, failed requests, overflow and clipping.' },
      { label: 'Repository scans', text: 'A pinned commit is checked for leaked secrets, risky code patterns, configuration problems and vulnerable dependencies, using OSV.dev for advisories.' },
      { label: 'Evidence, not guesses', text: 'An AI finding must quote real code from the file it names or it is discarded, and a suggested patch is kept only if every line it removes exists in that file.' },
      { label: 'Queue and worker', text: 'The app queues each audit and a separate worker runs it, with per-account limits enforced in the database.' },
    ],
    story: [
      { heading: 'What it is', body: ['SiteForge tests a website in a real browser and reads its GitHub repository, then lists each problem with its evidence, where it is and how to fix it. Next.js serves the workspace while a separate worker performs the audits from a queue, so a long audit never blocks the app.'] },
    ],
  },
  {
    slug: 'tempest-rebirth',
    name: 'Tempest Rebirth',
    tagline: 'A 3D action RPG in the browser.',
    description:
      'A playable vertical slice of a 3D action RPG: one dense region, combo combat, seven spells that evolve through use and a three-phase boss. Every model, texture, particle and sound is generated in code.',
    type: 'Browser game',
    role: 'Design & development',
    year: '2026',
    stack: ['TypeScript', 'Three.js', 'GLSL', 'Web Audio', 'Vite'],
    live: 'https://play.tempestarchive.com',
    source: 'https://github.com/geopero123/play-tensura',
    image: rebirth,
    alt: 'Tempest Rebirth title screen: a low-poly village with pink trees, a campfire and a blue slime, under the gold title "Tempest Rebirth, from slime to sovereign" with Play, Characters and Settings buttons',
    accent: '#e8c26a',
    tone: 'dark',
    schemaCategory: 'GameApplication',
    stackNote: 'TypeScript and Three.js, built with Vite into a static folder. Rendering uses custom GLSL cel-shading materials and a post-processing chain; all audio is synthesized with the Web Audio API.',
    facts: [
      { label: 'No downloaded assets', text: 'Every model, texture, particle, magic circle and sound is generated in code.' },
      { label: 'Combat', text: 'A four-hit ground combo with a launcher, aerial juggles and a dive finisher, plus hit-stop, perfect dodges and target lock.' },
      { label: 'Spells that evolve', text: 'Seven spells, each with five evolution tiers unlocked through use; every tier adds a new mechanic.' },
      { label: 'Rendering', text: 'Custom GLSL cel-shading with bloom, colour grading, vignette, radial blur, speed lines and impact frames.' },
      { label: 'Synthesized audio', text: 'Footsteps, impacts, spells and ambience, with a sequencer that crossfades exploration, combat, boss and victory music.' },
    ],
    story: [
      { heading: 'What it is', body: ['Tempest Rebirth is a vertical slice rather than a full game: one dense region, a complete combat system and a three-phase boss. Nothing is downloaded. Models, textures, particles and sound are all generated in code, with custom cel-shading on top of Three.js. It is played with keyboard and mouse.'] },
    ],
  },
];

export const flagship = projects.find(p => p.flagship)!;
export const tools = projects.filter(p => !p.flagship);
export const getProject = (slug: string) => projects.find(p => p.slug === slug);
