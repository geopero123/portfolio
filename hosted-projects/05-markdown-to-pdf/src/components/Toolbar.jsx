import {
  Bold, Code, Heading2, Image as ImageIcon, Italic, Link2, List, ListOrdered, Quote, Table, Minus,
} from 'lucide-react'

const GROUPS = [
  [
    { id: 'bold', Icon: Bold, title: 'Bold', keys: '⌘B' },
    { id: 'italic', Icon: Italic, title: 'Italic', keys: '⌘I' },
    { id: 'code', Icon: Code, title: 'Inline code' },
    { id: 'link', Icon: Link2, title: 'Link', keys: '⌘K' },
  ],
  [
    { id: 'heading', Icon: Heading2, title: 'Heading' },
    { id: 'quote', Icon: Quote, title: 'Blockquote' },
    { id: 'ul', Icon: List, title: 'Bulleted list' },
    { id: 'ol', Icon: ListOrdered, title: 'Numbered list' },
  ],
  [
    { id: 'table', Icon: Table, title: 'Table' },
    { id: 'rule', Icon: Minus, title: 'Horizontal rule' },
    { id: 'image', Icon: ImageIcon, title: 'Insert image' },
  ],
]

export default function Toolbar({ onAction }) {
  return (
    <div className="scroll-quiet flex items-center gap-0.5 overflow-x-auto border-b border-rule px-2 py-1.5">
      {GROUPS.map((group, gi) => (
        <div key={gi} className="flex items-center gap-0.5">
          {gi > 0 && <span className="mx-1.5 h-4 w-px shrink-0 bg-rule" />}
          {group.map(({ id, Icon, title, keys }) => (
            <button
              key={id}
              type="button"
              onMouseDown={(e) => e.preventDefault()} // keep the caret where it is
              onClick={() => onAction(id)}
              title={keys ? `${title}  ${keys}` : title}
              aria-label={title}
              className="grid size-7 shrink-0 place-items-center rounded-md text-ink-3 transition hover:bg-sunk hover:text-ink"
            >
              <Icon className="size-4" strokeWidth={1.9} />
            </button>
          ))}
        </div>
      ))}
    </div>
  )
}
