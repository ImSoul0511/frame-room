import { z } from 'zod';

export const idSchema = z.string().uuid();

export const genres = [
  'portrait',
  'fashion',
  'wedding',
  'family',
  'product',
  'food',
  'event',
  'cosplay',
] as const;

export const genreSchema = z.enum(genres);
export const providerTypeSchema = z.enum(['photographer', 'studio']);

const shortText = z.string().trim().min(1).max(120);
const description = z.string().trim().max(2000).default('');
const nonnegative = z.number().int().min(0);

/** Shared `:id` UUID path parameter schema for detail and mutation routes. */
export const idParamsSchema = z.object({
  id: idSchema,
});

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

/** Query parameters for GET /v1/explore. */
export const exploreQuerySchema = paginationSchema.extend({
  genre: genreSchema.optional(),
  city: z.string().trim().max(100).optional(),
  district: z.string().trim().max(100).optional(),
  priceMax: z.coerce.number().int().min(0).optional(),
});

export const providerSchema = z.object({
  id: idSchema,
  type: providerTypeSchema,
  displayName: z.string(),
  bio: z.string(),
  city: z.string(),
  district: z.string(),
  genres: z.array(genreSchema),
  styles: z.array(z.string()),
  priceFrom: z.number().nullable(),
  ratingAvg: z.number().nullable(),
  reviewCount: z.number(),
});

/** Explore provider card enriched with the cover URL from its first published portfolio image. */
export const exploreProviderSchema = providerSchema.extend({
  coverUrl: z.string().nullable().optional(),
});

export const serviceInputSchema = z.object({
  name: shortText,
  description,
  genre: genreSchema,
  durationMinutes: z.number().int().min(15).max(1440),
  price: nonnegative.max(1000000000),
  photoCount: nonnegative.default(10),
  retouchedCount: nonnegative.default(5),
  isActive: z.boolean().default(true),
});

export const serviceSchema = serviceInputSchema.extend({
  id: idSchema,
  ownerType: providerTypeSchema,
  photographerId: idSchema.nullable(),
  studioId: idSchema.nullable(),
});

export const portfolioInputSchema = z.object({
  title: shortText,
  description,
  genre: genreSchema,
  status: z.enum(['draft', 'published']).default('draft'),
});

/** Published portfolio displayed on a public provider detail page. */
export const publicPortfolioSchema = portfolioInputSchema.extend({
  id: idSchema,
  ownerType: providerTypeSchema,
  photographerId: idSchema.nullable(),
  studioId: idSchema.nullable(),
  publishedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  coverUrl: z.string().nullable().optional(),
});

