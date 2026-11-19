import type { DemoBrief, DemoBooking, DemoService, DemoState, DemoPhoto } from './types';

export function placeholderPhoto(index: number) {
  const colors = ['#d8dfeb', '#dce6df', '#e4ddec', '#dedfd6'];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1000" viewBox="0 0 800 1000"><rect width="800" height="1000" fill="${colors[index % 4]}"/><ellipse cx="400" cy="430" rx="180" ry="245" fill="none" stroke="#8796b3" stroke-width="2"/><path d="M210 860c20-250 360-250 380 0M330 420c0-120 140-120 140 0v100c0 95-140 95-140 0z" fill="none" stroke="#8796b3" stroke-width="2"/><text x="400" y="930" text-anchor="middle" font-family="Georgia" font-size="28" fill="#55688e">FrameRoom</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
export function seedPhotos(count = 6, prefix = 'demo-image'): DemoPhoto[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `${prefix}-${index}`,
    name: `Frame ${index + 1}`,
    url: placeholderPhoto(index),
    size: 1000,
    mime: 'image/webp',
    provenance: 'captured',
    hidden: false,
  }));
}
export function createDemoService(owner: string, id = `demo-package-${owner}`): DemoService {
  return {
    id,
    owner,
    name: 'portraitPackage',
    description: 'packageDescription',
    genre: 'portrait',
    price: 1800000,
    duration: 90,
    photos: 20,
    retouched: 3,
    quota: 3,
    revisions: 2,
    published: true,
  };
}
export function createDemoBrief(clock = Date.now()): DemoBrief {
  return {
    version: 1,
    concept: 'seedConcept',
    genre: 'portrait',
    location: 'seedLocation',
    locationType: 'outdoor',
    startsAt: new Date(clock + 86400000 * 3).toISOString(),
    endsAt: new Date(clock + 86400000 * 3 + 5400000).toISOString(),
    people: 1,
    photoCount: 20,
    retouched: 3,
    quota: 3,
    revisions: 2,
    budget: 1800000,
    crew: 'photographer',
    note: '',
    references: [],
    clientApproved: true,
    providerApproved: false,
  };
}
export function createDemoState(clock = Date.now()): DemoState {
  const studio = 'demo-studio';
  const personal = createDemoService('photographer');
  const studioService = createDemoService(studio);
  const statuses = [
    'pending',
    'confirmed',
    'in_progress',
    'proofing',
    'delivered',
    'completed',
  ] as const;
  const bookings: DemoBooking[] = statuses.map((status, index) => {
    const isStudio = index < 3 || index === 4;
    const brief = createDemoBrief(clock + index * 86400000);
    brief.providerApproved = index !== 0;
    return {
      id: `demo-booking-${index + 1}`,
      client: 'client',
      provider: isStudio ? studio : 'photographer',
      providerType: isStudio ? 'studio' : 'photographer',
      providerName: isStudio ? 'studioName' : 'photographerName',
      service: structuredClone(isStudio ? studioService : personal),
      status,
      briefs: [brief],
      agreedVersion: index ? 1 : null,
      assigned: isStudio && index ? 'photographer' : null,
      roomId: index ? `demo-room-${index}` : null,
      version: 1,
      cancellation: null,
      milestones: [{ id: `milestone-${index}`, title: 'prepareShoot', done: false }],
      decisions: [],
      gallery: index >= 3 ? seedPhotos(6, `demo-booking-${index + 1}-image`) : [],
      round: index >= 3 ? 1 : 0,
      selections:
        index >= 4
          ? [
              {
                round: 1,
                ids: [0, 1, 2].map((image) => `demo-booking-${index + 1}-image-${image}`),
                note: '',
                pins: [],
              },
            ]
          : [],
      deliveries:
        index >= 4
          ? [
              {
                id: `delivery-${index}`,
                name: 'FrameRoom-delivery.webp',
                url: placeholderPhoto(1),
                size: 1000,
                mime: 'image/webp',
              },
            ]
          : [],
      deliveredAt: index === 4 ? clock : null,
      remainingMs: 168 * 3600000,
      hold: false,
      holdReason: '',
    };
  });
  return {
    representatives: {},
    clock,
    studios: [
      {
        id: studio,
        name: 'studioName',
        city: 'Ho Chi Minh City',
        address: 'seedLocation',
        description: 'studioDescription',
        contact: 'studio@example.test',
      },
      {
        id: 'demo-studio-2',
        name: 'secondStudioName',
        city: 'Ho Chi Minh City',
        address: '',
        description: 'studioDescription',
        contact: 'second@example.test',
      },
    ],
    members: [
      { studio, person: 'manager', role: 'manager' },
      { studio, person: 'photographer', role: 'photographer' },
      { studio, person: 'photographer2', role: 'photographer' },
      { studio: 'demo-studio-2', person: 'manager', role: 'photographer' },
      { studio: 'demo-studio-2', person: 'photographer2', role: 'manager' },
    ],
    invitations: [
      {
        id: 'demo-invitation',
        studio: 'demo-studio-2',
        person: 'photographer',
        role: 'photographer',
        status: 'pending',
      },
    ],
    services: [personal, studioService],
    albums: [
      {
        id: 'demo-album',
        owner: 'photographer',
        title: 'albumTitle',
        description: 'seedConcept',
        genre: 'portrait',
        tags: ['natural', 'warm'],
        credits: '',
        published: true,
        hidden: false,
        photos: seedPhotos(6, 'demo-album-image'),
      },
      {
        id: 'demo-studio-album',
        owner: studio,
        title: 'studioAlbumTitle',
        description: 'seedConcept',
        genre: 'fashion',
        tags: ['editorial'],
        credits: '',
        published: false,
        hidden: false,
        photos: seedPhotos(3),
      },
    ],
    bookings,
    conversations: [
      {
        id: 'demo-conversation-studio',
        client: 'client',
        provider: studio,
        providerType: 'studio',
        providerName: 'studioName',
      },
      {
        id: 'demo-conversation-personal',
        client: 'client',
        provider: 'photographer',
        providerType: 'photographer',
        providerName: 'photographerName',
      },
    ],
    messages: [
      {
        id: 'demo-message-general',
        conversation: 'demo-conversation-studio',
        booking: null,
        sender: 'client',
        text: 'initialInquiry',
        at: clock - 3600000,
        submission: 'seed-1',
      },
      {
        id: 'demo-message-context',
        conversation: 'demo-conversation-studio',
        booking: 'demo-booking-2',
        sender: 'manager',
        text: 'shootReminder',
        at: clock - 1800000,
        submission: 'seed-2',
      },
    ],
    reviews: [],
    reports: [
      {
        id: 'demo-report',
        target: 'demo-album',
        targetType: 'portfolio',
        title: 'albumTitle',
        reporter: 'client',
        reason: 'copyright',
        details: 'reportDetails',
        status: 'pending',
        decision: '',
      },
    ],
    blocks: [],
    resources: [{ id: 'demo-resource', studio, name: 'portraitRoom', type: 'room', active: true }],
    profiles: {
      client: {
        name: 'clientName',
        bio: 'clientBio',
        city: 'Ho Chi Minh City',
        genres: ['portrait', 'family'],
        specialties: [],
      },
      photographer: {
        name: 'photographerName',
        bio: 'photographerBio',
        city: 'Ho Chi Minh City',
        genres: ['portrait', 'fashion'],
        specialties: ['photographer'],
      },
      photographer2: {
        name: 'secondPhotographerName',
        bio: 'photographerBio',
        city: 'Ho Chi Minh City',
        genres: ['wedding'],
        specialties: ['retoucher'],
      },
      manager: {
        name: 'managerName',
        bio: 'managerBio',
        city: 'Ho Chi Minh City',
        genres: ['portrait'],
        specialties: ['photographer', 'artDirector'],
      },
      admin: { name: 'adminName', bio: '', city: '', genres: [], specialties: [] },
    },
    projects: [
      {
        id: 'demo-project',
        title: 'projectTitle',
        concept: 'seedConcept',
        references: [],
        notes: '',
      },
    ],
    notifications: [
      {
        id: 'demo-notification',
        recipient: 'client',
        text: 'shootReminder',
        href: '/bookings/demo-booking-2',
        read: false,
      },
    ],
    history: [],
    hiddenTargets: [],
  };
}
