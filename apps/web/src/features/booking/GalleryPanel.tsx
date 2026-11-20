import { downloadText } from '../../lib/download';
import { selectionReport } from '../../lib/selection-export';
import { JobSubmission } from '../../lib/job-submission';
import { useState } from 'react';
import { cullingOutputSchema, type AiJob, type Artifact } from '@frameroom/shared';
import type { Image, PhotoFeedback, Workspace } from '../../lib/types';
import { post, upload } from '../../lib/api';
import { useApi, useTask } from '../../lib/hooks';
import { ContactSheet } from './ContactSheet';
import { useCapabilities } from '../../lib/capabilities';
import { useStrings } from '../../lib/i18n';
import { Action, Area, Feedback, FilePicker, Form, Provenance, Status } from '../../components/ui';

export function GalleryPanel({ workspace: w }: { workspace: Workspace }) {
  const t = useStrings();
  const [selection, setSelection] = useState<string[]>(w.selections.map((s) => s.imageId));
  const [prompt, setPrompt] = useState('');
  const b = w.booking;
  const capabilities = useCapabilities();
  const jobs = useApi<AiJob[]>(`/v1/creative-projects/${b.projectId}/ai-jobs`, w.isProvider, 5000);
  const variants = useApi<Artifact[]>(
    `/v1/creative-projects/${b.projectId}/artifacts`,
    true,
    30000,
  );
  const add = useTask(async (file: File) => {
    const result = await upload(file, 'gallery-previews', b.id);
    return post(`/v1/bookings/${b.id}/gallery-images`, {
      storagePath: result.storagePath,
      caption: file.name,
    });
  });
  const choose = useTask(async () =>
    post(`/v1/bookings/${b.id}/selections`, { imageIds: selection }),
  );
  const reopen = useTask(async () => post(`/v1/bookings/${b.id}/selections/reopen`));
  const requestRevision = useTask(async () =>
    post(`/v1/bookings/${b.id}/selections/revision-request`),
  );
  const [submission] = useState(() => new JobSubmission());
  const ai = useTask(async (kind: 'edit' | 'cull') => {
    const path = `/v1/creative-projects/${b.projectId}/ai-jobs`;
    const input = {
      kind,
      prompt,
      imageIds:
        kind === 'cull'
          ? (selection.length ? selection : w.images.map((image) => image.id)).slice(0, 50)
          : selection,
    };
    const result = await post(path, input, submission.key(path, input));
    submission.complete();
    return result;
  });
  const canSelect = w.isClient && w.gallery?.status === 'open_for_selection';
  const allowPick = canSelect || (w.isProvider && ['in_progress', 'proofing'].includes(b.status));
  return (
    <>
      <div className="section-header">
        <h2>
          {t.booking.gallery}
          {w.gallery ? ` · ${t.booking.round} ${w.gallery.round}` : ''}
        </h2>
        {w.isProvider && b.status === 'in_progress' ? (
          <FilePicker
            label={t.booking.addImages}
            onFile={(file) => add.mutate(file)}
            disabled={add.isPending}
          />
        ) : null}
      </div>
      <Feedback
        error={add.error ?? choose.error ?? reopen.error ?? requestRevision.error ?? ai.error}
      />
      {canSelect ? (
        <p>
          {t.demo.selectionHint} {w.proofing.quota}
        </p>
      ) : null}
      <ContactSheet
        images={w.images}
        selection={selection}
        canSelect={allowPick && !choose.isPending}
        maxSelection={canSelect ? w.proofing.quota : 200}
        feedbackImageIds={w.photoFeedback
          .filter((note) => note.round === w.gallery?.round)
          .map((note) => note.imageId)}
        onExport={() =>
          downloadText(
            `FrameRoom-${b.id}-round-${w.gallery?.round ?? 1}.csv`,
            selectionReport(
              {
                images: w.images,
                selected: selection,
                feedback: w.photoFeedback,
                round: w.gallery?.round ?? 1,
                state:
                  w.gallery?.status === 'selection_submitted' ||
                  ['delivered', 'completed'].includes(b.status)
                    ? t.tools.submitted
                    : t.tools.draft,
              },
              [
                t.tools.reportFrame,
                t.tools.reportFilename,
                t.tools.reportRound,
                t.tools.reportState,
                t.tools.reportNotes,
                t.tools.reportProvenance,
              ],
            ),
            'text/csv;charset=utf-8',
          )
        }
        onChange={setSelection}
      />
      <p className="selection-export-hint">{t.tools.exportHint}</p>
      <section className="atelier-feedback-list">
        <h2>{t.atelier.feedback}</h2>
        {w.images.map((image) => (
          <details key={image.id}>
            <summary>
              {image.caption || t.proofing.open} /{' '}
              {w.photoFeedback.filter((item) => item.imageId === image.id).length}
            </summary>
            <ProofingPhoto
              image={image}
              notes={w.photoFeedback.filter((item) => item.imageId === image.id)}
              editable={canSelect && selection.includes(image.id)}
              bookingId={b.id}
              round={w.gallery?.round ?? 1}
            />
          </details>
        ))}
      </section>
      {canSelect ? (
        <Action
          pending={choose.isPending}
          disabled={!selection.length || selection.length > w.proofing.quota}
          onClick={() => choose.mutate()}
        >
          {t.booking.selection}
        </Action>
      ) : null}
      {w.isClient &&
      w.gallery?.status === 'selection_submitted' &&
      w.gallery.round <= w.proofing.revisions &&
      !w.gallery.revisionRequestedAt ? (
        <Action
          secondary
          pending={requestRevision.isPending}
          onClick={() => requestRevision.mutate()}
        >
          {t.booking.requestRevision}
        </Action>
      ) : null}
      {w.gallery?.revisionRequestedAt ? <p>{t.booking.waiting}</p> : null}
      {w.isProvider &&
      w.gallery?.status === 'selection_submitted' &&
      w.gallery.revisionRequestedAt ? (
        <Action secondary pending={reopen.isPending} onClick={() => reopen.mutate()}>
          {t.booking.reopen}
        </Action>
      ) : null}
      {w.isProvider &&
      capabilities.data?.aiConfigured &&
      ['in_progress', 'proofing'].includes(b.status) ? (
        <section className="panel">
          <h2>✧ {t.booking.cull}</h2>
          <p className="muted">{t.booking.cullHint}</p>
          <Area label={t.booking.editPrompt} value={prompt} onChange={setPrompt} />
          <div className="row wrap">
            <Action
              secondary
              pending={ai.isPending}
              disabled={!w.images.length}
              onClick={() => ai.mutate('cull')}
            >
              {t.booking.cull}
            </Action>
            <Action
              secondary
              pending={ai.isPending}
              disabled={selection.length !== 1 || !prompt.trim()}
              onClick={() => ai.mutate('edit')}
            >
              {t.booking.edit}
            </Action>
          </div>
          {jobs.data
            ?.filter((j) => ['cull', 'edit'].includes(j.kind))
            .map((j) => {
              const suggestions = cullingOutputSchema.safeParse(j.result);
              return (
                <div className="job-result" key={j.id}>
                  <Status status={j.status} />
                  {suggestions.success
                    ? suggestions.data.suggestions.map((s) => (
                        <p key={s.imageId}>
                          <strong>{w.images.find((i) => i.id === s.imageId)?.caption}</strong>{' '}
                          {s.selected ? '✓' : '—'} {s.reason}
                        </p>
                      ))
                    : null}
                </div>
              );
            })}
        </section>
      ) : null}
      <div className="moodboard">
        {variants.data
          ?.filter((a) => a.originalImageId)
          .map((a) => (
            <figure key={a.id}>
              <div className="before-after">
                {w.images.find((i) => i.id === a.originalImageId) ? (
                  <img
                    src={w.images.find((i) => i.id === a.originalImageId)!.url}
                    alt={t.project.original}
                  />
                ) : null}
                <img src={a.url} alt={t.project.variant} />
              </div>
              <figcaption>
                <Provenance value={a.provenance} />
                <p>{a.prompt}</p>
                <a href={a.url} target="_blank" rel="noreferrer">
                  {t.booking.download} ↗
                </a>
              </figcaption>
            </figure>
          ))}
      </div>
    </>
  );
}

