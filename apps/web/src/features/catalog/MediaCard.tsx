import { useId, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { FittedImage } from '../../components/FittedImage';
import { useStrings } from '../../lib/i18n';
import type { Portfolio } from '../../lib/types';

export function MediaCard({
  portfolio,
  image,
  title,
  description,
  onOpen,
  photoId,
  edit = false,
}: {
  portfolio: Portfolio;
  image?: string | null;
  title?: string;
  description?: string;
  onOpen?: () => void;
  photoId?: string;
  edit?: boolean;
}) {
  const t = useStrings();
  const captionId = useId();
  const [params] = useSearchParams();
  const [failedSrc, setFailedSrc] = useState<string>();
  const project = params.get('project');
  const context = project ? `?project=${encodeURIComponent(project)}` : '';
  const albumUrl = `/portfolios/${portfolio.id}${photoId ? `/photos/${photoId}` : ''}${edit ? '?edit=1' : context}`;
  const imageLabel = title || description || portfolio.title;
  const visual = (
    <>
      {image && image !== failedSrc ? (
        <FittedImage
          src={image}
          alt={imageLabel}
          loading="lazy"
          decoding="async"
          onError={() => setFailedSrc(image)}
        />
      ) : (
        <span className="image-unavailable">{t.discovery.noImage}</span>
      )}
      {description ? (
        <span className="media-card-caption" id={captionId}>
          <span>{description}</span>
        </span>
      ) : null}
    </>
  );
  return (
    <article className="media-card collection-card">
      {onOpen ? (
        <button
          className="media-card-image collection-image"
          onClick={onOpen}
          aria-label={`${t.view} · ${imageLabel}`}
          aria-describedby={description ? captionId : undefined}
        >
          {visual}
        </button>
      ) : (
        <Link
          className="media-card-image collection-image"
          to={albumUrl}
          aria-label={imageLabel}
          aria-describedby={description ? captionId : undefined}
        >
          {visual}
        </Link>
      )}
    </article>
  );
}
