import { z } from 'zod';
import {
  searchInputSchema,
  type Provider,
  type SearchResult,
  type Language,
} from '@frameroom/shared';
import { Database } from '../repositories/database.js';
import { AiService } from './ai.js';
import { discover } from './catalog.js';

export async function search(
  db: Database,
  ai: AiService,
  userId: string,
  input: z.infer<typeof searchInputSchema>,
  language: Language = 'en',
) {
  let image: Buffer | undefined;
  if (input.imageStoragePath) {
    await ai.media.enforceReference(userId, 'search-uploads', input.imageStoragePath);
    image = await ai.media.download('search-uploads', input.imageStoragePath);
  }
  const parsed = await ai.parseSearch(userId, input.query, image);
  const ignored = new Set(input.ignoreParsed);
  const filters = {
    genre: input.filters.genre ?? (!ignored.has('genres') ? parsed.genres[0] : undefined),
    city: input.filters.city ?? (!ignored.has('city') ? (parsed.city ?? undefined) : undefined),
    district:
      input.filters.district ??
      (!ignored.has('district') ? (parsed.district ?? undefined) : undefined),
    priceMax:
      input.filters.priceMax ??
      (!ignored.has('priceMax') ? (parsed.priceMax ?? undefined) : undefined),
  };
  const description = [parsed.description, ...(!ignored.has('styles') ? parsed.styles : [])].join(
    ' ',
  );
  const vector = await ai.embedding(userId, description);
  const candidates = await db.run(userId, (tx) => discover(tx, filters, 500));
  const byId = new Map<string, Provider>(candidates.map((p) => [p.id, p]));
  const images = candidates.length
    ? await db.run(userId, (tx) =>
        tx.rows<{
          id: string;
          providerId: string;
          storagePath: string;
          caption: string;
          description: string;
          score: number;
          provenance: SearchResult['matchedImages'][number]['provenance'];
        }>(
          `select i.id,coalesce(p.photographer_id,p.studio_id) as provider_id,i.storage_path,i.caption,i.provenance,e.description,greatest(0,least(1,1-(e.embedding OPERATOR(extensions.<=>) $1::extensions.vector))) as score
    from image_embeddings e join portfolio_images i on i.id=e.image_id join portfolios p on p.id=i.portfolio_id where coalesce(p.photographer_id,p.studio_id)=any($2::uuid[]) and p.status='published' and p.deleted_at is null and not i.is_hidden and private.provider_visible(p.photographer_id,p.studio_id) and e.model=$3 order by score desc,i.id`,
          [JSON.stringify(vector), candidates.map((p) => p.id), ai.env.AI_EMBEDDING_MODEL],
        ),
      )
    : [];
  const grouped = new Map<string, SearchResult>();
  for (const image of images) {
    let result = grouped.get(image.providerId);
    if (!result) {
      result = {
        provider: byId.get(image.providerId)!,
        score: image.score,
        reasons: [image.description],
        matchedImages: [],
      };
      grouped.set(image.providerId, result);
    }
    if (result.matchedImages.length < 3)
      result.matchedImages.push({
        id: image.id,
        url: await ai.media.url('portfolio-images', image.storagePath, true),
        caption: image.caption,
        provenance: image.provenance,
      });
  }
  const all = [...grouped.values()];
  const start = (input.page - 1) * input.pageSize;
  const page = all.slice(start, start + input.pageSize);
  if (page.length && language === 'vi') {
    const localized = await ai.structured(
      userId,
      'search_reasons',
      z.object({
        items: z
          .array(z.object({ providerId: z.string().uuid(), reason: z.string().max(500) }))
          .max(50),
      }),
      `Explain only the visual matches in Vietnamese. Use only the supplied photographic descriptions. Do not infer availability, reputation or unprovided facts. ${JSON.stringify(page.map((p) => ({ providerId: p.provider.id, description: p.reasons.join(' ') })))}`,
      undefined,
      language,
    );
    for (const item of localized.items) {
      const match = page.find((p) => p.provider.id === item.providerId);
      if (match) match.reasons = [item.reason];
    }
  }
  return {
    data: page,
    parsedQuery: parsed,
    effectiveFilters: filters,
    meta: {
      page: input.page,
      pageSize: input.pageSize,
      total: all.length,
      indexedProviders: grouped.size,
    },
  };
}
