import { ZodError } from 'zod';

export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'UNPROCESSABLE'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR'
  | 'SERVICE_UNAVAILABLE';

export interface ErrorDetail {
  field?: string;
  reason: string;
  message?: string;
}

/** Business error carrying the HTTP status, stable code and machine-readable reason. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode,
    readonly reason: string,
    message: string = reason,
    readonly details: ErrorDetail[] = [{ reason }],
  ) {
    super(message);
  }
}

const CODE_BY_STATUS: Record<number, ErrorCode> = {
  400: 'VALIDATION_ERROR',
  401: 'UNAUTHORIZED',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  410: 'NOT_FOUND',
  422: 'UNPROCESSABLE',
  429: 'RATE_LIMITED',
  503: 'SERVICE_UNAVAILABLE',
};

export function requireCondition(
  condition: unknown,
  status = 403,
  reason = 'forbidden',
): asserts condition {
  if (!condition) throw new ApiError(status, CODE_BY_STATUS[status] ?? 'FORBIDDEN', reason);
}

interface DatabaseError {
  code?: string;
  constraint?: string;
  message?: string;
}

/** Postgres codes that map to a stable public error. Unknown codes fall through to 500. */
function fromDatabaseError(error: DatabaseError): ApiError | undefined {
  switch (error.code) {
    case '23505':
      return new ApiError(
        409,
        'CONFLICT',
        error.constraint?.includes('user_name') ? 'user_name_taken' : 'already_exists',
      );
    case '23P01':
      return new ApiError(409, 'CONFLICT', 'slot_overlap');
    case '40001':
      return new ApiError(409, 'CONFLICT', 'stale_version');
    case '23503':
      return new ApiError(409, 'CONFLICT', 'referenced_resource');
    case '23514':
      return new ApiError(422, 'UNPROCESSABLE', 'invalid_state');
    case '42501':
      return new ApiError(403, 'FORBIDDEN', 'forbidden');
    case 'P0002':
      return new ApiError(404, 'NOT_FOUND', 'not_found');
    case 'ECONNREFUSED':
    case '57P01':
    case '42P01':
    case '3F000':
      return new ApiError(503, 'SERVICE_UNAVAILABLE', 'database_unavailable');
    default:
      return undefined;
  }
}

function fromZodError(error: ZodError): ApiError {
  return new ApiError(
    400,
    'VALIDATION_ERROR',
    'invalid_input',
    'The request is not valid',
    error.issues.map((issue) => ({
      field: issue.path.join('.') || undefined,
      reason: issue.code,
      message: issue.message,
    })),
  );
}

/** Converts any thrown value into an ApiError without exposing internal messages. */
export function publicError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  if (error instanceof ZodError) return fromZodError(error);
  const framework = error as { statusCode?: number; code?: string };
  if (framework.statusCode === 413) {
    return new ApiError(413, 'VALIDATION_ERROR', 'request_too_large', 'The request is too large');
  }
  if (framework.code === 'FST_ERR_CTP_INVALID_JSON_BODY' || framework.statusCode === 400) {
    return new ApiError(400, 'VALIDATION_ERROR', 'invalid_input', 'The request is not valid');
  }
  return (
    fromDatabaseError(error as DatabaseError) ??
    new ApiError(500, 'INTERNAL_ERROR', 'internal_error', 'Unexpected server error')
  );
}
