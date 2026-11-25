import { lazy, Suspense } from 'react';
import { Link } from 'react-router-dom';
import { QueryState } from '../../components/ui';
import { UserAvatar } from '../../components/UserAvatar';
import { useAuth } from '../../lib/auth';
import { useStrings } from '../../lib/i18n';
import { useMessageReadState } from './readState';
import { inboxUrl, type InboxSelection, type useInbox } from './inbox-data';
import './messaging.css';

const Thread = lazy(() =>
  import('./ConversationThread').then(({ ConversationThread }) => ({
    default: ConversationThread,
  })),
);

export function Inbox({
  threads,
  selection,
  onSelect,
  compact = false,
}: {
  threads: ReturnType<typeof useInbox>;
  selection: InboxSelection;
  onSelect: (next: InboxSelection) => void;
  compact?: boolean;
}) {
  const t = useStrings();
  const { session, profile } = useAuth();
  const seen = useMessageReadState(session?.user.id);
  if (!session) return null;
  const { kind, id } = selection;
  const list = threads[kind];
  const active = list.data?.find((item) => item.id === id);
  return (
    <div
      className={`messenger-layout ${active ? 'has-active-conversation' : ''} ${compact ? 'inbox-compact' : ''}`}
    >
      <aside className="messenger-sidebar">
        {!compact && (
          <header className="messenger-sidebar-header">
            <h2>{t.workspaceUi.messages}</h2>
          </header>
        )}
        <div className="inbox-filters" role="group" aria-label={t.messaging.conversations}>
          {(['direct', 'project'] as const).map((group) => (
            <button
              key={group}
              type="button"
              aria-pressed={kind === group}
              onClick={() => onSelect({ kind: group })}
            >
              {group === 'direct' ? t.messaging.direct : t.messaging.projects}
            </button>
          ))}
        </div>
        <nav className="messenger-conversations" aria-label={t.messaging.conversations}>
          {list.isPending || list.error ? <QueryState query={list} /> : null}
          {list.data?.length === 0 && (
            <p className="inbox-list-empty">
              {kind === 'direct' ? t.messaging.noDirect : t.messaging.noProjects}
            </p>
          )}
          {list.data?.map((entry) => {
            const isClient = entry.clientId === session.user.id;
            const peer = isClient ? entry.providerName : entry.clientName;
            const next = { kind, id: entry.id };
            return (
              <Link
                key={entry.id}
                className={`messenger-conversation ${active?.id === entry.id ? 'is-selected' : ''}`}
                to={inboxUrl(next)}
                aria-current={active?.id === entry.id ? 'page' : undefined}
                onClick={
                  compact
                    ? (event) => {
                        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
                          return;
                        event.preventDefault();
                        onSelect(next);
                      }
                    : undefined
                }
              >
                <UserAvatar
                  name={peer}
                  avatarPath={isClient ? entry.providerAvatarPath : entry.clientAvatarPath}
                  className="messenger-avatar"
                />
                <span className="messenger-conversation-name">
                  {entry.projectTitle ?? peer}
                  {entry.projectTitle && <small>{peer}</small>}
                </span>
                {entry.latestIncomingMessageId &&
                  seen[entry.id] !== entry.latestIncomingMessageId && (
                    <span className="message-unread-dot" aria-label={t.messaging.unreadMessages} />
                  )}
              </Link>
            );
          })}
        </nav>
      </aside>
      {active ? (
        <Suspense fallback={<p role="status">{t.pending}</p>}>
          <Thread
            key={active.id}
            conversation={active}
            userId={session.user.id}
            currentUserName={
              profile?.displayName ?? session.user.email?.split('@')[0] ?? t.messaging.you
            }
            currentUserAvatarPath={profile?.avatarPath}
            onBack={() => onSelect({ kind })}
          />
        </Suspense>
      ) : (
        <section className="messenger-empty-selection">
          <span className="messenger-empty-icon" aria-hidden="true">
            <span />
          </span>
          <p>{t.messaging.selectConversation}</p>
        </section>
      )}
    </div>
  );
}
