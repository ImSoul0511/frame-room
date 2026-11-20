import type { QueryClient } from '@tanstack/react-query';

/** Related resources refreshed after a write from each workspace. */
export function mutationResources(pathname: string): string[] {
  if (pathname.startsWith('/projects')) return ['/v1/creative-projects'];
  if (pathname.startsWith('/bookings'))
    return [
      '/v1/bookings',
      '/v1/creative-projects',
      '/v1/me/timeline',
      '/v1/me/calendar',
      '/v1/me/schedule',
      '/v1/me/notifications',
      '/v1/conversations',
    ];
  if (pathname.startsWith('/messages')) return ['/v1/conversations', '/v1/me/notifications'];
  if (pathname.startsWith('/studio'))
    return [
      '/v1/studios',
      '/v1/me/studios',
      '/v1/me/invitations',
      '/v1/me/services',
      '/v1/me/schedule',
      '/v1/me/calendar',
      '/v1/bookings',
      '/v1/explore',
    ];
  if (pathname.startsWith('/portfolio') || pathname.startsWith('/settings'))
    return [
      '/v1/me',
      '/v1/me/calendar',
      '/v1/photographers',
      '/v1/portfolios',
      '/v1/studios',
      '/v1/services',
      '/v1/explore',
    ];
  if (pathname.startsWith('/admin'))
    return [
      '/v1/admin',
      '/v1/bookings',
      '/v1/portfolios',
      '/v1/photographers',
      '/v1/studios',
      '/v1/explore',
    ];
  if (pathname.startsWith('/providers')) return ['/v1/conversations'];
  if (pathname.startsWith('/notifications')) return ['/v1/me/notifications'];
  return [];
}
export function matchesResource(path: unknown, resources: readonly string[]) {
  return (
    typeof path === 'string' &&
    resources.some(
      (resource) =>
        path === resource || path.startsWith(`${resource}/`) || path.startsWith(`${resource}?`),
    )
  );
}
export function invalidateResources(client: QueryClient, resources: readonly string[]) {
  return client.invalidateQueries({
    predicate: (query) =>
      query.queryKey[0] === 'api' && matchesResource(query.queryKey[2], resources),
  });
}
