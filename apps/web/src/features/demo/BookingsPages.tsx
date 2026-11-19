import { useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Action, Feedback, Form, PageHeading } from '../../components/ui';
import { currency, dateTime } from '../../lib/api';
import { useStrings } from '../../lib/i18n';
import { useDemo, useDemoTask } from './DemoContext';
import { canReadBooking, canReadConversation } from './permissions';
import { currentBrief, agreedBrief } from './model';
import { createDemoBrief, createDemoService } from './seed';
import { BriefFields, BookingRows, DemoTabs } from './ui';
import { BookingActions } from './BookingActions';
import { DemoBriefPanel } from './BriefPanel';
import { DemoRoomPanel } from './RoomPanel';
import { DemoProofingPanel } from './ProofingPanel';
import { DemoDeliveryPanel, DemoReviewPanel } from './DeliveryPanel';
import type { DemoService } from './types';

export function WorkspaceBookingsPage() {
  const demo = useDemo();
  const t = useStrings();
  const [tab, setTab] = useState('all');
  const bookings = demo.state.bookings.filter((booking) =>
    canReadBooking(demo.state, demo.role, booking),
  );
  const filtered = bookings.filter(
    (booking) =>
      tab === 'all' ||
      (tab === 'active'
        ? ['confirmed', 'in_progress'].includes(booking.status)
        : tab === 'closed'
          ? ['cancelled', 'rejected'].includes(booking.status)
          : booking.status === tab),
  );
  return (
    <>
      <header className="workspace-heading">
        <div>
          <p className="eyebrow">{t.demo[demo.role]}</p>
          <h1>{t.demo.bookings}</h1>
        </div>
        {demo.choice === 'account' ? (
          <Link className="button-link" to="/bookings/live">
            {t.booking.liveBookings}
          </Link>
        ) : null}
        {demo.role === 'client' ? (
          <Link className="button-link dark" to="/explore">
            {t.demo.newBooking}
          </Link>
        ) : null}
      </header>
      <DemoTabs
        tabs={[
          { id: 'all', label: t.all },
          { id: 'pending', label: t.statuses.pending },
          { id: 'active', label: t.demo.activeBookings },
          { id: 'proofing', label: t.demo.proofing },
          { id: 'delivered', label: t.statuses.delivered },
          { id: 'completed', label: t.statuses.completed },
          { id: 'closed', label: t.demo.closedBookings },
        ]}
        value={tab}
        onChange={setTab}
      >
        <BookingRows ids={filtered.map((booking) => booking.id)} />
      </DemoTabs>
    </>
  );
}
export function WorkspaceBookingPage() {
  const demo = useDemo();
  const t = useStrings();
  const { id } = useParams();
  const [tab, setTab] = useState('overview');
  const booking = demo.state.bookings.find((item) => item.id === id);
  if (!booking || !canReadBooking(demo.state, demo.role, booking))
    return <p className="workspace-empty">{t.demo.forbidden}</p>;
  const conversation = demo.state.conversations.find(
    (value) =>
      value.client === booking.client &&
      value.provider === booking.provider &&
      value.providerType === booking.providerType &&
      canReadConversation(demo.state, demo.role, value),
  );
  const tabs = [
    'overview',
    'brief',
    ...(booking.roomId ? ['room'] : []),
    ...(booking.gallery.length || ['in_progress', 'proofing'].includes(booking.status)
      ? ['proofing']
      : []),
    ...(['proofing', 'delivered', 'completed'].includes(booking.status) ? ['delivery'] : []),
    ...(booking.status === 'completed' ? ['review'] : []),
    'history',
  ];
  const selected = tabs.includes(tab) ? tab : 'overview';
  const brief = agreedBrief(booking);
  return (
    <>
      <PageHeading
        title={demo.text(booking.service.name)}
        subtitle={`${demo.text(booking.providerName)} · ${dateTime(brief.startsAt)} · ${currency(booking.service.price)}`}
        action={
          <span className={`status status-${booking.status}`}>{t.statuses[booking.status]}</span>
        }
      />
      <BookingActions booking={booking} />
      <DemoTabs
        tabs={tabs.map((key) => ({ id: key, label: t.demo[key as keyof typeof t.demo] ?? key }))}
        value={selected}
        onChange={setTab}
      >
        {selected === 'overview' ? (
          <>
            <div className="workspace-summary-grid">
              <article>
                <span>{t.demo.brief}</span>
                <strong>
                  {t.booking.version} {booking.agreedVersion ?? currentBrief(booking).version}
                </strong>
              </article>
              <article>
                <span>{t.demo.location}</span>
                <strong>{demo.text(brief.location)}</strong>
              </article>
              <article>
                <span>{t.demo.quota}</span>
                <strong>{brief.quota}</strong>
              </article>
              <article>
                <span>{t.demo.initialAssignment}</span>
                <strong>
                  {booking.assigned
                    ? demo.text(demo.state.profiles[booking.assigned]?.name ?? booking.assigned)
                    : booking.providerType === 'studio'
                      ? '—'
                      : demo.text(booking.providerName)}
                </strong>
              </article>
            </div>
            <section className="workspace-card">
              <h2>{t.demo.concept}</h2>
              <p>{demo.text(brief.concept)}</p>
              <p className="workspace-hint">
                {booking.roomId ? t.demo.scopeHint : t.demo.pendingRoom}
              </p>
              <div className="row wrap">
                <button className="button-link" onClick={() => setTab('brief')}>
                  {t.demo.brief}
                </button>
                {conversation ? (
                  <Link className="button-link" to={`/messages?conversation=${conversation.id}`}>
                    {t.demo.messages}
                  </Link>
                ) : null}
              </div>
            </section>
          </>
        ) : selected === 'brief' ? (
          <DemoBriefPanel key={`${booking.id}-${demo.role}`} booking={booking} />
        ) : selected === 'room' ? (
          <DemoRoomPanel booking={booking} />
        ) : selected === 'proofing' ? (
          <DemoProofingPanel
            key={`${booking.id}-${booking.round}-${demo.role}`}
            booking={booking}
          />
        ) : selected === 'delivery' ? (
          <DemoDeliveryPanel booking={booking} />
        ) : selected === 'review' ? (
          <DemoReviewPanel key={demo.role} booking={booking} />
        ) : (
          <div className="workspace-history">
            {demo.state.history
              .filter((event) => event.booking === booking.id)
              .map((event) => (
                <article key={event.id}>
                  <span>{dateTime(new Date(event.at).toISOString())}</span>
                  <div>
                    <strong>{demo.text(event.action)}</strong>
                    {event.assignment ? (
                      <p>
                        {event.assignment.from
                          ? demo.text(
                              demo.state.profiles[event.assignment.from]?.name ??
                                event.assignment.from,
                            )
                          : '—'}{' '}
                        →{' '}
                        {demo.text(
                          demo.state.profiles[event.assignment.to]?.name ?? event.assignment.to,
                        )}
                      </p>
                    ) : null}
                    <p>{demo.text(demo.state.profiles[event.actor]?.name ?? event.actor)}</p>
                    {event.reason ? <p>{event.reason}</p> : null}
                  </div>
                </article>
              ))}
          </div>
        )}
      </DemoTabs>
    </>
  );
}
type BookingLocation = {
  provider?: string;
  providerType?: 'photographer' | 'studio';
  providerName?: string;
  service?: DemoService;
  concept?: string;
};
export function WorkspaceBookingCreatePage() {
  const demo = useDemo();
  const t = useStrings();
  const task = useDemoTask();
  const navigate = useNavigate();
  const location = useLocation();
  const initial = (location.state ?? demo.offer ?? {}) as BookingLocation;
  const service = initial.service ?? createDemoService('photographer');
  const [brief, setBrief] = useState(() => ({
    ...createDemoBrief(demo.state.clock),
    concept: initial.concept ?? demo.text('seedConcept'),
    location: demo.text('seedLocation'),
    crew: t.photographer,
    quota: service.quota,
    revisions: service.revisions,
    photoCount: service.photos,
    retouched: service.retouched,
    budget: service.price,
  }));
  return (
    <div className="workspace-booking-create">
      <PageHeading
        title={t.demo.newBooking}
        subtitle={`${demo.text(initial.providerName ?? 'photographerName')} · ${demo.text(service.name)} · ${currency(service.price)}`}
      />
      <section className="workspace-card">
        <Form
          onSubmit={() => {
            const id = crypto.randomUUID();
            if (
              task.execute({
                type: 'book',
                id,
                provider: initial.provider ?? service.owner,
                providerType: initial.providerType ?? 'photographer',
                providerName: initial.providerName ?? 'photographerName',
                service,
                brief,
              })
            )
              navigate(`/bookings/${id}`);
          }}
        >
          <BriefFields value={brief} onChange={setBrief} />
          <Feedback error={task.error} />
          <Action type="submit">{t.demo.book}</Action>
        </Form>
      </section>
    </div>
  );
}
