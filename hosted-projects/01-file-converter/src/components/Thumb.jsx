import Element from './Element.jsx'
import { elementForFile } from '../lib/elements.js'

/** Images show their own pixels inside the element tile; everything else shows its symbol. */
export default function Thumb({ item }) {
  const el = elementForFile(item.file, item.source)
  if (item.url) {
    return (
      <div className="el el-sm size-[52px] shrink-0 overflow-hidden !p-0" data-family={el.family}>
        <img src={item.url} alt="" className="size-full object-cover" loading="lazy" />
        <span className="absolute bottom-0.5 left-1 rounded-sm bg-ink px-1 font-mono text-[8.5px] font-medium uppercase text-paper">{el.sym}</span>
      </div>
    )
  }
  return <Element el={el} small className="size-[52px] shrink-0" />
}
