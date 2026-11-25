import { createClient, type PostgrestError } from '@supabase/supabase-js';
import { z } from 'zod';
import { profileSchema, ownPhotographerSchema, type Profile } from '@frameroom/shared';

import type { ApiEnv } from '../config/env.js';
import { ApiError } from '../lib/errors.js';
import { provinceNames } from '../lib/provinces.js';
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

const portfolioPreviewSchema = publicPortfolioSchema.extend({
  photographers: z.object({ displayName: z.string() }).nullish(),
  studios: z.object({ name: z.string() }).nullish(),
  portfolioImages: z
    .array(
      z.object({
        storagePath: z.string(),
        sortOrder: z.number(),
        isHidden: z.boolean(),
        imageTags: z
          .array(
            z.object({
              tags: tagSchema.extend({ isActive: z.boolean().optional() }).nullable(),
            }),
          )
          .default([]),
      }),
    )
    .default([]),
});

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

  function presentPortfolio(row: unknown, ownerName?: string) {
    const { portfolioImages, photographers, studios, ...portfolio } = portfolioPreviewSchema.parse(
      normalizeRow(row),
    );
    const images = portfolioImages
      .filter((image) => !image.isHidden)
      .sort((a, b) => a.sortOrder - b.sortOrder);
    const tags = images.flatMap((image) =>
      image.imageTags.flatMap(({ tags }) => (tags && tags.isActive !== false ? [tags] : [])),
    );
    return {
      ...portfolio,
      ownerName: ownerName ?? photographers?.displayName ?? studios?.name ?? null,
      coverUrl: buildPublicPortfolioImageUrl(
        env.SUPABASE_URL,
        images[0]?.storagePath,
        env.API_PUBLIC_ORIGIN,
      ),
      tags: [...new Map(tags.map((tag) => [tag.id, tag])).values()],
    };
  }

  const list = async (query: ExploreQuery | ProviderListQuery, type?: string) => {
    let request = publicClient.from('providers').select('*');
    if (type) request = request.eq('type', type);
    if (query.genre) request = request.contains('genres', [query.genre]);
    if (query.city) {
      const names = provinceNames(query.city);
      request =
        names.length === 1
          ? request.ilike('city', names[0])
          : request.or(names.map((name) => `city.ilike.${name}`).join(','));
    }
    if (query.district) request = request.ilike('district', query.district);
    if ('q' in query && query.q) {
      const keyword = query.q.replace(/[\\%_]/g, '\\$&');
      const matches = await Promise.all(
        ['display_name', 'user_name', 'photographers.display_name'].map((column) =>
          publicClient
            .from('profiles')
            .select('photographers!inner(id,display_name,is_hidden)')
            .eq('photographers.is_hidden', false)
            .ilike(column, `%${keyword}%`)
            .limit(1000),
        ),
      );
      for (const result of matches) check(result.error);
      const ids = [
        ...new Set(
          matches.flatMap((result) =>
            (result.data ?? []).flatMap((row) =>
              row.photographers.map((photographer) => photographer.id),
            ),
          ),
        ),
      ];
      const pattern = `%${keyword}%`.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
      request = request.or(
        [
          `display_name.ilike."${pattern}"`,
          ...(ids.length ? [`id.in.(${ids.join(',')})`] : []),
        ].join(','),
      );
    }
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
    const photographerIds = providers
      .filter((item) => item.type === 'photographer')
      .map((item) => item.id);
    const identities = new Map<string, { userName: string | null; avatarPath: string | null }>();
    if (photographerIds.length && type === 'photographer') {
      const identityRows = await publicClient
        .from('photographers')
        .select('id,profiles(user_name,avatar_path)')
        .in('id', photographerIds);
      check(identityRows.error);
      for (const row of identityRows.data ?? []) {
        const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
        identities.set(row.id, {
          userName: profile?.user_name ?? null,
          avatarPath: profile?.avatar_path ?? null,
        });
      }
    }
    if (type || !providers.length) {
      return providers.map((provider) => ({ ...provider, ...identities.get(provider.id) }));
    }
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
        ...identities.get(provider.id),
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
      let cityProviderFilter: string | undefined;
      if (query.city) {
        const names = provinceNames(query.city);
        let providers = publicClient.from('providers').select('id,type');
        providers =
          names.length === 1
            ? providers.ilike('city', names[0])
            : providers.or(names.map((name) => `city.ilike.${name}`).join(','));
        const { data, error } = await providers.limit(10000);
        check(error);
        const photographers = (data ?? [])
          .filter((item) => item.type === 'photographer')
          .map((item) => item.id);
        const studios = (data ?? [])
          .filter((item) => item.type === 'studio')
          .map((item) => item.id);
        if (!photographers.length && !studios.length) return [];
        cityProviderFilter = [
          photographers.length ? `photographer_id.in.(${photographers.join(',')})` : '',
          studios.length ? `studio_id.in.(${studios.join(',')})` : '',
        ]
          .filter(Boolean)
          .join(',');
      }
      const matching = query.tag
        ? ',matches:portfolio_images!inner(is_hidden,image_tags!inner(tags!inner(slug)))'
        : '';
      let request = publicClient
        .from('portfolios')
        .select(
          `*,photographers(display_name),studios(name),portfolio_images(storage_path,sort_order,is_hidden,image_tags(tags(*)))${matching}`,
        )
        .eq('status', 'published')
        .is('deleted_at', null);
      if (query.genre) request = request.eq('genre', query.genre);
      if (cityProviderFilter) request = request.or(cityProviderFilter);
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
      return (data ?? []).map((row) => presentPortfolio(row));
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
    async updatePhotographerCover(userId: string, path: string) {
      const { data, error } = await accountClient()
        .from('photographers')
        .update({ cover_path: path })
        .eq('user_id', userId)
        .select()
        .maybeSingle();
      check(error);
      if (!data) throw new ApiError(404, 'NOT_FOUND', 'not_found');
      return ownPhotographerSchema.parse(normalizeRow(data));
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
      const [services, portfolios, reviews, cover] = await Promise.all([
        publicClient
          .from('services')
          .select('*')
          .eq(owner, id)
          .eq('is_active', true)
          .is('deleted_at', null),
        publicClient
          .from('portfolios')
          .select('*,portfolio_images(storage_path,sort_order,is_hidden,image_tags(tags(*)))')
          .eq(owner, id)
          .eq('status', 'published')
          .is('deleted_at', null),
        publicClient
          .from('reviews')
          .select('*')
          .eq(owner, id)
          .eq('is_hidden', false)
          .is('deleted_at', null),
        type === 'photographer'
          ? publicClient
              .from('photographers')
              .select('*,profiles(avatar_path)')
              .eq('id', id)
              .maybeSingle()
          : Promise.resolve({ data: null, error: null }),
      ]);
      for (const result of [services, portfolios, reviews, cover]) check(result.error);
      return providerDetailSchema.parse({
        provider: normalizeRow(data),
        coverPath:
          z.object({ cover_path: z.string().nullable().optional() }).nullable().parse(cover.data)
            ?.cover_path ?? null,
        avatarPath:
          z
            .object({
              profiles: z.object({ avatar_path: z.string().nullable() }).nullable().optional(),
            })
            .nullable()
            .parse(cover.data)?.profiles?.avatar_path ?? null,
        services: normalizeRow(services.data ?? []),
        portfolios: (portfolios.data ?? []).map((row) => presentPortfolio(row, data.display_name)),
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
        .select('id,display_name')
        .eq('id', providerId)
        .eq('type', providerType)
        .maybeSingle();
      check(provider.error);
      if (!provider.data) throw new ApiError(404, 'NOT_FOUND', 'portfolio_not_found');
      const images = await publicClient
        .from('portfolio_images')
        .select('*,image_tags(tags(*))')
        .eq('portfolio_id', id)
        .eq('is_hidden', false)
        .order('sort_order')
        .order('id');
      check(images.error);
      const linksSchema = z.array(
        z.object({ tags: z.union([tagSchema, z.array(tagSchema)]).nullish() }),
      );
      return portfolioDetailSchema.parse({
        portfolio: {
          ...(normalizeRow(portfolio) as object),
          ownerName: provider.data.display_name,
        },
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
            .parse(normalizeRow(image.image_tags ?? []))
            .flatMap((link) =>
              Array.isArray(link.tags) ? link.tags : link.tags ? [link.tags] : [],
            ),
        })),
      });
    },
  };
}
