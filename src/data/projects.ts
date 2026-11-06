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

const toolsBase = 'https://github.com/geopero123/Portfolio-setup/tree/claude/five-utility-react-apps-ajzt9l';

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
  /** Omitted when no public repository exists. */
  source?: string;
  image: ImageMetadata;
  alt: string;
  /** Extra screens used by the detail page and flagship presentation. */
  screens?: { image: ImageMetadata; alt: string; label: string }[];
  mobile?: { image: ImageMetadata; alt: string };
  flagship?: boolean;
  /** Verified facts, phrased for the detail page. Only what actually exists. */
  facts?: { label: string; text: string }[];
  /** Detail-page sections; only present when there's something real to say. */
  story?: { heading: string; body: string[] }[];
  /** Accent used only inside this project's own presentation. */
  accent: string;
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
    facts: [
      { label: 'Spoiler levels', text: 'Anime, Moderate and Full. Every list, dossier and timeline entry respects the level the reader picks.' },
      { label: 'Two continuities', text: 'Light-novel and web-novel material are labelled separately and never merged into one false ending.' },
      { label: 'Original writing', text: 'Every summary is written from scratch. No novel prose or dialogue is reproduced.' },
      { label: 'Linked records', text: 'Story records name who was present, what each side wanted, which abilities decided the outcome and what returns later. Characters, skills, places and events link to each other.' },
      { label: 'Indexable', text: 'Every route is prerendered with its own title and description. The sitemap covers several hundred character, skill, location, faction and story pages.' },
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
    facts: [
      { label: 'Live preview', text: 'Write on the left, read the typeset result on the right. Split, write-only and read-only modes.' },
      { label: 'Real PDF export', text: 'Exports selectable, searchable text with working links rather than a screenshot of the page.' },
      { label: 'Local autosave', text: 'Drafts persist in the browser. Nothing is uploaded.' },
    ],
    story: [
      { heading: 'Why', body: ['Most "Markdown to PDF" tools rasterise the page or route it through a server. QUIRE lays the document out itself and writes a proper PDF in the browser, so the output stays light, searchable and private.'] },
    ],
  },
  {
    slug: 'kilo',
    name: 'KILO',
    tagline: 'Less weight. Same picture.',
    description:
      'A batch image compressor and resizer with a before-and-after comparison. Fine-tune the quality and see exactly what changes.',
    type: 'Browser application',
    role: 'Design & development',
    year: '2026',
    stack: ['React 19', 'Vite', 'Tailwind CSS', 'Canvas API'],
    live: 'https://kilo.madebygio.dev',
    source: `${toolsBase}/03-image-compressor`,
    image: kilo,
    alt: 'KILO ("smaller.") on a dark canvas: the headline "Make images lighter", a large dashed drop zone for JPG, PNG, WebP, AVIF, GIF, BMP and SVG, and a "100% private · processed on your device" badge',
    accent: '#c9e28a',
    facts: [
      { label: 'Batch processing', text: 'Drop many images at once; each one is converted, resized and compressed on your own device.' },
      { label: 'Visual comparison', text: 'Before-and-after preview so quality changes are seen, not guessed.' },
      { label: 'Formats', text: 'JPG, PNG, WebP, AVIF, GIF, BMP and SVG in; modern formats out.' },
    ],
    story: [
      { heading: 'Why', body: ['Image tools that upload your photos to a server are slow and a little uncomfortable. KILO does the work with the Canvas API in the tab, which turned out to be fast enough for whole folders of photographs.'] },
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
];

export const flagship = projects.find(p => p.flagship)!;
export const tools = projects.filter(p => !p.flagship);
export const getProject = (slug: string) => projects.find(p => p.slug === slug);