function ProofingPhoto({
  image,
  notes,
  editable,
  bookingId,
  round,
}: {
  image: Image;
  notes: PhotoFeedback[];
  editable: boolean;
  bookingId: string;
  round: number;
}) {
  const t = useStrings();
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [pinMode, setPinMode] = useState(false);
  const [note, setNote] = useState('');
  const save = useTask(async () => {
    await post(`/v1/bookings/${bookingId}/photo-feedback`, {
      imageId: image.id,
      round,
      note,
      ...position,
    });
    setNote('');
    setPosition(null);
    setPinMode(false);
  });
  const photo = (
    <img className="proofing-photo" src={image.url} alt={image.caption || t.booking.gallery} />
  );
  const pins = notes.filter((item) => item.x !== null && item.y !== null);
  return (
    <>
      <div className="proofing-frame">
        {pinMode && editable ? (
          <button
            type="button"
            className="proofing-photo-button"
            aria-label={t.demo.pin}
            onClick={(event) => {
              const bounds = event.currentTarget.getBoundingClientRect();
              const point =
                event.detail === 0
                  ? { x: 0.5, y: 0.5 }
                  : {
                      x: (event.clientX - bounds.left) / bounds.width,
                      y: (event.clientY - bounds.top) / bounds.height,
                    };
              setPosition(point);
            }}
          >
            {photo}
          </button>
        ) : (
          photo
        )}
        {pins.map((item, i) => (
          <span
            key={item.id}
            className="proofing-pin"
            style={{ left: `${item.x! * 100}%`, top: `${item.y! * 100}%` }}
            aria-hidden="true"
          >
            {i + 1}
          </span>
        ))}
        {position ? (
          <span
            className="proofing-pin"
            style={{ left: `${position.x * 100}%`, top: `${position.y * 100}%` }}
            aria-hidden="true"
          >
            +
          </span>
        ) : null}
      </div>
      {notes.length ? (
        <ul>
          {notes.map((item) => (
            <li key={item.id}>
              {t.booking.round} {item.round} ·{' '}
              {item.x === null ? '' : `${pins.indexOf(item) + 1}. `}
              {item.note}
            </li>
          ))}
        </ul>
      ) : null}
      {editable ? (
        <Form onSubmit={() => save.mutate()}>
          <Action
            secondary
            onClick={() => {
              setPinMode(!pinMode);
              setPosition(null);
            }}
          >
            {pinMode ? t.demo.feedback : t.demo.pin}
          </Action>
          {pinMode && !position ? <p role="status">{t.demo.pinHint}</p> : null}
          <Area
            label={pinMode ? t.demo.pinNote : t.demo.feedback}
            value={note}
            onChange={setNote}
          />
          <Action
            secondary
            type="submit"
            pending={save.isPending}
            disabled={!note.trim() || (pinMode && !position)}
          >
            {t.save}
          </Action>
          <Feedback error={save.error} />
        </Form>
      ) : null}
    </>
  );
}
