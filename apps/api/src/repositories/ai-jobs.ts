import type { Transaction } from './database.js';
export type WorkerJob = {
  id: string;
  projectId: string | null;
  userId: string;
  kind: string;
  status: string;
  providerStartedAt: string | null;
  input: unknown;
};
export async function claimForWork(tx: Transaction, jobId: string): Promise<WorkerJob | null> {
  const job = await tx.one<WorkerJob>('select * from ai_jobs where id=$1 for update', [jobId]);
  if (['succeeded', 'failed', 'uncertain'].includes(job.status)) return null;
  if (job.providerStartedAt) {
    await tx.execute(
      "update ai_jobs set status='uncertain',error='provider_outcome_unknown' where id=$1",
      [job.id],
    );
    return null;
  }
  await tx.execute(
    "update ai_jobs set status='running',started_at=now(),provider_started_at=now() where id=$1",
    [job.id],
  );
  return job;
}
