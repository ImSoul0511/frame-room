import {
  genreSchema,
  idSchema,
  paginationSchema,
  photographerInputSchema,
  portfolioInputSchema,
  portfolioImageInputSchema as sharedPortfolioImageInputSchema,
  providerSchema,
  providerTypeSchema,
  provenanceSchema,
  serviceInputSchema,
  serviceSchema,
  studioInputSchema,
  invitationInputSchema,
  invitationResponseSchema,
  resourceInputSchema,
  addOnInputSchema,
} from '@frameroom/shared';
import { z } from 'zod';

export {
  genreSchema,
  idSchema,
  paginationSchema,
  portfolioInputSchema,
  providerSchema,
  providerTypeSchema,
  provenanceSchema,
  serviceInputSchema,
  serviceSchema,
  studioInputSchema,
};

const shortText = z.string().trim().min(1).max(120);
const description = z.string().trim().max(2000).default('');
const optionalFilterText = z.string().trim().min(1).max(100).optional();

/** Shared `:id` UUID path parameter for detail routes. */
export const idParamsSchema = z.object({
  id: idSchema,
});

export const photographerLookupParamsSchema = z.object({
  id: photographerInputSchema.shape.displayName,
});

export const photographerDisplayNameQuerySchema = z.object({
  displayName: photographerInputSchema.shape.displayName,
});

export type ProviderLookup = { id: string } | { displayName: string };

/** Query parameters for GET /v1/explore. */
export const exploreQuerySchema = paginationSchema.extend({
  genre: genreSchema.optional(),
  city: optionalFilterText,
  district: optionalFilterText,
  priceMax: z.coerce.number().int().min(0).optional(),
});

/** Query parameters for GET /v1/photographers and GET /v1/studios. */
export const providerListQuerySchema = paginationSchema.extend({
  genre: genreSchema.optional(),
  city: optionalFilterText,
  district: optionalFilterText,
});

/** Provider card on the Explore page, with the cover URL of its first published portfolio image. */
export const exploreProviderSchema = providerSchema.extend({
  coverUrl: z.string().nullable().optional(),
});

export const portfolioStatusSchema = z.enum(['draft', 'published', 'hidden']);

/** Database tag taxonomy, including optional localized metadata. */
export const tagKindSchema = z.enum(['tone', 'setting', 'mood']);
export const tagSchema = z.object({
  id: idSchema,
  name: z.string(),
  slug: z.string(),
  kind: tagKindSchema,
  nameVi: z.string().nullish(),
  category: z.string().nullish(),
});

/** Published portfolio shown on public discovery and provider pages. */
export const publicPortfolioSchema = z.object({
  id: idSchema,
  title: shortText,
  description,
  genre: genreSchema,
  status: portfolioStatusSchema,
  ownerType: providerTypeSchema,
  photographerId: idSchema.nullable(),
  studioId: idSchema.nullable(),
  publishedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  coverUrl: z.string().nullable().optional(),
  tags: z.array(tagSchema).optional(),
});

/** Publicly visible review shown on a provider detail page. */
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
export type ProviderListQuery = z.infer<typeof providerListQuerySchema>;
export type ExploreProvider = z.infer<typeof exploreProviderSchema>;
export type Tag = z.infer<typeof tagSchema>;
export type PublicPortfolio = z.infer<typeof publicPortfolioSchema>;
export type PublicReview = z.infer<typeof publicReviewSchema>;
export type ProviderDetail = z.infer<typeof providerDetailSchema>;

// ---------- 102b: Studios & Team ----------

export const studioMemberRoleSchema = z.enum(['manager', 'photographer']);

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
  photographerId: idSchema.nullable(),
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
  q: z.string().trim().min(1).max(120).optional(),
  sort: z.enum(['newest', 'oldest', 'name']).optional(),
});

export const ownedPortfolioSchema = z.object({
  id: idSchema,
  title: shortText,
  description,
  genre: genreSchema,
  status: portfolioStatusSchema,
  ownerType: providerTypeSchema,
  photographerId: idSchema.nullable(),
  studioId: idSchema.nullable(),
  publishedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const portfolioImageInputSchema = sharedPortfolioImageInputSchema.extend({
  sortOrder: z.number().int().min(0).default(0),
  tagIds: z.array(idSchema).max(20).default([]),
  crewCredits: z.string().trim().max(500).optional(),
});

export const portfolioImageSchema = z.object({
  id: idSchema,
  portfolioId: idSchema,
  storagePath: z.string(),
  url: z.string().nullable(),
  width: z.number().int(),
  height: z.number().int(),
  caption: z.string(),
  sortOrder: z.number().int(),
  provenance: provenanceSchema,
  source: z.string().nullable(),
  licenseNote: z.string().nullable(),
  crewCredits: z.string().optional(),
  isHidden: z.boolean(),
  createdAt: z.string(),
  tags: z.array(tagSchema),
});

export const portfolioDetailSchema = z.object({
  portfolio: ownedPortfolioSchema,
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

export const invitationStatusSchema = z.enum(['pending', 'accepted', 'declined', 'revoked']);

export const resourceTypeSchema = z.enum(['room', 'equipment']);

export const studioInvitationInputSchema = invitationInputSchema;

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

export const respondInvitationInputSchema = invitationResponseSchema;

export const studioMemberParamsSchema = z.object({
  id: idSchema,
  userId: idSchema,
});

export const updateStudioMemberRoleInputSchema = z.object({
  role: studioMemberRoleSchema,
});

export const studioResourceInputSchema = resourceInputSchema;

export const studioResourceSchema = studioResourceInputSchema.extend({
  id: idSchema,
  studioId: idSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const serviceAddOnInputSchema = addOnInputSchema;

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
