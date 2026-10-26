/** Public identity. Only add contact addresses approved for publication. */
export const SITE = {
  url: "https://madebygio.dev",
  name: "madebygio",
  author: "Gio",
  fullName: "Giorgi",
  role: "React & Full-Stack Web Developer",
  titleDefault: "Gio - React & Full-Stack Web Developer",
  description: "I'm Gio, a React and full-stack web developer. I build websites and web applications with care for how they look, work and feel - from focused browser tools to Tempest Archive, a full content platform.",
  ogImage: "/social-card.png",
  socials: {
    github: "https://github.com/geopero123",
    linkedin: "",
    email: "mailto:giorgigiorgashvili2009@gmail.com",
  },
  projectsRepository: "https://github.com/geopero123/Portfolio-setup",
} as const;

export type Site = typeof SITE;
