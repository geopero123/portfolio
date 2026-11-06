/** Text transforms for the editor toolbar and its keyboard shortcuts. */

/** Wraps or unwraps the selection — pressing bold twice gets you back. */
export function toggleWrap(value, start, end, before, after = before) {
  const selected = value.slice(start, end)
  const outerBefore = value.slice(Math.max(0, start - before.length), start)
  const outerAfter = value.slice(end, end + after.length)

  if (outerBefore === before && outerAfter === after) {
    return {
      value: value.slice(0, start - before.length) + selected + value.slice(end + after.length),
      start: start - before.length,
      end: end - before.length,
    }
  }
  if (selected.startsWith(before) && selected.endsWith(after) && selected.length >= before.length + after.length) {
    const inner = selected.slice(before.length, selected.length - after.length)
    return { value: value.slice(0, start) + inner + value.slice(end), start, end: start + inner.length }
  }
  return {
    value: value.slice(0, start) + before + selected + after + value.slice(end),
    start: start + before.length,
    end: end + before.length,
  }
}

function lineBounds(value, start, end) {
  const from = value.lastIndexOf('\n', start - 1) + 1
  let to = value.indexOf('\n', end)
  if (to === -1) to = value.length
  return [from, to]
}

/** Adds or removes a line prefix across every line the selection touches. */
export function togglePrefix(value, start, end, prefix, { numbered = false } = {}) {
  const [from, to] = lineBounds(value, start, end)
  const block = value.slice(from, to)
  const lines = block.split('\n')
  const pattern = numbered ? /^\d+\.\s/ : new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`)
  const allPrefixed = lines.every((l) => !l.trim() || pattern.test(l))

  const next = lines
    .map((line, i) => {
      if (!line.trim()) return line
      if (allPrefixed) return line.replace(pattern, '')
      return (numbered ? `${i + 1}. ` : prefix) + line
    })
    .join('\n')

  return { value: value.slice(0, from) + next + value.slice(to), start: from, end: from + next.length }
}

export function insertAt(value, start, end, text, { selectOffset, selectLength } = {}) {
  const next = value.slice(0, start) + text + value.slice(end)
  const caret = start + (selectOffset ?? text.length)
  return { value: next, start: caret, end: caret + (selectLength ?? 0) }
}

export const TABLE_SNIPPET = `
| Column | Column | Column |
| --- | --- | --- |
| Cell | Cell | Cell |
| Cell | Cell | Cell |
`

/** Two spaces, because a literal tab in markdown starts a code block. */
export function indentSelection(value, start, end, outdent = false) {
  const [from, to] = lineBounds(value, start, end)
  const block = value.slice(from, to)
  if (start === end && !outdent) {
    return { value: value.slice(0, start) + '  ' + value.slice(end), start: start + 2, end: start + 2 }
  }
  const next = block
    .split('\n')
    .map((l) => (outdent ? l.replace(/^ {1,2}/, '') : `  ${l}`))
    .join('\n')
  return { value: value.slice(0, from) + next + value.slice(to), start: from, end: from + next.length }
}
