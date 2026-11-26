import { findVietnamLocality } from '@frameroom/shared';

export function provinceNames(city: string): string[] {
  const locality = findVietnamLocality(city);
  return locality ? [...new Set([locality.name, locality.english, ...locality.aliases])] : [city];
}
