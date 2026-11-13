import { ApiError } from '../lib/errors.js';
import * as repo from '../repositories/catalog.js';
import type { Transaction } from '../repositories/database.js';
import type {
  ExploreProvider,
  ExploreQuery,
  ProviderDetail,
  Provider,
  Tag,
  MyStudio,
  Studio,
  StudioInput,
  StudioTeamMember,
  OwnedService,
  ServiceInput,
  OwnedPortfolio,
  PortfolioDetail,
  PortfolioImage,
  PortfolioImageInput,
  PortfolioInput,
  PortfolioListQuery,
  PublicPortfolio,
  MyInvitation,
  ServiceAddOn,
  ServiceAddOnInput,
  StudioInvitation,
  StudioInvitationInput,
  StudioResource,
  StudioResourceInput,
} from '../schemas/catalog.js';

/** Builds a public URL for the `portfolio-images` bucket when SUPABASE_URL is configured. */
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

// ---------- 102b: Studios & Team ----------

export async function requireStudioManager(
  tx: Transaction,
  studioId: string,
  userId: string,
): Promise<void> {
  const allowed = await repo.isStudioManager(tx, studioId, userId);
  if (!allowed) {
    throw new ApiError(403, 'FORBIDDEN', 'manager_required');
  }
}

export async function listMyStudios(tx: Transaction, userId: string): Promise<MyStudio[]> {
  return repo.listStudiosByMember(tx, userId);
}

export async function createStudio(
  tx: Transaction,
  userId: string,
  input: StudioInput,
): Promise<Studio> {
  const hasPhotographerProfile = await repo.photographerExistsByUser(tx, userId);
  if (!hasPhotographerProfile) {
    throw new ApiError(403, 'FORBIDDEN', 'photographer_required');
  }

  const studio = await repo.insertStudio(tx, userId, input);
  await repo.insertStudioMember(tx, studio.id, userId, 'manager');
  return studio;
}

export async function updateStudio(
  tx: Transaction,
  userId: string,
  studioId: string,
  input: StudioInput,
): Promise<Studio> {
  await requireStudioManager(tx, studioId, userId);
  const updated = await repo.updateStudio(tx, studioId, input);
  if (!updated) {
    throw new ApiError(404, 'NOT_FOUND', 'studio_not_found');
  }
  return updated;
}

export async function getStudioTeam(
  tx: Transaction,
  userId: string,
  studioId: string,
): Promise<StudioTeamMember[]> {
  await requireStudioManager(tx, studioId, userId);
  return repo.listStudioTeam(tx, studioId);
}

// ---------- 102c: Services ----------

/** Verifies that the caller owns a provider record (either as the photographer or a studio manager). */
export async function assertProviderOwnership(
  tx: Transaction,
  userId: string,
  owner: { photographerId: string | null; studioId: string | null },
): Promise<void> {
  if (owner.photographerId) {
    const callerPhotographerId = await repo.findPhotographerIdByUser(tx, userId);
    if (!callerPhotographerId || callerPhotographerId !== owner.photographerId) {
      throw new ApiError(403, 'FORBIDDEN', 'not_provider_owner');
    }
    return;
  }
  if (owner.studioId) {
    await requireStudioManager(tx, owner.studioId, userId);
    return;
  }
  throw new ApiError(403, 'FORBIDDEN', 'not_provider_owner');
}

export async function listMyServices(tx: Transaction, userId: string): Promise<OwnedService[]> {
  return repo.listOwnedServices(tx, userId);
}

export async function createPersonalService(
  tx: Transaction,
  userId: string,
  input: ServiceInput,
): Promise<OwnedService> {
  const photographerId = await repo.findPhotographerIdByUser(tx, userId);
  if (!photographerId) {
    throw new ApiError(403, 'FORBIDDEN', 'photographer_required');
  }
  return repo.insertService(tx, { ownerType: 'photographer', photographerId }, input);
}

export async function createStudioService(
  tx: Transaction,
  userId: string,
  studioId: string,
  input: ServiceInput,
): Promise<OwnedService> {
  await requireStudioManager(tx, studioId, userId);
  return repo.insertService(tx, { ownerType: 'studio', studioId }, input);
}

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

