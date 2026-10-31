import { useMemo, useState } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, type UIMessage } from 'ai';
import { useQueryClient } from '@tanstack/react-query';
import type { AiAction } from '@frameroom/shared';
import { post, supabase } from '../../lib/api';
import { env } from '../../lib/env';
import { getLanguage } from '../../lib/locale-store';
import { useApi, useTask } from '../../lib/hooks';
import { useStrings } from '../../lib/i18n';
import { Action, Area, Feedback, QueryState } from '../../components/ui';

export function ChatPanel({ projectId }: { projectId: string }) {
  const history = useApi<{ id: string; role: 'user' | 'assistant'; content: string }[]>(
    `/v1/creative-projects/${projectId}/messages`,
  );
  if (!history.data) return <QueryState query={history} />;
  return (
    <Conversation
      key={projectId}
      projectId={projectId}
      initial={history.data.map((m) => ({
        id: m.id,
        role: m.role,
        parts: [{ type: 'text', text: m.content }],
      }))}
    />
  );
}
function Conversation({ projectId, initial }: { projectId: string; initial: UIMessage[] }) {
  const t = useStrings();
  const client = useQueryClient();
  const [text, setText] = useState('');
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: `${env.VITE_API_URL}/v1/creative-projects/${projectId}/chat`,
        headers: async () => {
          const session = await supabase?.auth.getSession();
          return {
            authorization: `Bearer ${session?.data.session?.access_token ?? ''}`,
            'accept-language': getLanguage(),
          };
        },
      }),
    [projectId],
  );
  const chat = useChat({
    id: projectId,
    messages: initial,
    transport,
    onFinish: () => {
      void client.invalidateQueries({ queryKey: ['api'] });
    },
  });
  const actions = useApi<AiAction[]>(`/v1/creative-projects/${projectId}/actions`);
  const propose = useTask(async () => {
    await post(`/v1/creative-projects/${projectId}/assistant`, { mode: 'action', text });
    setText('');
  });
  const apply = useTask(async (value: { id: string; confirm: boolean }) =>
    post(`/v1/ai-actions/${value.id}/${value.confirm ? 'confirm' : 'reject'}`),
  );
  const busy = chat.status === 'submitted' || chat.status === 'streaming';
  return (
    <section className="chat-panel">
      <div className="chat-heading">
        <span className="sparkle">✧</span>
        <div>
          <h2>{t.assistant.title}</h2>
          <p>{t.assistant.hint}</p>
        </div>
      </div>
      <div className="chat-messages" aria-live="polite">
        {chat.messages.map((m) => (
          <div className={`chat-message ${m.role}`} key={m.id}>
            {m.parts.map((part, i) => (part.type === 'text' ? <p key={i}>{part.text}</p> : null))}
          </div>
        ))}
        {busy ? <p role="status">{t.pending}</p> : null}
      </div>
      <div className="row wrap">
        <button
          className="chip"
          disabled={busy}
          onClick={() => void chat.sendMessage({ text: t.assistant.summary })}
        >
          {t.assistant.summary}
        </button>
        <button
          className="chip"
          disabled={busy}
          onClick={() => void chat.sendMessage({ text: t.assistant.feedback })}
        >
          {t.assistant.feedback}
        </button>
      </div>
      <form
        className="form-stack"
        onSubmit={(e) => {
          e.preventDefault();
          if (text.trim()) {
            void chat.sendMessage({ text });
            setText('');
          }
        }}
      >
        <Area
          label={t.project.assistant}
          value={text}
          onChange={setText}
          placeholder={t.assistant.placeholder}
        />
        <Feedback
          error={propose.error ?? apply.error ?? (chat.error ? new Error(t.errors.generic) : null)}
        />
        <div className="row wrap">
          <Action type="submit" pending={busy} disabled={!text.trim()}>
            {t.assistant.send}
          </Action>
          {busy ? (
            <Action secondary onClick={() => void chat.stop()}>
              {t.assistant.stop}
            </Action>
          ) : (
            <Action
              secondary
              pending={propose.isPending}
              disabled={!text.trim()}
              onClick={() => propose.mutate()}
            >
              {t.assistant.propose}
            </Action>
          )}
        </div>
      </form>
      {actions.data?.map((a) => (
        <article className="action-proposal" key={a.id}>
          <span className="eyebrow">{t.assistant[a.status]}</span>
          <p>{a.explanation}</p>
          <details>
            <summary>{t.view}</summary>
            <pre>{JSON.stringify(a.payload, null, 2)}</pre>
          </details>
          {a.status === 'proposed' ? (
            <>
              <p className="muted">{t.assistant.confirmHint}</p>
              <div className="row wrap">
                <Action
                  pending={apply.isPending}
                  onClick={() => apply.mutate({ id: a.id, confirm: true })}
                >
                  {t.assistant.confirm}
                </Action>
                <Action secondary onClick={() => apply.mutate({ id: a.id, confirm: false })}>
                  {t.assistant.reject}
                </Action>
              </div>
            </>
          ) : null}
        </article>
      ))}
    </section>
  );
}
