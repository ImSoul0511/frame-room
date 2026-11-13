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

/** Path parameter `:id` (UUID) dùng chung cho các route chi tiết. */
export const idParamsSchema = z.object({
  id: idSchema,
});

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

/** Query parameters cho GET /v1/explore. */
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

/** Card provider trên trang Explore (có thêm coverUrl từ ảnh đầu tiên của portfolio đã publish). */
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

/** Portfolio đã publish hiển thị trong trang chi tiết provider. */
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

/** Đánh giá công khai hiển thị trong trang chi tiết provider. */
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

/** Tag taxonomy (bảng public.tags). */
export const tagKindSchema = z.enum(['tone', 'setting', 'mood']);
export const tagSchema = z.object({
  id: idSchema,
  name: z.string(),
  slug: z.string(),
  kind: tagKindSchema,
});

/** Response của GET /v1/photographers/:id và GET /v1/studios/:id. */
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
