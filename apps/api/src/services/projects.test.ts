import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CreativeProject } from '@frameroom/shared';
import { patchProject } from './projects.js';
import * as repo from '../repositories/projects.js';
import type { Transaction } from '../repositories/database.js';
import { MediaService } from './media.js';
import { envSchema } from '../config/env.js';

vi.mock('../repositories/projects.js');
const project = {
  id: 'project',
  ownerId: 'owner',
  bookingId: null,
  version: 1,
  selectedArtifactIds: [],
  referencePaths: [],
  brief: null,
  title: 'Project',
  idea: 'Idea',
} as unknown as CreativeProject;
const media = new MediaService(envSchema.parse({}));
afterEach(() => vi.restoreAllMocks());
describe('project mutation authorization', () => {
  it('denies non-owner writes even when they can read the project', async () => {
    vi.mocked(repo.findProject).mockResolvedValue(project);
    const one = vi.fn();
    const tx = { one } as unknown as Transaction;
    await expect(
      patchProject(tx, 'other', 'project', { title: 'changed' }, media),
    ).rejects.toMatchObject({ status: 403 });
    expect(one).not.toHaveBeenCalled();
  });
  it('rejects a stale draft before validating media or issuing a write', async () => {
    vi.mocked(repo.findProject).mockResolvedValue({ ...project, version: 2 });
    const one = vi.fn();
    await expect(
      patchProject(
        { one } as unknown as Transaction,
        'owner',
        'project',
        { version: 1, title: 'stale draft' },
        media,
      ),
    ).rejects.toMatchObject({ status: 409, reason: 'stale_version' });
    expect(one).not.toHaveBeenCalled();
    expect(repo.findProject).toHaveBeenCalledWith(expect.anything(), 'project', true);
  });
  it('updates an explicitly current version under the project lock', async () => {
    vi.mocked(repo.findProject).mockResolvedValue(project);
    const one = vi.fn().mockResolvedValue({ ...project, version: 2, title: 'updated' });
    await expect(
      patchProject(
        { one } as unknown as Transaction,
        'owner',
        'project',
        { version: 1, title: 'updated' },
        media,
      ),
    ).resolves.toMatchObject({ version: 2 });
    expect(one).toHaveBeenCalledOnce();
  });
  it('rejects foreign artifacts before writing any project field', async () => {
    vi.mocked(repo.findProject).mockResolvedValue(project);
    const one = vi.fn();
    const tx = { rows: vi.fn().mockResolvedValue([]), one } as unknown as Transaction;
    await expect(
      patchProject(tx, 'owner', 'project', { selectedArtifactIds: ['foreign'] }, media),
    ).rejects.toMatchObject({ status: 422 });
    expect(one).not.toHaveBeenCalled();
  });
  it('checks reference ownership before updating and increments version in the write', async () => {
    vi.mocked(repo.findProject).mockResolvedValue(project);
    const verify = vi
      .spyOn(media, 'verifyReference')
      .mockRejectedValue(Object.assign(new Error('denied'), { status: 403 }));
    const one = vi.fn();
    await expect(
      patchProject(
        { one } as unknown as Transaction,
        'owner',
        'project',
        { referencePaths: ['other/image.webp'] },
        media,
      ),
    ).rejects.toMatchObject({ status: 403 });
    expect(verify).toHaveBeenCalled();
    expect(one).not.toHaveBeenCalled();
  });
});
