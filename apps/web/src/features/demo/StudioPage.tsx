import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Action, Feedback, Modal, Select } from '../../components/ui';
import { useStrings } from '../../lib/i18n';
import { useDemo, useDemoTask } from './DemoContext';
import { isManager, canReadBooking } from './permissions';
import { DemoTabs, BookingRows } from './ui';
import { ServicePanel, AlbumPanel, SchedulePanel } from './CatalogPanels';
import { StudioEditor, TeamPanel, InvitationsPanel, ResourcesPanel } from './StudioPanels';

export function WorkspaceStudioPage() {
  const demo = useDemo();
  const t = useStrings();
  const task = useDemoTask();
  const params = useParams();
  const [selected, setSelected] = useState(params.id ?? '');
  const [tab, setTab] = useState('overview');
  const [create, setCreate] = useState(false);
  const [discard, setDiscard] = useState(false);
  const [leave, setLeave] = useState(false);
  const studios = demo.state.studios.filter((studio) =>
    demo.state.members.some((member) => member.studio === studio.id && member.person === demo.role),
  );
  const studio = studios.find((value) => value.id === selected) ?? studios[0];
  const manage = studio && isManager(demo.state, demo.role, studio.id);
  const tabs = manage
    ? [
        'overview',
        'bookings',
        'team',
        'albums',
        'services',
        'resources',
        'schedule',
        'settings',
        'invitations',
      ]
    : ['bookings', 'invitations'];
  const active = tabs.includes(tab) ? tab : tabs[0];
  const bookings = studio
    ? demo.state.bookings.filter(
        (booking) =>
          booking.provider === studio.id && canReadBooking(demo.state, demo.role, booking),
      )
    : [];
  if (params.id && !studios.some((value) => value.id === params.id))
    return <p className="workspace-empty">{t.demo.forbidden}</p>;
  return (
    <>
      <header className="workspace-heading">
        <div>
          <p className="eyebrow">{t.demo[demo.role]}</p>
          <h1>{t.demo.studio}</h1>
        </div>
        <Action onClick={() => setCreate(true)}>{t.demo.createStudio}</Action>
      </header>
      <div className="workspace-studio-selector">
        <Select
          label={t.demo.studio}
          value={studio?.id ?? ''}
          onChange={(value) => {
            setSelected(value);
            setTab('overview');
          }}
        >
          {!studios.length ? <option value="">—</option> : null}
          {studios.map((value) => (
            <option key={value.id} value={value.id}>
              {demo.text(value.name)} ·{' '}
              {isManager(demo.state, demo.role, value.id) ? t.demo.manager : t.demo.member}
            </option>
          ))}
        </Select>
        {studio ? (
          <button className="text-button" onClick={() => setLeave(true)}>
            {t.demo.leave}
          </button>
        ) : null}
      </div>
      {!manage ? <p className="workspace-hint">{t.demo.readOnlyStudio}</p> : null}
      <DemoTabs
        tabs={tabs.map((key) => ({ id: key, label: t.demo[key as keyof typeof t.demo] }))}
        value={active}
        onChange={setTab}
      >
        {active === 'invitations' ? (
          <InvitationsPanel />
        ) : !studio ? (
          <InvitationsPanel />
        ) : active === 'overview' ? (
          <>
            <div className="workspace-summary-grid">
              <article>
                <span>{t.demo.bookings}</span>
                <strong>{bookings.length}</strong>
              </article>
              <article>
                <span>{t.demo.team}</span>
                <strong>
                  {demo.state.members.filter((member) => member.studio === studio.id).length}
                </strong>
              </article>
              <article>
                <span>{t.statuses.completed}</span>
                <strong>
                  {bookings.filter((booking) => booking.status === 'completed').length}
                </strong>
              </article>
            </div>
            <BookingRows ids={bookings.map((booking) => booking.id)} />
          </>
        ) : active === 'bookings' ? (
          <BookingRows ids={bookings.map((booking) => booking.id)} />
        ) : active === 'team' ? (
          <TeamPanel key={studio.id} studio={studio.id} />
        ) : active === 'services' ? (
          <ServicePanel key={studio.id} owner={studio.id} />
        ) : active === 'albums' ? (
          <AlbumPanel key={studio.id} owner={studio.id} />
        ) : active === 'resources' ? (
          <ResourcesPanel key={studio.id} studio={studio.id} />
        ) : active === 'schedule' ? (
          <SchedulePanel key={studio.id} owner={studio.id} />
        ) : (
          <section className="workspace-card">
            <StudioEditor key={studio.id} initial={studio} />
          </section>
        )}
      </DemoTabs>
      {create ? (
        <Modal title={t.demo.createStudio} onClose={() => setDiscard(true)}>
          <StudioEditor onClose={() => setCreate(false)} />
        </Modal>
      ) : null}
      {discard ? (
        <Modal title={t.cancel} onClose={() => setDiscard(false)}>
          <p>{t.demo.discardedDraft}</p>
          <div className="row wrap">
            <Action
              onClick={() => {
                setDiscard(false);
                setCreate(false);
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
      {leave && studio ? (
        <Modal title={t.demo.leave} onClose={() => setLeave(false)}>
          <p>{t.demo.removeMemberNote}</p>
          <Feedback error={task.error} />
          <Action
            onClick={() => {
              if (
                task.execute({
                  type: 'member',
                  studio: studio.id,
                  person: demo.role,
                  role: 'remove',
                })
              )
                setLeave(false);
            }}
          >
            {t.demo.leave}
          </Action>
        </Modal>
      ) : null}
    </>
  );
}
