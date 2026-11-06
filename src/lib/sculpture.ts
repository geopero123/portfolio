/** Deterministic geometry shared by SSR and the interactive SVG. No WebGL runtime. */
export const RING_COUNT = 48;
const TAU = Math.PI * 2;
export function shapePath(ring: number, morph = 0, pitch = 0, yaw = 0): string {
  const v = ring / RING_COUNT * TAU;
  const ax = .92 + pitch, ay = -.26 + yaw, az = -.38;
  const cx = Math.cos(ax), sx = Math.sin(ax), cy = Math.cos(ay), sy = Math.sin(ay);
  const cz = Math.cos(az), sz = Math.sin(az);
  const points: string[] = [];
  for (let step = 0; step <= 100; step++) {
    const u = step / 100 * TAU;
    const r = 148 + 53 * Math.cos(v);
    const x = r * Math.cos(u), y = r * Math.sin(u);
    const z = 53 * Math.sin(v) + (1-morph) * 69 * Math.sin(u*2);
    const y1 = y*cx-z*sx, z1 = y*sx+z*cx;
    const x2 = x*cy+z1*sy, z2 = -x*sy+z1*cy;
    const perspective = 700 / (700-z2);
    points.push(`${step === 0 ? 'M' : 'L'}${(260+(x2*cz-y1*sz)*perspective).toFixed(1)},${(258+(x2*sz+y1*cz)*perspective).toFixed(1)}`);
  }
  return points.join(' ')+'Z';
}
