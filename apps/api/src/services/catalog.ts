import { ApiError } from '../lib/errors.js';
import * as repo from '../repositories/catalog.js';
import type { Transaction } from '../repositories/database.js';
import type {
  ExploreProvider,
  ExploreQuery,
  ProviderDetail,
  Provider,
  Tag,
} from '../schemas/catalog.js';

/** Tạo public URL cho ảnh trong bucket `portfolio-images` nếu có SUPABASE_URL, hoặc trả về đường dẫn gốc. */
function buildPublicPortfolioImageUrl(
  supabaseUrl: string | undefined,
  storagePath: string | undefined,
): string | null {
  if (!storagePath) return null;
  if (!supabaseUrl) return storagePath;
  const base = supabaseUrl.replace(/\/+$/, '');
  return `${base}/storage/v1/object/public/portfolio-images/${storagePath}`;
}

export async function exploreProviders(
  tx: Transaction,
  query: ExploreQuery,
  supabaseUrl?: string,
): Promise<ExploreProvider[]> {
  const providers = await repo.discoverProviders(tx, query);
  return Promise.all(
    providers.map(async (provider) => {
      const coverPath = await repo.findProviderCoverPath(tx, provider.id);
      return {
        ...provider,
        coverUrl: buildPublicPortfolioImageUrl(supabaseUrl, coverPath),
      };
    }),
  );
}

export async function listProviders(tx: Transaction, type: repo.ProviderType): Promise<Provider[]> {
  return repo.listProvidersByType(tx, type);
}

export async function getProviderDetail(
  tx: Transaction,
  type: repo.ProviderType,
  id: string,
  supabaseUrl?: string,
): Promise<ProviderDetail> {
  const provider = await repo.findProviderById(tx, type, id);
  if (!provider) {
    throw new ApiError(
      404,
      'NOT_FOUND',
      type === 'studio' ? 'studio_not_found' : 'photographer_not_found',
    );
  }

  const [services, rawPortfolios, reviews] = await Promise.all([
    repo.listActiveServicesByProvider(tx, type, id),
    repo.listPublishedPortfoliosByProvider(tx, type, id),
    repo.listVisibleReviewsByProvider(tx, type, id),
  ]);

  const portfolios = await Promise.all(
    rawPortfolios.map(async (portfolio) => {
      const coverPath = await repo.findPortfolioCoverPath(tx, portfolio.id);
      return {
        ...portfolio,
        coverUrl: buildPublicPortfolioImageUrl(supabaseUrl, coverPath),
      };
    }),
  );

  return {
    provider,
    services,
    portfolios,
    reviews,
  };
}

export async function getAllTags(tx: Transaction): Promise<Tag[]> {
  return repo.listTags(tx);
}
