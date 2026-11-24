import { describe, expect, it } from 'vitest';
import { angularDelta, nearestGenreAngle, pointerAngle, wrapGenre } from './aperture-geometry';

describe('aperture drag geometry', () => {
  it('keeps clockwise dragging continuous across the polar angle boundary', () => {
    expect(angularDelta(179, -179)).toBe(2);
    expect(angularDelta(-179, 179)).toBe(-2);
  });
  it('measures dragging relative to the circle centre even when it is outside the viewport', () => {
    expect(pointerAngle(80, 100, -20, 100)).toBe(0);
    expect(pointerAngle(-20, 200, -20, 100)).toBe(90);
  });
  it('selects the neighbouring genre across the last/first boundary without a full turn', () => {
    expect(nearestGenreAngle(330, 0)).toBe(360);
    expect(nearestGenreAngle(0, 11)).toBe(-30);
  });
  it('preserves accumulated turns after repeated dragging', () => {
    expect(nearestGenreAngle(1080, 1)).toBe(1110);
    expect(nearestGenreAngle(-720, 11)).toBe(-750);
    expect(wrapGenre(-25)).toBe(11);
  });
});
