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
}
export interface Image {
  id: string;
  storagePath: string;
  url: string;
  caption: string;
  provenance: 'captured' | 'manipulated' | 'ai_generated';
}
export interface Brief {
  id: string;
  version: number;
  content: BriefContent;
  clientApproved: boolean;
  providerApproved: boolean;
}
export interface Message {
  id: string;
  senderId: string | null;
  text: string;
  type: 'text' | 'image' | 'system';
  url: string | null;
  createdAt: string;
}
export interface Milestone {
  id: string;
  title: string;
  dueAt: string | null;
  status: 'todo' | 'done';
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
  messages: Message[];
  decisions: Decision[];
  milestones: Milestone[];
  gallery: { id: string; status: string; round: number } | null;
  images: Image[];
  selections: { imageId: string }[];
  deliveries: { id: string; fileName: string; url: string }[];
  resources: { resourceId: string; name: string }[];
  review: { rating: number; comment: string } | null;
}
export interface ProviderDetail {
  provider: Provider;
  services: Service[];
  portfolios: Portfolio[];
  reviews: { id: string; rating: number; comment: string; authorName: string }[];
}
