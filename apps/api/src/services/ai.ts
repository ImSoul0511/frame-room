import { createGateway, embed, generateText, Output, streamText } from 'ai';
import { z } from 'zod';
import {
  actionProposalSchema,
  briefContentSchema,
  parsedSearchSchema,
  type CreativeProject,
  type BriefContent,
  type Language,
} from '@frameroom/shared';
import type { ApiEnv } from '../config/env.js';
import { Database } from '../repositories/database.js';
import { ApiError } from '../lib/errors.js';
import { project } from './access.js';
import { MediaService } from './media.js';
import { aiSystem } from './ai-language.js';

type Usage = { inputTokens?: number; outputTokens?: number };
export class AiService {
  readonly gateway;
  constructor(
    readonly env: ApiEnv,
    readonly db: Database,
    readonly media: MediaService,
  ) {
    this.gateway = createGateway({ apiKey: env.AI_GATEWAY_API_KEY });
  }
  ready() {
    if (!this.env.AI_GATEWAY_API_KEY)
      throw new ApiError(503, 'SERVICE_UNAVAILABLE', 'ai_not_configured');
  }
  async reserve(userId: string, feature: string, model = this.env.AI_TEXT_MODEL, images = 0) {
    this.ready();
    return this.db.run(userId, (tx) =>
      tx.one<{ id: string }>('select frameroom_reserve_usage($1,$2,$3,$4,$5,$6) as id', [
        userId,
        feature,
        model,
        images ? 0.5 : 0.15,
        images,
        this.env.AI_MONTHLY_BUDGET_USD,
      ]),
    );
  }
  async settle(id: string, usage?: Usage, metadata?: unknown, failed = false) {
    const cost = z
      .object({
        gateway: z.object({ cost: z.union([z.string(), z.number()]).optional() }).optional(),
      })
      .safeParse(metadata);
    const billed =
      cost.success && cost.data.gateway?.cost !== undefined ? Number(cost.data.gateway.cost) : null;
    await this.db.run(null, (tx) =>
      tx.execute(
        'update ai_usage set status=$2,input_tokens=$3,output_tokens=$4,actual_usd=$5 where id=$1',
        [
          id,
          failed ? 'uncertain' : 'completed',
          usage?.inputTokens ?? null,
          usage?.outputTokens ?? null,
          billed !== null && Number.isFinite(billed) ? billed : null,
        ],
      ),
    );
  }
  async structured<T>(
    userId: string,
    feature: string,
    schema: z.ZodType<T>,
    prompt: string,
    image?: Buffer,
    language: Language = 'en',
  ) {
    const reservation = await this.reserve(userId, feature);
    try {
      const result = await generateText({
        model: this.gateway(this.env.AI_TEXT_MODEL),
        system: aiSystem(language),
        output: Output.object({ schema }),
        maxOutputTokens: 4000,
        maxRetries: 0,
        abortSignal: AbortSignal.timeout(90000),
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              ...(image ? [{ type: 'image' as const, image }] : []),
            ],
          },
        ],
      });
      await this.settle(reservation.id, result.totalUsage, result.finalStep.providerMetadata);
      return schema.parse(result.output);
    } catch (error) {
      await this.settle(reservation.id, undefined, undefined, true);
      if (error instanceof ApiError) throw error;
      throw new ApiError(502, 'SERVICE_UNAVAILABLE', 'ai_generation_failed');
    }
  }
  async embedding(userId: string, text: string) {
    const reservation = await this.reserve(userId, 'embedding', this.env.AI_EMBEDDING_MODEL);
    try {
      const result = await embed({
        model: this.gateway.embeddingModel(this.env.AI_EMBEDDING_MODEL),
        value: text.slice(0, 6000),
        dimensions: 768,
        maxRetries: 0,
        abortSignal: AbortSignal.timeout(45000),
      });
      const vector = z.array(z.number().finite()).length(768).parse(result.embedding);
      await this.settle(reservation.id, { inputTokens: result.usage.tokens });
      return vector;
    } catch {
      await this.settle(reservation.id, undefined, undefined, true);
      throw new ApiError(502, 'SERVICE_UNAVAILABLE', 'embedding_failed');
    }
  }
  async context(userId: string, projectId: string) {
    return this.db.run(userId, async (tx) => {
      const p = await project(tx, projectId);
      const booking = p.bookingId
        ? await tx.one<{ version: number }>('select * from bookings where id=$1', [p.bookingId])
        : null;
      const services = await tx.rows(
        'select s.id,s.name,s.genre,s.price,s.duration_minutes,s.owner_type,s.photographer_id,s.studio_id from services s where s.is_active and s.deleted_at is null and private.provider_visible(s.photographer_id,s.studio_id) order by s.created_at limit 20',
      );
      const messages = p.bookingId
        ? await tx.rows(
            `select m.id,m.text,m.type from room_messages m join shoot_rooms r on r.id=m.room_id where r.booking_id=$1 and not m.is_hidden order by m.created_at desc,m.id desc limit 40`,
            [p.bookingId],
          )
        : [];
      const brief = p.bookingId
        ? await tx.optional<{ content: BriefContent }>(
            `select v.content from brief_versions v join bookings b on b.id=v.booking_id where b.id=$1 and v.version=b.agreed_brief_version`,
            [p.bookingId],
          )
        : undefined;
      const history = await tx.rows<{ role: 'user' | 'assistant'; content: string }>(
        'select role,content from (select * from ai_messages where project_id=$1 order by created_at desc,id desc limit 12) t order by created_at,id',
        [projectId],
      );
      const selectedArtifacts = await tx.rows<{
        id: string;
        storagePath: string;
        prompt: string;
        provenance: string;
      }>(
        'select id,storage_path,prompt,provenance from ai_artifacts where project_id=$1 and id=any($2::uuid[])',
        [p.id, p.selectedArtifactIds],
      );
      return {
        selectedArtifacts,
        project: p,
        booking,
        services,
        roomMessages: messages,
        agreedBrief: brief?.content ?? null,
        history,
      };
    });
  }
  async plan(userId: string, projectId: string, text: string, language: Language = 'en') {
    const context = await this.context(userId, projectId);
    const primary = context.selectedArtifacts[0];
    const image = primary
      ? await this.media.download('ai-artifacts', primary.storagePath)
      : context.project.referencePaths[0]
        ? await this.media.download('brief-references', context.project.referencePaths[0])
        : undefined;
    return this.structured(
      userId,
      'brief',
      briefContentSchema,
      `Draft an editable shoot plan. Do not imply agreement. Context: ${JSON.stringify(context)}\nRequest: ${text}`,
      image,
      language,
    );
  }
  async proposeAction(userId: string, projectId: string, text: string, language: Language = 'en') {
    const context = await this.context(userId, projectId);
    const output = await this.structured(
      userId,
      'action',
      actionProposalSchema,
      `Propose exactly one action. Allowed kinds: update_brief (payload must contain brief with title/concept/shotList/lighting/checklist/milestones); create_milestone (title,dueAt nullable); request_booking (serviceId, projectId, scheduledStart, scheduledEnd, addOnIds,note); reschedule_booking (scheduledStart,scheduledEnd,assignedPhotographerId optional,resourceIds,version); assign_photographer (assignedPhotographerId). Use only known IDs. If required values are missing, do not invent them: provide a payload that explains missing values. Context: ${JSON.stringify(context)}\nRequest: ${text}`,
      undefined,
      language,
    );
    return this.db.run(userId, async (tx) => {
      const current = await project(tx, projectId, true);
      if (current.version !== context.project.version)
        throw new ApiError(409, 'CONFLICT', 'stale_context');
      const b = current.bookingId
        ? await tx.one<{ version: number }>('select version from bookings where id=$1 for update', [
            current.bookingId,
          ])
        : null;
      if ((b?.version ?? null) !== (context.booking?.version ?? null))
        throw new ApiError(409, 'CONFLICT', 'stale_context');
      return tx.one(
        'insert into ai_actions(project_id,proposed_for,kind,explanation,payload,project_version,booking_version) values($1,$2,$3,$4,$5,$6,$7) returning *',
        [
          projectId,
          userId,
          output.kind,
          output.explanation,
          JSON.stringify(output.payload),
          current.version,
          b?.version ?? null,
        ],
      );
    });
  }
  async chat(userId: string, projectId: string, text: string, language: Language = 'en') {
    const context = await this.context(userId, projectId);
    const reservation = await this.reserve(userId, 'chat');
    const result = streamText({
      model: this.gateway(this.env.AI_TEXT_MODEL),
      system: `${aiSystem(language)}\nAuthorized context: ${JSON.stringify({ project: context.project, agreedBrief: context.agreedBrief, roomMessages: context.roomMessages })}`,
      messages: [...context.history, { role: 'user', content: text }],
      maxOutputTokens: 2000,
      maxRetries: 0,
      abortSignal: AbortSignal.timeout(90000),
      onFinish: async (finish) => {
        await this.db.run(userId, async (tx) => {
          await project(tx, projectId);
          await tx.execute(
            "insert into ai_messages(project_id,user_id,role,content) values($1,$2,'user',$3),($1,$2,'assistant',$4)",
            [projectId, userId, text, finish.text],
          );
        });
        await this.settle(reservation.id, finish.totalUsage, finish.providerMetadata);
      },
      onError: async () => {
        await this.settle(reservation.id, undefined, undefined, true);
      },
    });
    return result;
  }
  async generateImage(userId: string, prompt: string, image?: Buffer) {
    const reservation = await this.reserve(
      userId,
      image ? 'edit' : 'concept',
      this.env.AI_IMAGE_MODEL,
      1,
    );
    try {
      const result = await generateText({
        model: this.gateway(this.env.AI_IMAGE_MODEL),
        maxRetries: 0,
        abortSignal: AbortSignal.timeout(180000),
        providerOptions: {
          google: { responseModalities: ['TEXT', 'IMAGE'], imageConfig: { imageSize: '1K' } },
        },
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt.slice(0, 6000) },
              ...(image ? [{ type: 'image' as const, image }] : []),
            ],
          },
        ],
      });
      const file = result.finalStep.files.find((f) => f.mediaType.startsWith('image/'));
      if (!file) throw new Error('No image output');
      await this.settle(reservation.id, result.totalUsage, result.finalStep.providerMetadata);
      return Buffer.from(file.uint8Array);
    } catch {
      await this.settle(reservation.id, undefined, undefined, true);
      throw new ApiError(502, 'SERVICE_UNAVAILABLE', 'image_generation_uncertain');
    }
  }
  async describe(userId: string, image: Buffer) {
    const schema = z.object({
      description: z.string().max(1500),
      tone: z.string().max(100),
      setting: z.string().max(100),
      mood: z.string().max(100),
    });
    return this.structured(
      userId,
      'image_description',
      schema,
      'Describe photographic genre, subject, composition, lighting, color tone, setting, mood. Do not identify people or infer private attributes. Use searchable English visual terms.',
      image,
    );
  }
  async parseSearch(userId: string, query: string, image?: Buffer) {
    return this.structured(
      userId,
      'search',
      parsedSearchSchema,
      `Interpret this photography search in Vietnamese or English. Return a visual English description, supported genres, free-form styles, and explicitly requested city/district/maximum VND price. Unknown location/price must be null. Query: ${query}`,
      image,
    );
  }
}
export function projectPrompt(project: CreativeProject, prompt: string) {
  return `Photography concept illustration, not a real portfolio photograph. ${project.idea}\n${JSON.stringify(project.brief ?? {})}\n${prompt}`;
}
