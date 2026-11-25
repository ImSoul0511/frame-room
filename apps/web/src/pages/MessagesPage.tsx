import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { Inbox } from '../features/messaging/Inbox';
import { inboxUrl, useInbox } from '../features/messaging/inbox-data';

export function MessagesPage() {
  const { session } = useAuth();
  const threads = useInbox(Boolean(session));
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const inProject = params.has('room') || params.get('tab') === 'projects';
  return (
    <Inbox
      threads={threads}
      selection={{
        kind: inProject ? 'project' : 'direct',
        id: params.get(inProject ? 'room' : 'conversation') ?? undefined,
      }}
      onSelect={(next) => navigate(inboxUrl(next))}
    />
  );
}
