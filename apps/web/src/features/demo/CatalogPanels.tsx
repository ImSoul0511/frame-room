import { useState } from 'react';
import {
  Action,
  Area,
  Field,
  Form,
  NumberField,
  Select,
  Modal,
  Feedback,
  FilePicker,
  Provenance,
} from '../../components/ui';
import { useStrings } from '../../lib/i18n';
import { currency, dateTime } from '../../lib/api';
import { createDemoService } from './seed';
import { DemoError } from './model';
import { useDemo, useDemoTask } from './DemoContext';
import { localInput, BookingRows } from './ui';
import { canReadBooking } from './permissions';
import type { DemoAlbum, DemoPhoto, DemoService } from './types';

export function ServicePanel({ owner }: { owner: string }) {
  const demo = useDemo();
  const t = useStrings();
  const task = useDemoTask();
  const [editing, setEditing] = useState<DemoService | null>(null);
  const [confirm, setConfirm] = useState<DemoService | null>(null);
  const save = () => {
    if (editing && task.execute({ type: 'service', service: editing })) setEditing(null);
  };
  return (
    <>
      <div className="section-header">
        <h2>{t.demo.services}</h2>
        <Action
          onClick={() => {
            task.clear();
            setEditing({
              ...createDemoService(owner, crypto.randomUUID()),
              name: '',
              description: '',
            });
          }}
        >
          {t.demo.addService}
        </Action>
      </div>
      <Feedback error={task.error} />
      {demo.state.services
        .filter((service) => service.owner === owner)
        .map((service) => (
          <article className="workspace-package" key={service.id}>
            <div>
              <span className="status">{service.published ? t.demo.published : t.demo.draft}</span>
              <h3>{demo.text(service.name)}</h3>
              <p>{demo.text(service.description)}</p>
              <small>
                {service.duration} {t.provider.minutes} · {service.quota}{' '}
                {t.demo.quota.toLowerCase()} · {service.revisions} {t.demo.revisions.toLowerCase()}
              </small>
            </div>
            <div>
              <strong>{currency(service.price)}</strong>
              <div className="row wrap">
                <Action
                  secondary
                  onClick={() => {
                    task.clear();
                    setEditing({
                      ...service,
                      name: demo.text(service.name),
                      description: demo.text(service.description),
                    });
                  }}
                >
                  {t.demo.edit}
                </Action>
                <button className="text-button" onClick={() => setConfirm(service)}>
                  {service.published ? t.demo.unpublish : t.demo.publish}
                </button>
              </div>
            </div>
          </article>
        ))}
      {editing ? (
        <Modal title={t.demo.services} onClose={() => setEditing(null)}>
          <Form onSubmit={save}>
            <Field
              label={t.demo.serviceName}
              value={editing.name}
              onChange={(name) => setEditing({ ...editing, name })}
              required
            />
            <Area
              label={t.demo.description}
              value={editing.description}
              onChange={(description) => setEditing({ ...editing, description })}
            />
            <Select
              label={t.demo.genre}
              value={editing.genre}
              onChange={(genre) => setEditing({ ...editing, genre: genre as DemoService['genre'] })}
            >
              {Object.entries(t.genreLabels).map(([key, name]) => (
                <option value={key} key={key}>
                  {name}
                </option>
              ))}
            </Select>
            <div className="workspace-number-grid">
              {(['price', 'duration', 'photos', 'retouched', 'quota', 'revisions'] as const).map(
                (key) => (
                  <NumberField
                    key={key}
                    label={t.demo[key]}
                    value={editing[key]}
                    onChange={(value) => setEditing({ ...editing, [key]: value })}
                  />
                ),
              )}
            </div>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={editing.published}
                onChange={(event) => setEditing({ ...editing, published: event.target.checked })}
              />
              {t.demo.published}
            </label>
            <Feedback error={task.error} />
            <Action type="submit">{t.save}</Action>
          </Form>
        </Modal>
      ) : null}
      {confirm ? (
        <Modal
          title={confirm.published ? t.demo.unpublish : t.demo.publish}
          onClose={() => setConfirm(null)}
        >
          <p>{t.demo.unpublishNote}</p>
          <Action
            onClick={() => {
              if (
                task.execute({
                  type: 'service',
                  service: { ...confirm, published: !confirm.published },
                })
              )
                setConfirm(null);
            }}
          >
            {t.continue}
          </Action>
        </Modal>
      ) : null}
    </>
  );
}
export function AlbumPanel({ owner }: { owner: string }) {
  const demo = useDemo();
  const t = useStrings();
  const task = useDemoTask();
  const [editing, setEditing] = useState<DemoAlbum | null>(null);
  const [provenance, setProvenance] = useState<DemoPhoto['provenance']>('captured');
  const [discard, setDiscard] = useState(false);
  const save = (published: boolean) => {
    if (editing && task.execute({ type: 'album', album: { ...editing, published } }))
      setEditing(null);
  };
  return (
    <>
      <div className="section-header">
        <h2>{t.demo.albums}</h2>
        <Action
          onClick={() => {
            task.clear();
            setEditing({
              id: crypto.randomUUID(),
              owner,
              title: '',
              description: '',
              genre: 'portrait',
              tags: [],
              credits: '',
              published: false,
              hidden: false,
              photos: [],
            });
          }}
        >
          {t.demo.addAlbum}
        </Action>
      </div>
      <div className="profile-album-grid">
        {demo.state.albums
          .filter((album) => album.owner === owner)
          .map((album, index) => (
            <article className="workspace-album" key={album.id}>
              {album.photos[0] ? (
                <img src={demo.image(album.photos[0].url, index)} alt={demo.text(album.title)} />
              ) : (
                <div className="profile-album-placeholder">F</div>
              )}
              <div>
                <span className="status">{album.published ? t.demo.published : t.demo.draft}</span>
                <h3>{demo.text(album.title)}</h3>
                <p>{demo.text(album.description)}</p>
                <Action
                  secondary
                  onClick={() => {
                    task.clear();
                    setEditing({
                      ...structuredClone(album),
                      title: demo.text(album.title),
                      description: demo.text(album.description),
                    });
                  }}
                >
                  {t.demo.edit}
                </Action>
              </div>
            </article>
          ))}
      </div>
      {editing ? (
        <Modal title={t.demo.albums} onClose={() => setDiscard(true)}>
          <Form onSubmit={() => save(editing.published)}>
            <Field
              label={t.demo.title}
              value={editing.title}
              onChange={(title) => setEditing({ ...editing, title })}
              required
            />
            <Area
              label={t.demo.description}
              value={editing.description}
              onChange={(description) => setEditing({ ...editing, description })}
            />
            <Select
              label={t.demo.genre}
              value={editing.genre}
              onChange={(genre) => setEditing({ ...editing, genre: genre as DemoAlbum['genre'] })}
            >
              {Object.entries(t.genreLabels).map(([key, name]) => (
                <option key={key} value={key}>
                  {name}
                </option>
              ))}
            </Select>
            <Field
              label={t.demo.tags}
              value={editing.tags.join(', ')}
              onChange={(value) =>
                setEditing({
                  ...editing,
                  tags: value
                    .split(',')
                    .map((tag) => tag.trim())
                    .filter(Boolean),
                })
              }
            />
            <Field
              label={t.demo.credits}
              value={editing.credits}
              onChange={(credits) => setEditing({ ...editing, credits })}
            />
            <Select
              label={t.demo.authenticity}
              value={provenance}
              onChange={(value) => setProvenance(value as DemoPhoto['provenance'])}
            >
              {(['captured', 'manipulated', 'ai_generated'] as const).map((value) => (
                <option key={value} value={value}>
                  {t.project[value === 'ai_generated' ? 'aiGenerated' : value]}
                </option>
              ))}
            </Select>
            <FilePicker
              label={t.portfolio.upload}
              multiple
              onFile={(file) =>
                task.attempt(() => {
                  if (!file.type.startsWith('image/')) throw new DemoError('fileType');
                  const photo = { ...demo.file(file), provenance, hidden: false };
                  setEditing((current) =>
                    current ? { ...current, photos: [...current.photos, photo] } : current,
                  );
                })
              }
            />
            <div className="workspace-upload-grid">
              {editing.photos.map((photo, index) => (
                <figure key={photo.id}>
                  <img src={demo.image(photo.url, index)} alt={photo.name} />
                  <Provenance value={photo.provenance} />
                  <button
                    type="button"
                    className="text-button"
                    onClick={() =>
                      setEditing({
                        ...editing,
                        photos: editing.photos.filter((value) => value.id !== photo.id),
                      })
                    }
                  >
                    {t.delete}
                  </button>
                </figure>
              ))}
            </div>
            <Feedback error={task.error} />
            <div className="row wrap">
              <Action secondary onClick={() => save(false)}>
                {t.demo.saveDraft}
              </Action>
              <Action onClick={() => save(true)}>{t.demo.publish}</Action>
            </div>
          </Form>
        </Modal>
      ) : null}
      {discard ? (
        <Modal title={t.cancel} onClose={() => setDiscard(false)}>
          <p>{t.demo.discardedDraft}</p>
          <div className="row">
            <Action
              onClick={() => {
                setDiscard(false);
                setEditing(null);
              }}
            >
              {t.cancel}
            </Action>
            <Action secondary onClick={() => setDiscard(false)}>
              {t.demo.edit}
            </Action>
          </div>
        </Modal>
      ) : null}
    </>
  );
}
export function SchedulePanel({ owner }: { owner: string }) {
  const demo = useDemo();
  const t = useStrings();
  const task = useDemoTask();
  const [title, setTitle] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const bookings = demo.state.bookings.filter(
    (booking) =>
      canReadBooking(demo.state, demo.role, booking) &&
      (booking.provider === owner || booking.assigned === owner),
  );
  return (
    <>
      <h2>{t.demo.schedule}</h2>
      <BookingRows ids={bookings.map((booking) => booking.id)} />
      <section className="workspace-card">
        <h3>{t.demo.block}</h3>
        <Form
          onSubmit={() => {
            if (
              task.execute({
                type: 'block',
                block: { id: crypto.randomUUID(), owner, title, start, end },
              })
            )
              setTitle('');
          }}
        >
          <Field label={t.demo.blockTitle} value={title} onChange={setTitle} />
          <div className="two-col">
            <div className="native-field">
              <label htmlFor="demo-block-start">{t.demo.startTime}</label>
              <input
                id="demo-block-start"
                type="datetime-local"
                value={localInput(start)}
                onChange={(event) =>
                  setStart(event.target.value ? new Date(event.target.value).toISOString() : '')
                }
              />
            </div>
            <div className="native-field">
              <label htmlFor="demo-block-end">{t.demo.endTime}</label>
              <input
                id="demo-block-end"
                type="datetime-local"
                value={localInput(end)}
                onChange={(event) =>
                  setEnd(event.target.value ? new Date(event.target.value).toISOString() : '')
                }
              />
            </div>
          </div>
          <Feedback error={task.error} />
          <Action type="submit">{t.demo.block}</Action>
        </Form>
      </section>
      {demo.state.blocks
        .filter((block) => block.owner === owner)
        .map((block) => (
          <article key={block.id} className="workspace-list-row">
            <div>
              <strong>{block.title}</strong>
              <small>
                {dateTime(block.start)} — {dateTime(block.end)}
              </small>
            </div>
            <button
              className="text-button"
              onClick={() => task.execute({ type: 'block-remove', id: block.id })}
            >
              {t.delete}
            </button>
          </article>
        ))}
    </>
  );
}
