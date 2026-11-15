#!/usr/bin/env bash
# Publish the five browser tools to their subdomains with the Vercel CLI.
#
#   npm run publish:tools              # all five
#   npm run publish:tools -- convert   # just one (convert, folio, qr, quire, kilo)
#
# Each tool folder is deployed on its own from hosted-projects/<folder>, so its
# Vercel project must have no Root Directory set. The first run in a folder
# links it to its project (creates a gitignored .vercel/ there); after that,
# this is one command. Needs `vercel login` once on this machine.
set -euo pipefail

cd "$(dirname "$0")/.."

# name => folder => Vercel project
TOOLS=(
  "convert|01-file-converter|madebygio-convert"
  "folio|02-pdf-toolkit|madebygio-folio"
  "qr|04-qr-generator|madebygio-qr"
  "quire|05-markdown-to-pdf|madebygio-quire"
  "kilo|03-smaller|madebygio-kilo"
)
SCOPE="geopero123s-projects"
ONLY="${1:-}"

if ! npx --yes vercel@latest whoami >/dev/null 2>&1; then
  echo "Not logged in to Vercel. Run: npx vercel@latest login" >&2
  exit 1
fi

for entry in "${TOOLS[@]}"; do
  IFS='|' read -r name folder project <<<"$entry"
  if [[ -n "$ONLY" && "$ONLY" != "$name" ]]; then continue; fi

  dir="hosted-projects/$folder"
  echo "==> $name ($dir -> $project)"
  if [[ ! -f "$dir/.vercel/project.json" ]]; then
    (cd "$dir" && npx --yes vercel@latest link --yes --project "$project" --scope "$SCOPE")
  fi
  (cd "$dir" && npx --yes vercel@latest deploy --prod --yes)
done

echo "Done. Live: convert, folio, qr, quire, kilo .madebygio.dev"
