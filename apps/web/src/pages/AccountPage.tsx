import { Link } from 'react-router-dom';
import type { Booking, CreativeProject, OwnPhotographer } from '@frameroom/shared';
import { useAuth } from '../lib/auth';
import { useApi } from '../lib/hooks';
import { useStrings } from '../lib/i18n';
import { dateTime, patch, supabase, upload } from '../lib/api';
import type { ProviderDetail } from '../lib/types';
import { QueryState } from '../components/ui';
import { AvatarEditor, PhotoEditButton } from '../features/catalog/AvatarEditor';
import { ProviderProfile } from '../features/profiles/ProviderProfile';
import { BotanicalSpray } from '../components/BotanicalSpray';
import { AvailabilitySetting } from '../features/booking/Availability';

function PhotographerProfile({ id }: { id: string }) {
  const { profile } = useAuth();
  const detail = useApi<ProviderDetail>(`/v1/photographers/${id}`);
  if (!detail.data) return <QueryState query={detail} />;
  const cover =
    detail.data.coverPath && supabase
      ? supabase.storage.from('profile-covers').getPublicUrl(detail.data.coverPath).data.publicUrl
      : undefined;
  return (
    <>
      <ProviderProfile
        detail={detail.data}
        avatar={profile && <AvatarEditor profile={profile} className="profile-monogram" />}
        canRequest={false}
        onBook={() => {}}
        coverAction={
          <PhotoEditButton
            kind="cover"
            current={cover}
            onSave={async (file) => {
              const { storagePath } = await upload(file, 'profile-covers');
              await patch('/v1/photographers/me/cover', { coverPath: storagePath });
            }}
          />
        }
      />
      <AvailabilitySetting type="photographer" id={id} />
    </>
  );
}

function ClientProfile() {
  const t = useStrings();
  const { profile, session } = useAuth();
  const coverPath = session?.user.user_metadata.profile_cover_path;
  const cover =
    typeof coverPath === 'string' && profile && coverPath.startsWith(profile.id + '/')
      ? supabase?.storage.from('profile-covers').getPublicUrl(coverPath).data.publicUrl
      : undefined;
  const projects = useApi<CreativeProject[]>('/v1/creative-projects');
  const bookings = useApi<Booking[]>('/v1/bookings', true, 60000);
  const upcoming = bookings.data
    ?.filter(
      (booking) =>
        Date.parse(booking.scheduledStart) >= bookings.dataUpdatedAt &&
        !['cancelled', 'rejected', 'completed'].includes(booking.status),
    )
    .sort((left, right) => Date.parse(left.scheduledStart) - Date.parse(right.scheduledStart))
    .slice(0, 3);
  return (
    <div className="public-profile account-overview">
      <div className="account-portrait">
        <div
          className={
            cover ? 'profile-cover profile-cover-custom' : 'profile-cover profile-cover-empty'
          }
        >
          {cover ? (
            <img src={cover} alt="" />
          ) : (
            <>
              <BotanicalSpray className="account-sprig" />
              <BotanicalSpray className="account-sprig-secondary" blue flowers={false} />
            </>
          )}
          <PhotoEditButton
            kind="cover"
            current={cover}
            onSave={async (file) => {
              if (!supabase) throw new Error(t.authMissing);
              const { storagePath } = await upload(file, 'profile-covers');
              const { error } = await supabase.auth.updateUser({
                data: { profile_cover_path: storagePath },
              });
              if (error) throw error;
            }}
          />
        </div>
        <header className="profile-identity">
          {profile && <AvatarEditor profile={profile} className="profile-monogram" />}
          <div className="profile-name">
            <p className="eyebrow">{t.profileUi.account}</p>
            <h1>{profile?.displayName}</h1>
            <p className="muted">@{profile?.userName}</p>
          </div>
        </header>
      </div>
      <div className="account-activity">
        <section>
          <h2>
            <Link to="/bookings">
              {t.studio.upcoming}
              <span aria-hidden="true">↗</span>
            </Link>
          </h2>
          <QueryState
            query={bookings}
            empty={upcoming?.length === 0}
            emptyMessage={t.profileUi.noUpcoming}
          />
          {upcoming?.map((booking) => (
            <Link className="account-activity-item" key={booking.id} to={`/bookings/${booking.id}`}>
              <time dateTime={booking.scheduledStart}>{dateTime(booking.scheduledStart)}</time>
              <strong>{booking.serviceName}</strong>
            </Link>
          ))}
        </section>
        <section>
          <h2>
            <Link to="/projects">
              {t.nav.projects}
              <span aria-hidden="true">↗</span>
            </Link>
          </h2>
          <QueryState
            query={projects}
            empty={projects.data?.length === 0}
            emptyMessage={t.profileUi.noProjects}
          />
          {projects.data?.slice(0, 3).map((project) => (
            <Link className="account-activity-item" key={project.id} to={`/projects/${project.id}`}>
              <strong>{project.title}</strong>
              <p>{project.idea}</p>
            </Link>
          ))}
        </section>
      </div>
    </div>
  );
}

export function AccountPage() {
  const { profile } = useAuth();
  const isPhotographer = Boolean(profile?.roles.includes('photographer'));
  const photographer = useApi<OwnPhotographer | null>('/v1/photographers/me', isPhotographer);
  if (!isPhotographer) return <ClientProfile />;
  if (!photographer.data)
    return <QueryState query={photographer} empty={photographer.data === null} />;
  return <PhotographerProfile key={photographer.data.id} id={photographer.data.id} />;
}
