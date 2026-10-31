import { useState } from 'react';
import { cullingOutputSchema, type AiJob, type Artifact } from '@frameroom/shared';
import type { Workspace } from '../../lib/types';
import { post, upload } from '../../lib/api';
import { useApi, useTask } from '../../lib/hooks';
import { useStrings } from '../../lib/i18n';
import { Action, Area, Feedback, FilePicker, Provenance, Status } from '../../components/ui';

export function GalleryPanel({ workspace: w }: { workspace: Workspace }) {
  const t = useStrings();
  const [selection, setSelection] = useState<string[]>(w.selections.map((s) => s.imageId));
  const [prompt, setPrompt] = useState('');
  const b = w.booking;
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
        {w.isProvider && ['confirmed', 'in_progress'].includes(b.status) ? (
          <FilePicker
            label={t.booking.addImages}
            onFile={(file) => add.mutate(file)}
            disabled={add.isPending}
          />
        ) : null}
      </div>
      <Feedback error={add.error ?? choose.error ?? reopen.error ?? ai.error} />
      <div className="moodboard gallery-grid">
        {w.images.map((i) => (
          <figure key={i.id} className={selection.includes(i.id) ? 'image-selected' : ''}>
            <label>
              <img src={i.url} alt={i.caption || t.booking.gallery} />
              {allowPick ? (
                <span className="image-check">
                  <input
                    type="checkbox"
                    aria-label={`${t.booking.selected}: ${i.caption || i.id}`}
                    checked={selection.includes(i.id)}
                    onChange={(e) =>
                      setSelection(
                        e.target.checked
                          ? [...selection, i.id]
                          : selection.filter((id) => id !== i.id),
                      )
                    }
                  />
                </span>
              ) : null}
            </label>
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
          disabled={!selection.length}
          onClick={() => choose.mutate()}
        >
          {t.booking.selection}
        </Action>
      ) : null}
      {w.isProvider && w.gallery?.status === 'selection_submitted' ? (
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
