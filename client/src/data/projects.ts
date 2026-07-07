import generated from './projects.generated.json'
import meta from './project-meta.json'

export interface Project {
  /** Discovered id — the folder or file name in the repo root. */
  id: string
  /** URL-facing slug (pretty name from project-meta.json when present). */
  slug: string
  /** The tool's own <title>, extracted by scripts/sync-projects.mjs. */
  title: string
  name: string
  tagline: string
  accent: string
  glyph: string
  tags: string[]
  /** Where the embedded copy is served from ("/projects/<slug>/"). */
  url: string
  /** Original location in the repo root. */
  source: string
}

interface ProjectMeta {
  slug?: string
  name?: string
  tagline?: string
  accent?: string
  glyph?: string
  order?: number
  tags?: string[]
}

const metaById = meta as Record<string, ProjectMeta>

export const projects: Project[] = generated.map((entry) => {
  const overrides = metaById[entry.id] ?? {}
  const [titleName, titleTagline] = entry.title.split('—').map((part) => part.trim())
  return {
    id: entry.id,
    slug: entry.slug,
    title: entry.title,
    name: overrides.name ?? titleName ?? entry.slug,
    tagline: overrides.tagline ?? titleTagline ?? '',
    accent: overrides.accent ?? '#f5b942',
    glyph: overrides.glyph ?? '▪',
    tags: overrides.tags ?? ['HTML', 'CSS', 'JavaScript'],
    url: entry.url,
    source: entry.source,
  }
})

export function findProject(slug: string | undefined): Project | undefined {
  return projects.find((project) => project.slug === slug)
}
