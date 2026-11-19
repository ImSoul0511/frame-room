import { describe, expect, it } from 'vitest';
import { accountDestination, safeReturnPath, authErrorReason } from './auth-navigation';

describe('authentication return navigation', () => {
  it('retains an intended provider route and query after sign-in', () => {
    const destination = '/providers/photographer/123?project=456';
    expect(safeReturnPath(destination)).toBe(destination);
  });
  it.each([
    null,
    '',
    'https://other.test',
    '//other.test',
    '/\\other.test',
    '/\n/other.test',
    '/\t/other.test',
  ])('rejects an external or browser-normalized redirect: %j', (destination) => {
    expect(safeReturnPath(destination)).toBe('/explore');
  });
  it.each([
    '/auth',
    '/AUTH?mode=signup',
    '/auth/callback',
    '/onboarding?next=/auth',
    '/reset-password',
    '/projects/../auth#login',
    '/%61uth',
  ])('avoids redirecting back into authentication: %s', (destination) => {
    expect(safeReturnPath(destination)).toBe('/explore');
  });
  it.each([
    [[], '/projects'],
    [['client'], '/projects'],
    [['client', 'photographer'], '/bookings'],
    [['client', 'photographer', 'studio_manager'], '/studio'],
    [['client', 'system_admin'], '/admin'],
  ] as const)('uses derived account roles %j for the default destination', (roles, destination) => {
    expect(safeReturnPath(null, accountDestination(roles))).toBe(destination);
  });
  it('keeps authentication errors generic and distinguishes confirmation and throttling', () => {
    expect(authErrorReason('invalid_credentials')).toBe('auth_invalid_credentials');
    expect(authErrorReason('email_not_confirmed')).toBe('email_confirmation_required');
    expect(authErrorReason('over_email_send_rate_limit')).toBe('rate_limited');
    expect(authErrorReason('user_already_exists')).toBe('auth_failed');
  });
});
