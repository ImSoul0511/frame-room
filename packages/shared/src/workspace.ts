import { z } from 'zod';
import {
  bookingSchema,
  briefContentSchema,
  idSchema,
  projectSchema,
  provenanceSchema,
} from './business.js';

export const notificationSchema = z
  .object({
    id: idSchema,
    bookingId: idSchema.nullable(),
    studioId: idSchema.nullable(),
    event: z.string(),
    createdAt: z.string(),
    readAt: z.string().nullable(),
  })
  .passthrough();
export const workspaceImageSchema = z
  .object({
    id: idSchema,
    storagePath: z.string(),
    url: z.string(),
    thumbnailUrl: z.string().optional(),
    caption: z.string(),
    crewCredits: z.string().optional(),
    tags: z.array(z.object({ id: idSchema, name: z.string() })).optional(),
    provenance: provenanceSchema,
  })
  .passthrough();
export const photoFeedbackSchema = z
  .object({
    id: idSchema,
    imageId: idSchema,
    round: z.number().int(),
    note: z.string(),
    x: z.number().nullable(),
    y: z.number().nullable(),
  })
  .passthrough();
export const bookingWorkspaceSchema = z.object({
  booking: bookingSchema,
  project: projectSchema,
  room: z.object({ id: idSchema, status: z.string() }).passthrough().nullable(),
  isProvider: z.boolean(),
  canManage: z.boolean(),
  isClient: z.boolean(),
  briefs: z.array(
    z
      .object({
        id: idSchema,
        version: z.number().int(),
        status: z.enum(['open', 'closed']).optional(),
        content: briefContentSchema,
        clientApproved: z.boolean(),
        providerApproved: z.boolean(),
      })
      .passthrough(),
  ),
  cancellation: z
    .object({ id: idSchema, isClientProposal: z.boolean(), reason: z.string() })
    .passthrough()
    .nullable(),
  messages: z.array(
    z
      .object({
        id: idSchema,
        senderId: idSchema.nullable(),
        text: z.string(),
        type: z.enum(['text', 'image', 'system']),
        storagePath: z.string().nullable(),
        createdAt: z.string(),
      })
      .passthrough(),
  ),
  decisions: z.array(
    z
      .object({
        id: idSchema,
        title: z.string(),
        description: z.string(),
        proposedBy: idSchema,
        status: z.enum(['proposed', 'agreed', 'rejected']),
      })
      .passthrough(),
  ),
  milestones: z.array(
    z
      .object({
        id: idSchema,
        title: z.string(),
        dueAt: z.string().nullable(),
        status: z.enum(['todo', 'done']),
        updatedAt: z.string().nullish(),
        updatedBy: idSchema.nullish(),
      })
      .passthrough(),
  ),
  gallery: z
    .object({
      id: idSchema,
      status: z.string(),
      round: z.number().int(),
      revisionRequestedAt: z.string().nullable(),
    })
    .passthrough()
    .nullable(),
  proofing: z.object({ quota: z.number(), revisions: z.number() }),
  photoFeedback: z.array(photoFeedbackSchema),
  images: z.array(workspaceImageSchema),
  selections: z.array(z.object({ imageId: idSchema }).passthrough()),
  deliveries: z.array(
    z.object({ id: idSchema, fileName: z.string(), url: z.string() }).passthrough(),
  ),
  resources: z.array(z.object({ resourceId: idSchema, name: z.string() }).passthrough()),
  review: z
    .object({
      rating: z.number(),
      comment: z.string(),
      isHidden: z.boolean().optional(),
      moderationReason: z.string().nullish(),
      reassessmentRequestedAt: z.string().nullish(),
      deletedAt: z.string().nullish(),
    })
    .passthrough()
    .nullable(),
});
export type BookingWorkspace = z.infer<typeof bookingWorkspaceSchema>;
export type Notification = z.infer<typeof notificationSchema>;
