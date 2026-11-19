import { expect, it, vi } from 'vitest';
import { claimForWork, type WorkerJob } from './ai-jobs.js';
import type { Transaction } from './database.js';

const job: WorkerJob = {
  id: 'job-id',
  projectId: null,
  userId: 'user-id',
  kind: 'index',
  status: 'queued',
  providerStartedAt: null,
  input: {},
};

it('ends a queued indexing job before recording a provider call when search is disabled', async () => {
  const tx: Transaction = {
    one: vi.fn().mockResolvedValue(job),
    execute: vi.fn().mockResolvedValue(undefined),
    rows: vi.fn(),
    optional: vi.fn(),
  };
  expect(await claimForWork(tx, job.id, false)).toBeNull();
  expect(tx.execute).toHaveBeenCalledTimes(1);
  expect(tx.execute).toHaveBeenCalledWith(
    expect.stringContaining("status='failed',error='ai_search_disabled'"),
    [job.id],
  );
});

it('still claims other AI jobs when search is disabled', async () => {
  const concept = { ...job, kind: 'concept', projectId: 'project-id' };
  const tx: Transaction = {
    one: vi.fn().mockResolvedValue(concept),
    execute: vi.fn().mockResolvedValue(undefined),
    rows: vi.fn(),
    optional: vi.fn(),
  };
  expect(await claimForWork(tx, concept.id, false)).toEqual(concept);
  expect(tx.execute).toHaveBeenCalledWith(expect.stringContaining("status='running'"), [
    concept.id,
  ]);
});
