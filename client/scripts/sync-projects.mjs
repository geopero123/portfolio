#!/usr/bin/env node
/**
 * Syncs the standalone HTML tools from the repo root into client/public/projects/<slug>/
 * and generates src/data/projects.generated.json.
 *
 * Discovery rules (repo root = one level above client/, i.e. the repo root
 * that also holds package.json/client/server — tools live there so the whole
 * repo is self-contained and deployable on its own, e.g. to Vercel):
 *   - any directory containing an index.html  -> copied recursively
 *   - any top-level *.html file               -> copied as <slug>/index.html
 * Directories named in EXCLUDED_DIRS and dot-directories are skipped.
 *
 * Presentation metadata (pretty slug, accent, tags, order) lives in
 * src/data/project-meta.json, keyed by the discovered id (folder / file name).
 * Tools without an entry there still appear, with defaults derived from their
 * file name and <title> — drop a new tool folder in the repo root and rerun.
 */
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const clientDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const repoRoot = path.resolve(clientDir, '..')
const outDir = path.join(clientDir, 'public', 'projects')
const manifestFile = path.join(clientDir, 'src', 'data', 'projects.generated.json')
const metaFile = path.join(clientDir, 'src', 'data', 'project-meta.json')

const EXCLUDED_DIRS = new Set(['client', 'server', 'api', 'node_modules'])

const meta = JSON.parse(await fsp.readFile(metaFile, 'utf8'))

const entries = await fsp.readdir(repoRoot, { withFileTypes: true })
const found = []
for (const entry of entries) {
  if (entry.name.startsWith('.')) continue
  const full = path.join(repoRoot, entry.name)
  if (entry.isDirectory()) {
    if (EXCLUDED_DIRS.has(entry.name)) continue
    if (!fs.existsSync(path.join(full, 'index.html'))) continue
    found.push({
      id: entry.name,
      kind: 'folder',
      source: `${entry.name}/`,
      indexFile: path.join(full, 'index.html'),
      copy: (dest) => fsp.cp(full, dest, { recursive: true }),
    })
  } else if (entry.isFile() && /\.html?$/i.test(entry.name)) {
    found.push({
      id: entry.name.replace(/\.html?$/i, ''),
      kind: 'single-file',
      source: entry.name,
      indexFile: full,
      copy: async (dest) => {
        await fsp.mkdir(dest, { recursive: true })
        await fsp.copyFile(full, path.join(dest, 'index.html'))
      },
    })
  }
}

await fsp.rm(outDir, { recursive: true, force: true })
await fsp.mkdir(outDir, { recursive: true })

const manifest = []
for (const project of found) {
  const slug = meta[project.id]?.slug ?? project.id
  await project.copy(path.join(outDir, slug))
  const html = await fsp.readFile(project.indexFile, 'utf8')
  const title = /<title>([^<]*)<\/title>/i.exec(html)?.[1]?.trim() || slug
  manifest.push({
    id: project.id,
    slug,
    title,
    source: project.source,
    kind: project.kind,
    // Explicit file path: Vite's dev server does not resolve directory
    // indexes inside public/, and relative assets resolve the same either way.
    url: `/projects/${slug}/index.html`,
  })
}

manifest.sort(
  (a, b) =>
    (meta[a.id]?.order ?? 99) - (meta[b.id]?.order ?? 99) || a.slug.localeCompare(b.slug),
)
await fsp.writeFile(manifestFile, JSON.stringify(manifest, null, 2) + '\n')

console.log(`[sync-projects] ${manifest.length} project(s) -> public/projects/`)
for (const m of manifest) console.log(`  - ${m.slug}  (${m.source})  "${m.title}"`)
