import { useState } from 'react';
import { Action, Area, Feedback, FilePicker, Modal, Form, Provenance } from '../../components/ui';
import { useStrings } from '../../lib/i18n';
import { useDemo, useDemoTask } from './DemoContext';
import { canWorkBooking } from './permissions';
import { agreedBrief, DemoError, selectionSubmitted } from './model';
import type { DemoBooking, DemoPin } from './types';

export function DemoProofingPanel({ booking }: { booking: DemoBooking }) {
  const demo = useDemo();
  const t = useStrings();
  const task = useDemoTask();
  const previous = booking.selections[booking.selections.length - 1];
  const [selection, setSelection] = useState<string[]>(previous?.ids ?? []);
  const [note, setNote] = useState(previous?.note ?? '');
  const [pins, setPins] = useState<DemoPin[]>(previous?.pins ?? []);
  const [pin, setPin] = useState<DemoPin | null>(null);
  const [annotate, setAnnotate] = useState(false);
  const client = demo.role === booking.client,
    worker = canWorkBooking(demo.state, demo.role, booking);
  const submitted = selectionSubmitted(booking),
    editable = client && booking.status === 'proofing' && !submitted;
  const quota = agreedBrief(booking).quota;
  return (
    <>
      <div className="section-header">
        <div>
          <h2>
            {t.demo.proofing} · {t.demo.round} {booking.round || 1}
          </h2>
          <p className="muted">
            {t.demo.selectionHint} {quota} {t.profileUi.photos} · {selection.length}{' '}
            {t.demo.selection.toLowerCase()}
          </p>
        </div>
        {worker && ['in_progress', 'proofing'].includes(booking.status) && !submitted ? (
          <FilePicker
            label={t.demo.gallery}
            multiple
            onFile={(file) =>
              task.attempt(() => {
                if (!file.type.startsWith('image/')) throw new DemoError('fileType');
                demo.dispatch({
                  type: 'gallery',
                  id: booking.id,
                  photos: [{ ...demo.file(file), provenance: 'captured', hidden: false }],
                });
              })
            }
          />
        ) : null}
      </div>
      <Feedback error={task.error} />
      {editable ? (
        <div className="row wrap workspace-proof-tools">
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={annotate}
              onChange={(event) => setAnnotate(event.target.checked)}
            />
            {t.demo.pin}
          </label>
          {annotate ? <span className="muted">{t.demo.pinHint}</span> : null}
        </div>
      ) : submitted ? (
        <p className="workspace-hint">{t.demo.selectionLocked}</p>
      ) : null}
      <div className="workspace-proof-grid">
        {booking.gallery
          .filter((photo) => !photo.hidden)
          .map((photo, index) => (
            <article
              key={photo.id}
              className={
                selection.includes(photo.id)
                  ? 'workspace-proof-image selected'
                  : 'workspace-proof-image'
              }
            >
              <button
                className="workspace-pin-canvas"
                disabled={!editable || !annotate}
                aria-label={`${t.demo.pin}: ${photo.name}`}
                onClick={(event) => {
                  const rect = event.currentTarget.getBoundingClientRect();
                  setPin({
                    imageId: photo.id,
                    x:
                      event.detail === 0
                        ? 50
                        : Math.max(
                            0,
                            Math.min(100, ((event.clientX - rect.left) / rect.width) * 100),
                          ),
                    y:
                      event.detail === 0
                        ? 50
                        : Math.max(
                            0,
                            Math.min(100, ((event.clientY - rect.top) / rect.height) * 100),
                          ),
                    note: '',
                  });
                }}
              >
                <img src={demo.image(photo.url, index)} alt={photo.name} />
                <span className="workspace-watermark">FrameRoom · {t.demo.demo}</span>
                {pins
                  .filter((value) => value.imageId === photo.id)
                  .map((value, pinIndex) => (
                    <span
                      key={`${pinIndex}-${value.x}-${value.y}`}
                      className="workspace-pin"
                      style={{ left: `${value.x}%`, top: `${value.y}%` }}
                      title={value.note}
                    >
                      {pinIndex + 1}
                    </span>
                  ))}
              </button>
              <div className="row between">
                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    aria-label={`${t.demo.select}: ${photo.name}`}
                    disabled={!editable}
                    checked={selection.includes(photo.id)}
                    onChange={(event) =>
                      setSelection(
                        event.target.checked
                          ? [...selection, photo.id]
                          : selection.filter((id) => id !== photo.id),
                      )
                    }
                  />
                  {photo.name}
                </label>
                <Provenance value={photo.provenance} />
              </div>
            </article>
          ))}
      </div>
      {!booking.gallery.length ? <p className="empty-state">{t.demo.noResults}</p> : null}
      <section className="workspace-card">
        <h3>{t.demo.feedback}</h3>
        {editable ? (
          <Area label={t.demo.notes} value={note} onChange={setNote} />
        ) : (
          <p>{note || '—'}</p>
        )}
        {pins.length ? (
          <div className="workspace-pin-list">
            <h4>{t.demo.pins}</h4>
            {pins.map((value, index) => (
              <div key={`${index}-${value.imageId}`}>
                <span>
                  {index + 1}. {value.note}
                </span>
                {editable ? (
                  <button
                    className="text-button"
                    onClick={() => setPins(pins.filter((_, pinIndex) => pinIndex !== index))}
                  >
                    {t.delete}
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}
        {editable ? (
          <Action
            disabled={!selection.length || selection.length > quota}
            onClick={() =>
              task.execute({ type: 'select', id: booking.id, ids: selection, note, pins })
            }
          >
            {t.demo.select}
          </Action>
        ) : null}
        {worker && booking.status === 'proofing' && submitted ? (
          <Action
            secondary
            disabled={booking.round - 1 >= agreedBrief(booking).revisions}
            onClick={() => task.execute({ type: 'reopen', id: booking.id })}
          >
            {t.demo.reopen}
          </Action>
        ) : null}
      </section>
      {pin ? (
        <Modal title={t.demo.pinNote} onClose={() => setPin(null)}>
          <Form
            onSubmit={() => {
              if (pin.note.trim()) {
                setPins([...pins, pin]);
                setPin(null);
              }
            }}
          >
            <Area
              label={t.demo.pinNote}
              value={pin.note}
              onChange={(value) => setPin({ ...pin, note: value })}
            />
            <Action type="submit" disabled={!pin.note.trim()}>
              {t.save}
            </Action>
          </Form>
        </Modal>
      ) : null}
    </>
  );
}
