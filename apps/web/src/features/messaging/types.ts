export type Conversation = {
  id: string;
  clientId: string;
  clientName: string;
  clientAvatarPath?: string | null;
  providerName: string;
  providerAvatarPath?: string | null;
  latestIncomingMessageId?: string | null;
  photographerId: string | null;
  studioId: string | null;
};

export type Message = {
  id: string;
  senderId: string | null;
  senderName: string | null;
  senderAvatarPath?: string | null;
  bookingId: string | null;
  text: string;
  type: 'text' | 'image' | 'system';
  createdAt: string;
  storagePath: string | null;
  submissionId?: string | null;
};

export type Messages = { items: Message[]; before: string | null };
