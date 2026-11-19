export function safeReturnPath(value: string | null, fallback = '/explore') {
  if (
    !value ||
    !value.startsWith('/') ||
    value.startsWith('//') ||
    [...value].some(
      (character) =>
        character === '\\' || character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
    )
  )
    return fallback;
  const path = new URL(value, 'https://frameroom.invalid').pathname;
  try {
    const decoded = decodeURIComponent(path);
    if (
      decoded.startsWith('//') ||
      decoded.includes('\\') ||
      /^\/(auth|onboarding|reset-password)(\/|$)/i.test(decoded)
    )
      return fallback;
  } catch {
    return fallback;
  }
  return value;
}

export function accountDestination(roles: readonly string[]) {
  if (roles.includes('system_admin')) return '/admin';
  if (roles.includes('studio_manager')) return '/studio';
  if (roles.includes('photographer')) return '/bookings';
  return '/projects';
}

export function authErrorReason(code?: string) {
  if (code === 'invalid_credentials') return 'auth_invalid_credentials';
  if (code === 'email_not_confirmed') return 'email_confirmation_required';
  if (code === 'over_email_send_rate_limit' || code === 'over_request_rate_limit')
    return 'rate_limited';
  if (code === 'weak_password') return 'invalid_input';
  return 'auth_failed';
}
