import { JobSubmission } from '../../lib/job-submission';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { AiJob, Artifact, Booking, BriefContent, CreativeProject } from '@frameroom/shared';
import { api, patch, post, upload } from '../../lib/api';
import { useApi, useTask } from '../../lib/hooks';
import { useAuth } from '../../lib/auth';
import { useCapabilities } from '../../lib/capabilities';
import { useStrings } from '../../lib/i18n';
import {
  Action,
  Area,
  Feedback,
  FilePicker,
  Provenance,
  QueryState,
  Status,
} from '../../components/ui';
import { AssistantDrawer } from '../../components/AssistantDrawer';
import { SignedImage } from '../../components/SignedImage';
import { BriefEditor } from './BriefEditor';
import { ProjectIdea } from './ProjectIdea';

export function ProjectPage() {
  const t = useStrings();
  const { id = '' } = useParams();
  const { session } = useAuth();
  const capabilities = useCapabilities();
  const project = useApi<CreativeProject>(`/v1/creative-projects/${id}`);
  const booking = useApi<Booking>(
    `/v1/bookings/${project.data?.bookingId}`,
    Boolean(project.data?.bookingId),
  );
  const references = useApi<{ storagePath: string; url: string }[]>(
    `/v1/creative-projects/${id}/references`,
    true,
    60000,
  );
  const artifacts = useApi<Artifact[]>(`/v1/creative-projects/${id}/artifacts`, true, 60000);
  const jobs = useApi<AiJob[]>(`/v1/creative-projects/${id}/ai-jobs`, true, 10000);
  const [tab, setTab] = useState('board');
  const [prompt, setPrompt] = useState('');
  const [plan, setPlan] = useState<BriefContent | null>(null);
  const [submission] = useState(() => new JobSubmission());
  const generate = useTask(async () => {
    const path = `/v1/creative-projects/${id}/ai-jobs`;
    const input = { kind: 'concept', prompt };
    const result = await post(path, input, submission.key(path, input));
    submission.complete();
    return result;
  });
  const planner = useTask(async () =>
    setPlan(
      await post<BriefContent>(`/v1/creative-projects/${id}/assistant`, {
        mode: 'brief',
        text: prompt || project.data?.idea,
      }),
    ),
  );
  const save = useTask(async ({ brief, version }: { brief: BriefContent; version?: number }) => {
    const latest = await api<CreativeProject>(`/v1/creative-projects/${id}`);
    const updated = await patch<CreativeProject>(`/v1/creative-projects/${id}`, {
      brief,
      version: version ?? latest.version,
    });
    setPlan(null);
    return updated;
  });
  const reference = useTask(async (file: File) => {
    const result = await upload(file, 'brief-references');
    const current = await api<CreativeProject>(`/v1/creative-projects/${id}`);
    return patch(`/v1/creative-projects/${id}`, {
      version: current.version,
      referencePaths: [...current.referencePaths, result.storagePath],
    });
  });
  const remove = useTask(async (path: string) => {
    const current = await api<CreativeProject>(`/v1/creative-projects/${id}`);
    return patch(`/v1/creative-projects/${id}`, {
      version: current.version,
      referencePaths: current.referencePaths.filter((item) => item !== path),
    });
  });
  const select = useTask(
    async ({ artifactId, selected }: { artifactId: string; selected: boolean }) => {
      const current = await api<CreativeProject>(`/v1/creative-projects/${id}`);
      return patch(`/v1/creative-projects/${id}`, {
        version: current.version,
        selectedArtifactIds: selected
          ? [...current.selectedArtifactIds, artifactId]
          : current.selectedArtifactIds.filter((item) => item !== artifactId),
      });
    },
  );
  if (!project.data) return <QueryState query={project} />;
  const p = project.data;
  const editable =
    p.ownerId === session?.user.id &&
    (!p.bookingId ||
      Boolean(
        booking.data && ['pending', 'confirmed', 'in_progress'].includes(booking.data.status),
      ));
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
      <header className="page-heading">
        <div>
          <p className="eyebrow">FrameRoom / {t.atelier.board}</p>
          <h1>{p.title}</h1>
          <p className="muted">{t.atelier.boardHint}</p>
        </div>
        <div className="row wrap">
          <AssistantDrawer projectId={id} />
          <Link
            className="button-link dark"
            to={p.bookingId ? `/bookings/${p.bookingId}` : `/explore?project=${id}`}
          >
            {p.bookingId ? t.project.booking : t.project.findProvider}
          </Link>
        </div>
      </header>
      <nav className="tabs" aria-label={t.project.title}>
        {(['board', 'brief'] as const).map((key) => (
          <button key={key} aria-pressed={tab === key} onClick={() => setTab(key)}>
            {key === 'board' ? t.atelier.board : t.booking.brief}
          </button>
        ))}
      </nav>
      {tab === 'board' ? (
        <>
          <div className="atelier-project-toolbar">
            <p className="atelier-save-state">{t.atelier.saved}</p>
            {editable ? (
              <FilePicker
                label={t.project.addReference}
                disabled={reference.isPending || (references.data?.length ?? 0) >= 12}
                onFile={(file) => reference.mutate(file)}
              />
            ) : null}
          </div>
          <Feedback error={reference.error ?? remove.error ?? select.error} />
          <QueryState query={references} />
          <QueryState query={artifacts} />
          <div className="atelier-board">
            <ProjectIdea key={p.id} project={p} editable={editable} />
            {references.data?.map((item, index) => (
              <figure key={item.storagePath}>
                <SignedImage
                  src={item.url}
                  alt={`${t.project.reference} ${index + 1}`}
                  onRefresh={() => void references.refetch()}
                />
                <figcaption>
                  <span className="eyebrow">
                    {String(index + 1).padStart(3, '0')} / {t.project.reference}
                  </span>
                  {editable ? (
                    <button
                      className="text-button"
                      disabled={remove.isPending}
                      aria-label={`${t.atelier.removeReference} ${index + 1}`}
                      onClick={() => remove.mutate(item.storagePath)}
                    >
                      {t.delete}
                    </button>
                  ) : null}
                </figcaption>
              </figure>
            ))}
            {artifacts.data?.map((item) => (
              <figure key={item.id}>
                <SignedImage
                  src={item.url}
                  alt={item.prompt || p.idea}
                  onRefresh={() => void artifacts.refetch()}
                />
                <figcaption>
                  <Provenance value={item.provenance} />
                  <p>{item.prompt}</p>
                  {editable ? (
                    <label className="checkbox-row">
                      <input
                        type="checkbox"
                        checked={p.selectedArtifactIds.includes(item.id)}
                        disabled={
                          select.isPending ||
                          (!p.selectedArtifactIds.includes(item.id) &&
                            p.selectedArtifactIds.length >= 12)
                        }
                        onChange={(event) =>
                          select.mutate({ artifactId: item.id, selected: event.target.checked })
                        }
                      />
                      {t.project.useInBrief}
                    </label>
                  ) : null}
                </figcaption>
              </figure>
            ))}
            {!references.isPending &&
            !artifacts.isPending &&
            !references.data?.length &&
            !artifacts.data?.length ? (
              <div className="atelier-board-empty">
                <h2>{t.atelier.boardEmpty}</h2>
                <p>{t.atelier.boardEmptyHint}</p>
              </div>
            ) : null}
          </div>
          {editable ? (
            <details className="atelier-visual-search">
              <summary>{t.project.generate}</summary>
              {capabilities.data?.aiConfigured ? (
                <>
                  <Area
                    label={t.project.prompt}
                    value={prompt}
                    onChange={setPrompt}
                    placeholder={t.project.promptPlaceholder}
                  />
                  <Action
                    pending={generate.isPending}
                    disabled={!prompt.trim()}
                    onClick={() => generate.mutate()}
                  >
                    {t.project.generate}
                  </Action>
                  <Feedback error={generate.error} />
                </>
              ) : (
                <p>{t.atelier.unavailable}</p>
              )}
            </details>
          ) : null}
          {jobs.data?.length ? (
            <section className="panel">
              <h2>{t.project.jobs}</h2>
              {jobs.data.map((job) => (
                <div className="list-row" key={job.id}>
                  <span>
                    {job.kind === 'concept'
                      ? t.project.generate
                      : job.kind === 'edit'
                        ? t.booking.edit
                        : t.booking.cull}
                  </span>
                  <Status status={job.status} />
                  {job.error ? <span>{t.errors.generic}</span> : null}
                </div>
              ))}
            </section>
          ) : null}
        </>
      ) : (
        <section className="narrow-page">
          <div className="atelier-project-toolbar">
            <h2>{t.atelier.briefHint}</h2>
            {editable && capabilities.data?.aiConfigured ? (
              <Action secondary pending={planner.isPending} onClick={() => planner.mutate()}>
                {t.project.generatePlan}
              </Action>
            ) : null}
          </div>
          <Feedback error={planner.error} />
          {editable ? (
            <BriefEditor
              key={plan ? 'generated' : p.id}
              initial={initial}
              version={p.version}
              onSave={(brief, version) => save.mutateAsync({ brief, version })}
              pending={save.isPending}
              error={save.error}
            />
          ) : (
            <>
              <p>{initial.concept}</p>
              {(['shotList', 'lighting', 'checklist', 'milestones'] as const).map((key) => (
                <div key={key}>
                  <h3>{t.project[key]}</h3>
                  <ul>
                    {initial[key].map((value, index) => (
                      <li key={index}>{value}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </>
          )}
        </section>
      )}
    </>
  );
}
