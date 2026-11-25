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

it('closes a legacy indexing job before a provider call', async () => {
  const tx: Transaction = {
    one: vi.fn().mockResolvedValue(job),
    execute: vi.fn().mockResolvedValue(undefined),
    rows: vi.fn(),
    optional: vi.fn(),
  };
  expect(await claimForWork(tx, job.id)).toBeNull();
  expect(tx.execute).toHaveBeenCalledTimes(1);
  expect(tx.execute).toHaveBeenCalledWith(
    expect.stringContaining("status='failed',error='retired_job_kind'"),
    [job.id],
  );
});

it('claims a project concept job', async () => {
  const concept = { ...job, kind: 'concept', projectId: 'project-id' };
  const tx: Transaction = {
    one: vi.fn().mockResolvedValue(concept),
    execute: vi.fn().mockResolvedValue(undefined),
    rows: vi.fn(),
    optional: vi.fn(),
  };
  expect(await claimForWork(tx, concept.id)).toEqual(concept);
  expect(tx.execute).toHaveBeenCalledWith(expect.stringContaining("status='running'"), [
    concept.id,
  ]);
});
