import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CreativeProject } from '@frameroom/shared';
import type { Transaction } from '../repositories/database.js';
import * as projects from '../repositories/projects.js';
import { deleteProject } from './projects.js';

vi.mock('../repositories/projects.js');
const project = { id: 'project-1', ownerId: 'owner', bookingId: null } as CreativeProject;
const tx = { optional: vi.fn(), execute: vi.fn() } as unknown as Transaction;

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(projects.findProject).mockResolvedValue(project);
  vi.mocked(tx.optional).mockResolvedValue(undefined);
  vi.mocked(tx.execute).mockResolvedValue(undefined);
});

describe('deleteProject', () => {
  it('soft-deletes an unbooked project after locking it', async () => {
    await expect(deleteProject(tx, 'owner', 'project-1')).resolves.toEqual({ deleted: true });
    expect(projects.findProject).toHaveBeenCalledWith(tx, 'project-1', true);
    expect(tx.execute).toHaveBeenCalledWith(expect.stringContaining('deleted_at=now()'), [
      'project-1',
    ]);
  });
  it('denies a non-owner', async () => {
    await expect(deleteProject(tx, 'other', 'project-1')).rejects.toMatchObject({ status: 403 });
    expect(tx.execute).not.toHaveBeenCalled();
  });
  it('preserves booked projects', async () => {
    vi.mocked(tx.optional).mockResolvedValueOnce({ id: 'booking' });
    await expect(deleteProject(tx, 'owner', 'project-1')).rejects.toMatchObject({
      status: 409,
      reason: 'project_has_booking',
    });
    expect(tx.execute).not.toHaveBeenCalled();
  });
  it('preserves projects while AI work is running', async () => {
    vi.mocked(tx.optional).mockResolvedValueOnce(undefined).mockResolvedValueOnce({ id: 'job' });
    await expect(deleteProject(tx, 'owner', 'project-1')).rejects.toMatchObject({
      status: 409,
      reason: 'project_ai_pending',
    });
    expect(tx.execute).not.toHaveBeenCalled();
  });
});
