const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const rolls = new Set<Animation>();

reducedMotion.addEventListener('change', () => {
  if (reducedMotion.matches) rolls.forEach(animation => animation.cancel());
});

export function rollDigits(odometer: Element, from: string, delay = 0) {
  if (reducedMotion.matches) return;
  const tracks = [...odometer.querySelectorAll<HTMLElement>('.digit-roll')];
  const previous = from.padStart(tracks.length, '0').slice(-tracks.length);
  tracks.forEach((track, index) => {
    const start = Number(previous[index]);
    const finish = Number(track.style.getPropertyValue('--d'));
    if (start === finish) return;
    track.getAnimations().forEach(animation => animation.cancel());
    const animation = track.animate([
      { transform: `translateY(${-start}em)` },
      { transform: `translateY(${-finish}em)` },
    ], { duration: 560, delay, fill: 'backwards', easing: 'cubic-bezier(.16,1,.3,1)' });
    rolls.add(animation);
    const remove = () => { rolls.delete(animation); };
    animation.addEventListener('finish', remove, { once: true });
    animation.addEventListener('cancel', remove, { once: true });
  });
}