async function canManageProvider(
  tx: Transaction,
  userId: string,
  owner: { photographerId: string | null; studioId: string | null },
): Promise<boolean> {
  if (owner.photographerId) {
    const callerPhotographerId = await repo.findPhotographerIdByUser(tx, userId);
    return Boolean(callerPhotographerId && callerPhotographerId === owner.photographerId);
  }
  if (owner.studioId) {
    return repo.isStudioManager(tx, owner.studioId, userId);
  }
  return false;
}

export async function listMyPortfolios(tx: Transaction, userId: string): Promise<OwnedPortfolio[]> {
  return repo.listOwnedPortfolios(tx, userId);
}

export async function listPublicPortfolios(
  tx: Transaction,
  query: PortfolioListQuery,
  supabaseUrl?: string,
): Promise<PublicPortfolio[]> {
  const portfolios = await repo.listPublicPortfolios(tx, query);
  return Promise.all(
    portfolios.map(async (portfolio) => {
      const coverPath = await repo.findPortfolioCoverPath(tx, portfolio.id);
      return {
        ...portfolio,
        coverUrl: buildPublicPortfolioImageUrl(supabaseUrl, coverPath),
      };
    }),
  );
}

export async function getPortfolioDetail(
  tx: Transaction,
  portfolioId: string,
  callerUserId?: string,
  supabaseUrl?: string,
): Promise<PortfolioDetail> {
  const portfolio = await repo.findPortfolioById(tx, portfolioId);
  if (!portfolio) {
    throw new ApiError(404, 'NOT_FOUND', 'portfolio_not_found');
  }

  const isOwner = callerUserId ? await canManageProvider(tx, callerUserId, portfolio) : false;
  if (!isOwner) {
    if (portfolio.status !== 'published') {
      throw new ApiError(404, 'NOT_FOUND', 'portfolio_not_found');
    }
    const providerVisible = await repo.isPortfolioProviderVisible(tx, portfolio);
    if (!providerVisible) {
      throw new ApiError(404, 'NOT_FOUND', 'portfolio_not_found');
    }
  }

  const rawImages = await repo.listVisiblePortfolioImages(tx, portfolioId);
  const images: PortfolioImage[] = await Promise.all(
    rawImages.map(async (img) => ({
      ...img,
      url: buildPublicPortfolioImageUrl(supabaseUrl, img.storagePath),
      tags: await repo.listTagsForImage(tx, img.id),
    })),
  );

  return {
    ...portfolio,
    images,
  };
}

export async function createPersonalPortfolio(
  tx: Transaction,
  userId: string,
  input: PortfolioInput,
): Promise<OwnedPortfolio> {
  const photographerId = await repo.findPhotographerIdByUser(tx, userId);
  if (!photographerId) {
    throw new ApiError(403, 'FORBIDDEN', 'photographer_required');
  }
  return repo.insertPortfolio(tx, { ownerType: 'photographer', photographerId }, input);
}

export async function createStudioPortfolio(
  tx: Transaction,
  userId: string,
  studioId: string,
  input: PortfolioInput,
): Promise<OwnedPortfolio> {
  await requireStudioManager(tx, studioId, userId);
  return repo.insertPortfolio(tx, { ownerType: 'studio', studioId }, input);
}

export async function updatePortfolio(
  tx: Transaction,
  userId: string,
  portfolioId: string,
  input: PortfolioInput,
): Promise<OwnedPortfolio> {
  const existing = await repo.findPortfolioById(tx, portfolioId);
  if (!existing) {
    throw new ApiError(404, 'NOT_FOUND', 'portfolio_not_found');
  }
  await assertProviderOwnership(tx, userId, existing);
  return repo.updatePortfolio(tx, portfolioId, input);
}

