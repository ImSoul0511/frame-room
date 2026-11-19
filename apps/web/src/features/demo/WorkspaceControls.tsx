import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Action, Modal } from '../../components/ui';
import { useStrings } from '../../lib/i18n';
import { useDemo } from './DemoContext';
import type { DemoRole } from './types';

export function WorkspaceControls() {
  const demo = useDemo();
  const t = useStrings();
  const navigate = useNavigate();
  const [reset, setReset] = useState(false);
  const unread = demo.state.notifications.filter(
    (notice) => notice.recipient === demo.role && !notice.read,
  ).length;
  return (
    <div className="workspace-controls">
      {demo.choice !== 'account' ? (
        <span className="workspace-demo-label">
          {t.demo.demo}
          <small>{t.demo.demoNote}</small>
        </span>
      ) : null}
      <label className="workspace-role-picker">
        <span>{t.demo.role}</span>
        <select
          value={demo.choice}
          onChange={(event) => {
            const role = event.target.value as DemoRole | 'account';
            demo.setRole(role);
            navigate(
              role === 'admin'
                ? '/admin'
                : role === 'guest' || role === 'client' || role === 'account'
                  ? '/explore'
                  : '/bookings',
            );
          }}
        >
          <option value="account">{t.demo.accountRole}</option>
          {(['guest', 'client', 'photographer', 'photographer2', 'manager', 'admin'] as const).map(
            (role) => (
              <option key={role} value={role}>
                {t.demo[role]}
              </option>
            ),
          )}
        </select>
      </label>
      {demo.role !== 'guest' ? (
        <Link
          className="workspace-notification-link"
          to="/notifications"
          aria-label={
            demo.choice === 'account' ? t.demo.notifications : `${t.demo.notifications}: ${unread}`
          }
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            aria-hidden="true"
          >
            <path d="M5 17h14l-2-3V9A5 5 0 0 0 7 9v5l-2 3ZM10 21h4" />
          </svg>
          {demo.choice !== 'account' && unread ? <span>{unread}</span> : null}
        </Link>
      ) : null}
      {demo.choice !== 'account' ? (
        <button className="text-button workspace-reset" onClick={() => setReset(true)}>
          {t.demo.reset}
        </button>
      ) : null}
      {reset ? (
        <Modal title={t.demo.reset} onClose={() => setReset(false)}>
          <p>{t.demo.resetNote}</p>
          <div className="row wrap">
            <Action
              onClick={() => {
                demo.reset();
                setReset(false);
                navigate('/explore');
              }}
            >
              {t.demo.reset}
            </Action>
            <Action secondary onClick={() => setReset(false)}>
              {t.cancel}
            </Action>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
