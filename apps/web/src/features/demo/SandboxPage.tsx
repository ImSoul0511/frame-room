import { useState } from 'react';
import { useStrings } from '../../lib/i18n';
import { DemoProvider, useDemo } from './DemoContext';
import { WorkspaceProjectsPage } from './ProjectsPage';
import { WorkspaceStudioPage } from './StudioPage';
import { WorkspaceModerationPage } from './ModerationPage';
export function SandboxPage() {
  const t = useStrings();
  const [panel, setPanel] = useState('projects');
  return (
    <DemoProvider>
      <section className="notice">
        <h1>{t.atelier.sandbox}</h1>
        <p>{t.atelier.sandboxHint}</p>
      </section>
      <SandboxControls />
      <nav className="tabs" aria-label={t.atelier.sandbox}>
        {(['projects', 'studio', 'moderation'] as const).map((key) => (
          <button key={key} aria-pressed={key === panel} onClick={() => setPanel(key)}>
            {t.demo[key]}
          </button>
        ))}
      </nav>
      {panel === 'projects' ? (
        <WorkspaceProjectsPage />
      ) : panel === 'studio' ? (
        <WorkspaceStudioPage />
      ) : (
        <WorkspaceModerationPage />
      )}
    </DemoProvider>
  );
}

function SandboxControls() {
  const demo = useDemo();
  const t = useStrings();
  return (
    <div className="row wrap">
      <label>
        {t.demo.role}
        <select
          value={demo.choice}
          onChange={(event) => demo.setRole(event.target.value as typeof demo.choice)}
        >
          {(['client', 'photographer', 'manager', 'admin'] as const).map((role) => (
            <option key={role} value={role}>
              {t.demo[role]}
            </option>
          ))}
        </select>
      </label>
      <button className="text-button" onClick={demo.reset}>
        {t.demo.reset}
      </button>
    </div>
  );
}
