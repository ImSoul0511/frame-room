import { useState } from 'react';
import { useIsFetching, useIsMutating } from '@tanstack/react-query';
import type { Booking } from '@frameroom/shared';
import type { Resource, Workspace } from '../../lib/types';
import { patch, post } from '../../lib/api';
import { useApi, useTask } from '../../lib/hooks';
import { useStrings } from '../../lib/i18n';
import { Action, Area, Feedback, Form, Modal } from '../../components/ui';
export function BookingControls({ workspace: w }: { workspace: Workspace }) {
  const t = useStrings();
  const refreshing = useIsFetching({ queryKey: ['api'] }) > 0;
  const changing = useIsMutating() > 0;
  const b = w.booking;
  const [open, setOpen] = useState<'confirm' | 'reschedule' | null>(null);
  const [reason, setReason] = useState('');
  const [pendingDecision, setPendingDecision] = useState<'rejected' | 'cancelled' | null>(null);
  const change = useTask(async (to: Booking['status']) =>
    post(`/v1/bookings/${b.id}/transitions`, { to, version: b.version, reason }),
  );
  const controls: { to: Booking['status']; label: string; allowed: boolean }[] = [
    { to: 'rejected', label: t.booking.reject, allowed: b.status === 'pending' && w.canManage },
    {
      to: 'cancelled',
      label: t.booking.cancel,
      allowed: b.status === 'pending' && w.isClient,
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
    {
      to: 'delivered',
      label: t.booking.deliver,
      allowed:
        b.status === 'proofing' &&
        w.isProvider &&
        (!w.proofing.mode || w.gallery?.approvedRound === w.gallery?.round) &&
        w.deliveries.length > 0,
    },
    { to: 'completed', label: t.booking.complete, allowed: b.status === 'delivered' && w.isClient },
  ];
  const latest = w.briefs[0];
  const ready = latest?.clientApproved && latest.providerApproved && latest.status !== 'closed';
  const canConfirm = ready && Boolean(b.assignedPhotographerId);
  return (
    <>
      <div className="row wrap">
        {b.status === 'pending' && w.canManage ? (
          <Action
            disabled={changing || refreshing || !canConfirm}
            onClick={() => setOpen('confirm')}
          >
            {t.booking.confirm}
          </Action>
        ) : null}
        {['confirmed', 'in_progress'].includes(b.status) && w.canManage && b.studioId ? (
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
              onClick={() => {
                if (c.to === 'rejected' || c.to === 'cancelled') setPendingDecision(c.to);
                else change.mutate(c.to);
              }}
            >
              {c.label}
            </Action>
          ))}
      </div>
      {pendingDecision ? (
        <Modal
          title={pendingDecision === 'rejected' ? t.booking.reject : t.booking.cancel}
          onClose={() => setPendingDecision(null)}
        >
          <Form
            onSubmit={() =>
              change.mutate(pendingDecision, { onSuccess: () => setPendingDecision(null) })
            }
          >
            <Area label={t.booking.reason} value={reason} onChange={setReason} />
            <Feedback error={change.error} />
            <Action type="submit" pending={change.isPending} disabled={!reason.trim()}>
              {t.booking.agree}
            </Action>
          </Form>
        </Modal>
      ) : null}
      {b.studioId && w.canManage && ['in_progress', 'proofing'].includes(b.status) ? (
        <AssignmentForm workspace={w} attendance />
      ) : null}
      <Feedback error={change.error} />
      {b.studioId &&
      w.canManage &&
      ((b.status === 'pending' && ready) || ['confirmed', 'in_progress'].includes(b.status)) ? (
        <AssignmentForm workspace={w} />
      ) : null}
      {(w.isClient || w.canManage) &&
      ['confirmed', 'in_progress', 'proofing'].includes(b.status) ? (
        <CancellationForm workspace={w} />
      ) : null}
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
  const [resources, setResources] = useState(w.resources.map((r) => r.resourceId));
  const available = useApi<Resource[]>(`/v1/studios/${b.studioId}/resources`, Boolean(b.studioId));
  const task = useTask(async () => {
    const input = {
      version: b.version,
      scheduledStart: b.scheduledStart,
      scheduledEnd: b.scheduledEnd,
      resourceIds: resources,
    };
    if (confirm)
      await post(`/v1/bookings/${b.id}/transitions`, {
        version: b.version,
        resourceIds: resources,
        to: 'confirmed',
      });
    else await patch(`/v1/bookings/${b.id}/schedule`, input);
    onDone();
  });
  return (
    <Form onSubmit={() => task.mutate()}>
      {b.studioId ? (
        <>
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
      <Feedback error={task.error ?? available.error} />
      <Action type="submit" pending={task.isPending}>
        {confirm ? t.booking.confirm : t.save}
      </Action>
    </Form>
  );
}

function AssignmentForm({
  workspace: { booking: b },
  attendance = false,
}: {
  workspace: Workspace;
  attendance?: boolean;
}) {
  const t = useStrings();
  const [selected, setSelected] = useState<string[] | null>(null);
  const [reason, setReason] = useState('');
  const [open, setOpen] = useState(false);
  const reassign = b.status !== 'pending';
  const candidates = useApi<
    { id: string; displayName: string; isAvailable: boolean; isAssigned: boolean }[]
  >(`/v1/bookings/${b.id}/available-photographers${attendance ? '?attendance=true' : ''}`, open);
  const ids =
    selected ??
    (candidates.data ?? []).filter((person) => person.isAssigned).map((person) => person.id);
  const task = useTask(async () => {
    await post(`/v1/bookings/${b.id}/${attendance ? 'attendance' : 'team'}`, {
      version: b.version,
      photographerIds: ids,
      reason,
    });
    setOpen(false);
  });
  const label = attendance
    ? t.workspaceUi.finishAttendance
    : reassign
      ? t.workspaceUi.reassign
      : t.booking.assign;
  return (
    <>
      <Action
        secondary
        onClick={() => {
          setSelected(null);
          setReason('');
          setOpen(true);
        }}
      >
        {label}
      </Action>
      {open ? (
        <Modal title={label} onClose={() => setOpen(false)}>
          <Form onSubmit={() => task.mutate()}>
            <fieldset>
              <legend>{t.photographer}</legend>
              {candidates.data?.map((candidate) => (
                <label className="checkbox-row" key={candidate.id}>
                  <input
                    type="checkbox"
                    checked={ids.includes(candidate.id)}
                    disabled={!attendance && !candidate.isAvailable && !ids.includes(candidate.id)}
                    onChange={(event) =>
                      setSelected(
                        event.target.checked
                          ? [...ids, candidate.id]
                          : ids.filter((id) => id !== candidate.id),
                      )
                    }
                  />
                  {candidate.displayName}
                  {attendance || candidate.isAvailable ? '' : ` · ${t.errors.slot_overlap}`}
                </label>
              ))}
            </fieldset>
            {reassign && !attendance ? (
              <Area label={t.booking.reason} value={reason} onChange={setReason} />
            ) : null}
            <Feedback error={task.error ?? candidates.error} />
            <Action
              type="submit"
              pending={task.isPending}
              disabled={!ids.length || (reassign && !attendance && !reason.trim())}
            >
              {label}
            </Action>
          </Form>
        </Modal>
      ) : null}
    </>
  );
}

function CancellationForm({ workspace: w }: { workspace: Workspace }) {
  const t = useStrings();
  const [reason, setReason] = useState('');
  const path = `/v1/bookings/${w.booking.id}/cancellation`;
  const submit = useTask(async () => post(path, { reason }));
  const respond = useTask(async (accept: boolean) => patch(path, { accept }));
  return (
    <section className="panel">
      {w.cancellation ? (
        <>
          <p>{w.cancellation.reason}</p>
          {w.cancellation.isClientProposal === w.isClient ? (
            <p>{t.workspaceUi.counterparty}</p>
          ) : (
            <div className="row wrap">
              <Action pending={respond.isPending} onClick={() => respond.mutate(true)}>
                {t.workspaceUi['cancel-agree']}
              </Action>
              <Action secondary pending={respond.isPending} onClick={() => respond.mutate(false)}>
                {t.workspaceUi['cancel-decline']}
              </Action>
            </div>
          )}
        </>
      ) : (
        <Form onSubmit={() => submit.mutate()}>
          <Area label={t.booking.reason} value={reason} onChange={setReason} />
          <Action secondary type="submit" pending={submit.isPending} disabled={!reason.trim()}>
            {t.workspaceUi.cancel}
          </Action>
        </Form>
      )}
      <Feedback error={submit.error ?? respond.error} />
    </section>
  );
}
