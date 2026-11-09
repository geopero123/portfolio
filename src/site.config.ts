/**
 * Public identity. Only add contact details that are approved for publication:
 * every empty value below is simply not rendered anywhere on the site.
 */
export const SITE = {
  url: "https://madebygio.dev",
  name: "madebygio",
  author: "Gio",
  fullName: "Giorgi",
  role: "React Developer",
  titleDefault: "Giorgi · React Developer - madebygio",
  description: "Giorgi (Gio), React developer. I build React apps like Tempest Archive, a spoiler-aware reference site, and browser tools that process files on your device.",
  ogImage: "/social-card.png",
  socials: {
    github: "https://github.com/geopero123",
    /** Full https://www.linkedin.com/in/... URL. */
    linkedin: "" as string,
    /** A plain address, e.g. "hello@madebygio.dev" (no mailto:). */
    email: "giorgi@madebygio.dev" as string,
  },
  /** Path to a résumé PDF in /public, e.g. "/giorgi-resume.pdf". */
  resume: "/giorgi-resume.pdf" as string,
  projectsRepository: "https://github.com/geopero123/Portfolio-setup/tree/claude/five-utility-react-apps-ajzt9l",
  /** This site's source. The repository's default branch holds the older portfolio. */
  siteSource: "https://github.com/geopero123/portfolio/tree/local/current-site",
} as const;

export type Site = typeof SITE;

/** Contact channels that actually have a value, in order of preference. */
export const contactLinks = () => [
  SITE.socials.email && { kind: 'email', label: 'Email', value: SITE.socials.email, href: `mailto:${SITE.socials.email}`, external: false },
  SITE.socials.linkedin && { kind: 'linkedin', label: 'LinkedIn', value: SITE.socials.linkedin.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, ''), href: SITE.socials.linkedin, external: true },
  { kind: 'github', label: 'GitHub', value: SITE.socials.github.replace(/^https?:\/\//, ''), href: SITE.socials.github, external: true },
].filter(Boolean) as { kind: 'email' | 'linkedin' | 'github'; label: string; value: string; href: string; external: boolean }[];
