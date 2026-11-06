/**
 * A standalone HTML document: styles inlined, no external requests, readable in
 * light and dark. It is meant to survive being emailed to someone.
 */
export function buildHtmlDocument(bodyHtml, title) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title || 'Document')}</title>
<style>
  :root { color-scheme: light dark; --ink:#1a1a17; --ink-2:#43423c; --ink-3:#767469;
          --ground:#faf9f6; --sunk:#f2f0ea; --rule:#e5e2da; --accent:#5d7049; }
  @media (prefers-color-scheme: dark) {
    :root { --ink:#eceade; --ink-2:#c4c2b4; --ink-3:#8d8b7e;
            --ground:#15150f; --sunk:#22221b; --rule:#2f2f27; --accent:#a8c188; }
  }
  body { margin:0; background:var(--ground); color:var(--ink);
         font:16.5px/1.72 ui-serif, Georgia, "Times New Roman", serif; }
  main { max-width: 40rem; margin: 0 auto; padding: 4rem 1.5rem 6rem; }
  h1,h2,h3,h4,h5,h6 { line-height:1.24; margin:2em 0 .55em; font-weight:600; letter-spacing:-.011em; }
  h1 { font-size:2.05em; margin-top:0; letter-spacing:-.02em; }
  h2 { font-size:1.48em; padding-bottom:.28em; border-bottom:1px solid var(--rule); }
  h3 { font-size:1.2em; } h4 { font-size:1.03em; color:var(--ink-2); }
  h5,h6 { font-size:.95em; color:var(--ink-3); text-transform:uppercase; letter-spacing:.06em; }
  p { margin:0 0 1.05em; }
  a { color:var(--accent); text-underline-offset:2px; }
  ul,ol { margin:0 0 1.05em; padding-left:1.5em; } li { margin-bottom:.35em; }
  blockquote { margin:1.4em 0; padding:.15em 0 .15em 1.15em; border-left:2px solid var(--accent);
               color:var(--ink-2); font-style:italic; }
  hr { margin:2.4em 0; border:0; border-top:1px solid var(--rule); }
  img { max-width:100%; height:auto; border-radius:3px; }
  code { font-family:ui-monospace,Menlo,monospace; font-size:.855em; background:var(--sunk);
         border:1px solid var(--rule); border-radius:4px; padding:.1em .34em; }
  pre { margin:1.4em 0; padding:.95em 1.1em; background:var(--sunk); border:1px solid var(--rule);
        border-radius:7px; overflow-x:auto; line-height:1.6; }
  pre code { font-size:.82em; background:none; border:0; padding:0; }
  table { width:100%; margin:1.5em 0; border-collapse:collapse; font-size:.92em; }
  th,td { border-bottom:1px solid var(--rule); padding:.5em .7em; text-align:left; vertical-align:top; }
  thead th { border-bottom:1.5px solid var(--ink-3); font-weight:620; }
  .hljs-comment { color:var(--ink-3); font-style:italic; }
  .hljs-keyword,.hljs-literal,.hljs-type { color:var(--accent); font-weight:600; }
  .hljs-string { color:var(--ink-2); } .hljs-number { color:#a8452f; }
  .hljs-title { font-weight:620; }
</style>
</head>
<body>
<main>
${bodyHtml}
</main>
</body>
</html>`
}

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export function saveBlob(blob, name) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}
