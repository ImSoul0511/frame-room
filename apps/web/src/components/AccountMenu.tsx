import { Link } from 'react-router-dom';
import { useStrings } from '../lib/i18n';
import { UserAvatar } from './UserAvatar';

export function AccountMenu({
  displayName,
  avatarPath,
}: {
  displayName: string;
  avatarPath?: string | null;
}) {
  const t = useStrings();
  return (
    <Link className="avatar-trigger" to="/profile" aria-label={t.design.profile}>
      <UserAvatar name={displayName} avatarPath={avatarPath} className="avatar" />
    </Link>
  );
}
