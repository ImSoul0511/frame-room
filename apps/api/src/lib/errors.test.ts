import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { ApiError, publicError, requireCondition } from './errors.js';

describe('publicError', () => {
  it('passes ApiError through unchanged', () => {
    const error = new ApiError(404, 'NOT_FOUND', 'profile_required');
    expect(publicError(error)).toBe(error);
    expect(error.details).toEqual([{ reason: 'profile_required' }]);
  });

  it('maps Zod issues to a 400 with field details', () => {
    const result = z.object({ name: z.string() }).safeParse({ name: 1 });
    if (result.success) throw new Error('expected failure');
    const error = publicError(result.error);
    expect(error.status).toBe(400);
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.details).toEqual([
      expect.objectContaining({ field: 'name', reason: 'invalid_type' }),
    ]);
  });

  it.each([
    [{ code: '23505', constraint: 'uq_profiles_user_name' }, 409, 'user_name_taken'],
    [{ code: '23505', constraint: 'uq_other' }, 409, 'already_exists'],
    [{ code: '23P01' }, 409, 'slot_overlap'],
    [{ code: '40001' }, 409, 'stale_version'],
    [{ code: '23503' }, 409, 'referenced_resource'],
    [{ code: '23514' }, 422, 'invalid_state'],
    [{ code: '42501' }, 403, 'forbidden'],
    [{ code: 'P0002' }, 404, 'not_found'],
    [{ code: 'ECONNREFUSED' }, 503, 'database_unavailable'],
  ])('maps database error %j', (input, status, reason) => {
    const error = publicError(input);
    expect(error.status).toBe(status);
    expect(error.reason).toBe(reason);
  });

  it('maps invalid JSON and oversized bodies', () => {
    expect(publicError({ code: 'FST_ERR_CTP_INVALID_JSON_BODY', statusCode: 400 }).status).toBe(
      400,
    );
    expect(publicError({ statusCode: 413 }).reason).toBe('request_too_large');
  });

  it('hides internal messages for unknown failures', () => {
    const error = publicError(new Error('select * from secrets failed'));
    expect(error.status).toBe(500);
    expect(error.message).toBe('Unexpected server error');
    expect(JSON.stringify(error.details)).not.toContain('secrets');
  });
});

describe('requireCondition', () => {
  it('throws the mapped code for the status', () => {
    expect(() => requireCondition(false, 409, 'already_member')).toThrowError(
      expect.objectContaining({ status: 409, code: 'CONFLICT', reason: 'already_member' }),
    );
    expect(() => requireCondition(true)).not.toThrow();
  });
});
