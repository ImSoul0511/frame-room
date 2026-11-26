import { useState } from 'react';
import { useAuth } from '../lib/auth';
import { post, patch } from '../lib/api';
import { useApi, useTask } from '../lib/hooks';
import { useStrings } from '../lib/i18n';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { AvatarEditor } from '../features/catalog/AvatarEditor';
import { PhotographerForm, ProfileForm } from '../features/catalog/ProviderForms';
import { ChangePassword } from '../features/profiles/ChangePassword';
import {
  Action,
  Area,
  Feedback,
  Form,
  Modal,
  PageHeading,
  QueryState,
  Select,
} from '../components/ui';

export function SettingsPage() {
  const t = useStrings();
  const { profile, session } = useAuth();
  return (
    <>
      <PageHeading title={t.workspaceUi.settings} />
      <div className="settings-profile">
        <section className="panel settings-profile-panel">
          <h2>{t.profileUi.account}</h2>
          <p className="muted">{t.profileUi.editProfileDescription}</p>
          {profile ? <ProfileForm key={profile.id} profile={profile} /> : null}
        </section>
        {profile ? (
          <aside className="settings-avatar-card" aria-label={t.profileUi.account}>
            <AvatarEditor profile={profile} className="settings-avatar-card-photo" />
            <p className="settings-avatar-card-name">{profile.displayName}</p>
            <p className="settings-avatar-card-username">@{profile.userName}</p>
          </aside>
        ) : null}
      </div>
      {session?.user.email ? (
        <section className="panel settings-signin-panel">
          <h2>{t.profileUi.signInEmail}</h2>
          <p className="settings-signin-email">{session.user.email}</p>
          <p className="muted">{t.profileUi.signInEmailHint}</p>
          <ChangePassword key={session.user.id} />
        </section>
      ) : null}
      {profile?.roles.includes('photographer') ? (
        <section className="panel">
          <h2>{t.portfolio.profile}</h2>
          <PhotographerForm />
        </section>
      ) : null}
      <div className="settings-preferences">
        <section className="panel settings-language-panel">
          <h2>{t.language.label}</h2>
          <LanguageSwitcher />
        </section>
      </div>
    </>
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
