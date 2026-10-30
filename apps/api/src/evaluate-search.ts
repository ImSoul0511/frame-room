import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { z } from 'zod';
import { searchInputSchema } from '@frameroom/shared';
import { loadEnv } from './config/env.js';
import { Database } from './repositories/database.js';
import { MediaService } from './services/media.js';
import { AiService } from './services/ai.js';
import { search } from './services/search.js';
const env = loadEnv();
if (!env.AI_GATEWAY_API_KEY)
  throw new Error(
    'Real-model evaluation requires a budgeted AI_GATEWAY_API_KEY. No score was fabricated.',
  );
if (!env.DATABASE_URL || new URL(env.DATABASE_URL).hostname !== '127.0.0.1')
  throw new Error('Evaluation is restricted to local demo data.');
const db = new Database(env.DATABASE_URL);
const ai = new AiService(env, db, new MediaService(env));
try {
  const count = await db.run(null, (tx) =>
    tx.one<{ count: number }>(
      'select count(*)::int as count from image_embeddings where model=$1',
      [env.AI_EMBEDDING_MODEL],
    ),
  );
  assert.ok(
    count.count >= 100,
    'Prepare at least 100 permitted, indexed images before the release benchmark.',
  );
  const cases = z
    .array(
      z.object({ query: z.string(), language: z.enum(['en', 'vi']), expectedUserName: z.string() }),
    )
    .length(30)
    .parse(
      JSON.parse(
        await readFile(
          new URL('../../../fixtures/search-evaluation.json', import.meta.url),
          'utf8',
        ),
      ),
    );
  const client = await db.run(null, (tx) =>
    tx.one<{ id: string }>("select id from profiles where user_name='demo_client'"),
  );
  const results = [];
  for (const sample of cases) {
    const expected = await db.run(null, (tx) =>
      tx.one<{ id: string }>(
        'select p.id from photographers p join profiles u on u.id=p.user_id where u.user_name=$1',
        [sample.expectedUserName],
      ),
    );
    const result = await search(
      db,
      ai,
      client.id,
      searchInputSchema.parse({ query: sample.query, pageSize: 5 }),
      sample.language,
    );
    results.push({
      ...sample,
      matched: result.data.some((p) => p.provider.id === expected.id),
      topFive: result.data.map((p) => p.provider.id),
    });
  }
  const recall = results.filter((r) => r.matched).length / results.length;
  const dir = new URL('../../../.artifacts/', import.meta.url);
  await mkdir(dir, { recursive: true });
  await writeFile(
    new URL('ai-evaluation.json', dir),
    JSON.stringify(
      {
        model: env.AI_TEXT_MODEL,
        embeddingModel: env.AI_EMBEDDING_MODEL,
        recallAtFive: recall,
        results,
      },
      null,
      2,
    ),
  );
  process.stdout.write(
    `Measured recall@5: ${(recall * 100).toFixed(1)}% across ${results.length} labeled queries.\n`,
  );
  assert.ok(recall >= 0.8, 'Release retrieval target was not met.');
} finally {
  await db.close();
}
