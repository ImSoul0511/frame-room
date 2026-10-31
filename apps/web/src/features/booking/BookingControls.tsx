import { useState } from 'react';
import { useIsFetching, useIsMutating } from '@tanstack/react-query';
import type { Booking } from '@frameroom/shared';
import type { Member, Resource, Workspace } from '../../lib/types';
import { patch, post } from '../../lib/api';
import { useApi, useTask } from '../../lib/hooks';
import { useStrings } from '../../lib/i18n';
import { Action, Area, DateField, Feedback, Form, Modal, Select } from '../../components/ui';

export function localTime(value: string) {
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}
export function BookingControls({ workspace: w }: { workspace: Workspace }) {
  const t = useStrings();
  const refreshing = useIsFetching({ queryKey: ['api'] }) > 0;
  const changing = useIsMutating() > 0;
  const b = w.booking;
  const [open, setOpen] = useState<'confirm' | 'reschedule' | null>(null);
  const [reason, setReason] = useState('');
  const change = useTask(async (to: Booking['status']) =>
    post(`/v1/bookings/${b.id}/transitions`, { to, version: b.version, reason }),
  );
  const controls: { to: Booking['status']; label: string; allowed: boolean }[] = [
    { to: 'rejected', label: t.booking.reject, allowed: b.status === 'pending' && w.canManage },
    {
      to: 'cancelled',
      label: t.booking.cancel,
      allowed:
        (b.status === 'pending' && w.isClient) ||
        b.status === 'confirmed' ||
        (b.status === 'in_progress' && w.isProvider),
    },
    {
      to: 'in_progress',
      label: t.booking.begin,
      allowed: b.status === 'confirmed' && w.isProvider,
    },
    {
      to: 'proofing',
      label: t.booking.proofing,
      allowed: b.status === 'in_progress' && w.isProvider,
    },
    { to: 'delivered', label: t.booking.deliver, allowed: b.status === 'proofing' && w.isProvider },
    { to: 'completed', label: t.booking.complete, allowed: b.status === 'delivered' && w.isClient },
  ];
  return (
    <>
      <div className="row wrap">
        {b.status === 'pending' && w.canManage ? (
          <Action disabled={changing || refreshing} onClick={() => setOpen('confirm')}>
            {t.booking.confirm}
          </Action>
        ) : null}
        {['confirmed', 'in_progress'].includes(b.status) && w.canManage ? (
          <Action secondary onClick={() => setOpen('reschedule')}>
            {t.booking.reschedule}
          </Action>
        ) : null}
        {controls
          .filter((c) => c.allowed)
          .map((c) => (
            <Action
              key={c.to}
              secondary
              pending={change.isPending || changing || refreshing}
              onClick={() => change.mutate(c.to)}
            >
              {c.label}
            </Action>
          ))}
      </div>
      {controls.some((c) => c.allowed && c.to === 'cancelled') ? (
        <Area label={t.booking.reason} value={reason} onChange={setReason} />
      ) : null}
      <Feedback error={change.error} />
      {open ? (
        <Modal
          title={open === 'confirm' ? t.booking.confirm : t.booking.reschedule}
          onClose={() => setOpen(null)}
        >
          <ScheduleForm
            key={b.version}
            workspace={w}
            confirm={open === 'confirm'}
            onDone={() => setOpen(null)}
          />
        </Modal>
      ) : null}
    </>
  );
}
function ScheduleForm({
  workspace: w,
  confirm,
  onDone,
}: {
  workspace: Workspace;
  confirm: boolean;
  onDone: () => void;
}) {
  const t = useStrings();
  const b = w.booking;
  const [start, setStart] = useState(localTime(b.scheduledStart));
  const [end, setEnd] = useState(localTime(b.scheduledEnd));
  const [assigned, setAssigned] = useState(b.assignedPhotographerId ?? '');
  const [resources, setResources] = useState(w.resources.map((r) => r.resourceId));
  const team = useApi<Member[]>(`/v1/studios/${b.studioId}/team`, Boolean(b.studioId));
  const available = useApi<Resource[]>(`/v1/studios/${b.studioId}/resources`, Boolean(b.studioId));
  const task = useTask(async () => {
    const input = {
      version: b.version,
      scheduledStart: new Date(start).toISOString(),
      scheduledEnd: new Date(end).toISOString(),
      ...(assigned ? { assignedPhotographerId: assigned } : {}),
      resourceIds: resources,
    };
    if (confirm) await post(`/v1/bookings/${b.id}/transitions`, { ...input, to: 'confirmed' });
    else await patch(`/v1/bookings/${b.id}/schedule`, input);
    onDone();
  });
  return (
    <Form onSubmit={() => task.mutate()}>
      <DateField label={t.booking.start} value={start} onChange={setStart} />
      <DateField label={t.booking.end} value={end} onChange={setEnd} />
      {b.studioId ? (
        <>
          <Select label={t.booking.assign} value={assigned} onChange={setAssigned} required>
            <option value="">—</option>
            {team.data?.map((m) => (
              <option key={m.photographerId} value={m.photographerId}>
                {m.displayName}
              </option>
            ))}
          </Select>
          <fieldset>
            <legend>{t.booking.resources}</legend>
            {available.data
              ?.filter((r) => r.isActive)
              .map((r) => (
                <label key={r.id} className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={resources.includes(r.id)}
                    onChange={(e) =>
                      setResources(
                        e.target.checked
                          ? [...resources, r.id]
                          : resources.filter((id) => id !== r.id),
                      )
                    }
                  />
                  {r.name}
                </label>
              ))}
          </fieldset>
        </>
      ) : null}
      <Feedback error={task.error ?? team.error ?? available.error} />
      <Action type="submit" pending={task.isPending}>
        {confirm ? t.booking.confirm : t.save}
      </Action>
    </Form>
  );
}
