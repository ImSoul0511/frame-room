import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import { useStrings } from '../../lib/i18n';
import { Inbox } from './Inbox';
import { inboxUrl, useInbox, type InboxSelection } from './inbox-data';
import { useMessageReadState } from './readState';

export function ChatLauncher() {
  const t = useStrings();
  const { session, onboardingRequired } = useAuth();
  const ready = Boolean(session && !onboardingRequired);
  const threads = useInbox(ready);
  const seen = useMessageReadState(session?.user.id);
  const [open, setOpen] = useState(false);
  const [selection, setSelection] = useState<InboxSelection>({ kind: 'direct' });
  const launcher = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLElement>(null);
  const unread = [threads.direct, threads.project].some((list) =>
    list.data?.some(
      (item) => item.latestIncomingMessageId && seen[item.id] !== item.latestIncomingMessageId,
    ),
  );
  const close = () => {
    setOpen(false);
    launcher.current?.focus();
  };
  useEffect(() => {
    const start = (event: Event) => {
      setSelection({ kind: 'direct', id: (event as CustomEvent<string>).detail });
      setOpen(true);
      panel.current?.focus();
    };
    window.addEventListener('frameroom:open-chat', start);
    return () => window.removeEventListener('frameroom:open-chat', start);
  }, []);
  useEffect(() => {
    if (!open) return;
    panel.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);
  return (
    <>
      {open && (
        <section
          className="chat-window"
          role="dialog"
          id="quick-chat"
          aria-labelledby="quick-chat-title"
          tabIndex={-1}
          ref={panel}
        >
          <header className="chat-window-bar">
            <h2 id="quick-chat-title">{t.workspaceUi.messages}</h2>
            {ready && (
              <Link
                to={inboxUrl(selection)}
                className="chat-icon"
                aria-label={t.messaging.expand}
                title={t.messaging.expand}
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  aria-hidden="true"
                >
                  <path d="M14 4h6v6M20 4l-7 7M10 20H4v-6m0 6 7-7" />
                </svg>
              </Link>
            )}
            <button
              type="button"
              className="chat-icon"
              onClick={close}
              aria-label={t.close}
              title={t.close}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                aria-hidden="true"
              >
                <path d="m6 6 12 12M18 6 6 18" />
              </svg>
            </button>
          </header>
          {ready ? (
            <Inbox compact threads={threads} selection={selection} onSelect={setSelection} />
          ) : (
            <div className="chat-signin">
              <p>{t.messaging.signIn}</p>
              <Link className="button-link dark" to="/auth?next=%2Fmessages" onClick={close}>
                {t.login}
              </Link>
            </div>
          )}
        </section>
      )}
      <button
        ref={launcher}
        className="floating-chat"
        type="button"
        aria-expanded={open}
        aria-controls={open ? 'quick-chat' : undefined}
        aria-label={t.workspaceUi.messages}
        onClick={() => setOpen(!open)}
      >
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          aria-hidden="true"
        >
          <path d="M20.5 11.5a8.5 8.5 0 0 1-8.5 8.5c-1.5 0-3-.4-4.3-1.1L3 20l1.1-4.7A8.5 8.5 0 1 1 20.5 11.5Z" />
          <path d="M8 10h8M8 13h5" />
        </svg>
        {unread && <span className="message-unread-dot" aria-label={t.messaging.unreadMessages} />}
      </button>
    </>
  );
}
