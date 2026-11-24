import { createClient, type PostgrestError } from '@supabase/supabase-js';
import { z } from 'zod';
import { profileSchema, ownPhotographerSchema, type Profile } from '@frameroom/shared';

import type { ApiEnv } from '../config/env.js';
import { ApiError } from '../lib/errors.js';
import { normalizeRow } from '../repositories/database.js';
import type {
  ExploreQuery,
  Provider,
  ProviderListQuery,
  ProviderLookup,
  PortfolioListQuery,
} from '../schemas/catalog.js';
import {
  providerDetailSchema,
  portfolioDetailSchema,
  publicPortfolioSchema,
  tagSchema,
} from '../schemas/catalog.js';
import { buildPublicPortfolioImageUrl, singleDisplayNameMatch } from './catalog.js';

function check(error: PostgrestError | null, conflictReason = 'already_exists') {
  if (!error) return;
  if (error.code === '23505') throw new ApiError(409, 'CONFLICT', conflictReason);
  throw new ApiError(503, 'SERVICE_UNAVAILABLE', 'database_unavailable');
}

/** Public reads retain the anonymous client's RLS; account writes are scoped by verified routes. */
export function createCloudCatalog(env: ApiEnv) {
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) return null;
  const options = { auth: { persistSession: false, autoRefreshToken: false } };
  const publicClient = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, options);
  const accountClient = () => {
    if (!env.SUPABASE_SERVICE_ROLE_KEY)
      throw new ApiError(503, 'SERVICE_UNAVAILABLE', 'database_not_configured');
    return createClient(env.SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY, options);
  };

  const list = async (query: ExploreQuery | ProviderListQuery, type?: string) => {
    let request = publicClient.from('providers').select('*');
    if (type) request = request.eq('type', type);
    if (query.genre) request = request.contains('genres', [query.genre]);
    if (query.city) request = request.ilike('city', query.city);
    if (query.district) request = request.ilike('district', query.district);
    if ('priceMax' in query && query.priceMax !== undefined)
      request = request.lte('price_from', query.priceMax);
    const start = (query.page - 1) * query.pageSize;
    const { data, error } = await request
      .order('rating_avg', { ascending: false, nullsFirst: false })
      .order('display_name')
      .order('id')
      .range(start, start + query.pageSize - 1);
    check(error);
    const providers = normalizeRow(data ?? []) as Provider[];
    const { data: portfolios, error: portfolioError } = await publicClient
      .from('portfolios')
      .select('id,photographer_id,studio_id,portfolio_images(storage_path,sort_order,is_hidden)')
      .eq('status', 'published')
      .is('deleted_at', null)
      .order('published_at', { ascending: false });
    check(portfolioError);
    return providers.map((provider) => {
      const portfolio = portfolios?.find((p) =>
        provider.type === 'photographer'
          ? p.photographer_id === provider.id
          : p.studio_id === provider.id,
      );
      const image = portfolio?.portfolio_images
        .filter((image) => !image.is_hidden)
        .sort((a, b) => a.sort_order - b.sort_order)[0];
      return {
        ...provider,
        coverUrl: buildPublicPortfolioImageUrl(
          env.SUPABASE_URL,
          image?.storage_path,
          env.API_PUBLIC_ORIGIN,
        ),
      };
    });
  };

  const profile = async (userId: string): Promise<Profile> => {
    const client = accountClient();
    const { data, error } = await client
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
    check(error);
    if (!data) throw new ApiError(404, 'NOT_FOUND', 'profile_required');
    const [photographer, membership, admin] = await Promise.all([
      client.from('photographers').select('id').eq('user_id', userId).maybeSingle(),
      client
        .from('studio_members')
        .select('studio_id')
        .eq('user_id', userId)
        .eq('role', 'manager')
        .limit(1),
      client.from('user_roles').select('user_id').eq('user_id', userId).limit(1),
    ]);
    for (const result of [photographer, membership, admin]) check(result.error);
    return profileSchema.parse({
      ...(normalizeRow(data) as object),
      roles: [
        'client',
        ...(photographer.data ? ['photographer'] : []),
        ...(membership.data?.length ? ['studio_manager'] : []),
        ...(admin.data?.length ? ['system_admin'] : []),
      ],
    });
  };

  return {
    list,
    profile,
    async portfolios(query: PortfolioListQuery) {
      const matching = query.tag
        ? ',matches:portfolio_images!inner(is_hidden,image_tags!inner(tags!inner(slug)))'
        : '';
      let request = publicClient
        .from('portfolios')
        .select(
          `*,portfolio_images(storage_path,sort_order,is_hidden,image_tags(tags(*)))${matching}`,
        )
        .eq('status', 'published')
        .is('deleted_at', null);
      if (query.genre) request = request.eq('genre', query.genre);
      if (query.tag)
        request = request
          .eq('matches.is_hidden', false)
          .eq('matches.image_tags.tags.slug', query.tag);
      if (query.q) {
        const pattern = `%${query.q.replace(/[\\%_]/g, '\\$&')}%`
          .replace(/\\/g, '\\\\')
          .replace(/"/g, '\\"');
        request = request.or(`title.ilike."${pattern}",description.ilike."${pattern}"`);
      }
      if (query.sort === 'name') request = request.order('title');
      else
        request = request
          .order('published_at', { ascending: query.sort === 'oldest', nullsFirst: false })
          .order('created_at', { ascending: query.sort === 'oldest' });
      const start = (query.page - 1) * query.pageSize;
      const { data, error } = await request.order('id').range(start, start + query.pageSize - 1);
      check(error);
      const rowSchema = publicPortfolioSchema.extend({
        portfolioImages: z.array(
          z.object({
            storagePath: z.string(),
            sortOrder: z.number(),
            isHidden: z.boolean(),
            imageTags: z.array(
              z.object({ tags: tagSchema.extend({ isActive: z.boolean().optional() }).nullable() }),
            ),
          }),
        ),
      });
      return rowSchema
        .array()
        .parse(normalizeRow(data ?? []))
        .map(({ portfolioImages, ...portfolio }) => {
          const images = portfolioImages
            .filter((image) => !image.isHidden)
            .sort((a, b) => a.sortOrder - b.sortOrder);
          const tags = images.flatMap((image) =>
            image.imageTags.flatMap((link) =>
              link.tags && link.tags.isActive !== false ? [link.tags] : [],
            ),
          );
          return {
            ...portfolio,
            coverUrl: buildPublicPortfolioImageUrl(
              env.SUPABASE_URL,
              images[0]?.storagePath,
              env.API_PUBLIC_ORIGIN,
            ),
            tags: [...new Map(tags.map((tag) => [tag.id, tag])).values()],
          };
        });
    },
    async tags() {
      const { data, error } = await publicClient.from('tags').select('*').order('name');
      check(error);
      return (data ?? [])
        .filter((tag) => tag.is_active !== false)
        .map((tag) => tagSchema.parse(normalizeRow(tag)));
    },
    async createProfile(userId: string, input: { userName: string; displayName: string }) {
      const client = accountClient();
      const existing = await client.from('profiles').select('id').eq('id', userId).maybeSingle();
      check(existing.error);
      if (existing.data) return { profile: await profile(userId), created: false };
      const { error } = await client.from('profiles').insert({
        id: userId,
        user_name: input.userName,
        display_name: input.displayName,
      });
      if (error?.code === '23505') {
        const retry = await client.from('profiles').select('id').eq('id', userId).maybeSingle();
        check(retry.error);
        if (retry.data) return { profile: await profile(userId), created: false };
      }
      check(error, 'user_name_taken');
      return { profile: await profile(userId), created: true };
    },
    async updateProfile(userId: string, input: { userName: string; displayName: string }) {
      await profile(userId);
      const { error } = await accountClient()
        .from('profiles')
        .update({
          user_name: input.userName,
          display_name: input.displayName,
        })
        .eq('id', userId);
      check(error, 'user_name_taken');
      return profile(userId);
    },
    async updateAvatar(userId: string, avatarPath: string | null) {
      await profile(userId);
      const { error } = await accountClient()
        .from('profiles')
        .update({ avatar_path: avatarPath })
        .eq('id', userId);
      check(error);
      return profile(userId);
    },
    async photographer(userId: string) {
      const { data, error } = await accountClient()
        .from('photographers')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
      check(error);
      return data ? ownPhotographerSchema.parse(normalizeRow(data)) : null;
    },
    async savePhotographer(
      userId: string,
      input: {
        displayName: string;
        bio: string;
        city: string;
        district: string;
        genres: string[];
        styles: string[];
        contactEmail?: string | null;
        professionalRoles?: string[];
      },
      update = false,
    ) {
      await profile(userId);
      const client = accountClient();
      const values = {
        display_name: input.displayName,
        bio: input.bio,
        city: input.city,
        district: input.district,
        genres: input.genres,
        styles: input.styles,
        ...(input.contactEmail === undefined ? {} : { contact_email: input.contactEmail }),
        ...(input.professionalRoles === undefined
          ? {}
          : { professional_roles: input.professionalRoles }),
      };
      const result = update
        ? await client.from('photographers').update(values).eq('user_id', userId).select().single()
        : await client
            .from('photographers')
            .insert({ ...values, user_id: userId })
            .select()
            .single();
      check(result.error);
      return ownPhotographerSchema.parse(normalizeRow(result.data));
    },
    async detail(type: 'photographer' | 'studio', lookup: ProviderLookup) {
      const query = publicClient.from('providers').select('*').eq('type', type);
      const { data: matches, error } = await ('id' in lookup
        ? query.eq('id', lookup.id).limit(1)
        : query.eq('display_name', lookup.displayName).limit(2));
      check(error);
      const data = singleDisplayNameMatch(matches ?? []);
      if (!data) throw new ApiError(404, 'NOT_FOUND', `${type}_not_found`);
      const { id } = data;
      const owner = type === 'photographer' ? 'photographer_id' : 'studio_id';
      const [services, portfolios, reviews] = await Promise.all([
        publicClient
          .from('services')
          .select('*')
          .eq(owner, id)
          .eq('is_active', true)
          .is('deleted_at', null),
        publicClient
          .from('portfolios')
          .select('*,portfolio_images(storage_path,sort_order,is_hidden)')
          .eq(owner, id)
          .eq('status', 'published')
          .is('deleted_at', null),
        publicClient
          .from('reviews')
          .select('*')
          .eq(owner, id)
          .eq('is_hidden', false)
          .is('deleted_at', null),
      ]);
      for (const result of [services, portfolios, reviews]) check(result.error);
      return providerDetailSchema.parse({
        provider: normalizeRow(data),
        services: normalizeRow(services.data ?? []),
        portfolios: (portfolios.data ?? []).map((portfolio) => ({
          ...(normalizeRow(portfolio) as object),
          coverUrl: buildPublicPortfolioImageUrl(
            env.SUPABASE_URL,
            z
              .array(
                z.object({
                  storage_path: z.string(),
                  sort_order: z.number(),
                  is_hidden: z.boolean(),
                }),
              )
              .parse(portfolio.portfolio_images ?? [])
              .filter((image) => !image.is_hidden)
              .sort((a, b) => a.sort_order - b.sort_order)[0]?.storage_path,
            env.API_PUBLIC_ORIGIN,
          ),
        })),
        reviews: (reviews.data ?? []).map((review) => ({
          ...(normalizeRow(review) as object),
          authorName: '',
        })),
      });
    },
    async publicImageExists(path: string) {
      const { data, error } = await publicClient
        .from('portfolio_images')
        .select('id,portfolios!inner(id)')
        .eq('storage_path', path)
        .eq('is_hidden', false)
        .eq('portfolios.status', 'published')
        .is('portfolios.deleted_at', null)
        .limit(1);
      check(error);
      return Boolean(data?.length);
    },
    async portfolio(id: string) {
      const { data: portfolio, error } = await publicClient
        .from('portfolios')
        .select('*')
        .eq('id', id)
        .eq('status', 'published')
        .is('deleted_at', null)
        .maybeSingle();
      check(error);
      if (!portfolio) throw new ApiError(404, 'NOT_FOUND', 'portfolio_not_found');
      const providerType = portfolio.photographer_id ? 'photographer' : 'studio';
      const providerId = portfolio.photographer_id ?? portfolio.studio_id;
      const provider = await publicClient
        .from('providers')
        .select('id')
        .eq('id', providerId)
        .eq('type', providerType)
        .maybeSingle();
      check(provider.error);
      if (!provider.data) throw new ApiError(404, 'NOT_FOUND', 'portfolio_not_found');
      const images = await publicClient
        .from('portfolio_images')
        .select('*,image_tags(tags(id,name,slug,kind))')
        .eq('portfolio_id', id)
        .eq('is_hidden', false)
        .order('sort_order')
        .order('id');
      check(images.error);
      const linksSchema = z.array(
        z.object({ tags: z.union([tagSchema, z.array(tagSchema)]).nullish() }),
      );
      return portfolioDetailSchema.parse({
        portfolio: normalizeRow(portfolio),
        images: (images.data ?? []).map((image) => ({
          ...(normalizeRow(image) as object),
          source: image.source ?? null,
          licenseNote: image.license_note ?? null,
          url: buildPublicPortfolioImageUrl(
            env.SUPABASE_URL,
            image.storage_path,
            env.API_PUBLIC_ORIGIN,
          ),
          tags: linksSchema
            .parse(image.image_tags ?? [])
            .flatMap((link) =>
              Array.isArray(link.tags) ? link.tags : link.tags ? [link.tags] : [],
            ),
        })),
      });
    },
  };
}
