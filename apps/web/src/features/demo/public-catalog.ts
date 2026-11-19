import type { ProviderDetail } from '../../lib/types';
import type { CardProvider } from '../catalog/ProviderCard';
import { isPhotographer } from './permissions';
import { placeholderPhoto } from './seed';
import type { DemoRole, DemoState } from './types';

export function getDemoProviderDetail(
  state: DemoState,
  id: string,
  text: (value: string) => string,
  image: (url: string, index?: number) => string,
): ProviderDetail | null {
  const studio = state.studios.find((value) => value.id === id);
  const profile = state.profiles[id];
  if (!studio && (!profile || !isPhotographer(id as DemoRole))) return null;
  const albums = state.albums.filter(
    (album) =>
      album.owner === id &&
      album.published &&
      !album.hidden &&
      !state.hiddenTargets.includes(album.id),
  );
  const services = state.services.filter((service) => service.owner === id && service.published);
  if (!albums.length && !services.length) return null;
  const reviews = state.reviews.filter(
    (review) =>
      !review.hidden &&
      !review.deleted &&
      state.bookings.some((booking) => booking.id === review.booking && booking.provider === id),
  );
  const genres = studio
    ? [
        ...new Set([
          ...services.map((service) => service.genre),
          ...albums.map((album) => album.genre),
        ]),
      ]
    : profile.genres;
  return {
    provider: {
      id,
      type: studio ? 'studio' : 'photographer',
      displayName: text(studio?.name ?? profile.name),
      bio: text(studio?.description ?? profile.bio),
      city: studio?.city ?? profile.city,
      district: '',
      genres,
      styles: [...new Set(albums.flatMap((album) => album.tags))],
      priceFrom: services.length ? Math.min(...services.map((service) => service.price)) : null,
      ratingAvg: reviews.length
        ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length
        : null,
      reviewCount: reviews.length,
    },
    portfolios: albums.map((album, index) => ({
      id: album.id,
      title: text(album.title),
      description: text(album.description),
      genre: album.genre,
      status: 'published',
      ownerType: studio ? 'studio' : 'photographer',
      studioId: studio?.id ?? null,
      coverUrl: image(
        album.photos.find((photo) => !photo.hidden && !state.hiddenTargets.includes(photo.id))
          ?.url ?? placeholderPhoto(index),
        index,
      ),
    })),
    services: services.map((service) => ({
      id: service.id,
      ownerType: studio ? 'studio' : 'photographer',
      photographerId: studio ? null : id,
      studioId: studio?.id ?? null,
      name: text(service.name),
      description: text(service.description),
      genre: service.genre,
      durationMinutes: service.duration,
      price: service.price,
      photoCount: service.photos,
      retouchedCount: service.retouched,
      isActive: service.published,
    })),
    reviews: reviews.map((review) => ({
      id: review.id,
      rating: review.rating,
      comment: review.comment,
      authorName: text(state.profiles.client.name),
    })),
  };
}
export function getDemoProviderCards(
  state: DemoState,
  text: (value: string) => string,
  image: (url: string, index?: number) => string,
): CardProvider[] {
  return [
    ...Object.keys(state.profiles).filter((role) => isPhotographer(role as DemoRole)),
    ...state.studios
      .filter((studio) => !state.representatives[studio.id])
      .map((studio) => studio.id),
  ].flatMap((id) => {
    const detail = getDemoProviderDetail(state, id, text, image);
    return detail
      ? [
          {
            ...detail.provider,
            coverUrl: detail.portfolios[0]?.coverUrl ?? image(placeholderPhoto(0)),
            isDemo: true,
          },
        ]
      : [];
  });
}
