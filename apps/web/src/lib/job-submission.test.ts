import { expect, it } from 'vitest';
import { JobSubmission } from './job-submission';
it('reuses the key after an unknown outcome but starts a new explicit job after success', () => {
  const submission = new JobSubmission();
  const first = submission.key('/project/one', { prompt: 'soft light' });
  expect(submission.key('/project/one', { prompt: 'soft light' })).toBe(first);
  expect(submission.key('/project/two', { prompt: 'soft light' })).not.toBe(first);
  const second = submission.key('/project/two', { prompt: 'soft light' });
  submission.complete();
  expect(submission.key('/project/two', { prompt: 'soft light' })).not.toBe(second);
});
