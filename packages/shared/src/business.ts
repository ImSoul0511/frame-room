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
export const provenanceSchema = z.enum(['captured', 'manipulated', 'ai_generated']);
export const bookingStatusSchema = z.enum([
  'pending',
  'confirmed',
  'rejected',
  'cancelled',
  'in_progress',
  'proofing',
  'delivered',
  'completed',
]);
export const jobKindSchema = z.enum(['concept', 'edit', 'cull', 'index']);
export const jobStatusSchema = z.enum(['queued', 'running', 'succeeded', 'failed', 'uncertain']);
const shortText = z.string().trim().min(1).max(120);
const description = z.string().trim().max(2000).default('');
const nonnegative = z.number().int().min(0);
export const profileInputSchema = z.object({
  userName: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9][a-z0-9_]{2,29}$/),
  displayName: z.string().trim().min(1).max(60),
});
export const profileSchema = profileInputSchema.extend({
  id: idSchema,
  roles: z.array(z.string()),
  createdAt: z.string(),
});
export const photographerInputSchema = z.object({
  displayName: z.string().trim().min(1).max(60),
  bio: description,
  city: z.string().trim().max(100).default(''),
  district: z.string().trim().max(100).default(''),
  genres: z.array(genreSchema).min(1).max(5),
  styles: z.array(z.string().trim().max(30)).max(10).default([]),
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
export const studioInputSchema = z.object({
  name: z.string().trim().min(1).max(80),
  description,
  city: z.string().trim().max(100).default(''),
  district: z.string().trim().max(100).default(''),
  address: z.string().trim().max(200).default(''),
  genres: z.array(genreSchema).min(1).max(5),
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
export const addOnInputSchema = z.object({
  name: shortText,
  price: nonnegative,
  description,
  isActive: z.boolean().default(true),
});
export const resourceInputSchema = z.object({
  name: shortText,
  type: z.enum(['room', 'equipment']),
  description,
  isActive: z.boolean().default(true),
});
export const invitationInputSchema = z.object({
  photographerId: idSchema,
  role: z.enum(['manager', 'photographer']).default('photographer'),
});
export const invitationResponseSchema = z.object({
  status: z.enum(['accepted', 'declined', 'revoked']),
});
export const portfolioInputSchema = z.object({
  title: shortText,
  description,
  genre: genreSchema,
  status: z.enum(['draft', 'published']).default('draft'),
});
export const portfolioImageInputSchema = z.object({
  storagePath: z.string().min(1).max(500),
  caption: z.string().trim().max(300).default(''),
  provenance: provenanceSchema.default('captured'),
  source: z.string().max(500).nullable().default(null),
  licenseNote: z.string().max(500).nullable().default(null),
});
export const projectInputSchema = z.object({
  title: shortText,
  idea: z.string().trim().min(1).max(4000),
});
export const briefContentSchema = z.object({
  title: shortText,
  concept: z.string().max(4000),
  shotList: z.array(z.string().max(500)).max(30),
  lighting: z.array(z.string().max(500)).max(20),
  checklist: z.array(z.string().max(500)).max(30),
  milestones: z.array(z.string().max(200)).max(20),
});
export const projectPatchSchema = z.object({
  selectedArtifactIds: z.array(idSchema).max(12).optional(),
  title: shortText.optional(),
  idea: z.string().trim().min(1).max(4000).optional(),
  brief: briefContentSchema.optional(),
  referencePaths: z.array(z.string().max(500)).max(12).optional(),
});
export const projectSchema = projectInputSchema.extend({
  selectedArtifactIds: z.array(idSchema),
  id: idSchema,
  ownerId: idSchema,
  bookingId: idSchema.nullable(),
  brief: briefContentSchema.nullable(),
  referencePaths: z.array(z.string()),
  version: z.number().int(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export const searchInputSchema = z
  .object({
    query: z.string().trim().max(300).default(''),
    imageStoragePath: z.string().max(500).nullable().default(null),
    filters: z
      .object({
        genre: genreSchema.optional(),
        city: z.string().max(100).optional(),
        district: z.string().max(100).optional(),
        priceMax: nonnegative.optional(),
      })
      .default({}),
    ignoreParsed: z.array(z.enum(['genres', 'styles', 'city', 'district', 'priceMax'])).default([]),
    page: z.number().int().min(1).max(100).default(1),
    pageSize: z.number().int().min(1).max(50).default(20),
  })
  .refine((v) => Boolean(v.query || v.imageStoragePath), 'A query or reference is required');
export const parsedSearchSchema = z.object({
  description: z.string().max(1500),
  genres: z.array(genreSchema).max(5),
  styles: z.array(z.string().max(60)).max(10),
  city: z.string().max(100).nullable(),
  district: z.string().max(100).nullable(),
  priceMax: nonnegative.nullable(),
});
export const searchResultSchema = z.object({
  provider: providerSchema,
  score: z.number(),
  reasons: z.array(z.string()),
  matchedImages: z.array(
    z.object({ id: idSchema, url: z.string(), caption: z.string(), provenance: provenanceSchema }),
  ),
});
export const bookingInputSchema = z
  .object({
    serviceId: idSchema,
    projectId: idSchema,
    scheduledStart: z.string().datetime(),
    scheduledEnd: z.string().datetime(),
    addOnIds: z.array(idSchema).max(20).default([]),
    note: z.string().max(2000).default(''),
  })
  .refine(
    (v) => Date.parse(v.scheduledEnd) > Date.parse(v.scheduledStart),
    'End must follow start',
  );
export const scheduleInputSchema = z
  .object({
    scheduledStart: z.string().datetime(),
    scheduledEnd: z.string().datetime(),
    assignedPhotographerId: idSchema.optional(),
    resourceIds: z.array(idSchema).max(20).default([]),
    version: z.number().int().min(1),
  })
  .refine(
    (v) => Date.parse(v.scheduledEnd) > Date.parse(v.scheduledStart),
    'End must follow start',
  );
export const transitionInputSchema = z.object({
  to: bookingStatusSchema,
  version: z.number().int().min(1),
  reason: z.string().max(1000).default(''),
  scheduledStart: z.string().datetime().optional(),
  scheduledEnd: z.string().datetime().optional(),
  assignedPhotographerId: idSchema.optional(),
  resourceIds: z.array(idSchema).max(20).default([]),
});
export const bookingSchema = z.object({
  id: idSchema,
  clientId: idSchema,
  projectId: idSchema,
  serviceId: idSchema,
  ownerType: providerTypeSchema,
  photographerId: idSchema.nullable(),
  studioId: idSchema.nullable(),
  assignedPhotographerId: idSchema.nullable(),
  status: bookingStatusSchema,
  scheduledStart: z.string(),
  scheduledEnd: z.string(),
  totalPrice: z.number(),
  serviceName: z.string(),
  version: z.number(),
  agreedBriefVersion: z.number().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export const blockInputSchema = z
  .object({
    startsAt: z.string().datetime(),
    endsAt: z.string().datetime(),
    resourceId: idSchema.optional(),
    label: shortText,
  })
  .refine((v) => Date.parse(v.endsAt) > Date.parse(v.startsAt), 'End must follow start');
export const messageInputSchema = z
  .object({
    text: z.string().trim().max(4000).default(''),
    storagePath: z.string().max(500).nullable().default(null),
  })
  .refine((v) => Boolean(v.text || v.storagePath), 'Message cannot be empty');
export const milestoneInputSchema = z.object({
  title: shortText,
  dueAt: z.string().datetime().nullable().default(null),
});
export const decisionInputSchema = z.object({ title: shortText, description });
export const selectionInputSchema = z.object({ imageIds: z.array(idSchema).min(1).max(200) });
export const reviewInputSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(1000).default(''),
});
export const reportInputSchema = z.object({
  targetType: z.enum([
    'portfolio',
    'portfolio_image',
    'photographer',
    'studio',
    'review',
    'message',
  ]),
  targetId: idSchema,
  reason: z.enum(['inappropriate', 'copyright', 'spam', 'other']),
  description: z.string().trim().min(1).max(1000),
});
export const moderationInputSchema = z.object({ isHidden: z.boolean() });
export const assistantInputSchema = z.object({
  text: z.string().trim().min(1).max(4000),
  mode: z.enum(['chat', 'brief', 'summary', 'feedback', 'action']).default('chat'),
});
export const actionKindSchema = z.enum([
  'update_brief',
  'create_milestone',
  'request_booking',
  'reschedule_booking',
  'assign_photographer',
]);
export const actionProposalSchema = z.object({
  kind: actionKindSchema,
  explanation: z.string().max(1000),
  payload: z.record(z.unknown()),
});
export const jobInputSchema = z.object({
  kind: jobKindSchema.exclude(['index']),
  prompt: z.string().trim().max(2000).default(''),
  imageIds: z.array(idSchema).max(50).default([]),
  referencePath: z.string().max(500).optional(),
});
export const cullingOutputSchema = z.object({
  suggestions: z
    .array(z.object({ imageId: idSchema, selected: z.boolean(), reason: z.string().max(500) }))
    .max(50),
});
export const jobSchema = z.object({
  id: idSchema,
  projectId: idSchema.nullable(),
  kind: jobKindSchema,
  status: jobStatusSchema,
  result: z.unknown().nullable(),
  error: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export const artifactSchema = z.object({
  id: idSchema,
  projectId: idSchema,
  storagePath: z.string(),
  url: z.string(),
  provenance: provenanceSchema,
  originalImageId: idSchema.nullable(),
  prompt: z.string(),
  createdAt: z.string(),
});
export const actionSchema = z.object({
  id: idSchema,
  projectId: idSchema,
  kind: actionKindSchema,
  explanation: z.string(),
  payload: z.record(z.unknown()),
  status: z.enum(['proposed', 'applied', 'rejected']),
  projectVersion: z.number(),
  bookingVersion: z.number().nullable(),
  expiresAt: z.string(),
});
export const assistantMessageSchema = z.object({
  id: idSchema,
  role: z.enum(['user', 'assistant']),
  content: z.string(),
  createdAt: z.string(),
});
export const errorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.array(
      z.object({
        field: z.string().optional(),
        reason: z.string().optional(),
        message: z.string().optional(),
      }),
    ),
  }),
});
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});
export type Profile = z.infer<typeof profileSchema>;
export type Provider = z.infer<typeof providerSchema>;
export type CreativeProject = z.infer<typeof projectSchema>;
export type Booking = z.infer<typeof bookingSchema>;
export type BriefContent = z.infer<typeof briefContentSchema>;
export type AiJob = z.infer<typeof jobSchema>;
export type AiAction = z.infer<typeof actionSchema>;
export type Artifact = z.infer<typeof artifactSchema>;
export type SearchResult = z.infer<typeof searchResultSchema>;
export type Service = z.infer<typeof serviceSchema>;
