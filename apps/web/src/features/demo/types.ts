import type { Booking, genres } from '@frameroom/shared';
export type Genre = (typeof genres)[number];

export type DemoRole = 'guest' | 'client' | 'photographer' | 'photographer2' | 'manager' | 'admin';
export type DemoMemberRole = 'manager' | 'photographer';
export type DemoStatus = Booking['status'];
export type DemoFile = { id: string; name: string; url: string; size: number; mime: string };
export type DemoPhoto = DemoFile & {
  provenance: 'captured' | 'manipulated' | 'ai_generated';
  hidden: boolean;
};
export type DemoBrief = {
  version: number;
  concept: string;
  genre: Genre;
  location: string;
  locationType: string;
  startsAt: string;
  endsAt: string;
  people: number;
  photoCount: number;
  retouched: number;
  quota: number;
  revisions: number;
  budget: number;
  crew: string;
  note: string;
  references: DemoFile[];
  clientApproved: boolean;
  providerApproved: boolean;
  rejection?: { by: string; reason: string };
};
export type DemoService = {
  id: string;
  owner: string;
  name: string;
  description: string;
  genre: Genre;
  price: number;
  duration: number;
  photos: number;
  retouched: number;
  quota: number;
  revisions: number;
  published: boolean;
};
export type DemoAlbum = {
  id: string;
  owner: string;
  title: string;
  description: string;
  genre: Genre;
  tags: string[];
  credits: string;
  published: boolean;
  hidden: boolean;
  photos: DemoPhoto[];
};
export type DemoStudio = {
  id: string;
  name: string;
  city: string;
  address: string;
  description: string;
  contact: string;
};
export type DemoBooking = {
  id: string;
  client: string;
  provider: string;
  providerType: 'photographer' | 'studio';
  providerName: string;
  service: DemoService;
  status: DemoStatus;
  briefs: DemoBrief[];
  agreedVersion: number | null;
  assigned: string | null;
  roomId: string | null;
  version: number;
  cancellation: { by: string; reason: string } | null;
  milestones: { id: string; title: string; done: boolean }[];
  decisions: { id: string; text: string; by: string; result: 'proposed' | 'agreed' | 'rejected' }[];
  gallery: DemoPhoto[];
  round: number;
  selections: { round: number; ids: string[]; note: string; pins: DemoPin[] }[];
  deliveries: DemoFile[];
  deliveredAt: number | null;
  remainingMs: number;
  hold: boolean;
  holdReason: string;
};
export type DemoPin = { imageId: string; x: number; y: number; note: string };
export type DemoConversation = {
  id: string;
  client: string;
  provider: string;
  providerType: 'photographer' | 'studio';
  providerName: string;
};
export type DemoMessage = {
  id: string;
  conversation: string;
  booking: string | null;
  sender: string;
  text: string;
  file?: DemoFile;
  at: number;
  submission: string;
};
export type DemoReview = {
  id: string;
  booking: string;
  rating: number;
  comment: string;
  hidden: boolean;
  deleted: boolean;
  reassessment: boolean;
  reason: string;
};
export type DemoReport = {
  id: string;
  target: string;
  targetType: 'portfolio' | 'image' | 'review';
  title: string;
  reporter: string;
  reason: string;
  details: string;
  status: 'pending' | 'actioned' | 'dismissed';
  decision: string;
};
export type DemoState = {
  representatives: Record<string, string>;
  clock: number;
  studios: DemoStudio[];
  members: { studio: string; person: string; role: DemoMemberRole }[];
  invitations: {
    id: string;
    studio: string;
    person: string;
    role: DemoMemberRole;
    status: 'pending' | 'accepted' | 'declined';
  }[];
  services: DemoService[];
  albums: DemoAlbum[];
  bookings: DemoBooking[];
  conversations: DemoConversation[];
  messages: DemoMessage[];
  reviews: DemoReview[];
  reports: DemoReport[];
  blocks: { id: string; owner: string; title: string; start: string; end: string }[];
  resources: {
    id: string;
    studio: string;
    name: string;
    type: 'room' | 'equipment';
    active: boolean;
  }[];
  profiles: Record<
    string,
    { name: string; bio: string; city: string; genres: Genre[]; specialties: string[] }
  >;
  projects: { id: string; title: string; concept: string; references: DemoFile[]; notes: string }[];
  notifications: { id: string; recipient: string; text: string; href: string; read: boolean }[];
  history: {
    id: string;
    booking?: string;
    actor: string;
    action: string;
    reason: string;
    at: number;
    assignment?: { from: string | null; to: string };
  }[];
  hiddenTargets: string[];
};
export type DemoOffer = {
  provider: string;
  providerType: 'photographer' | 'studio';
  providerName: string;
  service: DemoService;
  concept?: string;
};
export type DemoAction =
  | {
      type: 'book';
      id: string;
      provider: string;
      providerType: 'photographer' | 'studio';
      providerName: string;
      service: DemoService;
      brief: DemoBrief;
    }
  | { type: 'brief'; id: string; brief: DemoBrief }
  | { type: 'brief-reject'; id: string; reason: string }
  | { type: 'approve' | 'confirm' | 'start' | 'deliver' | 'complete'; id: string }
  | { type: 'reject' | 'cancel' | 'cancel-agree' | 'cancel-decline'; id: string; reason: string }
  | { type: 'assign'; id: string; person: string; reason: string; expectedVersion: number }
  | {
      type: 'conversation';
      id: string;
      provider: string;
      providerType: 'photographer' | 'studio';
      providerName: string;
      booking?: string;
    }
  | {
      type: 'message';
      id: string;
      conversation: string;
      booking: string | null;
      text: string;
      file?: DemoFile;
      submission: string;
    }
  | { type: 'milestone'; id: string; title: string }
  | { type: 'milestone-done'; id: string; milestone: string }
  | { type: 'decision'; id: string; text: string }
  | { type: 'decision-result'; id: string; decision: string; result: 'agreed' | 'rejected' }
  | { type: 'gallery'; id: string; photos: DemoPhoto[] }
  | { type: 'select'; id: string; ids: string[]; note: string; pins: DemoPin[] }
  | { type: 'reopen'; id: string }
  | { type: 'delivery'; id: string; file: DemoFile }
  | { type: 'review'; id: string; rating: number; comment: string }
  | {
      type: 'report';
      id: string;
      target: string;
      targetType: DemoReport['targetType'];
      title: string;
      reason: string;
      details: string;
    }
  | { type: 'moderate'; id: string; outcome: DemoReport['status']; reason: string }
  | { type: 'review-visibility'; id: string; visible: boolean; reason: string }
  | { type: 'hold'; id: string; hold: boolean; reason: string }
  | { type: 'advance'; hours: number }
  | { type: 'studio'; studio: DemoStudio }
  | { type: 'studio-update'; studio: DemoStudio }
  | { type: 'invite'; id: string; studio: string; person: string; role: DemoMemberRole }
  | { type: 'invitation'; id: string; accept: boolean }
  | { type: 'member'; studio: string; person: string; role: DemoMemberRole | 'remove' }
  | { type: 'service'; service: DemoService }
  | { type: 'album'; album: DemoAlbum }
  | { type: 'resource'; resource: DemoState['resources'][number] }
  | { type: 'block'; block: DemoState['blocks'][number] }
  | { type: 'block-remove'; id: string }
  | { type: 'profile'; profile: DemoState['profiles'][string] }
  | { type: 'project'; project: DemoState['projects'][number] }
  | { type: 'project-reference'; id: string; file: DemoFile }
  | { type: 'notification'; id: string };
