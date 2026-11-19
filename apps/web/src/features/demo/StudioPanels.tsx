import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Action, Area, Feedback, Field, Form, Modal, Select } from '../../components/ui';
import { useStrings } from '../../lib/i18n';
import { useDemo, useDemoTask } from './DemoContext';
import type { DemoStudio } from './types';

export function StudioEditor({ initial, onClose }: { initial?: DemoStudio; onClose?: () => void }) {
  const demo = useDemo();
  const t = useStrings();
  const task = useDemoTask();
  const [value, setValue] = useState<DemoStudio>(
    initial
      ? {
          ...initial,
          name: demo.text(initial.name),
          description: demo.text(initial.description),
          address: demo.text(initial.address),
        }
      : { id: crypto.randomUUID(), name: '', description: '', city: '', address: '', contact: '' },
  );
  const [saved, setSaved] = useState(false);
  return (
    <Form
      onSubmit={() => {
        const success = task.execute({ type: initial ? 'studio-update' : 'studio', studio: value });
        setSaved(success);
        if (success) onClose?.();
      }}
    >
      <Field
        label={t.demo.studioNameLabel}
        value={value.name}
        onChange={(name) => setValue({ ...value, name })}
        required
      />
      <Area
        label={t.demo.description}
        value={value.description}
        onChange={(description) => setValue({ ...value, description })}
      />
      <Field
        label={t.city}
        value={value.city}
        onChange={(city) => setValue({ ...value, city })}
        required
      />
      <Field
        label={t.address}
        value={value.address}
        onChange={(address) => setValue({ ...value, address })}
      />
      <Field
        label={t.demo.contactInfo}
        value={value.contact}
        onChange={(contact) => setValue({ ...value, contact })}
        required
      />
      <Feedback error={task.error} success={saved ? t.demo.saved : null} />
      <Action type="submit">{initial ? t.save : t.demo.createStudio}</Action>
    </Form>
  );
}
export function TeamPanel({ studio }: { studio: string }) {
  const demo = useDemo();
  const t = useStrings();
  const task = useDemoTask();
  const [person, setPerson] = useState('');
  const [role, setRole] = useState<'manager' | 'photographer'>('photographer');
  const [remove, setRemove] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  return (
    <div className="two-col">
      <section className="workspace-card">
        <h2>{t.demo.team}</h2>
        {demo.state.members
          .filter((member) => member.studio === studio)
          .map((member) => (
            <article className="workspace-team-row" key={member.person}>
              <div>
                <strong>
                  {demo.text(demo.state.profiles[member.person]?.name ?? member.person)}
                </strong>
                <small>{t.demo[member.role === 'manager' ? 'manager' : 'member']}</small>
                {demo.state.bookings
                  .filter(
                    (booking) =>
                      booking.provider === studio &&
                      booking.assigned === member.person &&
                      !['completed', 'cancelled', 'rejected'].includes(booking.status),
                  )
                  .map((booking) => (
                    <Link key={booking.id} to={`/bookings/${booking.id}`}>
                      {demo.text(booking.service.name)}
                    </Link>
                  ))}
              </div>
              <div className="workspace-row-actions">
                <button
                  className="text-button"
                  onClick={() =>
                    task.execute({
                      type: 'member',
                      studio,
                      person: member.person,
                      role: member.role === 'manager' ? 'photographer' : 'manager',
                    })
                  }
                >
                  {member.role === 'manager' ? t.demo.demote : t.demo.promote}
                </button>
                <button className="text-button" onClick={() => setRemove(member.person)}>
                  {t.demo.removeMember}
                </button>
              </div>
            </article>
          ))}
        <Feedback error={task.error} />
      </section>
      <section className="workspace-card">
        <h2>{t.demo.invite}</h2>
        <Form
          onSubmit={() =>
            task.execute({ type: 'invite', id: crypto.randomUUID(), studio, person, role })
          }
        >
          <Field label={t.demo.photographerSearch} value={search} onChange={setSearch} />
          <Select label={t.photographer} value={person} onChange={setPerson}>
            <option value="">—</option>
            {(['photographer', 'photographer2', 'manager'] as const)
              .filter((value) =>
                demo
                  .text(demo.state.profiles[value].name)
                  .toLocaleLowerCase()
                  .includes(search.toLocaleLowerCase()),
              )
              .map((value) => (
                <option key={value} value={value}>
                  {demo.text(demo.state.profiles[value].name)}
                </option>
              ))}
          </Select>
          <Select label={t.role} value={role} onChange={(value) => setRole(value as typeof role)}>
            <option value="photographer">{t.demo.member}</option>
            <option value="manager">{t.demo.manager}</option>
          </Select>
          <Feedback error={task.error} />
          <Action type="submit">{t.demo.invite}</Action>
        </Form>
        <h3 className="workspace-subheading">{t.demo.invitations}</h3>
        {demo.state.invitations
          .filter((invitation) => invitation.studio === studio)
          .map((invitation) => (
            <div className="workspace-list-row" key={invitation.id}>
              <span>
                {demo.text(demo.state.profiles[invitation.person]?.name ?? invitation.person)}
              </span>
              <span className="status">
                {invitation.status === 'pending'
                  ? t.demo.pending
                  : invitation.status === 'accepted'
                    ? t.demo.approved
                    : t.demo.decline}
              </span>
            </div>
          ))}
      </section>
      {remove ? (
        <Modal title={t.demo.removeMember} onClose={() => setRemove(null)}>
          <p>{t.demo.removeMemberNote}</p>
          <Feedback error={task.error} />
          <Action
            onClick={() => {
              if (task.execute({ type: 'member', studio, person: remove, role: 'remove' }))
                setRemove(null);
            }}
          >
            {t.continue}
          </Action>
        </Modal>
      ) : null}
    </div>
  );
}
export function InvitationsPanel() {
  const demo = useDemo();
  const t = useStrings();
  const task = useDemoTask();
  const [decline, setDecline] = useState<string | null>(null);
  const invitations = demo.state.invitations.filter(
    (invitation) => invitation.person === demo.role,
  );
  return (
    <>
      <Feedback error={task.error} />
      {invitations.map((invitation) => (
        <article className="workspace-card" key={invitation.id}>
          <h3>
            {demo.text(
              demo.state.studios.find((studio) => studio.id === invitation.studio)?.name ?? '',
            )}
          </h3>
          <p>{t.demo[invitation.role === 'manager' ? 'manager' : 'member']}</p>
          {invitation.status === 'pending' ? (
            <div className="row wrap">
              <Action
                onClick={() =>
                  task.execute({ type: 'invitation', id: invitation.id, accept: true })
                }
              >
                {t.demo.accept}
              </Action>
              <Action secondary onClick={() => setDecline(invitation.id)}>
                {t.demo.decline}
              </Action>
            </div>
          ) : (
            <span className="status">
              {invitation.status === 'accepted' ? t.demo.approved : t.demo.decline}
            </span>
          )}
        </article>
      ))}
      {!invitations.length ? <p className="empty-state">{t.demo.noResults}</p> : null}
      {decline ? (
        <Modal title={t.demo.decline} onClose={() => setDecline(null)}>
          <p>
            {demo.text(
              demo.state.studios.find(
                (studio) => studio.id === invitations.find((value) => value.id === decline)?.studio,
              )?.name ?? '',
            )}
          </p>
          <Feedback error={task.error} />
          <Action
            onClick={() => {
              if (task.execute({ type: 'invitation', id: decline, accept: false }))
                setDecline(null);
            }}
          >
            {t.demo.decline}
          </Action>
        </Modal>
      ) : null}
    </>
  );
}
export function ResourcesPanel({ studio }: { studio: string }) {
  const demo = useDemo();
  const t = useStrings();
  const task = useDemoTask();
  const [name, setName] = useState('');
  const [type, setType] = useState<'room' | 'equipment'>('room');
  return (
    <>
      <h2>{t.demo.resources}</h2>
      <Feedback error={task.error} />
      {demo.state.resources
        .filter((resource) => resource.studio === studio)
        .map((resource) => (
          <article className="workspace-list-row" key={resource.id}>
            <div>
              <strong>{demo.text(resource.name)}</strong>
              <small>{resource.type === 'room' ? t.demo.roomResource : t.demo.equipment}</small>
            </div>
            <button
              className="text-button"
              onClick={() =>
                task.execute({
                  type: 'resource',
                  resource: { ...resource, active: !resource.active },
                })
              }
            >
              {resource.active ? t.demo.active : t.demo.inactive}
            </button>
          </article>
        ))}
      <section className="workspace-card">
        <Form
          onSubmit={() => {
            if (
              task.execute({
                type: 'resource',
                resource: { id: crypto.randomUUID(), studio, name, type, active: true },
              })
            )
              setName('');
          }}
        >
          <Field label={t.demo.resourceName} value={name} onChange={setName} />
          <Select
            label={t.demo.resources}
            value={type}
            onChange={(value) => setType(value as typeof type)}
          >
            <option value="room">{t.demo.roomResource}</option>
            <option value="equipment">{t.demo.equipment}</option>
          </Select>
          <Feedback error={task.error} />
          <Action type="submit">{t.demo.addResource}</Action>
        </Form>
      </section>
    </>
  );
}
