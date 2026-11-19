import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { AiJob, Artifact, BriefContent, CreativeProject } from '@frameroom/shared';
import { api, patch, post, upload } from '../lib/api';
import { useApi, useTask } from '../lib/hooks';
import { useStrings } from '../lib/i18n';
import { useAuth } from '../lib/auth';
import {
  Action,
  Area,
  Feedback,
  Field,
  FilePicker,
  Form,
  Modal,
  PageHeading,
  Provenance,
  QueryState,
  Status,
} from '../components/ui';
import { BriefEditor } from '../features/projects/BriefEditor';
import { ChatPanel } from '../features/projects/ChatPanel';

export function ProjectsPage() {
  const t = useStrings();
  const projects = useApi<CreativeProject[]>('/v1/creative-projects');
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [idea, setIdea] = useState('');
  const navigate = useNavigate();
  const create = useTask(async () => {
    const p = await post<CreativeProject>('/v1/creative-projects', { title, idea });
    navigate(`/projects/${p.id}`);
  });
  return (
    <>
      <PageHeading
        title={t.project.title}
        subtitle={t.project.subtitle}
        action={<Action onClick={() => setOpen(true)}>{t.project.new}</Action>}
      />
      <QueryState query={projects} empty={projects.data?.length === 0} />
      <div className="project-grid">
        {projects.data?.map((p, i) => (
          <Link className="project-card" key={p.id} to={`/projects/${p.id}`}>
            <div className={`project-art art-${i % 3}`}>
              <span>0{i + 1}</span>
              <i>↗</i>
            </div>
            <div className="project-card-body">
              <span className="eyebrow">{p.bookingId ? t.booking.room : t.project.overview}</span>
              <h2>{p.title}</h2>
              <p>{p.idea}</p>
            </div>
          </Link>
        ))}
      </div>
      {open ? (
        <Modal title={t.project.new} onClose={() => setOpen(false)}>
          <Form onSubmit={() => create.mutate()}>
            <Field label={t.project.name} value={title} onChange={setTitle} required />
            <Area
              label={t.project.idea}
              value={idea}
              onChange={setIdea}
              placeholder={t.project.placeholder}
            />
            <Feedback error={create.error} />
            <Action type="submit" pending={create.isPending}>
              {t.project.create}
            </Action>
          </Form>
        </Modal>
      ) : null}
    </>
  );
}
export function ProjectPage() {
  const t = useStrings();
  const { session } = useAuth();
  const { id = '' } = useParams();
  const project = useApi<CreativeProject>(`/v1/creative-projects/${id}`);
  const artifacts = useApi<Artifact[]>(`/v1/creative-projects/${id}/artifacts`, true, 30000);
  const references = useApi<{ storagePath: string; url: string }[]>(
    `/v1/creative-projects/${id}/references`,
    true,
    60000,
  );
  const jobs = useApi<AiJob[]>(`/v1/creative-projects/${id}/ai-jobs`, true, 5000);
  const [tab, setTab] = useState('concepts');
  const [prompt, setPrompt] = useState('');
  const [plan, setPlan] = useState<BriefContent | null>(null);
  const generate = useTask(async () =>
    post(`/v1/creative-projects/${id}/ai-jobs`, { kind: 'concept', prompt }),
  );
  const planner = useTask(async () => {
    const draft = await post<BriefContent>(`/v1/creative-projects/${id}/assistant`, {
      mode: 'brief',
      text: prompt || project.data?.idea,
    });
    setPlan(draft);
  });
  const save = useTask(async (brief: BriefContent) => {
    await patch(`/v1/creative-projects/${id}`, { brief });
    setPlan(null);
  });
  const reference = useTask(async (file: File) => {
    const result = await upload(file, 'brief-references');
    const p = await api<CreativeProject>(`/v1/creative-projects/${id}`);
    await patch(`/v1/creative-projects/${id}`, {
      referencePaths: [...p.referencePaths, result.storagePath],
    });
  });
  const selectConcept = useTask(async (value: { id: string; selected: boolean }) => {
    const current = await api<CreativeProject>(`/v1/creative-projects/${id}`);
    return patch(`/v1/creative-projects/${id}`, {
      selectedArtifactIds: value.selected
        ? [...current.selectedArtifactIds, value.id]
        : current.selectedArtifactIds.filter((item) => item !== value.id),
    });
  });
  if (!project.data) return <QueryState query={project} />;
  const p = project.data;
  const initial = plan ??
    p.brief ?? {
      title: p.title,
      concept: p.idea,
      shotList: [],
      lighting: [],
      checklist: [],
      milestones: [],
    };
  return (
    <>
      <PageHeading
        title={p.title}
        subtitle={p.idea}
        action={
          <Link
            className="button-link dark"
            to={p.bookingId ? `/bookings/${p.bookingId}` : `/explore?project=${id}`}
          >
            {p.bookingId ? t.project.booking : t.project.findProvider} ↗
          </Link>
        }
      />
      <div className="tabs" role="tablist">
        {(['concepts', 'brief', 'assistant'] as const).map((key) => (
          <button key={key} role="tab" aria-selected={tab === key} onClick={() => setTab(key)}>
            {t.project[key]}
          </button>
        ))}
      </div>
      {tab === 'concepts' ? (
        <>
          <section className="concept-composer">
            <div>
              <span className="eyebrow">✧ {t.project.concepts}</span>
              <h2>{t.project.prompt}</h2>
            </div>
            <Area
              label={t.project.prompt}
              value={prompt}
              onChange={setPrompt}
              placeholder={t.project.promptPlaceholder}
            />
            <div className="row wrap">
              <Action pending={generate.isPending} onClick={() => generate.mutate()}>
                {t.project.generate}
              </Action>
              <FilePicker
                label={t.project.addReference}
                disabled={reference.isPending}
                onFile={(file) => reference.mutate(file)}
              />
            </div>
            <Feedback error={generate.error ?? reference.error ?? selectConcept.error} />
          </section>
          <div className="moodboard">
            {references.data?.map((r) => (
              <figure key={r.storagePath}>
                <img src={r.url} alt={t.project.reference} />
                <figcaption>{t.project.reference}</figcaption>
              </figure>
            ))}
            {artifacts.data?.map((a) => (
              <figure key={a.id}>
                <img src={a.url} alt={a.prompt || p.idea} />
                <figcaption>
                  <Provenance value={a.provenance} />
                  <p>{a.prompt}</p>
                  {p.ownerId === session?.user.id ? (
                    <label className="checkbox-row">
                      <input
                        type="checkbox"
                        checked={p.selectedArtifactIds.includes(a.id)}
                        disabled={selectConcept.isPending}
                        onChange={(event) =>
                          selectConcept.mutate({ id: a.id, selected: event.target.checked })
                        }
                      />
                      {t.project.useInBrief}
                    </label>
                  ) : null}
                </figcaption>
              </figure>
            ))}
          </div>
          {!references.data?.length && !artifacts.data?.length ? (
            <p className="empty-state">{t.project.noConcepts}</p>
          ) : null}
          <section className="panel">
            <h2>{t.project.jobs}</h2>
            {jobs.data?.map((j) => (
              <div className="list-row" key={j.id}>
                <span>
                  {j.kind === 'concept'
                    ? t.project.generate
                    : j.kind === 'edit'
                      ? t.booking.edit
                      : t.booking.cull}
                </span>
                <Status status={j.status} />
                {j.error ? <span className="muted">{t.errors.generic}</span> : null}
              </div>
            ))}
          </section>
        </>
      ) : null}
      {tab === 'brief' ? (
        <div className="narrow-page">
          <div className="row wrap">
            <Action secondary pending={planner.isPending} onClick={() => planner.mutate()}>
              {t.project.generatePlan}
            </Action>
          </div>
          <Feedback error={planner.error} />
          <BriefEditor
            key={plan ? 'generated' : p.version}
            initial={initial}
            onSave={(brief) => save.mutate(brief)}
            pending={save.isPending}
            error={save.error}
          />
        </div>
      ) : null}
      {tab === 'assistant' ? <ChatPanel projectId={id} /> : null}
    </>
  );
}
