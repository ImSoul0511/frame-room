import { useState } from 'react';
import { useStrings } from '../lib/i18n';

/** URL refreshes replace src without remounting the selected image or its feedback. */
export function SignedImage({
  src,
  alt,
  onRefresh,
  className,
}: {
  src: string;
  alt: string;
  onRefresh?: () => void;
  className?: string;
}) {
  const t = useStrings();
  const [failed, setFailed] = useState<string | null>(null);
  if (failed === src)
    return (
      <div className="image-recovery" role="status">
        <p>{t.atelier.imageUnavailable}</p>
        <button
          className="text-button"
          onClick={() => {
            setFailed(null);
            onRefresh?.();
          }}
        >
          {t.atelier.refreshImage}
        </button>
      </div>
    );
  return (
    <img src={src} alt={alt} className={className} loading="lazy" onError={() => setFailed(src)} />
  );
}
