import { useLocation, useNavigate } from 'react-router-dom';
import type { SavedProvider } from '@frameroom/shared';
import { useAuth } from '../../lib/auth';
import { useApi, useTask } from '../../lib/hooks';
import { api, post } from '../../lib/api';
import { useStrings } from '../../lib/i18n';
import { Feedback } from '../../components/ui';
export function SaveProviderButton({
  type,
  id,
  name,
}: {
  type: 'photographer' | 'studio';
  id: string;
  name: string;
}) {
  const t = useStrings();
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const saved = useApi<SavedProvider[]>('/v1/me/saved-providers', Boolean(auth.session));
  const entry = saved.data?.find((item) => item.providerType === type && item.providerId === id);
  const toggle = useTask(
    async () =>
      entry
        ? api(`/v1/me/saved-providers/${entry.id}`, { method: 'DELETE' })
        : post('/v1/me/saved-providers', { providerType: type, providerId: id }),
    ['/v1/me/saved-providers'],
  );
  return (
    <div className="save-provider">
      <button
        className="save-provider-button"
        aria-pressed={Boolean(entry)}
        aria-label={`${entry ? t.tools.unsaveProvider : t.tools.saveProvider}: ${name}`}
        disabled={toggle.isPending || Boolean(auth.session && saved.isPending)}
        onClick={() => {
          if (!auth.session || auth.onboardingRequired)
            navigate(`/auth?next=${encodeURIComponent(location.pathname + location.search)}`);
          else if (!saved.error) toggle.mutate();
          else void saved.refetch();
        }}
      >
        {entry ? '♥' : '♡'}
      </button>
      <Feedback error={toggle.error ?? saved.error} />
    </div>
  );
}
