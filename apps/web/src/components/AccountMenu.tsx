import { DropdownMenu } from '@astryxdesign/core/DropdownMenu';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/api';
import { useTask } from '../lib/hooks';
import { useStrings } from '../lib/i18n';
import { Feedback } from './ui';

export function AccountMenu({ displayName }: { displayName: string }) {
  const t = useStrings();
  const navigate = useNavigate();
  const logout = useTask(async () => {
    const result = await supabase?.auth.signOut({ scope: 'local' });
    if (result?.error) throw result.error;
    navigate('/explore');
  });
  return (
    <>
      <DropdownMenu
        className="account-menu"
        alignment="end"
        menuWidth={208}
        renderTrigger={(props) => (
          <button
            {...props}
            className="avatar-trigger"
            type="button"
            aria-label={t.design.accountMenu}
            disabled={logout.isPending}
          >
            <span className="avatar" aria-hidden="true">
              {displayName.slice(0, 1)}
            </span>
          </button>
        )}
        items={[
          { label: t.design.profile, onClick: () => navigate('/profile') },
          {
            label: logout.isPending ? t.pending : t.logout,
            isDisabled: logout.isPending,
            onClick: () => logout.mutate(),
          },
        ]}
      />
      <Feedback error={logout.error} />
    </>
  );
}
