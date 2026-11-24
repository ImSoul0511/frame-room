import type { genres } from '@frameroom/shared';

export type Genre = (typeof genres)[number];

// Unsplash reference photographs, following the existing demo media source.
// These illustrate genres and are never attributed to a listed provider.
export const genreArt: Record<Genre, string> = {
  portrait: 'photo-1534528741775-53994a69daeb',
  fashion: 'photo-1483985988355-763728e1935b',
  wedding: 'photo-1519741497674-611481863552',
  family: 'photo-1511895426328-dc8714191300',
  product: 'photo-1523275335684-37898b6baf30',
  food: 'photo-1546069901-ba9599a7e63c',
  event: 'photo-1511285560929-80b456fea0bc',
  cosplay: 'photo-1490481651871-ab68de25d43d',
  drink: 'photo-1513558161293-cdaf765edfd7',
  yearbook: 'photo-1523050854058-8df90110c9f1',
  outdoor: 'photo-1472396961693-142e6e269027',
  tet_holiday: 'photo-1511632765486-a01980e01a18',
};

export const genreImage = (genre: Genre) =>
  `https://images.unsplash.com/${genreArt[genre]}?auto=format&fit=crop&w=1000&q=85`;
