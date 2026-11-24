import { Link, useSearchParams } from 'react-router-dom';
import { QueryState } from '../components/ui';
import { UserAvatar } from '../components/UserAvatar';
import { ConversationThread } from '../features/messaging/ConversationThread';
import type { Conversation } from '../features/messaging/types';
import { useAuth } from '../lib/auth';
import { useApi } from '../lib/hooks';
import { useStrings } from '../lib/i18n';
import { useMessageReadState } from '../features/messaging/readState';

export function MessagesPage() {
  const t = useStrings();
  const { session, profile } = useAuth();
  const [params] = useSearchParams();
  const list = useApi<Conversation[]>('/v1/conversations', true, 15000);
  const readMessages = useMessageReadState(session?.user.id);
  const active = list.data?.find((entry) => entry.id === params.get('conversation'));
  if (!session) return null;
  const currentUserName =
    profile?.displayName ?? session.user.email?.split('@')[0] ?? t.messaging.you;

  return (
    <>
      {list.data?.length ? (
        <div className={`messenger-layout ${active ? 'has-active-conversation' : ''}`}>
          <aside className="messenger-sidebar">
            <header className="messenger-sidebar-header">
              <Link className="messenger-home" to="/explore" aria-label={t.workspaceUi.explore}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M19 12H5m0 0 7-7m-7 7 7 7"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </Link>
              <h2>{t.messaging.conversations}</h2>
              <span>{list.data.length}</span>
            </header>
            <nav className="messenger-conversations" aria-label={t.messaging.conversations}>
              {list.data.map((conversation) => {
                const name =
                  conversation.clientId === session.user.id
                    ? conversation.providerName
                    : conversation.clientName;
                const selected = active?.id === conversation.id;
                return (
                  <Link
                    key={conversation.id}
                    className={`messenger-conversation ${selected ? 'is-selected' : ''}`}
                    to={`?conversation=${encodeURIComponent(conversation.id)}`}
                    aria-current={selected ? 'page' : undefined}
                  >
                    <UserAvatar
                      name={name}
                      avatarPath={
                        conversation.clientId === session.user.id
                          ? conversation.providerAvatarPath
                          : conversation.clientAvatarPath
                      }
                      className="messenger-avatar"
                    />
                    <span className="messenger-conversation-name">{name}</span>
                    {conversation.latestIncomingMessageId &&
                    readMessages[conversation.id] !== conversation.latestIncomingMessageId ? (
                      <span
                        className="message-unread-dot"
                        aria-label={t.messaging.unreadMessages}
                      />
                    ) : null}
                  </Link>
                );
              })}
            </nav>
          </aside>
          {active ? (
            <ConversationThread
              key={active.id}
              conversation={active}
              userId={session.user.id}
              currentUserName={currentUserName}
              currentUserAvatarPath={profile?.avatarPath}
            />
          ) : (
            <section className="messenger-empty-selection" aria-live="polite">
              <span className="messenger-empty-icon" aria-hidden="true">
                <span />
              </span>
              <p>{t.messaging.selectConversation}</p>
            </section>
          )}
        </div>
      ) : (
        <div className="messenger-list-state">
          <Link className="button-link" to="/explore">
            {t.workspaceUi.explore}
          </Link>
          <QueryState query={list} empty={list.data?.length === 0} />
        </div>
      )}
    </>
  );
}
