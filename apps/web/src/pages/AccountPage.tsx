import { Link } from 'react-router-dom';
import type { OwnPhotographer } from '@frameroom/shared';
import { useAuth } from '../lib/auth';
import { useApi, useTask } from '../lib/hooks';
import { useStrings } from '../lib/i18n';
import { patch, upload } from '../lib/api';
import type { ProviderDetail } from '../lib/types';
import { Feedback, QueryState } from '../components/ui';
import { UserAvatar } from '../components/UserAvatar';
import { ProviderProfile } from '../features/profiles/ProviderProfile';

function PhotographerProfile({ id }: { id: string }) {
  const t = useStrings();
  const { profile } = useAuth();
  const detail = useApi<ProviderDetail>(`/v1/photographers/${id}`);
  const coverTask = useTask(async (file: File) => {
    if (
      !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ||
      file.size > 20 * 1024 * 1024
    )
      throw new Error(t.profileUi.avatarInvalid);
    const { storagePath } = await upload(file, 'profile-covers');
    await patch('/v1/photographers/me/cover', { coverPath: storagePath });
  });
  if (!detail.data) return <QueryState query={detail} />;
  return (
    <>
      <Feedback error={coverTask.error} success={coverTask.isSuccess ? t.saved : null} />
      <ProviderProfile
        detail={detail.data}
        avatarPath={profile?.avatarPath ?? null}
        canRequest={false}
        onBook={() => {}}
        coverAction={
          <label className={`profile-cover-picker${coverTask.isPending ? ' is-pending' : ''}`}>
            {coverTask.isPending ? t.pending : t.profileUi.changeCover}
            <input
              type="file"
              className="sr-only"
              accept="image/jpeg,image/png,image/webp"
              disabled={coverTask.isPending}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) coverTask.mutate(file);
                event.target.value = '';
              }}
            />
          </label>
        }
      />
    </>
  );
}

export function AccountPage() {
  const t = useStrings();
  const { profile } = useAuth();
  const isPhotographer = Boolean(profile?.roles.includes('photographer'));
  const photographer = useApi<OwnPhotographer | null>('/v1/photographers/me', isPhotographer);
  if (isPhotographer) {
    if (!photographer.data)
      return <QueryState query={photographer} empty={photographer.data === null} />;
    return <PhotographerProfile key={photographer.data.id} id={photographer.data.id} />;
  }
  return (
    <div className="public-profile">
      <div className="profile-cover profile-cover-empty">
        <span aria-hidden="true">FrameRoom.</span>
        <span className="profile-kind">{t.client}</span>
      </div>
      <header className="profile-identity">
        <UserAvatar
          name={profile?.displayName ?? ''}
          avatarPath={profile?.avatarPath}
          className="profile-monogram"
        />
        <div className="profile-name">
          <p className="eyebrow">{t.profileUi.account}</p>
          <h1>{profile?.displayName}</h1>
          <p className="muted">@{profile?.userName}</p>
        </div>
        <Link className="button-link dark" to="/settings">
          {t.profileUi.editProfile}
        </Link>
      </header>
    </div>
  );
}
