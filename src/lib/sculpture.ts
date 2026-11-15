/** Deterministic geometry rendered at build time. */
export const RING_COUNT = 48;
export const sculptureShapes = [
  { id: 'ribbon', name: 'Ribbon' },
  { id: 'orbit', name: 'Orbit' },
  { id: 'knot', name: 'Knot' },
] as const;
type Shape = typeof sculptureShapes[number]['id'];
const TAU = Math.PI * 2;

function makeProjection(pitch: number, yaw: number, roll: number) {
  const cx = Math.cos(pitch), sx = Math.sin(pitch);
  const cy = Math.cos(yaw), sy = Math.sin(yaw);
  const cz = Math.cos(roll), sz = Math.sin(roll);
  return (x: number, y: number, z: number) => {
    const y1 = y * cx - z * sx, z1 = y * sx + z * cx;
    const x2 = x * cy + z1 * sy, z2 = -x * sy + z1 * cy;
    const perspective = 700 / (700 - z2);
    return `${(260 + (x2 * cz - y1 * sz) * perspective).toFixed(1)},${(258 + (x2 * sz + y1 * cz) * perspective).toFixed(1)}`;
  };
}
const projectRibbon = makeProjection(.92, -.26, -.38);
const projectKnot = makeProjection(.64, -.2, -.25);

export function shapePath(ring: number, morph = 0): string {
  const v = ring / RING_COUNT * TAU;
  const r = 148 + 53 * Math.cos(v);
  const depth = 53 * Math.sin(v);
  const points: string[] = [];
  for (let step = 0; step <= 100; step++) {
    const u = step / 100 * TAU;
    const z = depth + (1 - morph) * 69 * Math.sin(u * 2);
    points.push((step === 0 ? 'M' : 'L') + projectRibbon(r * Math.cos(u), r * Math.sin(u), z));
  }
  return points.join(' ') + 'Z';
}

function knotPath(ring: number): string {
  const v = ring / RING_COUNT * TAU;
  const cv = Math.cos(v), sv = Math.sin(v);
  const base = 126, lobe = 58, radius = 23;
  const points: string[] = [];
  for (let step = 0; step <= 120; step++) {
    const u = step / 120 * TAU;
    // The tube runs twice around the axis and three times around the torus cross-section.
    const a = Math.cos(2 * u), b = Math.sin(2 * u);
    const c = Math.cos(3 * u), s = Math.sin(3 * u);
    const r = base + lobe * c;
    const dx = -3 * lobe * s * a - 2 * r * b;
    const dy = -3 * lobe * s * b + 2 * r * a;
    const dz = 3 * lobe * c;
    const length = Math.hypot(dx, dy, dz);
    const nx = a * c, ny = b * c, nz = s;
    // The cross product gives the second axis of the circular tube cross-section.
    const bx = (dy * nz - dz * ny) / length;
    const by = (dz * nx - dx * nz) / length;
    const bz = (dx * ny - dy * nx) / length;
    const x = r * a + radius * (nx * cv + bx * sv);
    const y = r * b + radius * (ny * cv + by * sv);
    const z = lobe * s + radius * (nz * cv + bz * sv);
    points.push((step === 0 ? 'M' : 'L') + projectKnot(x, y, z));
  }
  return points.join(' ') + 'Z';
}

export function wireArtwork(shape: Shape) {
  const path = Array.from({length: RING_COUNT}, (_, ring) => shape === 'knot' ? knotPath(ring) : shapePath(ring, Number(shape === 'orbit'))).join('');
  return `<defs><linearGradient id="copper" x1="70" y1="80" x2="420" y2="430" gradientUnits="userSpaceOnUse"><stop stop-color="#ffd0a6"/><stop offset=".4" stop-color="#f78152"/><stop offset=".75" stop-color="#bc4926"/><stop offset="1" stop-color="#ffc098"/></linearGradient></defs><path d="${path}" fill="none" stroke="url(#copper)" stroke-width=".9"/>`;
}
