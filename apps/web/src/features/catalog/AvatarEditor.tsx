import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { Profile } from '@frameroom/shared';
import { Action, Feedback } from '../../components/ui';
import { UserAvatar } from '../../components/UserAvatar';
import { patch, upload } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { useTask } from '../../lib/hooks';
import { useStrings } from '../../lib/i18n';

export function AvatarEditor({ profile }: { profile: Profile }) {
  const t = useStrings();
  const { session } = useAuth();
  const client = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );
  const update = useTask(async (remove: boolean) => {
    const avatarPath = remove ? null : (await upload(file!, 'avatars')).storagePath;
    const updated = await patch<Profile>('/v1/me/avatar', { avatarPath });
    client.setQueryData(['profile', session?.user.id], updated);
    void client.invalidateQueries({ queryKey: ['conversation'] });
    void client.invalidateQueries({ queryKey: ['people-search'] });
    setFile(null);
    setPreview(null);
  });
  return (
    <div className="avatar-editor">
      <UserAvatar
        name={profile.displayName}
        avatarPath={profile.avatarPath}
        imageUrl={preview}
        className="avatar-editor-preview"
      />
      <div className="avatar-editor-controls">
        <label className="button-link avatar-editor-picker">
          {t.profileUi.chooseAvatar}
          <input
            type="file"
            className="sr-only"
            accept="image/jpeg,image/png,image/webp"
            disabled={update.isPending}
            onChange={(event) => {
              const selected = event.target.files?.[0] ?? null;
              setFile(selected);
              setPreview(selected ? URL.createObjectURL(selected) : null);
              update.reset();
              event.target.value = '';
            }}
          />
        </label>
        <span className="muted">{file?.name ?? t.profileUi.avatarHint}</span>
        <div className="row wrap">
          <Action
            pending={update.isPending && !update.variables}
            disabled={!file || update.isPending}
            onClick={() => update.mutate(false)}
          >
            {t.save}
          </Action>
          {file ? (
            <Action
              secondary
              disabled={update.isPending}
              onClick={() => {
                setFile(null);
                setPreview(null);
              }}
            >
              {t.cancel}
            </Action>
          ) : null}
          {profile.avatarPath ? (
            <Action
              secondary
              pending={update.isPending && update.variables}
              disabled={update.isPending}
              onClick={() => update.mutate(true)}
            >
              {t.profileUi.removeAvatar}
            </Action>
          ) : null}
        </div>
        <Feedback error={update.error} success={update.isSuccess ? t.saved : null} />
      </div>
    </div>
  );
}
