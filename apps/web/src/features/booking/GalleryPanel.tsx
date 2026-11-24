import { useEffect, useRef, useState } from 'react';
import { cullingOutputSchema, type AiJob, type Artifact } from '@frameroom/shared';
import type { Image, PhotoFeedback, Workspace } from '../../lib/types';
import { post, upload } from '../../lib/api';
import { useApi, useTask } from '../../lib/hooks';
import { useStrings } from '../../lib/i18n';
import { Action, Area, Feedback, FilePicker, Form, Provenance, Status } from '../../components/ui';

export function GalleryPanel({ workspace: w }: { workspace: Workspace }) {
  const t = useStrings();
  const [selection, setSelection] = useState<string[]>(w.selections.map((s) => s.imageId));
  const [prompt, setPrompt] = useState('');
  const [preview, setPreview] = useState<{ file: File; url: string } | null>(null);
  const uploaded = useRef<{ file: File; storagePath: string } | null>(null);
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview.url);
    },
    [preview],
  );
  const b = w.booking;
  const jobs = useApi<AiJob[]>(`/v1/creative-projects/${b.projectId}/ai-jobs`, w.isProvider, 5000);
  const variants = useApi<Artifact[]>(
    `/v1/creative-projects/${b.projectId}/artifacts`,
    true,
    30000,
  );
  const add = useTask(async (file: File) => {
    const result =
      uploaded.current?.file === file
        ? uploaded.current
        : await upload(file, 'gallery-previews', b.id);
    uploaded.current = { file, storagePath: result.storagePath };
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
  const ai = useTask(async (kind: 'edit' | 'cull') =>
    post(`/v1/creative-projects/${b.projectId}/ai-jobs`, {
      kind,
      prompt,
      imageIds:
        kind === 'cull'
          ? selection.length
            ? selection
            : w.images.slice(0, 50).map((i) => i.id)
          : selection,
    }),
  );
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
            onFile={(file) => {
              uploaded.current = null;
              setPreview({ file, url: URL.createObjectURL(file) });
              add.mutate(file, {
                onSuccess: () => {
                  uploaded.current = null;
                  setPreview(null);
                },
              });
            }}
            disabled={add.isPending}
          />
        ) : null}
      </div>
      <Feedback
        error={add.error ?? choose.error ?? reopen.error ?? requestRevision.error ?? ai.error}
      />
      {preview ? (
        <figure>
          <img
            src={preview.url}
            alt={preview.file.name}
            style={{ maxWidth: '100%', maxHeight: 240 }}
          />
          <figcaption role="status">
            {add.isError ? t.messaging.imageUploadFailed : t.messaging.imageUploading}
          </figcaption>
          {add.isError ? (
            <Action
              secondary
              onClick={() =>
                add.mutate(preview.file, {
                  onSuccess: () => {
                    uploaded.current = null;
                    setPreview(null);
                  },
                })
              }
            >
              {t.retry}
            </Action>
          ) : null}
        </figure>
      ) : null}
      {canSelect ? (
        <p>
          {t.workspaceUi.selectionHint} {w.proofing.quota}
        </p>
      ) : null}
      <div className="moodboard gallery-grid">
        {w.images.map((i) => (
          <figure key={i.id} className={selection.includes(i.id) ? 'image-selected' : ''}>
            <ProofingPhoto
              image={i}
              notes={w.photoFeedback.filter((item) => item.imageId === i.id)}
              editable={canSelect && selection.includes(i.id)}
              bookingId={b.id}
              round={w.gallery?.round ?? 1}
            />
            {allowPick ? (
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  aria-label={`${t.booking.selected}: ${i.caption || i.id}`}
                  checked={selection.includes(i.id)}
                  disabled={
                    canSelect && selection.length >= w.proofing.quota && !selection.includes(i.id)
                  }
                  onChange={(e) =>
                    setSelection(
                      e.target.checked
                        ? [...selection, i.id]
                        : selection.filter((id) => id !== i.id),
                    )
                  }
                />
                {t.booking.selected}
              </label>
            ) : null}
            <figcaption>
              <Provenance value={i.provenance} />
              {i.caption}
            </figcaption>
          </figure>
        ))}
      </div>
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
      {w.isProvider && ['in_progress', 'proofing'].includes(b.status) ? (
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
            aria-label={t.workspaceUi.pin}
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
            {pinMode ? t.workspaceUi.feedback : t.workspaceUi.pin}
          </Action>
          {pinMode && !position ? <p role="status">{t.workspaceUi.pinHint}</p> : null}
          <Area
            label={pinMode ? t.workspaceUi.pinNote : t.workspaceUi.feedback}
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
