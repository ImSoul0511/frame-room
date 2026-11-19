import { useState } from 'react';
import { Modal, Provenance } from '../../components/ui';
import { useStrings } from '../../lib/i18n';
import { useDemo } from '../demo/DemoContext';
import { DemoReportButton } from '../demo/ReportButton';

export type GalleryPhoto = { id: string; url: string; caption?: string; provenance?: string };
export function PhotoGallery({ photos: source }: { photos: GalleryPhoto[] }) {
  const t = useStrings();
  const demo = useDemo();
  const photos = source.filter((photo) => !demo.state.hiddenTargets.includes(photo.id));
  const [selected, setSelected] = useState<number | null>(null);
  const current = selected === null ? null : photos[selected];
  const previous = () =>
    setSelected((value) => (value === null ? null : (value + photos.length - 1) % photos.length));
  const next = () => setSelected((value) => (value === null ? null : (value + 1) % photos.length));
  return (
    <>
      <div className="profile-photo-grid">
        {photos.map((photo, index) => (
          <div key={photo.id} className="public-photo-item">
            <button
              className="gallery-photo"
              onClick={() => setSelected(index)}
              aria-label={`${t.view}: ${photo.caption || `${t.profileUi.photo} ${index + 1}`}`}
            >
              <img
                src={photo.url}
                alt={photo.caption || `${t.profileUi.photo} ${index + 1}`}
                loading="lazy"
              />
              {photo.provenance ? <Provenance value={photo.provenance} /> : null}
            </button>
            <DemoReportButton targetType="image" targetId={photo.id} title={photo.caption} />
          </div>
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
            <img src={current.url} alt={current.caption || t.profileUi.photo} />
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
          </div>
        </Modal>
      ) : null}
    </>
  );
}
