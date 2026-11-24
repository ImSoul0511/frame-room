import { useEffect, useRef, useState, type RefObject } from 'react';
import type { Profile } from '@frameroom/shared';
import { UserAvatar } from '../../components/UserAvatar';
import { supabase } from '../../lib/api';
import { useStrings } from '../../lib/i18n';
import { AvatarCropDialog } from './AvatarCropDialog';

export function AvatarEditor({
  profile,
  file,
  editing,
  disabled,
  triggerRef,
  onStartEdit,
  onChange,
}: {
  profile: Profile;
  file: File | null;
  editing: boolean;
  disabled: boolean;
  triggerRef?: RefObject<HTMLButtonElement | null>;
  onStartEdit: () => void;
  onChange: (file: File) => void;
}) {
  const t = useStrings();
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [source, setSource] = useState<{ url: string; objectUrl: boolean } | null>(null);
  const [error, setError] = useState('');
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );
  useEffect(
    () => () => {
      if (source?.objectUrl) URL.revokeObjectURL(source.url);
    },
    [source],
  );
  const openFile = (selected: File) => {
    if (
      !['image/jpeg', 'image/png', 'image/webp'].includes(selected.type) ||
      selected.size > 20 * 1024 * 1024
    ) {
      setError(t.profileUi.avatarInvalid);
      return;
    }
    setError('');
    onStartEdit();
    setSource({ url: URL.createObjectURL(selected), objectUrl: true });
  };
  const openCurrent = () => {
    onStartEdit();
    setError('');
    if (file) setSource({ url: URL.createObjectURL(file), objectUrl: true });
    else if (profile.avatarPath && supabase)
      setSource({
        url: supabase.storage.from('avatars').getPublicUrl(profile.avatarPath).data.publicUrl,
        objectUrl: false,
      });
    else inputRef.current?.click();
  };
  return (
    <>
      <div className="avatar-editor">
        <button
          type="button"
          ref={triggerRef}
          className="avatar-edit-trigger"
          disabled={disabled}
          onClick={openCurrent}
          aria-label={t.profileUi.editAvatar}
        >
          <UserAvatar
            name={profile.displayName}
            avatarPath={profile.avatarPath}
            imageUrl={file ? preview : null}
            className="avatar-editor-preview"
          />
        </button>
        <div className="avatar-editor-controls">
          {editing ? (
            <button
              type="button"
              className="button-link avatar-editor-picker"
              disabled={disabled}
              onClick={() => inputRef.current?.click()}
            >
              {t.profileUi.chooseAvatar}
            </button>
          ) : null}
          <input
            ref={inputRef}
            type="file"
            className="sr-only"
            aria-label={t.profileUi.chooseAvatar}
            tabIndex={-1}
            accept="image/jpeg,image/png,image/webp"
            disabled={disabled}
            onChange={(event) => {
              const selected = event.target.files?.[0];
              if (selected) openFile(selected);
              event.target.value = '';
            }}
          />
        </div>
      </div>
      {error ? (
        <p className="notice error" role="alert">
          {error}
        </p>
      ) : null}
      {source ? (
        <AvatarCropDialog
          source={source.url}
          onClose={() => setSource(null)}
          onApply={(cropped) => {
            setPreview(URL.createObjectURL(cropped));
            onChange(cropped);
            setSource(null);
          }}
        />
      ) : null}
    </>
  );
}
