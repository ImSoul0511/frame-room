import type { genres } from '@frameroom/shared';

export type Genre = (typeof genres)[number];

// Vite emits content-hashed URLs, so replacing a photograph invalidates its browser cache.
const samples = import.meta.glob<string>('../../assets/genres/*.webp', {
  eager: true,
  query: '?url',
  import: 'default',
});

export const genreImages = (genre: Genre) =>
  [genre, `${genre}2`]
    .map((name) => samples[`../../assets/genres/${name}.webp`])
    .filter((src): src is string => Boolean(src));
