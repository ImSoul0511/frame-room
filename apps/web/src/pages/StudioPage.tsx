import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { Provider, Service, Booking } from '@frameroom/shared';
import type { Studio, Invitation, Member, Resource } from '../lib/types';
import { api, post, patch, currency, dateTime } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useApi, useTask } from '../lib/hooks';
import { useStrings } from '../lib/i18n';
import {
  Action,
  Area,
  Feedback,
  Field,
  Form,
  GenreSelect,
  Modal,
  NumberField,
  PageHeading,
  QueryState,
  Select,
} from '../components/ui';
import { PhotographerForm, ServiceForm } from '../features/catalog/ProviderForms';

export function StudioPage() {
  const t = useStrings();
  const { profile } = useAuth();
  const studios = useApi<Studio[]>('/v1/me/studios');
  const invites = useApi<Invitation[]>('/v1/me/invitations');
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [city, setCity] = useState('');
  const [genre, setGenre] = useState('portrait');
  const nav = useNavigate();
  const create = useTask(async () => {
    const studio = await post<Studio>('/v1/studios', { name, description, city, genres: [genre] });
    nav(`/studio/${studio.id}`);
  });
  const respond = useTask(async (v: { id: string; status: string }) =>
    patch(`/v1/invitations/${v.id}`, { status: v.status }),
  );
  if (!profile?.roles.includes('photographer'))
    return (
      <>
        <PageHeading title={t.studio.title} subtitle={t.studio.needPhotographer} />
        <div className="narrow-page">
          <PhotographerForm />
        </div>
      </>
    );
  return (
    <>
      <PageHeading
        title={t.studio.title}
        subtitle={t.studio.subtitle}
        action={<Action onClick={() => setOpen(true)}>{t.studio.new}</Action>}
      />
      <QueryState query={studios} empty={studios.data?.length === 0} />
      <div className="project-grid">
        {studios.data?.map((s) => (
          <Link key={s.id} to={`/studio/${s.id}`} className="studio-card">
            <span className="studio-monogram">{s.name.slice(0, 1)}</span>
            <h2>{s.name}</h2>
            <p>{s.city}</p>
            <span className="status">
              {s.role === 'manager' ? t.studio.manager : t.studio.member}
            </span>
          </Link>
        ))}
      </div>
      <h2>{t.studio.invitations}</h2>
      {invites.data
        ?.filter((i) => i.status === 'pending')
        .map((i) => (
          <div className="list-row" key={i.id}>
            <strong>{i.studioName}</strong>
            <Action
              pending={respond.isPending}
              onClick={() => respond.mutate({ id: i.id, status: 'accepted' })}
            >
              {t.studio.accept}
            </Action>
            <Action secondary onClick={() => respond.mutate({ id: i.id, status: 'declined' })}>
              {t.studio.decline}
            </Action>
          </div>
        ))}
      <Feedback error={respond.error} />
      {open ? (
        <Modal title={t.studio.new} onClose={() => setOpen(false)}>
          <Form onSubmit={() => create.mutate()}>
            <Field label={t.studio.name} value={name} onChange={setName} />
            <Area label={t.studio.description} value={description} onChange={setDescription} />
            <Field label={t.city} value={city} onChange={setCity} />
            <GenreSelect value={genre} onChange={setGenre} />
            <Feedback error={create.error} />
            <Action type="submit" pending={create.isPending}>
              {t.studio.new}
            </Action>
          </Form>
        </Modal>
      ) : null}
    </>
  );
}
export function StudioDetailPage() {
  const t = useStrings();
  const { id = '' } = useParams();
  const studios = useApi<Studio[]>('/v1/me/studios');
  const studio = studios.data?.find((s) => s.id === id);
  if (!studios.data) return <QueryState query={studios} />;
  if (!studio) return <p>{t.errors.not_found}</p>;
  return (
    <>
      <PageHeading title={studio.name} subtitle={`${studio.city} · ${t.studio.subtitle}`} />
      {studio.role === 'manager' ? (
        <StudioManager studio={studio} />
      ) : (
        <p>
          {t.studio.member} · <Link to="/bookings">{t.booking.title}</Link>
        </p>
      )}
    </>
  );
}
function StudioManager({ studio }: { studio: Studio }) {
  const t = useStrings();
  const { session } = useAuth();
  const nav = useNavigate();
  const [tab, setTab] = useState('dashboard');
  const [modal, setModal] = useState<'service' | 'resource' | null>(null);
  const [editing, setEditing] = useState<Service | undefined>();
  const [inviteId, setInviteId] = useState('');
  const [role, setRole] = useState('photographer');
  const [resourceName, setResourceName] = useState('');
  const [resourceType, setResourceType] = useState('room');
  const team = useApi<Member[]>(`/v1/studios/${studio.id}/team`);
  const resources = useApi<Resource[]>(`/v1/studios/${studio.id}/resources`);
  const services = useApi<Service[]>('/v1/me/services');
  const photographers = useApi<Provider[]>('/v1/photographers');
  const dashboard = useApi<{
    stats: { bookings: number; completed: number; completedValue: string };
    upcoming: Booking[];
  }>(`/v1/studios/${studio.id}/dashboard`);
  const invite = useTask(async () =>
    post(`/v1/studios/${studio.id}/invitations`, { photographerId: inviteId, role }),
  );
  const resource = useTask(async () => {
    await post(`/v1/studios/${studio.id}/resources`, {
      name: resourceName,
      type: resourceType,
      description: '',
    });
    setModal(null);
    setResourceName('');
  });
  const change = useTask(async (v: { id: string; role?: string }) =>
    v.role
      ? patch(`/v1/studios/${studio.id}/members/${v.id}`, { role: v.role })
      : api(`/v1/studios/${studio.id}/members/${v.id}`, { method: 'DELETE' }),
  );
  const leave = useTask(async () => {
    await api(`/v1/studios/${studio.id}/members/${session!.user.id}`, { method: 'DELETE' });
    nav('/studio');
  });
  return (
    <>
      <div className="tabs">
        {(['dashboard', 'team', 'services', 'resources'] as const).map((k) => (
          <button key={k} aria-pressed={tab === k} onClick={() => setTab(k)}>
            {t.studio[k]}
          </button>
        ))}
      </div>
      <Feedback error={change.error ?? leave.error} />
      {tab === 'dashboard' ? (
        <>
          <QueryState query={dashboard} />
          <div className="stats-grid">
            <article>
              <span>{t.booking.title}</span>
              <strong>{dashboard.data?.stats.bookings ?? 0}</strong>
            </article>
            <article>
              <span>{t.studio.completed}</span>
              <strong>{dashboard.data?.stats.completed ?? 0}</strong>
            </article>
            <article>
              <span>{t.studio.value}</span>
              <strong>{currency(Number(dashboard.data?.stats.completedValue ?? 0))}</strong>
            </article>
          </div>
          <section className="panel">
            <h2>{t.studio.upcoming}</h2>
            {dashboard.data?.upcoming.map((b) => (
              <Link className="list-row" key={b.id} to={`/bookings/${b.id}`}>
                <strong>{b.serviceName}</strong>
                <span>{dateTime(b.scheduledStart)}</span>
              </Link>
            ))}
          </section>
        </>
      ) : null}
      {tab === 'team' ? (
        <div className="two-col">
          <section className="panel">
            <h2>{t.studio.team}</h2>
            {team.data?.map((m) => (
              <div className="member-row" key={m.userId}>
                <div>
                  <strong>{m.displayName}</strong>
                  <small>
                    @{m.userName} · {t.studio[m.role === 'manager' ? 'manager' : 'member']}
                  </small>
                </div>
                <div className="row wrap">
                  <button
                    className="text-button"
                    onClick={() =>
                      change.mutate({
                        id: m.userId,
                        role: m.role === 'manager' ? 'photographer' : 'manager',
                      })
                    }
                  >
                    {m.role === 'manager' ? t.studio.demote : t.studio.promote}
                  </button>
                  <button className="text-button" onClick={() => change.mutate({ id: m.userId })}>
                    {t.studio.remove}
                  </button>
                </div>
              </div>
            ))}
            <Action secondary pending={leave.isPending} onClick={() => leave.mutate()}>
              {t.studio.leave}
            </Action>
          </section>
          <section className="panel">
            <h2>{t.studio.invite}</h2>
            <Form onSubmit={() => invite.mutate()}>
              <Select label={t.photographer} value={inviteId} onChange={setInviteId}>
                <option value="">—</option>
                {photographers.data?.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.displayName}
                  </option>
                ))}
              </Select>
              <Select label={t.role} value={role} onChange={setRole}>
                <option value="photographer">{t.studio.member}</option>
                <option value="manager">{t.studio.manager}</option>
              </Select>
              <Feedback error={invite.error} success={invite.isSuccess ? t.saved : null} />
              <Action type="submit" pending={invite.isPending} disabled={!inviteId}>
                {t.studio.invite}
              </Action>
            </Form>
          </section>
        </div>
      ) : null}
      {tab === 'services' ? (
        <>
          <Action
            onClick={() => {
              setEditing(undefined);
              setModal('service');
            }}
          >
            {t.studio.newService}
          </Action>
          {services.data
            ?.filter((s) => s.studioId === studio.id)
            .map((s) => (
              <article className="list-row" key={s.id}>
                <div>
                  <h3>{s.name}</h3>
                  <p>{currency(s.price)}</p>
                </div>
                <Action
                  secondary
                  onClick={() => {
                    setEditing(s);
                    setModal('service');
                  }}
                >
                  {t.save}
                </Action>
              </article>
            ))}
          <AddOnForm services={services.data?.filter((s) => s.studioId === studio.id) ?? []} />
        </>
      ) : null}
      {tab === 'resources' ? (
        <>
          <Action onClick={() => setModal('resource')}>{t.studio.newResource}</Action>
          {resources.data?.map((r) => (
            <div className="list-row" key={r.id}>
              <strong>{r.name}</strong>
              <span>{t.studio[r.type]}</span>
              <ResourceToggle resource={r} />
            </div>
          ))}
        </>
      ) : null}
      {modal === 'service' ? (
        <Modal title={t.studio.services} onClose={() => setModal(null)}>
          <ServiceForm studioId={studio.id} initial={editing} onDone={() => setModal(null)} />
        </Modal>
      ) : modal === 'resource' ? (
        <Modal title={t.studio.newResource} onClose={() => setModal(null)}>
          <Form onSubmit={() => resource.mutate()}>
            <Field label={t.studio.resources} value={resourceName} onChange={setResourceName} />
            <Select label={t.studio.resources} value={resourceType} onChange={setResourceType}>
              <option value="room">{t.studio.room}</option>
              <option value="equipment">{t.studio.equipment}</option>
            </Select>
            <Feedback error={resource.error} />
            <Action type="submit" pending={resource.isPending}>
              {t.create}
            </Action>
          </Form>
        </Modal>
      ) : null}
    </>
  );
}
function ResourceToggle({ resource: r }: { resource: Resource }) {
  const t = useStrings();
  const task = useTask(async () =>
    patch(`/v1/resources/${r.id}`, {
      name: r.name,
      type: r.type,
      description: r.description,
      isActive: !r.isActive,
    }),
  );
  return (
    <>
      <Action secondary pending={task.isPending} onClick={() => task.mutate()}>
        {r.isActive ? t.studio.active : t.studio.inactive}
      </Action>
      <Feedback error={task.error} />
    </>
  );
}
export function AddOnForm({ services }: { services: Service[] }) {
  const t = useStrings();
  const [id, setId] = useState(services[0]?.id ?? '');
  const [name, setName] = useState('');
  const [price, setPrice] = useState(0);
  const task = useTask(async () => {
    await post(`/v1/services/${id}/add-ons`, { name, price, description: '' });
    setName('');
  });
  return (
    <section className="panel">
      <h2>{t.studio.addOn}</h2>
      <Form onSubmit={() => task.mutate()}>
        <Select label={t.booking.service} value={id} onChange={setId}>
          <option value="">—</option>
          {services.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
        <Field label={t.studio.addOnName} value={name} onChange={setName} />
        <NumberField label={t.studio.price} value={price} onChange={setPrice} />
        <Feedback error={task.error} success={task.isSuccess ? t.saved : null} />
        <Action type="submit" pending={task.isPending} disabled={!id || !name.trim()}>
          {t.studio.addAddOn}
        </Action>
      </Form>
    </section>
  );
}
