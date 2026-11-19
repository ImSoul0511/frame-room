import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Action, Area, Feedback, Field, Form } from '../../components/ui';
import { useStrings } from '../../lib/i18n';
import { useDemo, useDemoTask } from './DemoContext';
import { DemoTabs } from './ui';
import { isPhotographer } from './permissions';

export function WorkspaceAccountPage({ editing = false }: { editing?: boolean }) {
  const demo = useDemo();
  const t = useStrings();
  const task = useDemoTask();
  const [tab, setTab] = useState(editing ? 'edit' : 'overview');
  const initial = demo.state.profiles[demo.role];
  const [value, setValue] = useState({
    ...structuredClone(initial),
    name: demo.text(initial.name),
    bio: demo.text(initial.bio),
  });
  const [saved, setSaved] = useState(false);
  return (
    <>
      <header className="account-profile-heading">
        <div className="profile-monogram">{demo.text(initial.name).slice(0, 1)}</div>
        <div>
          <p className="eyebrow">{t.demo[demo.role]}</p>
          <h1>{demo.text(initial.name)}</h1>
          <p className="muted">{t.demo.demoNote}</p>
        </div>
      </header>
      <DemoTabs
        tabs={[
          { id: 'overview', label: t.demo.overview },
          { id: 'edit', label: t.profileUi.editProfile },
          { id: 'security', label: t.profileUi.security },
        ]}
        value={tab}
        onChange={setTab}
      >
        {tab === 'overview' ? (
          <div className="workspace-account-layout">
            <section className="workspace-card">
              <h2>{t.demo.accountDetails}</h2>
              <p>{demo.text(initial.bio)}</p>
              <dl className="workspace-facts">
                <div>
                  <dt>{t.role}</dt>
                  <dd>{t.demo[demo.role]}</dd>
                </div>
                <div>
                  <dt>{t.city}</dt>
                  <dd>{initial.city || '—'}</dd>
                </div>
              </dl>
              <div className="profile-tags">
                {initial.genres.map((genre) => (
                  <span key={genre} className="card-tag">
                    {t.genreLabels[genre]}
                  </span>
                ))}
              </div>
              <button className="button-link" onClick={() => setTab('edit')}>
                {t.profileUi.editProfile}
              </button>
            </section>
            <aside className="workspace-card">
              <h2>{t.demo.overview}</h2>
              <div className="account-quick-links">
                <Link to="/notifications">{t.demo.notifications}</Link>
                {demo.role !== 'admin' ? (
                  <Link to="/bookings">{t.demo.bookings}</Link>
                ) : (
                  <Link to="/admin">{t.demo.moderation}</Link>
                )}
                {isPhotographer(demo.role) ? (
                  <>
                    <Link to="/portfolio">{t.demo.portfolio}</Link>
                    <Link to="/studio">{t.demo.studio}</Link>
                  </>
                ) : null}
              </div>
            </aside>
          </div>
        ) : tab === 'edit' ? (
          <section className="workspace-card workspace-profile-editor">
            <Form onSubmit={() => setSaved(task.execute({ type: 'profile', profile: value }))}>
              <Field
                label={t.displayName}
                value={value.name}
                onChange={(name) => {
                  setValue({ ...value, name });
                  setSaved(false);
                }}
                required
              />
              <Area
                label={t.bio}
                value={value.bio}
                onChange={(bio) => setValue({ ...value, bio })}
              />
              <Field
                label={t.city}
                value={value.city}
                onChange={(city) => setValue({ ...value, city })}
              />
              <Feedback error={task.error} success={saved ? t.demo.saved : null} />
              <Action type="submit">{t.save}</Action>
            </Form>
          </section>
        ) : (
          <section className="workspace-card">
            <h2>{t.profileUi.security}</h2>
            <p>{t.profileUi.passwordDescription}</p>
            <Link className="text-button" to="/auth?mode=reset">
              {t.forgot}
            </Link>
            <h3 className="workspace-subheading">{t.profileUi.privacy}</h3>
            <p>{t.profileUi.privateProfile}</p>
          </section>
        )}
      </DemoTabs>
    </>
  );
}
export function WorkspaceNotificationsPage() {
  const demo = useDemo();
  const t = useStrings();
  const task = useDemoTask();
  const list = demo.state.notifications.filter(
    (notification) => notification.recipient === demo.role,
  );
  return (
    <>
      <header className="workspace-heading">
        <h1>{t.demo.notifications}</h1>
      </header>
      <Feedback error={task.error} />
      {list.map((notification) => (
        <article key={notification.id} className="workspace-list-row">
          <div>
            <Link to={notification.href}>{demo.text(notification.text)}</Link>
            {!notification.read ? <small>{t.demo.unread}</small> : null}
          </div>
          {!notification.read ? (
            <button
              className="text-button"
              onClick={() => task.execute({ type: 'notification', id: notification.id })}
            >
              {t.demo.markRead}
            </button>
          ) : null}
        </article>
      ))}
      {!list.length ? <p className="empty-state">{t.demo.noNotifications}</p> : null}
    </>
  );
}
