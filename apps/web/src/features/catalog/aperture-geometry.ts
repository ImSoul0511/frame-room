import { genres } from '@frameroom/shared';

export const GENRE_STEP = 360 / genres.length;
export const wrapGenre = (index: number) =>
  ((index % genres.length) + genres.length) % genres.length;

export function pointerAngle(x: number, y: number, centerX: number, centerY: number) {
  return (Math.atan2(y - centerY, x - centerX) * 180) / Math.PI;
}

export function angularDelta(previous: number, next: number) {
  return ((next - previous + 540) % 360) - 180;
}

export function nearestGenreAngle(angle: number, index: number) {
  const step = Math.round(angle / GENRE_STEP);
  const difference = angularDelta(wrapGenre(step) * GENRE_STEP, wrapGenre(index) * GENRE_STEP);
  return step * GENRE_STEP + difference;
}
