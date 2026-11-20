import { Link, useParams } from 'react-router-dom';
import type { Workspace } from '../lib/types';
import { useApi } from '../lib/hooks';
import { useStrings } from '../lib/i18n';
import { dateTime, currency } from '../lib/format';
import { Action, QueryState } from '../components/ui';
export function PrintBriefPage() {
  const { id = '' } = useParams();
  const t = useStrings();
  const query = useApi<Workspace>(`/v1/bookings/${id}/workspace`);
  if (!query.data) return <QueryState query={query} />;
  const w = query.data;
  const brief =
    w.briefs.find((item) => item.version === w.booking.agreedBriefVersion) ?? w.briefs[0];
  if (!brief) return <p role="status">{t.tools.noBrief}</p>;
  const content = brief.content;
  const scope = content.requirements;
  return (
    <>
      <div className="brief-print-toolbar">
        <Link className="atelier-text-link" to={`/bookings/${id}`}>
          {t.tools.backToShoot}
        </Link>
        <Action onClick={() => window.print()}>{t.tools.print}</Action>
      </div>
      <article className="print-brief">
        <header>
          <p className="eyebrow">FrameRoom / {t.tools.briefDocument}</p>
          <h1>{content.title}</h1>
          <p className="print-brief-version">
            {brief.version === w.booking.agreedBriefVersion
              ? t.tools.agreedVersion
              : t.tools.latestDraft}{' '}
            · {t.booking.version} {brief.version}
          </p>
        </header>
        <dl className="print-brief-facts">
          <div>
            <dt>{t.atelier.service}</dt>
            <dd>{w.booking.serviceName}</dd>
          </div>
          <div>
            <dt>{t.booking.start}</dt>
            <dd>{dateTime(w.booking.scheduledStart)}</dd>
          </div>
          <div>
            <dt>{t.booking.end}</dt>
            <dd>{dateTime(w.booking.scheduledEnd)}</dd>
          </div>
          <div>
            <dt>{t.demo.budget}</dt>
            <dd>{currency(w.booking.totalPrice)}</dd>
          </div>
          {scope ? (
            <>
              <div>
                <dt>{t.demo.location}</dt>
                <dd>{scope.location}</dd>
              </div>
              <div>
                <dt>{t.tools.people}</dt>
                <dd>{scope.people}</dd>
              </div>
              <div>
                <dt>{t.tools.deliveredPhotos}</dt>
                <dd>{scope.photoCount}</dd>
              </div>
              <div>
                <dt>{t.tools.retouchedPhotos}</dt>
                <dd>{scope.retouchedCount}</dd>
              </div>
              <div>
                <dt>{t.tools.revisions}</dt>
                <dd>{scope.revisionLimit}</dd>
              </div>
            </>
          ) : null}
        </dl>
        <section>
          <h2>{t.project.concept}</h2>
          <p className="preserve-lines">{content.concept}</p>
        </section>
        {(['shotList', 'lighting', 'checklist', 'milestones'] as const).map((key) =>
          content[key].some((value) => value.trim()) ? (
            <section key={key}>
              <h2>{t.project[key]}</h2>
              <ul>
                {content[key]
                  .filter((value) => value.trim())
                  .map((value, index) => (
                    <li key={index}>{value}</li>
                  ))}
              </ul>
            </section>
          ) : null,
        )}
        {scope?.crew ? (
          <section>
            <h2>{t.demo.crew}</h2>
            <p className="preserve-lines">{scope.crew}</p>
          </section>
        ) : null}
        {scope?.notes ? (
          <section>
            <h2>{t.tools.notes}</h2>
            <p className="preserve-lines">{scope.notes}</p>
          </section>
        ) : null}
        <footer>
          <h2>{t.tools.approvals}</h2>
          <p>
            {brief.clientApproved ? '✓' : '○'} {t.client} / {brief.providerApproved ? '✓' : '○'}{' '}
            {t.tools.provider}
          </p>
          <small>FrameRoom · {w.booking.id}</small>
        </footer>
      </article>
    </>
  );
}
