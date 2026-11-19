import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Action, Area, Feedback, Field, FilePicker, Form, Modal } from '../../components/ui';
import { useStrings } from '../../lib/i18n';
import { useDemo, useDemoTask } from './DemoContext';
import { DemoTabs } from './ui';

export function WorkspaceProjectsPage() {
  const demo = useDemo();
  const t = useStrings();
  const task = useDemoTask();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [concept, setConcept] = useState('');
  return (
    <>
      <header className="workspace-heading">
        <div>
          <p className="eyebrow">{t.demo.client}</p>
          <h1>{t.demo.projects}</h1>
        </div>
        <Action onClick={() => setOpen(true)}>{t.demo.newProject}</Action>
      </header>
      <div className="workspace-project-grid">
        {demo.state.projects.map((project) => (
          <Link className="workspace-card" key={project.id} to={`/projects/${project.id}`}>
            <div className="workspace-project-art" aria-hidden="true">
              ✧
            </div>
            <h2>{demo.text(project.title)}</h2>
            <p>{demo.text(project.concept)}</p>
          </Link>
        ))}
      </div>
      {open ? (
        <Modal title={t.demo.newProject} onClose={() => setOpen(false)}>
          <Form
            onSubmit={() => {
              const id = crypto.randomUUID();
              if (
                task.execute({
                  type: 'project',
                  project: { id, title, concept, references: [], notes: '' },
                })
              )
                navigate(`/projects/${id}`);
            }}
          >
            <Field label={t.demo.title} value={title} onChange={setTitle} required />
            <Area label={t.demo.concept} value={concept} onChange={setConcept} />
            <Feedback error={task.error} />
            <Action type="submit">{t.create}</Action>
          </Form>
        </Modal>
      ) : null}
    </>
  );
}
export function WorkspaceProjectPage() {
  const demo = useDemo();
  const t = useStrings();
  const task = useDemoTask();
  const { id } = useParams();
  const [tab, setTab] = useState('moodboard');
  const [prompt, setPrompt] = useState('');
  const [reply, setReply] = useState('');
  const project = demo.state.projects.find((value) => value.id === id);
  const [draft, setDraft] = useState(
    project
      ? {
          ...structuredClone(project),
          title: demo.text(project.title),
          concept: demo.text(project.concept),
        }
      : null,
  );
  if (!project || !draft) return <p>{t.notFound}</p>;
  return (
    <>
      <header className="workspace-heading">
        <div>
          <p className="eyebrow">{t.demo.projects}</p>
          <h1>{demo.text(project.title)}</h1>
          <p>{demo.text(project.concept)}</p>
        </div>
        <Link
          className="button-link dark"
          to="/bookings/new"
          state={{ concept: demo.text(project.concept) }}
        >
          {t.demo.useBrief}
        </Link>
      </header>
      <DemoTabs
        tabs={(['moodboard', 'plan', 'assistant'] as const).map((key) => ({
          id: key,
          label: t.demo[key],
        }))}
        value={tab}
        onChange={setTab}
      >
        {tab === 'moodboard' ? (
          <>
            <FilePicker
              label={t.demo.references}
              multiple
              onFile={(file) =>
                task.attempt(() =>
                  demo.dispatch({
                    type: 'project-reference',
                    id: project.id,
                    file: demo.file(file),
                  }),
                )
              }
            />
            <div className="workspace-upload-grid">
              {project.references.map((file) => (
                <figure key={file.id}>
                  {file.mime.startsWith('image/') ? (
                    <img src={file.url} alt={file.name} />
                  ) : (
                    <a href={file.url} target="_blank" rel="noreferrer">
                      {file.name}
                    </a>
                  )}
                  <figcaption>{file.name}</figcaption>
                  <button
                    className="text-button"
                    onClick={() =>
                      task.execute({
                        type: 'project',
                        project: {
                          ...project,
                          references: project.references.filter((value) => value.id !== file.id),
                        },
                      })
                    }
                  >
                    {t.delete}
                  </button>
                </figure>
              ))}
            </div>
          </>
        ) : tab === 'plan' ? (
          <section className="workspace-card workspace-profile-editor">
            <Form
              onSubmit={() =>
                task.execute({
                  type: 'project',
                  project: { ...draft, references: project.references },
                })
              }
            >
              <Field
                label={t.demo.title}
                value={draft.title}
                onChange={(title) => setDraft({ ...draft, title })}
              />
              <Area
                label={t.demo.concept}
                value={draft.concept}
                onChange={(concept) => setDraft({ ...draft, concept })}
              />
              <Area
                label={t.demo.plan}
                value={draft.notes}
                onChange={(notes) => setDraft({ ...draft, notes })}
              />
              <div className="row wrap">
                <Action type="submit">{t.save}</Action>
                <Action
                  secondary
                  onClick={() => setDraft({ ...draft, notes: t.demo.assistantReply })}
                >
                  {t.demo.generatePlan}
                </Action>
              </div>
            </Form>
          </section>
        ) : (
          <section className="workspace-card workspace-profile-editor">
            <h2>{t.demo.assistant}</h2>
            <p className="workspace-hint">{t.demo.assistantHint}</p>
            {reply ? <div className="workspace-assistant-reply">{reply}</div> : null}
            <Form
              onSubmit={() => {
                if (prompt.trim()) setReply(t.demo.assistantReply);
              }}
            >
              <Area label={t.demo.message} value={prompt} onChange={setPrompt} />
              <Action type="submit" disabled={!prompt.trim()}>
                {t.demo.send}
              </Action>
            </Form>
          </section>
        )}
        <Feedback error={task.error} />
      </DemoTabs>
    </>
  );
}