export async function deletePortfolio(
  tx: Transaction,
  userId: string,
  portfolioId: string,
): Promise<void> {
  const existing = await repo.findPortfolioById(tx, portfolioId);
  if (!existing) {
    throw new ApiError(404, 'NOT_FOUND', 'portfolio_not_found');
  }
  await assertProviderOwnership(tx, userId, existing);
  await repo.softDeletePortfolio(tx, portfolioId);
}

export async function addPortfolioImage(
  tx: Transaction,
  userId: string,
  portfolioId: string,
  input: PortfolioImageInput,
  supabaseUrl?: string,
): Promise<PortfolioImage> {
  const existing = await repo.findPortfolioById(tx, portfolioId);
  if (!existing) {
    throw new ApiError(404, 'NOT_FOUND', 'portfolio_not_found');
  }
  await assertProviderOwnership(tx, userId, existing);

  const image = await repo.insertPortfolioImage(tx, portfolioId, input);
  const tags =
    input.tagIds.length > 0 ? await repo.replacePortfolioImageTags(tx, image.id, input.tagIds) : [];

  return {
    ...image,
    url: buildPublicPortfolioImageUrl(supabaseUrl, image.storagePath),
    tags,
  };
}

export async function setPortfolioImageTags(
  tx: Transaction,
  userId: string,
  imageId: string,
  tagIds: string[],
): Promise<Tag[]> {
  const ownership = await repo.findImagePortfolioOwnership(tx, imageId);
  if (!ownership) {
    throw new ApiError(404, 'NOT_FOUND', 'portfolio_image_not_found');
  }
  await assertProviderOwnership(tx, userId, ownership);
  return repo.replacePortfolioImageTags(tx, imageId, tagIds);
}

// ---------- 102e: Invitations, Members, Resources & Add-ons ----------

export async function listMyInvitations(tx: Transaction, userId: string): Promise<MyInvitation[]> {
  return repo.listPendingInvitationsForUser(tx, userId);
}

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

export async function respondToInvitation(
  tx: Transaction,
  userId: string,
  invitationId: string,
  action: 'accept' | 'decline',
): Promise<StudioInvitation> {
  const invitation = await repo.findInvitationWithRecipient(tx, invitationId);
  if (!invitation) {
    throw new ApiError(404, 'NOT_FOUND', 'invitation_not_found');
  }
  if (invitation.recipientUserId !== userId) {
    throw new ApiError(403, 'FORBIDDEN', 'not_invitation_recipient');
  }
  if (invitation.status !== 'pending') {
    throw new ApiError(409, 'CONFLICT', 'invitation_not_pending');
  }

  const nextStatus = action === 'accept' ? 'accepted' : 'declined';
  const updated = await repo.updateInvitationStatus(tx, invitationId, nextStatus);

  if (action === 'accept') {
    await repo.insertStudioMember(tx, invitation.studioId, userId, invitation.role);
  }

  return updated;
}

export async function updateStudioMemberRole(
  tx: Transaction,
  callerUserId: string,
  studioId: string,
  targetUserId: string,
  role: 'manager' | 'photographer',
): Promise<StudioTeamMember> {
  await requireStudioManager(tx, studioId, callerUserId);

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

export async function removeStudioMember(
  tx: Transaction,
  callerUserId: string,
  studioId: string,
  targetUserId: string,
): Promise<void> {
  await requireStudioManager(tx, studioId, callerUserId);

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

export async function listStudioResources(
  tx: Transaction,
  studioId: string,
): Promise<StudioResource[]> {
  return repo.listStudioResources(tx, studioId);
}

export async function createStudioResource(
  tx: Transaction,
  userId: string,
  studioId: string,
  input: StudioResourceInput,
): Promise<StudioResource> {
  await requireStudioManager(tx, studioId, userId);
  return repo.insertStudioResource(tx, studioId, input);
}

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

export async function listServiceAddOns(
  tx: Transaction,
  serviceId: string,
): Promise<ServiceAddOn[]> {
  const service = await repo.findServiceOwnership(tx, serviceId);
  if (!service) {
    throw new ApiError(404, 'NOT_FOUND', 'service_not_found');
  }
  return repo.listServiceAddOns(tx, serviceId);
}

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
