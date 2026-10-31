import { setTimeout } from 'node:timers/promises';
import sharp from 'sharp';
import { z } from 'zod';
import { cullingOutputSchema, languageSchema } from '@frameroom/shared';
import { loadEnv } from './config/env.js';
import { Database } from './repositories/database.js';
import { MediaService } from './services/media.js';
import { AiService, projectPrompt } from './services/ai.js';
import { project } from './services/access.js';
import { ownedRecord } from './services/catalog.js';
import { requireCondition } from './lib/errors.js';
import { createLogger } from './lib/logger.js';
import { expireSearchReferences } from './services/maintenance.js';
import { claimForWork, type WorkerJob as Job } from './repositories/ai-jobs.js';

const env = loadEnv();
const db = new Database(env.DATABASE_URL);
const media = new MediaService(env);
const ai = new AiService(env, db, media);
const log = createLogger();
let stopping = false;
let nextCleanup = 0;
process.once('SIGINT', () => {
  stopping = true;
});
process.once('SIGTERM', () => {
  stopping = true;
});
async function work(job: Job) {
  const input = z
    .object({
      prompt: z.string().default(''),
      imageIds: z.array(z.string().uuid()).default([]),
      imageId: z.string().uuid().optional(),
      referencePath: z.string().optional(),
      language: languageSchema.default('en'),
    })
    .parse(job.input);
  if (job.kind === 'index') {
    const image = await db.run(job.userId, async (tx) => {
      const i = await tx.one<{ id: string; portfolioId: string; storagePath: string }>(
        'select * from portfolio_images where id=$1 and not is_hidden',
        [input.imageId],
      );
      await ownedRecord(tx, 'portfolios', i.portfolioId);
      return i;
    });
    const description = await ai.describe(
      job.userId,
      await media.download('portfolio-images', image.storagePath),
    );
    const text = Object.values(description).join('. ');
    const vector = await ai.embedding(job.userId, text);
    await db.run(job.userId, async (tx) => {
      await ownedRecord(tx, 'portfolios', image.portfolioId);
      await tx.execute(
        'insert into image_embeddings(image_id,description,model,embedding) values($1,$2,$3,$4) on conflict(image_id) do update set description=excluded.description,model=excluded.model,embedding=excluded.embedding',
        [image.id, text, env.AI_EMBEDDING_MODEL, JSON.stringify(vector)],
      );
    });
    return { imageId: image.id, description };
  }
  requireCondition(job.projectId, 422, 'project_required');
  const context = await ai.context(job.userId, job.projectId);
  if (job.kind === 'cull') {
    const images = await db.run(job.userId, (tx) =>
      tx.rows<{ id: string; storagePath: string }>(
        `select i.id,i.storage_path from gallery_images i join galleries g on g.id=i.gallery_id where g.booking_id=$1 and i.id=any($2::uuid[])`,
        [context.project.bookingId, input.imageIds],
      ),
    );
    requireCondition(
      images.length === input.imageIds.length && images.length <= 50,
      422,
      'invalid_images',
    );
    const previews = await Promise.all(
      images.map(async (image) => ({
        input: await media.download('gallery-previews', image.storagePath),
      })),
    );
    const contact = await sharp({
      create: {
        width: 1000,
        height: Math.ceil(images.length / 5) * 230,
        channels: 3,
        background: '#fff',
      },
    })
      .composite(
        await Promise.all(
          previews.map(async (image, i) => ({
            input: await sharp(image.input)
              .resize(192, 192, { fit: 'contain', background: '#fff' })
              .png()
              .toBuffer(),
            left: (i % 5) * 200,
            top: Math.floor(i / 5) * 230,
          })),
        ),
      )
      .webp()
      .toBuffer();
    const suggestions = await ai.structured(
      job.userId,
      'cull',
      cullingOutputSchema,
      `Suggest a shortlist based on composition, visible quality and the agreed brief. Never claim full-resolution sharpness or delete photos. Contact sheet left-to-right, top-to-bottom: ${JSON.stringify(images.map((i) => i.id))}. Only these IDs are valid. Context ${JSON.stringify({ brief: context.agreedBrief, idea: context.project.idea })}`,
      contact,
      input.language,
    );
    const allowed = new Set(images.map((image) => image.id));
    requireCondition(
      suggestions.suggestions.every((s) => allowed.has(s.imageId)) &&
        new Set(suggestions.suggestions.map((s) => s.imageId)).size ===
          suggestions.suggestions.length,
      422,
      'invalid_ai_selection',
    );
    return suggestions;
  }
  let original: { id: string; storagePath: string } | undefined;
  if (job.kind === 'edit')
    original = await db.run(job.userId, (tx) =>
      tx.one<{ id: string; storagePath: string }>(
        'select i.id,i.storage_path from gallery_images i join galleries g on g.id=i.gallery_id where i.id=$1 and g.booking_id=$2',
        [input.imageIds[0], context.project.bookingId],
      ),
    );
  let referenceImage: Buffer | undefined;
  if (job.kind === 'concept') {
    const referencePath = input.referencePath ?? context.project.referencePaths[0];
    if (input.referencePath)
      await media.enforceReference(job.userId, 'brief-references', input.referencePath);
    referenceImage = referencePath
      ? await media.download('brief-references', referencePath)
      : context.selectedArtifacts[0]
        ? await media.download('ai-artifacts', context.selectedArtifacts[0].storagePath)
        : undefined;
  }
  const generated = await ai.generateImage(
    job.userId,
    job.kind === 'edit'
      ? `Edit this image according to the following request. Preserve unrelated content. ${input.prompt}`
      : projectPrompt(context.project, input.prompt),
    original ? await media.download('gallery-previews', original.storagePath) : referenceImage,
  );
  const buffer = await sharp(generated)
    .rotate()
    .resize(1280, 1280, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 88 })
    .toBuffer();
  const path = `${job.projectId}/${job.id}.webp`;
  await media.put('ai-artifacts', path, buffer, 'image/webp');
  return db.run(job.userId, async (tx) => {
    await project(tx, job.projectId!);
    return tx.one(
      'insert into ai_artifacts(project_id,job_id,storage_path,provenance,original_image_id,prompt) values($1,$2,$3,$4,$5,$6) on conflict(job_id) do update set job_id=excluded.job_id returning *',
      [
        job.projectId,
        job.id,
        path,
        original ? 'manipulated' : 'ai_generated',
        original?.id ?? null,
        input.prompt,
      ],
    );
  });
}
while (!stopping) {
  let messageId: string | undefined;
  try {
    if (Date.now() >= nextCleanup) {
      await expireSearchReferences(db, media);
      nextCleanup = Date.now() + 60000;
    }
    const message = await db.run(null, (tx) =>
      tx.optional<{ msgId: string; message: { jobId: string } }>(
        'select * from frameroom_claim_jobs()',
      ),
    );
    if (!message) {
      await setTimeout(1000);
      continue;
    }
    messageId = message.msgId;
    const job = await db.run(null, (tx) => claimForWork(tx, message.message.jobId));
    if (job) {
      try {
        const result = await work(job);
        await db.run(null, (tx) =>
          tx.execute(
            "update ai_jobs set status='succeeded',result=$2,completed_at=now() where id=$1",
            [job.id, JSON.stringify(result)],
          ),
        );
      } catch (error) {
        const reason = error instanceof Error ? error.message : 'job_failed';
        await db.run(null, (tx) =>
          tx.execute('update ai_jobs set status=$2,error=$3,completed_at=now() where id=$1', [
            job.id,
            reason.includes('uncertain') ? 'uncertain' : 'failed',
            reason.slice(0, 200),
          ]),
        );
        log.warn('AI job ended without a result');
      }
    }
    await db.run(null, (tx) => tx.execute('select frameroom_archive_job($1)', [messageId]));
  } catch {
    log.warn('Worker dependency unavailable; retrying');
    await setTimeout(5000);
  }
}
await db.close();