/** Publicly visible review displayed on a provider detail page. */
export const publicReviewSchema = z.object({
  id: idSchema,
  bookingId: idSchema,
  authorId: idSchema,
  authorName: z.string(),
  photographerId: idSchema.nullable(),
  studioId: idSchema.nullable(),
  rating: z.number().int().min(1).max(5),
  comment: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

/** Taxonomy tag (public.tags). */
export const tagKindSchema = z.enum(['tone', 'setting', 'mood']);
export const tagSchema = z.object({
  id: idSchema,
  name: z.string(),
  slug: z.string(),
  kind: tagKindSchema,
});

/** Response payload for GET /v1/photographers/:id and GET /v1/studios/:id. */
export const providerDetailSchema = z.object({
  provider: providerSchema,
  services: z.array(serviceSchema),
  portfolios: z.array(publicPortfolioSchema),
  reviews: z.array(publicReviewSchema),
});

export type Provider = z.infer<typeof providerSchema>;
export type Service = z.infer<typeof serviceSchema>;
export type ExploreQuery = z.infer<typeof exploreQuerySchema>;
export type ExploreProvider = z.infer<typeof exploreProviderSchema>;
export type Tag = z.infer<typeof tagSchema>;
export type PublicPortfolio = z.infer<typeof publicPortfolioSchema>;
export type PublicReview = z.infer<typeof publicReviewSchema>;
export type ProviderDetail = z.infer<typeof providerDetailSchema>;

// ---------- 102b: Studios & Team ----------

export const studioMemberRoleSchema = z.enum(['manager', 'photographer']);

export const studioInputSchema = z.object({
  name: z.string().trim().min(1).max(80),
  description,
  city: z.string().trim().max(100).default(''),
  district: z.string().trim().max(100).default(''),
  address: z.string().trim().max(200).default(''),
  genres: z.array(genreSchema).min(1).max(5),
});

export const studioSchema = studioInputSchema.extend({
  id: idSchema,
  createdBy: idSchema,
  isHidden: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const myStudioSchema = studioSchema.extend({
  role: studioMemberRoleSchema,
});

export const studioTeamMemberSchema = z.object({
  studioId: idSchema,
  userId: idSchema,
  role: studioMemberRoleSchema,
  joinedAt: z.string(),
  displayName: z.string(),
  userName: z.string(),
  photographerId: idSchema,
});

export type StudioInput = z.infer<typeof studioInputSchema>;
export type Studio = z.infer<typeof studioSchema>;
export type MyStudio = z.infer<typeof myStudioSchema>;
export type StudioTeamMember = z.infer<typeof studioTeamMemberSchema>;

// ---------- 102c: Services ----------

export const ownedServiceSchema = serviceSchema.extend({
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type ServiceInput = z.infer<typeof serviceInputSchema>;
export type OwnedService = z.infer<typeof ownedServiceSchema>;

// ---------- 102d: Portfolios & Images ----------

export const portfolioListQuerySchema = paginationSchema.extend({
  genre: genreSchema.optional(),
  tag: z.string().trim().min(1).max(60).optional(),
});

export const ownedPortfolioSchema = portfolioInputSchema.extend({
  id: idSchema,
  ownerType: providerTypeSchema,
  photographerId: idSchema.nullable(),
  studioId: idSchema.nullable(),
  publishedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const portfolioImageInputSchema = z.object({
  storagePath: z.string().trim().min(1).max(500),
  caption: z.string().trim().max(500).default(''),
  sortOrder: z.number().int().min(0).default(0),
  tagIds: z.array(idSchema).max(20).default([]),
});

export const portfolioImageSchema = z.object({
  id: idSchema,
  portfolioId: idSchema,
  storagePath: z.string(),
  url: z.string().nullable(),
  caption: z.string(),
  sortOrder: z.number().int(),
  isHidden: z.boolean(),
  createdAt: z.string(),
  tags: z.array(tagSchema),
});

export const portfolioDetailSchema = ownedPortfolioSchema.extend({
  images: z.array(portfolioImageSchema),
});

export const portfolioImageTagsInputSchema = z.object({
  tagIds: z.array(idSchema).max(20),
});

export type PortfolioListQuery = z.infer<typeof portfolioListQuerySchema>;
export type PortfolioInput = z.infer<typeof portfolioInputSchema>;
export type OwnedPortfolio = z.infer<typeof ownedPortfolioSchema>;
export type PortfolioImageInput = z.infer<typeof portfolioImageInputSchema>;
export type PortfolioImage = z.infer<typeof portfolioImageSchema>;
export type PortfolioDetail = z.infer<typeof portfolioDetailSchema>;

// ---------- 102e: Invitations, Members, Resources & Add-ons ----------

export const invitationStatusSchema = z.enum(['pending', 'accepted', 'declined', 'cancelled']);

export const resourceTypeSchema = z.enum(['room', 'equipment', 'backdrop', 'lighting', 'other']);

export const studioInvitationInputSchema = z.object({
  photographerId: idSchema,
  role: studioMemberRoleSchema.default('photographer'),
});

export const studioInvitationSchema = z.object({
  id: idSchema,
  studioId: idSchema,
  photographerId: idSchema,
  role: studioMemberRoleSchema,
  status: invitationStatusSchema,
  invitedBy: idSchema,
  respondedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const myInvitationSchema = studioInvitationSchema.extend({
  studioName: z.string(),
  inviterName: z.string(),
});

export const respondInvitationInputSchema = z.object({
  action: z.enum(['accept', 'decline']),
});

export const studioMemberParamsSchema = z.object({
  id: idSchema,
  userId: idSchema,
});

export const updateStudioMemberRoleInputSchema = z.object({
  role: z.enum(['manager', 'photographer']),
});

export const studioResourceInputSchema = z.object({
  name: z.string().trim().min(1).max(160),
  type: resourceTypeSchema,
  description: z.string().trim().max(1000).default(''),
  isActive: z.boolean().default(true),
});

export const studioResourceSchema = studioResourceInputSchema.extend({
  id: idSchema,
  studioId: idSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const serviceAddOnInputSchema = z.object({
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().max(1000).default(''),
  price: z.number().int().min(0),
  isActive: z.boolean().default(true),
});

export const serviceAddOnSchema = serviceAddOnInputSchema.extend({
  id: idSchema,
  serviceId: idSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type StudioInvitationInput = z.infer<typeof studioInvitationInputSchema>;
export type StudioInvitation = z.infer<typeof studioInvitationSchema>;
export type MyInvitation = z.infer<typeof myInvitationSchema>;
export type StudioResourceInput = z.infer<typeof studioResourceInputSchema>;
export type StudioResource = z.infer<typeof studioResourceSchema>;
export type ServiceAddOnInput = z.infer<typeof serviceAddOnInputSchema>;
export type ServiceAddOn = z.infer<typeof serviceAddOnSchema>;
