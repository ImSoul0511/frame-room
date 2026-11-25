import { useState } from 'react';
import { Modal } from '../../components/ui';
import { useStrings } from '../../lib/i18n';
import { ReportButton } from '../../pages/SettingsPage';
import { MediaCard } from '../catalog/MediaCard';
import type { Image, Portfolio, Tag } from '../../lib/types';
import { ImageTagsEditor } from '../catalog/ImageTagsEditor';

export function PhotoGallery({
  photos,
  portfolio,
  editTags,
}: {
  photos: Image[];
  portfolio: Portfolio;
  editTags?: Tag[];
}) {
  const t = useStrings();
  const [selected, setSelected] = useState<number | null>(null);
  const current = selected === null ? null : photos[selected];
  const previous = () =>
    setSelected((value) => (value === null ? null : (value + photos.length - 1) % photos.length));
  const next = () => setSelected((value) => (value === null ? null : (value + 1) % photos.length));
  return (
    <>
      <div className="media-grid">
        {photos.map((photo, index) => (
          <MediaCard
            key={photo.id}
            portfolio={portfolio}
            image={photo.url}
            description={photo.caption}
            onOpen={() => setSelected(index)}
            edit={Boolean(editTags)}
          />
        ))}
      </div>
      {current ? (
        <Modal title={t.profileUi.gallery} onClose={() => setSelected(null)}>
          <div
            className="photo-lightbox"
            onKeyDown={(event) => {
              if (event.key === 'ArrowLeft') previous();
              if (event.key === 'ArrowRight') next();
            }}
          >
            <div className="photo-lightbox-image" tabIndex={0}>
              <img src={current.url} alt={current.caption || t.profileUi.photo} />
              {current.caption ? <p className="media-card-caption">{current.caption}</p> : null}
            </div>
            <div className="row between wrap">
              <button className="text-button" onClick={previous}>
                {t.profileUi.previous}
              </button>
              <span className="muted">
                {(selected ?? 0) + 1} / {photos.length}
              </span>
              <button className="text-button" onClick={next}>
                {t.profileUi.next}
              </button>
            </div>
            {editTags ? (
              <ImageTagsEditor key={current.id} image={current} tags={editTags} />
            ) : (
              <ReportButton targetType="portfolio_image" targetId={current.id} />
            )}
          </div>
        </Modal>
      ) : null}
    </>
  );
}
