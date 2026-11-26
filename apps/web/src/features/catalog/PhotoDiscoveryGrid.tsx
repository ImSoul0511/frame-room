import { useLayoutEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useStrings } from '../../lib/i18n';
import type { Tag } from '../../lib/types';

export interface DiscoveryPhoto {
  id: string;
  portfolioId: string;
  caption: string;
  url: string;
  width?: number | null;
  height?: number | null;
  ownerName?: string | null;
  tags: Tag[];
}

export function PhotoDiscoveryGrid({ photos }: { photos: DiscoveryPhoto[] }) {
  const t = useStrings();
  const [params] = useSearchParams();
  const project = params.get('project');
  const grid = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState({ width: 0, columns: 4, gap: 20 });
  useLayoutEffect(() => {
    const element = grid.current;
    if (!element) return;
    const measure = () => {
      const styles = getComputedStyle(element);
      const next = {
        width: element.clientWidth,
        columns: Number(styles.getPropertyValue('--photo-columns')) || 4,
        gap: parseFloat(styles.columnGap) || 20,
      };
      setLayout((previous) =>
        previous.width === next.width &&
        previous.columns === next.columns &&
        previous.gap === next.gap
          ? previous
          : next,
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const columnWidth = Math.max(
    0,
    (layout.width - (layout.columns - 1) * layout.gap) / layout.columns,
  );
  const bottoms = Array<number>(layout.columns).fill(0);
  // Placement depends only on metadata and earlier photos, never image load order.
  // Appending a page therefore leaves every existing photo in the same position.
  const positions = photos.map((photo) => {
    const column = bottoms.indexOf(Math.min(...bottoms));
    const ratio =
      photo.width && photo.width > 0 && photo.height && photo.height > 0
        ? photo.width / photo.height
        : 3 / 4;
    const height = columnWidth / ratio;
    const position = {
      top: bottoms[column],
      left: column * (columnWidth + layout.gap),
      width: columnWidth,
      height,
    };
    bottoms[column] += height + layout.gap;
    return position;
  });
  const height = Math.max(0, ...bottoms) - (photos.length ? layout.gap : 0);
  return (
    <>
      <div className="discovery-photo-grid" ref={grid} style={{ height }}>
        {photos.map((photo, index) => (
          <Link
            className="discovery-photo"
            key={photo.id}
            style={positions[index]}
            to={`/portfolios/${photo.portfolioId}/photos/${photo.id}${project ? `?project=${encodeURIComponent(project)}` : ''}`}
            aria-label={photo.caption || t.profileUi.photo}
          >
            <img
              src={photo.url}
              alt={photo.caption || t.profileUi.photo}
              loading="lazy"
              decoding="async"
              width={photo.width || undefined}
              height={photo.height || undefined}
            />
            <span className="discovery-photo-caption">{photo.caption || photo.ownerName}</span>
          </Link>
        ))}
      </div>
    </>
  );
}
