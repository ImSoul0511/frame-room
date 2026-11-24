import type { Booking, BriefContent, CreativeProject, Provider, Service } from '@frameroom/shared';
export interface Studio {
  id: string;
  name: string;
  description: string;
  city: string;
  district: string;
  address: string;
  genres: string[];
  role: 'manager' | 'photographer';
}
export interface Portfolio {
  id: string;
  title: string;
  description: string;
  genre: string;
  status: 'draft' | 'published' | 'hidden';
  ownerType: 'photographer' | 'studio';
  studioId: string | null;
  coverUrl?: string | null;
  photographerId?: string | null;
  tags?: Tag[];
}
export interface Tag {
  id: string;
  slug: string;
  name: string;
  nameVi?: string | null;
  kind: 'tone' | 'setting' | 'mood';
  category?: string | null;
}
export interface Image {
  id: string;
  storagePath: string;
  url: string;
  caption: string;
  crewCredits?: string;
  tags?: { id: string; name: string; nameVi?: string | null }[];
  provenance: 'captured' | 'manipulated' | 'ai_generated';
}
export interface PhotoFeedback {
  id: string;
  imageId: string;
  round: number;
  note: string;
  x: number | null;
  y: number | null;
}
export interface Brief {
  status?: 'open' | 'closed';
  id: string;
  version: number;
  content: BriefContent;
  clientApproved: boolean;
  providerApproved: boolean;
}
export interface Message {
  id: string;
  submissionId?: string | null;
  senderId: string | null;
  text: string;
  type: 'text' | 'image' | 'system';
  storagePath: string | null;
  createdAt: string;
}
export interface Milestone {
  id: string;
  title: string;
  dueAt: string | null;
  status: 'todo' | 'done';
  updatedAt?: string | null;
  updatedBy?: string | null;
}
export interface Decision {
  id: string;
  title: string;
  description: string;
  proposedBy: string;
  status: 'proposed' | 'agreed' | 'rejected';
}
export interface Member {
  userId: string;
  displayName: string;
  userName: string;
  photographerId: string;
  role: 'manager' | 'photographer';
}
export interface Resource {
  id: string;
  name: string;
  type: 'room' | 'equipment';
  description: string;
  isActive: boolean;
}
export interface Invitation {
  id: string;
  studioName: string;
  status: string;
  role: string;
}
export interface Workspace {
  booking: Booking;
  project: CreativeProject;
  room: { id: string; status: string } | null;
  isProvider: boolean;
  canManage: boolean;
  isClient: boolean;
  briefs: Brief[];
  cancellation: { id: string; isClientProposal: boolean; reason: string } | null;
  messages: Message[];
  decisions: Decision[];
  milestones: Milestone[];
  gallery: { id: string; status: string; round: number; revisionRequestedAt: string | null } | null;
  proofing: { quota: number; revisions: number };
  photoFeedback: PhotoFeedback[];
  images: Image[];
  selections: { imageId: string }[];
  deliveries: { id: string; fileName: string; url: string }[];
  resources: { resourceId: string; name: string }[];
  review: {
    rating: number;
    comment: string;
    isHidden?: boolean;
    moderationReason?: string;
    reassessmentRequestedAt?: string;
    deletedAt?: string;
  } | null;
}
export interface ProviderDetail {
  provider: Provider;
  coverPath?: string | null;
  avatarPath?: string | null;
  services: Service[];
  portfolios: Portfolio[];
  reviews: { id: string; rating: number; comment: string; authorName: string }[];
}
