# Field Notes on Kettle Design

A short document that exercises everything the exporter handles — headings,
emphasis, links, lists, quotes, tables, code and images. Edit it, or select all
and start over.

## Why the whistle matters

The whistle is not decoration. It is the only part of the kettle that reports
**state** without being looked at, which makes it the single most useful
component in the object. Remove it and you have built a pot.

> A tool that cannot tell you what it is doing is a tool you have to watch.
> Watching is work. The whistle is the kettle doing that work for you.

Three things follow from that:

1. The signal must be **unambiguous** — one sound, one meaning.
2. It must arrive *before* the failure state, not during it.
3. It must be possible to ignore deliberately, but not accidentally.

### Materials, briefly

- **Stainless steel** — forgiving, dull, will outlive you
- **Copper** — beautiful, needy, conducts far better than it looks
- **Enamel over steel** — chips at the rim, always at the rim
  - Reglazing is possible but rarely worth it
  - Assume a five-year life in daily use

## Measurements

| Vessel | Capacity | Time to boil | Whistle |
| --- | --- | --- | --- |
| Stovetop, steel | 1.7 L | 8 min 20 s | Yes |
| Stovetop, copper | 1.2 L | 5 min 40 s | Yes |
| Electric, plastic | 1.7 L | 3 min 10 s | No |
| Electric, glass | 1.0 L | 2 min 45 s | No |

Electric wins on time and loses on everything else. Note what happens to the
whistle column as speed goes up.

## A model of the thing

```javascript
// Whistling starts once the vapour rate clears the aperture threshold.
function whistleState({ tempC, volumeL, apertureMm }) {
  if (tempC < 100) return 'silent'
  const vapourRate = (tempC - 99) * (1 / volumeL) * 40
  const threshold = apertureMm * 1.8
  return vapourRate > threshold ? 'whistling' : 'building'
}

console.log(whistleState({ tempC: 100.4, volumeL: 1.2, apertureMm: 6 }))
```

The threshold term is why a wide spout on a small kettle never quite sings: the
vapour escapes faster than it can build pressure. Use `apertureMm` under 7 for
anything below 1.5 litres.

## Checklist before you buy

- [x] Pick it up empty — the handle tells you most of what you need
- [x] Check the lid seats without force
- [ ] Fill it at the tap; a bad spout reveals itself immediately
- [ ] Listen to one boil before committing

---

### Further reading

- [The Design of Everyday Things](https://en.wikipedia.org/wiki/The_Design_of_Everyday_Things) — the standard reference
- Anything by ~~Dieter Rams~~ **Dieter Rams**, repeatedly

*Drag an image file straight into the editor to embed it — it is stored inside
the document, so the PDF works offline.*
