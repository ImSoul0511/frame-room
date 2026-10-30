import { ZodError } from 'zod';

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    public reason: string,
    message = reason,
  ) {
    super(message);
  }
}
export function requireCondition(
  condition: unknown,
  status = 403,
  reason = 'forbidden',
): asserts condition {
  if (!condition)
    throw new ApiError(
      status,
      status === 400
        ? 'VALIDATION_ERROR'
        : status === 404 || status === 410
          ? 'NOT_FOUND'
          : status === 409
            ? 'CONFLICT'
            : status === 422
              ? 'UNPROCESSABLE'
              : 'FORBIDDEN',
      reason,
    );
}
export function publicError(error: unknown) {
  if (error instanceof ApiError) return error;
  if (error instanceof ZodError)
    return new ApiError(
      400,
      'VALIDATION_ERROR',
      'invalid_input',
      error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
    );
  const dbError = error as { code?: string; constraint?: string; message?: string };
  if (dbError.code === 'FST_REQ_FILE_TOO_LARGE')
    return new ApiError(413, 'VALIDATION_ERROR', 'file_too_large');
  if (dbError.code === 'FST_FILES_LIMIT')
    return new ApiError(400, 'VALIDATION_ERROR', 'invalid_input');
  if (/Input buffer|pixel limit|corrupt image|unsupported image/i.test(dbError.message ?? ''))
    return new ApiError(400, 'VALIDATION_ERROR', 'unsupported_image');
  if (dbError.code === '23505')
    return new ApiError(
      409,
      'CONFLICT',
      dbError.constraint?.includes('user_name') ? 'user_name_taken' : 'already_exists',
    );
  if (dbError.code === '23P01') return new ApiError(409, 'CONFLICT', 'slot_overlap');
  if (dbError.code === '40001') return new ApiError(409, 'CONFLICT', 'stale_version');
  if (dbError.code === '42501') return new ApiError(403, 'FORBIDDEN', 'forbidden');
  if (dbError.code === 'P0002') return new ApiError(404, 'NOT_FOUND', 'not_found');
  if (dbError.code === '23514')
    return new ApiError(422, 'UNPROCESSABLE', dbError.message ?? 'invalid_state');
  if (dbError.code === '23503') return new ApiError(409, 'CONFLICT', 'referenced_resource');
  if (dbError.code === 'P0001' && dbError.message?.startsWith('ai_'))
    return new ApiError(429, 'RATE_LIMITED', dbError.message);
  if (['ECONNREFUSED', '57P01', '42P01', '3F000'].includes(dbError.code ?? ''))
    return new ApiError(503, 'SERVICE_UNAVAILABLE', 'database_unavailable');
  return new ApiError(500, 'INTERNAL_ERROR', 'internal_error');
}
