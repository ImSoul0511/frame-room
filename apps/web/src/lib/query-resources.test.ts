import { describe, expect, it } from 'vitest';
import { matchesResource, mutationResources } from './query-resources';
describe('workspace invalidation', () => {
  it('refreshes booking dependents without invalidating the catalog', () => {
    const resources = mutationResources('/bookings/one');
    expect(matchesResource('/v1/bookings/one/workspace', resources)).toBe(true);
    expect(matchesResource('/v1/me/schedule', resources)).toBe(true);
    expect(matchesResource('/v1/explore?page=1', resources)).toBe(false);
    expect(matchesResource('/v1/bookings-archive', resources)).toBe(false);
  });
  it('refreshes project artifacts and list but leaves another workspace alone', () => {
    const resources = mutationResources('/projects/one');
    expect(matchesResource('/v1/creative-projects/one/artifacts', resources)).toBe(true);
    expect(matchesResource('/v1/creative-projects', resources)).toBe(true);
    expect(matchesResource('/v1/admin/reports', resources)).toBe(false);
  });
});
