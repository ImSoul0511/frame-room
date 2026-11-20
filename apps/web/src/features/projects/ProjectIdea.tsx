import { useState } from 'react';
import type { CreativeProject } from '@frameroom/shared';
import { Action, Area, Feedback, Field, Form } from '../../components/ui';
import { patch, RequestError } from '../../lib/api';
import { useTask } from '../../lib/hooks';
import { useStrings } from '../../lib/i18n';

export function ProjectIdea({
  project,
  editable,
}: {
  project: CreativeProject;
  editable: boolean;
}) {
  const t = useStrings();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(project.title);
  const [idea, setIdea] = useState(project.idea);
  const [version, setVersion] = useState(project.version);
  const save = useTask(async () => {
    const result = await patch<CreativeProject>(`/v1/creative-projects/${project.id}`, {
      title,
      idea,
      version,
    });
    setVersion(result.version);
    setOpen(false);
  });
  const conflict = save.error instanceof RequestError && save.error.reason === 'stale_version';
  return (
    <section className="atelier-idea-card">
      <p className="eyebrow">001 / {t.project.concept}</p>
      {open ? (
        <Form onSubmit={() => save.mutate()}>
          <Field label={t.project.name} value={title} onChange={setTitle} required />
          <Area label={t.project.idea} value={idea} onChange={setIdea} />
          <Feedback error={save.error} />
          {conflict ? (
            <>
              <p>{t.atelier.conflict}</p>
              <Action
                secondary
                onClick={() => {
                  setVersion(project.version);
                  save.reset();
                }}
              >
                {t.atelier.reload}
              </Action>
              <blockquote>{project.idea}</blockquote>
            </>
          ) : null}
          <Action type="submit" pending={save.isPending} disabled={!title.trim() || !idea.trim()}>
            {t.save}
          </Action>
        </Form>
      ) : (
        <>
          <h2>{project.title}</h2>
          <p>{project.idea}</p>
          {editable ? (
            <button
              className="atelier-text-link"
              onClick={() => {
                setTitle(project.title);
                setIdea(project.idea);
                setVersion(project.version);
                setOpen(true);
              }}
            >
              {t.atelier.editIdea}
            </button>
          ) : null}
        </>
      )}
    </section>
  );
}
