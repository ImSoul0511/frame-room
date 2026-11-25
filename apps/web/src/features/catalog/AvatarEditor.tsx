import { useEffect, useId, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { Profile } from '@frameroom/shared';
import { UserAvatar } from '../../components/UserAvatar';
import { Action, Feedback, Modal } from '../../components/ui';
import { patch, supabase, upload } from '../../lib/api';
import { useTask } from '../../lib/hooks';
import { useStrings } from '../../lib/i18n';
import { AvatarCropDialog } from './AvatarCropDialog';

export function AvatarEditor({ profile, className }: { profile: Profile; className: string }) {
  const client = useQueryClient();
  const current =
    profile.avatarPath && supabase
      ? supabase.storage.from('avatars').getPublicUrl(profile.avatarPath).data.publicUrl
      : undefined;
  return (
    <div className="editable-avatar">
      <UserAvatar
        name={profile.displayName}
        avatarPath={profile.avatarPath}
        className={className}
      />
      <PhotoEditButton
        kind="avatar"
        current={current}
        onSave={async (file) => {
          const { storagePath } = await upload(file, 'avatars');
          await client.cancelQueries({ queryKey: ['profile', profile.id] });
          const updated = await patch<Profile>('/v1/me/avatar', { avatarPath: storagePath });
          client.setQueryData(['profile', profile.id], updated);
          await Promise.all(
            ['conversation', 'people-search'].map((key) =>
              client.invalidateQueries({ queryKey: [key] }),
            ),
          );
        }}
      />
    </div>
  );
}

export function PhotoEditButton({
  kind,
  current,
  onSave,
}: {
  kind: 'avatar' | 'cover';
  current?: string;
  onSave: (file: File) => Promise<void>;
}) {
  const t = useStrings();
  const input = useRef<HTMLInputElement>(null);
  const menuId = useId();
  const menu = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [viewing, setViewing] = useState(false);
  const [source, setSource] = useState('');
  const [selected, setSelected] = useState<File | null>(null);
  const [invalid, setInvalid] = useState(false);
  const save = useTask(onSave);
  const avatar = kind === 'avatar';
  const title = avatar ? t.profileUi.editAvatar : t.profileUi.changeCover;
  const viewLabel = avatar ? t.profileUi.viewAvatar : t.profileUi.viewCover;
  const chooseLabel = avatar ? t.profileUi.chooseAvatar : t.profileUi.chooseCover;
  useEffect(
    () => () => {
      if (source.startsWith('blob:')) URL.revokeObjectURL(source);
    },
    [source],
  );
  useEffect(() => {
    const popup = menu.current;
    const button = trigger.current;
    if (!popup || !button) return;
    const place = () => {
      if (!popup.matches(':popover-open')) return;
      const rect = button.getBoundingClientRect();
      if (rect.bottom < 0 || rect.top > window.innerHeight) {
        popup.hidePopover();
        return;
      }
      popup.style.left =
        Math.max(8, Math.min(rect.left, window.innerWidth - popup.offsetWidth - 8)) + 'px';
      popup.style.top =
        (rect.bottom + popup.offsetHeight + 8 <= window.innerHeight
          ? rect.bottom + 4
          : Math.max(8, rect.top - popup.offsetHeight - 4)) + 'px';
    };
    popup.addEventListener('toggle', place);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      popup.removeEventListener('toggle', place);
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, []);
  const close = () => {
    setViewing(false);
    setSource('');
    setSelected(null);
    setInvalid(false);
  };
  const apply = (file: File) => {
    setSelected(file);
    if (avatar) setSource('');
    save.mutate(file, { onSuccess: close });
  };
  const fileInput = (
    <input
      type="file"
      accept="image/jpeg,image/png,image/webp"
      hidden
      ref={input}
      onChange={(event) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file) return;
        save.reset();
        if (
          !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ||
          file.size > 20 * 1024 * 1024
        ) {
          setInvalid(true);
          return;
        }
        setInvalid(false);
        setSelected(file);
        setSource(URL.createObjectURL(file));
      }}
    />
  );
  return (
    <>
      <button
        className={'photo-edit-pencil photo-edit-' + kind}
        ref={trigger}
        popoverTarget={menuId}
        disabled={save.isPending}
        type="button"
        aria-label={title}
        title={title}
        onClick={() => {
          save.reset();
        }}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="m4 16-1 5 5-1L20 8a2.8 2.8 0 0 0-4-4L4 16Z M14 6l4 4" />
        </svg>
      </button>
      {fileInput}

      <div
        className="photo-dropdown"
        id={menuId}
        popover="auto"
        ref={menu}
        role="group"
        aria-label={title}
      >
        <button
          type="button"
          disabled={!current}
          onClick={() => {
            menu.current?.hidePopover();
            setViewing(true);
          }}
        >
          {viewLabel}
        </button>
        <button
          type="button"
          onClick={() => {
            menu.current?.hidePopover();
            input.current?.click();
          }}
        >
          {chooseLabel}
        </button>
      </div>
      {viewing && current && (
        <Modal title={viewLabel} onClose={close}>
          <img className="avatar-full-preview" src={current} alt={viewLabel} />
        </Modal>
      )}
      {avatar && source && <AvatarCropDialog source={source} onClose={close} onApply={apply} />}
      {avatar && <Feedback error={invalid ? new Error(t.profileUi.avatarInvalid) : save.error} />}
      {!avatar && (source || invalid) && (
        <Modal title={title} onClose={close}>
          {source && <img className="cover-edit-preview" alt="" src={source} />}
          <Feedback error={invalid ? new Error(t.profileUi.avatarInvalid) : save.error} />
          <div className="row wrap">
            <Action secondary disabled={save.isPending} onClick={() => input.current?.click()}>
              {t.profileUi.chooseCover}
            </Action>
            {selected && (
              <Action disabled={invalid} pending={save.isPending} onClick={() => apply(selected)}>
                {t.save}
              </Action>
            )}
            <Action secondary disabled={save.isPending} onClick={close}>
              {t.cancel}
            </Action>
          </div>
        </Modal>
      )}
    </>
  );
}
