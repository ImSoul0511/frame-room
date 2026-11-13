import { ApiError } from '../../src/lib/errors.js';
import type { Authenticate, Identity } from '../../src/lib/auth.js';

/**
 * Fake Authenticate: giống bản thật ở hành vi.
 * - Không có "Bearer ..." -> 401 authentication_required
 * - Có token -> trả Identity cố định (mặc định đã xác thực email)
 */
export function makeFakeAuth(
  identity: Identity = { id: 'user-1', isVerified: true },
): Authenticate {
  return async (authorization) => {
    if (!authorization?.startsWith('Bearer ')) {
      throw new ApiError(401, 'UNAUTHORIZED', 'authentication_required');
    }
    return identity;
  };
}
