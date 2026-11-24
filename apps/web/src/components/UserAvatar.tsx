export function getUserInitials(name: string) {
  const words = name.trim().split(/\s+/u).filter(Boolean);
  if (!words.length) return '?';
  if (words.length === 1)
    return Array.from(words[0] ?? '')
      .slice(0, 2)
      .join('')
      .toLocaleUpperCase();
  const first = Array.from(words[0] ?? '')[0] ?? '';
  const last = Array.from(words.at(-1) ?? '')[0] ?? '';
  return `${first}${last}`.toLocaleUpperCase();
}

export function UserAvatar({
  name,
  className = '',
  avatarPath,
  imageUrl,
}: {
  name: string;
  className?: string;
  avatarPath?: string | null;
  imageUrl?: string | null;
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const url =
    imageUrl ??
    (avatarPath && supabase
      ? supabase.storage.from('avatars').getPublicUrl(avatarPath).data.publicUrl
      : null);
  return (
    <span className={`user-avatar ${className}`.trim()} aria-hidden="true">
      {url && url !== failedUrl ? (
        <img src={url} alt="" onError={() => setFailedUrl(url)} />
      ) : (
        getUserInitials(name)
      )}
    </span>
  );
}
import { useState } from 'react';
import { supabase } from '../lib/api';
