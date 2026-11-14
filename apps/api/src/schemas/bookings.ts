import { z } from 'zod';

export const idSchema = z.string().uuid();

export const providerTypeSchema = z.enum(['photographer', 'studio']);

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
  version: z.number().int(),
  agreedBriefVersion: z.number().int().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type BookingInput = z.infer<typeof bookingInputSchema>;
export type Booking = z.infer<typeof bookingSchema>;

// --- Slice 105b: Reschedule and lifecycle transition payloads ---
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

export type ScheduleInput = z.infer<typeof scheduleInputSchema>;
export type TransitionInput = z.infer<typeof transitionInputSchema>;

// --- Slice 105c: Brief versioning and bilateral approval schemas ---
export const briefContentSchema = z.object({
  title: z.string().trim().min(1).max(120),
  concept: z.string().max(4000),
  shotList: z.array(z.string().max(500)).max(30),
  lighting: z.array(z.string().max(500)).max(20),
  checklist: z.array(z.string().max(500)).max(30),
  milestones: z.array(z.string().max(200)).max(20),
});

export const briefVersionSchema = z.object({
  id: idSchema,
  bookingId: idSchema,
  version: z.number().int(),
  content: briefContentSchema,
  createdBy: idSchema,
  clientApproved: z.boolean(),
  providerApproved: z.boolean(),
  createdAt: z.string(),
});

export type BriefContent = z.infer<typeof briefContentSchema>;
export type BriefVersion = z.infer<typeof briefVersionSchema>;

// --- Slice 105d: 13-part participant workspace projection schemas ---
export const workspaceProjectSchema = z.object({
  id: idSchema,
  ownerId: idSchema,
  title: z.string(),
  idea: z.string().nullable(),
  brief: z.record(z.unknown()).nullable(),
  referencePaths: z.array(z.string()),
  version: z.number().int(),
  bookingId: idSchema.nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const workspaceProviderSchema = z.object({
  ownerType: z.enum(['photographer', 'studio']),
  id: idSchema,
  displayName: z.string(),
  avatarPath: z.string().nullable(),
  city: z.string().nullable(),
});

export const workspaceAssignedPhotographerSchema = z.object({
  id: idSchema,
  userId: idSchema,
  displayName: z.string(),
  avatarPath: z.string().nullable(),
});

export const workspaceResourceSchema = z.object({
  id: idSchema,
  studioId: idSchema,
  name: z.string(),
  type: z.enum(['room', 'equipment']),
});

export const workspaceMessageAttachmentSchema = z.object({
  storagePath: z.string(),
  url: z.string().nullable(),
  mimeType: z.string().nullable().optional(),
  fileName: z.string().nullable().optional(),
});

export const workspaceMessageSchema = z.object({
  id: idSchema,
  bookingId: idSchema,
  senderId: idSchema,
  kind: z.string(),
  body: z.string(),
  attachments: z.array(workspaceMessageAttachmentSchema),
  createdAt: z.string(),
});

export const workspaceDecisionSchema = z.object({
  id: idSchema,
  bookingId: idSchema,
  title: z.string(),
  summary: z.string(),
  createdBy: idSchema,
  createdAt: z.string(),
});

export const workspaceMilestoneSchema = z.object({
  id: idSchema,
  bookingId: idSchema,
  title: z.string(),
  status: z.enum(['pending', 'in_progress', 'completed']),
  dueAt: z.string().nullable(),
  completedAt: z.string().nullable(),
  sortOrder: z.number().int(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const workspaceGalleryImageSchema = z.object({
  id: idSchema,
  galleryId: idSchema,
  storagePath: z.string(),
  url: z.string().nullable(),
  caption: z.string().nullable(),
  selected: z.boolean(),
  sortOrder: z.number().int(),
  createdAt: z.string(),
});

export const workspaceGallerySchema = z.object({
  id: idSchema,
  bookingId: idSchema,
  title: z.string(),
  status: z.enum(['draft', 'published', 'selected']),
  images: z.array(workspaceGalleryImageSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const workspaceDeliverySchema = z.object({
  id: idSchema,
  bookingId: idSchema,
  storagePath: z.string(),
  url: z.string().nullable(),
  fileName: z.string(),
  mimeType: z.string().nullable(),
  sizeBytes: z.number().int().nullable(),
  note: z.string().nullable(),
  uploadedBy: idSchema,
  createdAt: z.string(),
});

export const workspaceReviewSchema = z.object({
  id: idSchema,
  bookingId: idSchema,
  reviewerId: idSchema,
  rating: z.number().int(),
  comment: z.string().nullable(),
  createdAt: z.string(),
});

export const bookingWorkspaceSchema = z.object({
  booking: bookingSchema,
  project: workspaceProjectSchema,
  provider: workspaceProviderSchema,
  assignedPhotographer: workspaceAssignedPhotographerSchema.nullable(),
  resources: z.array(workspaceResourceSchema),
  briefVersions: z.array(briefVersionSchema),
  agreedBrief: briefVersionSchema.nullable(),
  messages: z.array(workspaceMessageSchema),
  decisions: z.array(workspaceDecisionSchema),
  milestones: z.array(workspaceMilestoneSchema),
  galleries: z.array(workspaceGallerySchema),
  deliveries: z.array(workspaceDeliverySchema),
  review: workspaceReviewSchema.nullable(),
});

export type BookingWorkspace = z.infer<typeof bookingWorkspaceSchema>;
export type WorkspaceGallery = z.infer<typeof workspaceGallerySchema>;
export type WorkspaceDelivery = z.infer<typeof workspaceDeliverySchema>;

// --- Slice 105e: Personal & resource schedule entries and manual block schemas ---
export const scheduleEntryKindSchema = z.enum(['booking', 'blocked', 'maintenance']);

export const scheduleEntrySchema = z.object({
  id: idSchema,
  bookingId: idSchema.nullable(),
  photographerId: idSchema.nullable(),
  resourceId: idSchema.nullable(),
  kind: scheduleEntryKindSchema,
  title: z.string(),
  startsAt: z.string(),
  endsAt: z.string(),
  createdBy: idSchema,
  createdAt: z.string(),
});

export const scheduleQuerySchema = z
  .object({
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional(),
  })
  .refine(
    (v) => !v.from || !v.to || Date.parse(v.to) > Date.parse(v.from),
    'End must follow start',
  );

export const scheduleBlockInputSchema = z
  .object({
    photographerId: idSchema.optional(),
    resourceId: idSchema.optional(),
    kind: z.enum(['blocked', 'maintenance']).default('blocked'),
    title: z.string().trim().min(1).max(200),
    startsAt: z.string().datetime(),
    endsAt: z.string().datetime(),
  })
  .refine(
    (v) => (v.photographerId !== undefined) !== (v.resourceId !== undefined),
    'Specify either photographerId or resourceId',
  )
  .refine((v) => Date.parse(v.endsAt) > Date.parse(v.startsAt), 'End must follow start');

export type ScheduleEntry = z.infer<typeof scheduleEntrySchema>;
export type ScheduleQuery = z.infer<typeof scheduleQuerySchema>;
export type ScheduleBlockInput = z.infer<typeof scheduleBlockInputSchema>;
