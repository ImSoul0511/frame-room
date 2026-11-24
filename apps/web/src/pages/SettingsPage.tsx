import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Resource, Studio } from '../lib/types';
import { useAuth } from '../lib/auth';
import { api, post, patch } from '../lib/api';
import { useApi, useTask } from '../lib/hooks';
import { useStrings } from '../lib/i18n';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { UserAvatar } from '../components/UserAvatar';
import { PhotographerForm, ProfileForm } from '../features/catalog/ProviderForms';
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
  const avatarTriggerRef = useRef<HTMLButtonElement>(null);
  return (
    <>
      <PageHeading title={t.workspaceUi.settings} />
      <div className="settings-profile">
        <section className="panel">
          <h2>{t.profileUi.account}</h2>
          {profile ? <ProfileForm profile={profile} avatarTriggerRef={avatarTriggerRef} /> : null}
          <p className="muted">{session?.user.email}</p>
        </section>
        {profile ? (
          <aside className="settings-avatar-card" aria-label={t.profileUi.account}>
            <button
              type="button"
              className="avatar-edit-trigger"
              aria-label={t.profileUi.editAvatar}
              onClick={() => avatarTriggerRef.current?.click()}
            >
              <UserAvatar
                name={profile.displayName}
                avatarPath={profile.avatarPath}
                className="settings-avatar-card-photo"
              />
            </button>
            <p className="settings-avatar-card-name">{profile.displayName}</p>
            <p className="settings-avatar-card-username">@{profile.userName}</p>
          </aside>
        ) : null}
      </div>
      {profile?.roles.includes('photographer') ? (
        <>
          <section className="panel">
            <h2>{t.portfolio.profile}</h2>
            <PhotographerForm />
          </section>
          <ScheduleBlocks />
        </>
      ) : null}
      <div className="settings-preferences">
        <section className="panel">
          <h2>{t.profileUi.security}</h2>
          <p className="muted">{t.profileUi.passwordDescription}</p>
          <Link className="text-button" to="/auth?mode=reset">
            {t.forgot}
          </Link>
        </section>
        <section className="panel settings-language-panel">
          <h2>{t.language.label}</h2>
          <LanguageSwitcher />
        </section>
      </div>
    </>
  );
}
export function ScheduleBlocks() {
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
export function ReportButton({
  targetType,
  targetId,
}: {
  targetType: 'portfolio' | 'portfolio_image' | 'review';
  targetId: string;
}) {
  const t = useStrings();
  const { profile, onboardingRequired } = useAuth();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('other');
  const [description, setDescription] = useState('');
  const task = useTask(async () =>
    post('/v1/reports', { targetType, targetId, reason, description }),
  );
  if (!profile || onboardingRequired) return null;
  return (
    <>
      <button
        className="text-button"
        onClick={() => {
          setOpen(true);
          task.reset();
        }}
      >
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
            <Action type="submit" pending={task.isPending} disabled={task.isSuccess}>
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
