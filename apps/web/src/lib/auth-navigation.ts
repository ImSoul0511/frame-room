export function safeReturnPath(value: string | null) {
  if (
    !value ||
    !value.startsWith('/') ||
    value.startsWith('//') ||
    [...value].some(
      (character) =>
        character === '\\' || character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
    )
  )
    return '/explore';
  if (/^\/(auth|onboarding|reset-password)(\/|\?|$)/i.test(value)) return '/explore';
  return value;
}

export function authErrorReason(code?: string) {
  if (code === 'invalid_credentials') return 'auth_invalid_credentials';
  if (code === 'email_not_confirmed') return 'email_confirmation_required';
  if (code === 'over_email_send_rate_limit' || code === 'over_request_rate_limit')
    return 'rate_limited';
  if (code === 'weak_password') return 'invalid_input';
  return 'auth_failed';
}
