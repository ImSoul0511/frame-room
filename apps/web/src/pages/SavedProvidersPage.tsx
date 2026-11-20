import { Link, useSearchParams } from 'react-router-dom';
import type { SavedProvider } from '@frameroom/shared';
import { useApi } from '../lib/hooks';
import { useDiscovery } from '../lib/discovery';
import { useStrings } from '../lib/i18n';
import { PageHeading, QueryState } from '../components/ui';
import { ProviderCard } from '../features/catalog/ProviderCard';
export function SavedProvidersPage() {
  const t = useStrings();
  const [params, setParams] = useSearchParams();
  const project = params.get('project');
  const exploreTo = `/explore${project ? `?project=${encodeURIComponent(project)}` : ''}`;
  const saved = useApi<SavedProvider[]>('/v1/me/saved-providers');
  const catalog = useDiscovery();
  const ids = new Set(saved.data?.map((item) => `${item.providerType}:${item.providerId}`));
  const providers = (catalog.data ?? []).filter(
    (provider) =>
      ids.has(`${provider.type}:${provider.id}`) &&
      (!params.get('genre') ||
        provider.genres.includes(params.get('genre') as (typeof provider.genres)[number])),
  );
  return (
    <>
      <PageHeading
        title={t.tools.saved}
        subtitle={t.tools.savedHint}
        action={
          <Link className="button-link dark" to={exploreTo}>
            {t.atelier.discover}
          </Link>
        }
      />
      <QueryState query={saved} />
      <QueryState query={catalog} />
      {params.get('genre') ? (
        <button
          className="chip"
          onClick={() =>
            setParams((current) => {
              const next = new URLSearchParams(current);
              next.delete('genre');
              return next;
            })
          }
        >
          {t.explore.clear}
        </button>
      ) : null}
      {saved.data && catalog.data && !providers.length ? (
        <div className="empty-state">
          <h2>{t.tools.savedEmpty}</h2>
          <Link className="atelier-text-link" to={exploreTo}>
            {t.atelier.discover}
          </Link>
        </div>
      ) : null}
      <div className="provider-grid">
        {providers.map((provider, index) => (
          <ProviderCard
            key={`${provider.type}:${provider.id}`}
            provider={provider}
            index={index}
            project={project}
            onGenre={(genre) =>
              setParams((current) => {
                const next = new URLSearchParams(current);
                if (next.get('genre') === genre) next.delete('genre');
                else next.set('genre', genre);
                return next;
              })
            }
          />
        ))}
      </div>
    </>
  );
}
