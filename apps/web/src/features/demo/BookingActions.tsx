import { useState } from 'react';
import { Action, Area, Feedback, Form, Modal, Select } from '../../components/ui';
import { useStrings } from '../../lib/i18n';
import { useDemo, useDemoTask } from './DemoContext';
import { canManageBooking, canWorkBooking, isManager } from './permissions';
import { currentBrief, isAvailable } from './model';
import type { DemoBooking } from './types';

export function BookingActions({ booking }: { booking: DemoBooking }) {
  const demo = useDemo();
  const t = useStrings();
  const task = useDemoTask();
  const [modal, setModal] = useState<'assign' | 'reject' | 'cancel' | 'cancel-agree' | null>(null);
  const [reason, setReason] = useState('');
  const [person, setPerson] = useState(booking.assigned ?? '');
  const client = booking.client === demo.role,
    manage = canManageBooking(demo.state, demo.role, booking),
    work = canWorkBooking(demo.state, demo.role, booking);
  const brief = currentBrief(booking),
    approvals = !brief.rejection && brief.clientApproved && brief.providerApproved;
  const assign =
    isManager(demo.state, demo.role, booking.provider) &&
    ((booking.status === 'pending' && !booking.assigned) ||
      (Boolean(booking.assigned) && ['confirmed', 'in_progress'].includes(booking.status)));
  const open = (value: typeof modal) => {
    setModal(value);
    setReason('');
    task.clear();
  };
  return (
    <>
      <div className="workspace-booking-actions">
        {assign ? (
          <Action secondary disabled={!approvals} onClick={() => open('assign')}>
            {booking.assigned ? t.demo.reassign : t.demo.initialAssignment}
          </Action>
        ) : null}
        {manage && booking.status === 'pending' ? (
          <>
            <Action
              disabled={!approvals || (booking.providerType === 'studio' && !booking.assigned)}
              onClick={() => task.execute({ type: 'confirm', id: booking.id })}
            >
              {t.demo.confirm}
            </Action>
            <button className="text-button" onClick={() => open('reject')}>
              {t.demo.reject}
            </button>
          </>
        ) : null}
        {work && booking.status === 'confirmed' ? (
          <Action onClick={() => task.execute({ type: 'start', id: booking.id })}>
            {t.demo.start}
          </Action>
        ) : null}
        {(client || work) &&
        ((booking.status === 'pending' && client) ||
          ['confirmed', 'in_progress', 'proofing'].includes(booking.status)) &&
        !booking.cancellation ? (
          <button className="text-button" onClick={() => open('cancel')}>
            {t.booking.cancel}
          </button>
        ) : null}
        {client && booking.status === 'delivered' ? (
          <Action
            disabled={booking.hold}
            onClick={() => task.execute({ type: 'complete', id: booking.id })}
          >
            {t.demo.complete}
          </Action>
        ) : null}
      </div>
      <Feedback error={task.error} />
      {booking.cancellation ? (
        <div className="workspace-cancellation">
          <strong>{t.demo.cancel}</strong>
          <p>{booking.cancellation.reason}</p>
          {(booking.cancellation.by === booking.client) !== client ? (
            <div className="row wrap">
              <Action onClick={() => open('cancel-agree')}>{t.demo['cancel-agree']}</Action>
              <Action
                secondary
                onClick={() => task.execute({ type: 'cancel-decline', id: booking.id, reason: '' })}
              >
                {t.demo['cancel-decline']}
              </Action>
            </div>
          ) : (
            <p className="muted">{t.demo.counterparty}</p>
          )}
        </div>
      ) : null}
      {modal ? (
        <Modal
          title={
            modal === 'assign'
              ? booking.assigned
                ? t.demo.reassign
                : t.demo.initialAssignment
              : t.demo[modal]
          }
          onClose={() => setModal(null)}
        >
          <Form
            onSubmit={() => {
              const success =
                modal === 'assign'
                  ? task.execute({
                      type: 'assign',
                      id: booking.id,
                      person,
                      reason,
                      expectedVersion: booking.version,
                    })
                  : task.execute({ type: modal, id: booking.id, reason });
              if (success) setModal(null);
            }}
          >
            {modal === 'assign' ? (
              <>
                <p className="muted">{t.demo.assignmentNote}</p>
                <Select label={t.photographer} value={person} onChange={setPerson}>
                  <option value="">—</option>
                  {demo.state.members
                    .filter((member) => member.studio === booking.provider)
                    .map((member) => (
                      <option key={member.person} value={member.person}>
                        {demo.text(demo.state.profiles[member.person]?.name ?? member.person)} ·{' '}
                        {isAvailable(demo.state, member.person, brief, booking.id)
                          ? t.demo.available
                          : t.demo.unavailable}
                      </option>
                    ))}
                </Select>
              </>
            ) : null}
            {(modal !== 'assign' || booking.assigned) && modal !== 'cancel-agree' ? (
              <Area label={t.demo.reason} value={reason} onChange={setReason} />
            ) : null}
            <Feedback error={task.error} />
            <Action type="submit">{modal === 'assign' ? t.demo.assign : t.continue}</Action>
          </Form>
        </Modal>
      ) : null}
    </>
  );
}
