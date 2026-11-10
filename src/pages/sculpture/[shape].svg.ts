import type { APIRoute } from 'astro';
import { sculptureShapes, wireArtwork } from '../../lib/sculpture';

export function getStaticPaths() {
  return sculptureShapes.slice(1).map(({ id }) => ({ params: { shape: id }, props: { shape: id } }));
}

export const GET: APIRoute = ({ props }) => new Response(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 520" width="520" height="520">${wireArtwork(props.shape)}</svg>`,
  { headers: { 'Content-Type': 'image/svg+xml' } },
);
