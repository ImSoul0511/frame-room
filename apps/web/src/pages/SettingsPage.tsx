import { useState } from 'react';
import type { Resource, Studio } from '../lib/types';
import { useAuth } from '../lib/auth';
import { api, post, patch } from '../lib/api';
import { useApi, useTask } from '../lib/hooks';
import { useStrings } from '../lib/i18n';
import { ProfileForm } from '../features/catalog/ProviderForms';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import {
  Action,
  Area,
  DateField,
  Feedback,
  Field,
  Form,
  Modal,
  PageHeading,
  QueryState,
  Select,
} from '../components/ui';

export function SettingsPage() {
  const t = useStrings();
  const { profile, session } = useAuth();
  const usage = useApi<{ requests: number; reservedUsd: number; images: number }>(
    '/v1/me/ai-usage',
  );
  return (
    <>
      <PageHeading title={t.nav.settings} />
      <div className="two-col">
        <section className="panel">
          <h2>{t.onboarding}</h2>
          {profile ? <ProfileForm profile={profile} /> : null}
          <p className="muted">{session?.user.email}</p>
          <LanguageSwitcher />
        </section>
        <section className="panel">
          <h2>{t.assistant.budget}</h2>
          <QueryState query={usage} />
          <p>
            {usage.data?.requests ?? 0} {t.assistant.requests} · {usage.data?.images ?? 0}{' '}
            {t.assistant.images}
          </p>
        </section>
      </div>
      {profile?.roles.includes('photographer') ? <ScheduleBlocks /> : null}
    </>
  );
}
function ScheduleBlocks() {
  const t = useStrings();
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [label, setLabel] = useState('');
  const [studioId, setStudio] = useState('');
  const [resourceId, setResource] = useState('');
  const blocks =
    useApi<
      { id: string; label: string; bookingId: string | null; startsAt: string; endsAt: string }[]
    >('/v1/me/schedule');
  const studios = useApi<Studio[]>('/v1/me/studios');
  const resources = useApi<Resource[]>(`/v1/studios/${studioId}/resources`, Boolean(studioId));
  const create = useTask(async () => {
    await post('/v1/me/schedule/blocks', {
      startsAt: new Date(start).toISOString(),
      endsAt: new Date(end).toISOString(),
      label,
      ...(resourceId ? { resourceId } : {}),
    });
    setLabel('');
  });
  const remove = useTask(async (id: string) =>
    api(`/v1/me/schedule/blocks/${id}`, { method: 'DELETE' }),
  );
  return (
    <section className="panel">
      <h2>{t.studio.blocks}</h2>
      <Form onSubmit={() => create.mutate()}>
        <div className="two-col">
          <Field label={t.studio.label} value={label} onChange={setLabel} />
          <Select
            label={t.nav.studio}
            value={studioId}
            onChange={(id) => {
              setStudio(id);
              setResource('');
            }}
          >
            <option value="">{t.portfolio.own}</option>
            {studios.data
              ?.filter((s) => s.role === 'manager')
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
          </Select>
          <DateField label={t.booking.start} value={start} onChange={setStart} />
          <DateField label={t.booking.end} value={end} onChange={setEnd} />
        </div>
        {studioId ? (
          <Select label={t.booking.resources} value={resourceId} onChange={setResource} required>
            <option value="">—</option>
            {resources.data
              ?.filter((r) => r.isActive)
              .map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
          </Select>
        ) : null}
        <Feedback error={create.error ?? remove.error} />
        <Action type="submit" pending={create.isPending}>
          {t.studio.newBlock}
        </Action>
      </Form>
      {blocks.data
        ?.filter((b) => !b.bookingId)
        .map((b) => (
          <div className="list-row" key={b.id}>
            <strong>{b.label}</strong>
            <Action secondary onClick={() => remove.mutate(b.id)}>
              {t.delete}
            </Action>
          </div>
        ))}
    </section>
  );
}
export function ReportButton({ targetType, targetId }: { targetType: string; targetId: string }) {
  const t = useStrings();
  const { session } = useAuth();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('other');
  const [description, setDescription] = useState('');
  const task = useTask(async () =>
    post('/v1/reports', { targetType, targetId, reason, description }),
  );
  if (!session) return null;
  return (
    <>
      <button className="text-button" onClick={() => setOpen(true)}>
        {t.admin.report}
      </button>
      {open ? (
        <Modal title={t.admin.report} onClose={() => setOpen(false)}>
          <Form onSubmit={() => task.mutate()}>
            <Select label={t.admin.reason} value={reason} onChange={setReason}>
              {['inappropriate', 'copyright', 'spam', 'other'].map((r) => (
                <option key={r} value={r}>
                  {t.reportReasons[r as keyof typeof t.reportReasons]}
                </option>
              ))}
            </Select>
            <Area label={t.admin.description} value={description} onChange={setDescription} />
            <Feedback error={task.error} success={task.isSuccess ? t.admin.reported : null} />
            <Action type="submit" pending={task.isPending}>
              {t.admin.submit}
            </Action>
          </Form>
        </Modal>
      ) : null}
    </>
  );
}
export function AdminPage() {
  const t = useStrings();
  const { profile } = useAuth();
  const allowed = profile?.roles.includes('system_admin');
  const reports = useApi<
    {
      id: string;
      targetType: string;
      targetId: string;
      reason: string;
      description: string;
      status: string;
    }[]
  >('/v1/admin/reports', allowed);
  const resolve = useTask(async (id: string) =>
    patch(`/v1/admin/reports/${id}`, { status: 'resolved' }),
  );
  const moderate = useTask(async (v: { targetType: string; targetId: string; isHidden: boolean }) =>
    post('/v1/admin/moderation', v),
  );
  if (!allowed) return <p>{t.errors.forbidden}</p>;
  return (
    <>
      <PageHeading title={t.admin.title} />
      <QueryState query={reports} empty={reports.data?.length === 0} />
      <Feedback error={resolve.error ?? moderate.error} />
      {reports.data?.map((r) => (
        <article className="panel" key={r.id}>
          <span className="eyebrow">{r.reason}</span>
          <p>{r.description}</p>
          <div className="row wrap">
            <Action
              secondary
              onClick={() =>
                moderate.mutate({ targetType: r.targetType, targetId: r.targetId, isHidden: true })
              }
            >
              {t.admin.hide}
            </Action>
            <Action
              secondary
              onClick={() =>
                moderate.mutate({ targetType: r.targetType, targetId: r.targetId, isHidden: false })
              }
            >
              {t.admin.restore}
            </Action>
            {r.status === 'open' ? (
              <Action onClick={() => resolve.mutate(r.id)}>{t.admin.resolve}</Action>
            ) : null}
          </div>
        </article>
      ))}
    </>
  );
}
