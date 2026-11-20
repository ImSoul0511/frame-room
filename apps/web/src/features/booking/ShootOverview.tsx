import type { Workspace } from '../../lib/types';
import { currency, dateTime } from '../../lib/api';
import { useStrings } from '../../lib/i18n';
import { shootStage } from './shoot-stage';

export function ShootProgress({ status }: { status: Workspace['booking']['status'] }) {
  const t = useStrings();
  const current = shootStage(status);
  const labels = [
    t.atelier.planning,
    t.atelier.agreement,
    t.atelier.shooting,
    t.atelier.proofing,
    t.atelier.delivery,
    t.atelier.complete,
  ];
  return (
    <ol className="atelier-stage-list" aria-label={t.booking.title}>
      {labels.map((label, index) => (
        <li
          key={index}
          className={index === current ? 'is-current' : index < current ? 'is-done' : ''}
          aria-current={index === current ? 'step' : undefined}
        >
          <span>{String(index + 1).padStart(2, '0')}</span>
          {label}
        </li>
      ))}
    </ol>
  );
}
export function ShootOverview({
  workspace: w,
  onNavigate,
}: {
  workspace: Workspace;
  onNavigate: (tab: string) => void;
}) {
  const t = useStrings();
  const status = w.booking.status;
  const hint = {
    pending: t.atelier.pendingHint,
    confirmed: t.atelier.confirmedHint,
    in_progress: t.atelier.progressHint,
    proofing: t.atelier.proofingHint,
    delivered: t.atelier.deliveredHint,
    completed: t.atelier.completedHint,
    cancelled: t.atelier.cancelledHint,
    rejected: t.atelier.cancelledHint,
  }[status];
  const next =
    status === 'pending' || status === 'cancelled' || status === 'rejected'
      ? 'brief'
      : status === 'confirmed'
        ? 'room'
        : status === 'in_progress' || status === 'proofing'
          ? 'gallery'
          : 'delivery';
  return (
    <>
      <section className="atelier-next">
        <div>
          <p className="eyebrow">{t.atelier.nextAction}</p>
          <p>{hint}</p>
        </div>
        <button className="button-link dark" onClick={() => onNavigate(next)}>
          {t.booking[next as 'brief' | 'room' | 'gallery' | 'delivery']}{' '}
          <span aria-hidden="true">↗</span>
        </button>
      </section>
      <dl className="atelier-shoot-summary">
        <div>
          <dt>{t.atelier.schedule}</dt>
          <dd>{dateTime(w.booking.scheduledStart)}</dd>
        </div>
        <div>
          <dt>{t.demo.budget}</dt>
          <dd>{currency(w.booking.totalPrice)}</dd>
        </div>
        <div>
          <dt>{t.atelier.selectedQuota}</dt>
          <dd>
            {w.selections.length} / {w.proofing.quota}
          </dd>
        </div>
      </dl>
      <div className="two-col">
        <section className="panel">
          <p className="eyebrow">{t.project.concept}</p>
          <h2>{w.project.title}</h2>
          <p>{w.project.idea}</p>
          <div className="row wrap">
            <button className="text-button" onClick={() => onNavigate('brief')}>
              {t.booking.brief}
            </button>
            <span className="muted">
              {w.briefs[0]?.clientApproved ? '✓' : '○'} {t.client} /{' '}
              {w.briefs[0]?.providerApproved ? '✓' : '○'} {t.photographer}
            </span>
          </div>
        </section>
        <section className="panel">
          <h2>{t.project.milestones}</h2>
          {w.milestones.length ? (
            <ul>
              {w.milestones.map((item) => (
                <li key={item.id}>
                  {item.status === 'done' ? '✓' : '○'} {item.title}
                  {item.dueAt ? ` / ${dateTime(item.dueAt)}` : ''}
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">{t.empty}</p>
          )}
        </section>
      </div>
    </>
  );
}
