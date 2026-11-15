/** One format, drawn as a periodic-table element. */
export default function Element({ el, small = false, as: Tag = 'div', className = '', style, ...props }) {
  if (!el) return null
  return (
    <Tag className={`el ${small ? 'el-sm' : ''} ${className}`} data-family={el.family} style={style} {...props}>
      <span className="el-n tnum" aria-hidden="true">{el.n || '–'}</span>
      <span className="el-sym" aria-hidden="true">{el.sym}</span>
      <span className="el-name" aria-hidden={Tag === 'button' ? undefined : 'true'}>{el.name}</span>
    </Tag>
  )
}

/** A word on split-flap tiles; every change flips the letters. */
export function SplitFlap({ text, className = '' }) {
  return (
    <span key={text} className={`flap min-w-[2.3em] ${className}`} aria-hidden="true">
      <span className="flex">
        {[...text].map((ch, i) => (
          <span key={i} className="inline-block" style={{ animation: 'flap .42s var(--ease) both', animationDelay: `${i * 70}ms`, transformOrigin: '50% 0' }}>
            {ch}
          </span>
        ))}
      </span>
    </span>
  )
}
