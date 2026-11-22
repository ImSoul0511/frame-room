import { useState } from 'react';
import type { BookingCompletion } from '@frameroom/shared';
import { Action, Area, Feedback, Form, Modal, PageHeading, QueryState } from '../components/ui';
import { CompletionStatus } from '../features/booking/CompletionStatus';
import { patch } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useApi, useTask } from '../lib/hooks';
import { useStrings } from '../lib/i18n';

export function BookingCompletionsPage() {
  const t = useStrings();
  const auth = useAuth();
  const isAdmin = auth.profile?.roles.includes('system_admin') ?? false;
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<BookingCompletion | null>(null);
  const [reason, setReason] = useState('');
  const list = useApi<{ items: BookingCompletion[]; hasNext: boolean }>(
    `/v1/admin/booking-completions?page=${page}`,
    isAdmin,
    30000,
  );
  const change = useTask(async (booking: BookingCompletion) =>
    patch(`/v1/admin/bookings/${booking.id}/completion-hold`, {
      hold: !booking.completionHoldAt,
      version: booking.version,
      reason: reason.trim(),
    }),
  );
  if (!isAdmin) return <p role="alert">{t.workspaceUi.forbidden}</p>;

  return (
    <>
      <PageHeading title={t.booking.manageCompletion} />
      <QueryState query={list} empty={list.data?.items.length === 0} />
      <div className="booking-list">
        {list.data?.items.map((booking) => (
          <article className="workspace-card" key={booking.id}>
            <h2>{booking.serviceName}</h2>
            <p>{booking.id}</p>
            <CompletionStatus booking={booking} />
            <Action
              secondary
              onClick={() => {
                change.reset();
                setReason('');
                setSelected(booking);
              }}
            >
              {booking.completionHoldAt ? t.workspaceUi.releaseHold : t.booking.placeHold}
            </Action>
          </article>
        ))}
      </div>
      {page > 1 || list.data?.hasNext ? (
        <div className="row wrap">
          <Action secondary disabled={page === 1} onClick={() => setPage(page - 1)}>
            {t.booking.previousPage}
          </Action>
          <Action secondary disabled={!list.data?.hasNext} onClick={() => setPage(page + 1)}>
            {t.booking.nextPage}
          </Action>
        </div>
      ) : null}
      {selected ? (
        <Modal
          title={selected.completionHoldAt ? t.workspaceUi.releaseHold : t.booking.placeHold}
          onClose={() => {
            if (!change.isPending) setSelected(null);
          }}
        >
          <Form onSubmit={() => change.mutate(selected, { onSuccess: () => setSelected(null) })}>
            <Area label={t.booking.reason} value={reason} onChange={setReason} />
            <Feedback error={change.error} />
            <Action
              type="submit"
              pending={change.isPending}
              disabled={!reason.trim() || reason.trim().length > 1000}
            >
              {selected.completionHoldAt ? t.workspaceUi.releaseHold : t.booking.placeHold}
            </Action>
          </Form>
        </Modal>
      ) : null}
    </>
  );
}
