import { lazy, Suspense, useState } from 'react';
import { Action, Modal } from './ui';
import { useStrings } from '../lib/i18n';
import { useCapabilities } from '../lib/capabilities';
const ChatPanel = lazy(() =>
  import('../features/projects/ChatPanel').then((m) => ({ default: m.ChatPanel })),
);
export function AssistantDrawer({ projectId }: { projectId: string }) {
  const t = useStrings();
  const [open, setOpen] = useState(false);
  const capabilities = useCapabilities();
  return (
    <>
      <Action secondary onClick={() => setOpen(true)}>
        {t.atelier.assistant}
      </Action>
      {open ? (
        <Modal title={t.atelier.assistant} onClose={() => setOpen(false)}>
          <p className="muted">{t.atelier.assistantHint}</p>
          {capabilities.data?.aiConfigured ? (
            <Suspense fallback={<p role="status">{t.pending}</p>}>
              <ChatPanel projectId={projectId} />
            </Suspense>
          ) : (
            <p role="status">{t.atelier.unavailable}</p>
          )}
        </Modal>
      ) : null}
    </>
  );
}
