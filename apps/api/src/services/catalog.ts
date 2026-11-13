import { ApiError } from '../lib/errors.js';
import * as repo from '../repositories/catalog.js';
import type { Transaction } from '../repositories/database.js';
import type {
  ExploreProvider,
  ExploreQuery,
  MyInvitation,
  MyStudio,
  OwnedPortfolio,
  OwnedService,
  PortfolioDetail,
  PortfolioImage,
  PortfolioImageInput,
  PortfolioInput,
  PortfolioListQuery,
  Provider,
  ProviderDetail,
  ProviderListQuery,
  PublicPortfolio,
  ServiceAddOn,
  ServiceAddOnInput,
  ServiceInput,
  Studio,
  StudioInput,
  StudioInvitation,
  StudioInvitationInput,
  StudioResource,
  StudioResourceInput,
  StudioTeamMember,
  Tag,
} from '../schemas/catalog.js';

/** Builds a public URL for the `portfolio-images` bucket when SUPABASE_URL is configured. */
export function buildPublicPortfolioImageUrl(
  supabaseUrl: string | undefined,
  storagePath: string | null | undefined,
): string | null {
  if (!storagePath) return null;
  if (/^https?:\/\//i.test(storagePath)) return storagePath;
  if (!supabaseUrl) return storagePath;
  const base = supabaseUrl.replace(/\/+$/, '');
  const path = storagePath.replace(/^\/+/, '');
  return `${base}/storage/v1/object/public/portfolio-images/${path}`;
}

/** Discovers public providers with cover URLs and pagination filters. */
export async function exploreProviders(
  tx: Transaction,
  query: ExploreQuery,
  supabaseUrl?: string,
): Promise<ExploreProvider[]> {
  const rows = await repo.discoverProviders(tx, query);
  return rows.map((row) => ({
    ...row,
    coverUrl: buildPublicPortfolioImageUrl(supabaseUrl, row.coverUrl),
  }));
}

/** Lists visible public photographers or studios with filters and pagination. */
export async function listProviders(
  tx: Transaction,
  type: 'photographer' | 'studio',
  query: ProviderListQuery,
): Promise<Provider[]> {
  return repo.listProvidersByType(tx, type, query);
}

/** Returns public provider detail with active services, published portfolios, and visible reviews. */
export async function getProviderDetail(
  tx: Transaction,
  type: 'photographer' | 'studio',
  id: string,
  supabaseUrl?: string,
): Promise<ProviderDetail> {
  const provider = await repo.findProviderById(tx, type, id);
  if (!provider) {
    throw new ApiError(404, 'NOT_FOUND', `${type}_not_found`);
  }

  const [services, portfolios, reviews] = await Promise.all([
    repo.listActiveServicesByProvider(tx, type, id),
    repo.listPublishedPortfoliosByProvider(tx, type, id),
    repo.listVisibleReviewsByProvider(tx, type, id),
  ]);

  return {
    provider,
    services,
    portfolios: portfolios.map((pf) => ({
      ...pf,
      coverUrl: buildPublicPortfolioImageUrl(supabaseUrl, pf.coverUrl),
    })),
    reviews,
  };
}

/** Lists all taxonomy tags ordered by kind and name. */
export async function getAllTags(tx: Transaction): Promise<Tag[]> {
  return repo.listTags(tx);
}

// ---------- 102b: Studios & Team ----------

/** Verifies that the caller is an active manager of the specified studio. */
export async function requireStudioManager(
  tx: Transaction,
  studioId: string,
  userId: string,
): Promise<void> {
  const ok = await repo.isStudioManager(tx, studioId, userId);
  if (!ok) {
    throw new ApiError(403, 'FORBIDDEN', 'studio_manager_required');
  }
}

/** Lists active studios where the caller is a member. */
export async function listMyStudios(tx: Transaction, userId: string): Promise<MyStudio[]> {
  return repo.listStudiosForUser(tx, userId);
}

/** Atomically creates a studio and adds the caller as its initial manager. */
export async function createStudio(
  tx: Transaction,
  userId: string,
  input: StudioInput,
): Promise<Studio> {
  const studio = await repo.insertStudio(tx, userId, input);
  await repo.insertStudioMember(tx, studio.id, userId, 'manager');
  return studio;
}

/** Updates mutable studio fields (current manager only). */
export async function updateStudio(
  tx: Transaction,
  userId: string,
  studioId: string,
  input: StudioInput,
): Promise<Studio> {
  await requireStudioManager(tx, studioId, userId);
  return repo.updateStudio(tx, studioId, input);
}

/** Lists team members of a studio (current manager only). */
export async function getStudioTeam(
  tx: Transaction,
  userId: string,
  studioId: string,
): Promise<StudioTeamMember[]> {
  await requireStudioManager(tx, studioId, userId);
  return repo.listStudioTeam(tx, studioId);
}

// ---------- 102c: Services ----------

/** Resolves the caller's photographer profile id or throws 403 if missing. */
async function requirePhotographerId(tx: Transaction, userId: string): Promise<string> {
  const photographerId = await repo.findPhotographerIdByUser(tx, userId);
  if (!photographerId) {
    throw new ApiError(403, 'FORBIDDEN', 'photographer_profile_required');
  }
  return photographerId;
}

/** Verifies that the caller owns a provider record (either as the photographer or a studio manager). */
export async function assertProviderOwnership(
  tx: Transaction,
  userId: string,
  owner: { photographerId: string | null; studioId: string | null },
): Promise<void> {
  if (owner.photographerId) {
    const myPhotographerId = await repo.findPhotographerIdByUser(tx, userId);
    if (myPhotographerId !== owner.photographerId) {
      throw new ApiError(403, 'FORBIDDEN', 'not_resource_owner');
    }
    return;
  }
  if (owner.studioId) {
    await requireStudioManager(tx, owner.studioId, userId);
    return;
  }
  throw new ApiError(403, 'FORBIDDEN', 'not_resource_owner');
}

/** Lists non-deleted services owned by the caller or their managed studios. */
export async function listMyServices(tx: Transaction, userId: string): Promise<OwnedService[]> {
  return repo.listOwnedServices(tx, userId);
}

/** Creates a personal photographer service. */
export async function createPersonalService(
  tx: Transaction,
  userId: string,
  input: ServiceInput,
): Promise<OwnedService> {
  const photographerId = await requirePhotographerId(tx, userId);
  return repo.insertPersonalService(tx, photographerId, input);
}

/** Creates a service owned by a studio (current manager only). */
export async function createStudioService(
  tx: Transaction,
  userId: string,
  studioId: string,
  input: ServiceInput,
): Promise<OwnedService> {
  await requireStudioManager(tx, studioId, userId);
  return repo.insertStudioService(tx, studioId, input);
}

/** Updates an owned photographer or studio service. */
export async function updateService(
  tx: Transaction,
  userId: string,
  serviceId: string,
  input: ServiceInput,
): Promise<OwnedService> {
  const existing = await repo.findServiceOwnership(tx, serviceId);
  if (!existing) {
    throw new ApiError(404, 'NOT_FOUND', 'service_not_found');
  }
  await assertProviderOwnership(tx, userId, existing);
  return repo.updateService(tx, serviceId, input);
}

/** Soft-deletes an owned service and marks it inactive. */
export async function deleteService(
  tx: Transaction,
  userId: string,
  serviceId: string,
): Promise<void> {
  const existing = await repo.findServiceOwnership(tx, serviceId);
  if (!existing) {
    throw new ApiError(404, 'NOT_FOUND', 'service_not_found');
  }
  await assertProviderOwnership(tx, userId, existing);
  await repo.softDeleteService(tx, serviceId);
}

// ---------- 102d: Portfolios & Images ----------

/** Lists non-deleted portfolios owned by the caller or their managed studios. */
export async function listMyPortfolios(tx: Transaction, userId: string): Promise<OwnedPortfolio[]> {
  return repo.listOwnedPortfolios(tx, userId);
}

/** Lists published portfolios from visible providers with optional genre and tag filters. */
export async function listPublicPortfolios(
  tx: Transaction,
  query: PortfolioListQuery,
  supabaseUrl?: string,
): Promise<PublicPortfolio[]> {
  const rows = await repo.listPublicPortfolios(tx, query);
  return rows.map((row) => ({
    ...row,
    coverUrl: buildPublicPortfolioImageUrl(supabaseUrl, row.coverUrl),
  }));
}

/** Returns a published portfolio's details, visible images, and batched image tags. */
export async function getPortfolioDetail(
  tx: Transaction,
  portfolioId: string,
  supabaseUrl?: string,
): Promise<PortfolioDetail> {
  const portfolio = await repo.findPortfolioById(tx, portfolioId);
  if (!portfolio || portfolio.status !== 'published') {
    throw new ApiError(404, 'NOT_FOUND', 'portfolio_not_found');
  }

  const visible = await repo.isPortfolioProviderVisible(tx, portfolio);
  if (!visible) {
    throw new ApiError(404, 'NOT_FOUND', 'portfolio_not_found');
  }

  const imageRows = await repo.listPortfolioImages(tx, portfolioId);
  const tagsByImage = await repo.listTagsForImages(
    tx,
    imageRows.map((img) => img.id),
  );

  const images: PortfolioImage[] = imageRows.map((img) => ({
    ...img,
    url: buildPublicPortfolioImageUrl(supabaseUrl, img.storagePath),
    tags: tagsByImage.get(img.id) ?? [],
  }));

  return {
    ...portfolio,
    images,
  };
}

/** Creates a personal photographer portfolio. */
export async function createPersonalPortfolio(
  tx: Transaction,
  userId: string,
  input: PortfolioInput,
): Promise<OwnedPortfolio> {
  const photographerId = await requirePhotographerId(tx, userId);
  return repo.insertPersonalPortfolio(tx, photographerId, input);
}

/** Creates a portfolio owned by a studio (current manager only). */
export async function createStudioPortfolio(
  tx: Transaction,
  userId: string,
  studioId: string,
  input: PortfolioInput,
): Promise<OwnedPortfolio> {
  await requireStudioManager(tx, studioId, userId);
  return repo.insertStudioPortfolio(tx, studioId, input);
}

/** Updates an owned photographer or studio portfolio. */
export async function updatePortfolio(
  tx: Transaction,
  userId: string,
  portfolioId: string,
  input: PortfolioInput,
): Promise<OwnedPortfolio> {
  const existing = await repo.findPortfolioOwnership(tx, portfolioId);
  if (!existing) {
    throw new ApiError(404, 'NOT_FOUND', 'portfolio_not_found');
  }
  await assertProviderOwnership(tx, userId, existing);
  return repo.updatePortfolio(tx, portfolioId, input);
}

/** Soft-deletes an owned portfolio. */
export async function deletePortfolio(
  tx: Transaction,
  userId: string,
  portfolioId: string,
): Promise<void> {
  const existing = await repo.findPortfolioOwnership(tx, portfolioId);
  if (!existing) {
    throw new ApiError(404, 'NOT_FOUND', 'portfolio_not_found');
  }
  await assertProviderOwnership(tx, userId, existing);
  await repo.softDeletePortfolio(tx, portfolioId);
}

/** Attaches an uploaded image with provenance metadata and optional tags to an owned portfolio. */
export async function addPortfolioImage(
  tx: Transaction,
  userId: string,
  portfolioId: string,
  input: PortfolioImageInput,
  supabaseUrl?: string,
): Promise<PortfolioImage> {
  const existing = await repo.findPortfolioOwnership(tx, portfolioId);
  if (!existing) {
    throw new ApiError(404, 'NOT_FOUND', 'portfolio_not_found');
  }
  await assertProviderOwnership(tx, userId, existing);

  const uniqueTagIds = [...new Set(input.tagIds)];
  if (uniqueTagIds.length > 0) {
    const foundCount = await repo.countExistingTags(tx, uniqueTagIds);
    if (foundCount !== uniqueTagIds.length) {
      throw new ApiError(404, 'NOT_FOUND', 'tag_not_found');
    }
  }

  const image = await repo.insertPortfolioImage(tx, portfolioId, input);
  if (uniqueTagIds.length > 0) {
    await repo.replacePortfolioImageTags(tx, image.id, uniqueTagIds);
  }
  const tags = uniqueTagIds.length > 0 ? await repo.listTagsForImage(tx, image.id) : [];

  return {
    ...image,
    url: buildPublicPortfolioImageUrl(supabaseUrl, image.storagePath),
    tags,
  };
}

/** Replaces tag assignments on an owned portfolio image. */
export async function setPortfolioImageTags(
  tx: Transaction,
  userId: string,
  imageId: string,
  tagIds: string[],
): Promise<Tag[]> {
  const existing = await repo.findPortfolioImageOwnership(tx, imageId);
  if (!existing) {
    throw new ApiError(404, 'NOT_FOUND', 'portfolio_image_not_found');
  }
  await assertProviderOwnership(tx, userId, existing);

  const uniqueTagIds = [...new Set(tagIds)];
  if (uniqueTagIds.length > 0) {
    const foundCount = await repo.countExistingTags(tx, uniqueTagIds);
    if (foundCount !== uniqueTagIds.length) {
      throw new ApiError(404, 'NOT_FOUND', 'tag_not_found');
    }
  }

  await repo.replacePortfolioImageTags(tx, imageId, uniqueTagIds);
  return repo.listTagsForImage(tx, imageId);
}

// ---------- 102e: Invitations, Members, Resources & Add-ons ----------

/** Lists pending studio invitations addressed to the caller. */
export async function listMyInvitations(tx: Transaction, userId: string): Promise<MyInvitation[]> {
  return repo.listPendingInvitationsForUser(tx, userId);
}

/** Invites a photographer to join a studio (current manager only). */
export async function createStudioInvitation(
  tx: Transaction,
  userId: string,
  studioId: string,
  input: StudioInvitationInput,
): Promise<StudioInvitation> {
  await requireStudioManager(tx, studioId, userId);

  const targetUserId = await repo.findPhotographerUserId(tx, input.photographerId);
  if (!targetUserId) {
    throw new ApiError(404, 'NOT_FOUND', 'photographer_not_found');
  }

  const alreadyMember = await repo.isStudioMember(tx, studioId, targetUserId);
  if (alreadyMember) {
    throw new ApiError(409, 'CONFLICT', 'already_studio_member');
  }

  const alreadyInvited = await repo.hasPendingStudioInvitation(tx, studioId, input.photographerId);
  if (alreadyInvited) {
    throw new ApiError(409, 'CONFLICT', 'invitation_already_pending');
  }

  return repo.insertStudioInvitation(tx, studioId, userId, input);
}

/** Atomically accepts/declines (recipient) or revokes (studio manager) a pending invitation. */
export async function respondToInvitation(
  tx: Transaction,
  userId: string,
  invitationId: string,
  status: 'accepted' | 'declined' | 'revoked',
): Promise<StudioInvitation> {
  const invitation = await repo.findInvitationWithRecipient(tx, invitationId);
  if (!invitation) {
    throw new ApiError(404, 'NOT_FOUND', 'invitation_not_found');
  }

  if (status === 'revoked') {
    await requireStudioManager(tx, invitation.studioId, userId);
  } else if (invitation.recipientUserId !== userId) {
    throw new ApiError(403, 'FORBIDDEN', 'not_invitation_recipient');
  }

  const updated = await repo.respondPendingInvitation(tx, invitationId, status);
  if (!updated) {
    throw new ApiError(409, 'CONFLICT', 'invitation_not_pending');
  }

  if (status === 'accepted') {
    await repo.insertStudioMember(tx, invitation.studioId, userId, invitation.role);
  }

  return updated;
}

/** Updates a studio member's role under an advisory lock while protecting the last manager. */
export async function updateStudioMemberRole(
  tx: Transaction,
  callerUserId: string,
  studioId: string,
  targetUserId: string,
  role: 'manager' | 'photographer',
): Promise<StudioTeamMember> {
  await requireStudioManager(tx, studioId, callerUserId);
  await repo.lockStudioMembers(tx, studioId);

  const currentRole = await repo.findStudioMemberRole(tx, studioId, targetUserId);
  if (!currentRole) {
    throw new ApiError(404, 'NOT_FOUND', 'studio_member_not_found');
  }

  if (currentRole === 'manager' && role !== 'manager') {
    const managerCount = await repo.countStudioManagers(tx, studioId);
    if (managerCount <= 1) {
      throw new ApiError(409, 'CONFLICT', 'last_manager_protected');
    }
  }

  return repo.updateStudioMemberRole(tx, studioId, targetUserId, role);
}

/** Removes a studio member under an advisory lock while protecting the last manager and active bookings. */
export async function removeStudioMember(
  tx: Transaction,
  callerUserId: string,
  studioId: string,
  targetUserId: string,
): Promise<void> {
  await requireStudioManager(tx, studioId, callerUserId);
  await repo.lockStudioMembers(tx, studioId);

  const currentRole = await repo.findStudioMemberRole(tx, studioId, targetUserId);
  if (!currentRole) {
    throw new ApiError(404, 'NOT_FOUND', 'studio_member_not_found');
  }

  if (currentRole === 'manager') {
    const managerCount = await repo.countStudioManagers(tx, studioId);
    if (managerCount <= 1) {
      throw new ApiError(409, 'CONFLICT', 'last_manager_protected');
    }
  }

  const hasActiveBookings = await repo.hasActiveStudioBookingAssignments(
    tx,
    studioId,
    targetUserId,
  );
  if (hasActiveBookings) {
    throw new ApiError(409, 'CONFLICT', 'active_booking_assignments');
  }

  await repo.deleteStudioMember(tx, studioId, targetUserId);
}

/** Lists non-deleted resources of a studio (current manager only). */
export async function listStudioResources(
  tx: Transaction,
  userId: string,
  studioId: string,
): Promise<StudioResource[]> {
  await requireStudioManager(tx, studioId, userId);
  return repo.listStudioResources(tx, studioId);
}

/** Creates a studio resource (current manager only). */
export async function createStudioResource(
  tx: Transaction,
  userId: string,
  studioId: string,
  input: StudioResourceInput,
): Promise<StudioResource> {
  await requireStudioManager(tx, studioId, userId);
  return repo.insertStudioResource(tx, studioId, input);
}

/** Updates a studio resource (current manager only). */
export async function updateStudioResource(
  tx: Transaction,
  userId: string,
  resourceId: string,
  input: StudioResourceInput,
): Promise<StudioResource> {
  const studioId = await repo.findResourceStudioId(tx, resourceId);
  if (!studioId) {
    throw new ApiError(404, 'NOT_FOUND', 'resource_not_found');
  }
  await requireStudioManager(tx, studioId, userId);
  return repo.updateStudioResource(tx, resourceId, input);
}

/** Soft-deletes a studio resource (current manager only). */
export async function deleteStudioResource(
  tx: Transaction,
  userId: string,
  resourceId: string,
): Promise<void> {
  const studioId = await repo.findResourceStudioId(tx, resourceId);
  if (!studioId) {
    throw new ApiError(404, 'NOT_FOUND', 'resource_not_found');
  }
  await requireStudioManager(tx, studioId, userId);
  await repo.softDeleteStudioResource(tx, resourceId);
}

/** Lists active add-ons for an active service belonging to a visible provider. */
export async function listServiceAddOns(
  tx: Transaction,
  serviceId: string,
): Promise<ServiceAddOn[]> {
  const addOns = await repo.listActivePublicServiceAddOns(tx, serviceId);
  if (!addOns) {
    throw new ApiError(404, 'NOT_FOUND', 'service_not_found');
  }
  return addOns;
}

/** Creates an add-on for an owned service. */
export async function createServiceAddOn(
  tx: Transaction,
  userId: string,
  serviceId: string,
  input: ServiceAddOnInput,
): Promise<ServiceAddOn> {
  const service = await repo.findServiceOwnership(tx, serviceId);
  if (!service) {
    throw new ApiError(404, 'NOT_FOUND', 'service_not_found');
  }
  await assertProviderOwnership(tx, userId, service);
  return repo.insertServiceAddOn(tx, serviceId, input);
}
