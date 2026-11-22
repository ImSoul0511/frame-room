import { useState } from 'react';
import { Modal, Provenance } from '../../components/ui';
import { useLanguage, useStrings } from '../../lib/i18n';
import { ReportButton } from '../../pages/SettingsPage';
import { FittedImage } from '../../components/FittedImage';

export type GalleryPhoto = {
  id: string;
  url: string;
  caption?: string;
  provenance?: string;
  crewCredits?: string;
  tags?: { id: string; name: string; nameVi?: string | null }[];
};
export function PhotoGallery({ photos }: { photos: GalleryPhoto[] }) {
  const t = useStrings();
  const { language } = useLanguage();
  const tagLabel = (tag: NonNullable<GalleryPhoto['tags']>[number]) =>
    language === 'vi' ? tag.nameVi || tag.name : tag.name;
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
              <FittedImage
                src={photo.url}
                alt={photo.caption || `${t.profileUi.photo} ${index + 1}`}
                loading="lazy"
                decoding="async"
              />
              {photo.provenance ? <Provenance value={photo.provenance} /> : null}
            </button>
            {photo.caption ? <p className="photo-caption">{photo.caption}</p> : null}
            <div className="profile-tags">
              {photo.tags?.map((tag) => (
                <span className="card-tag" key={tag.id}>
                  {tagLabel(tag)}
                </span>
              ))}
            </div>
            <ReportButton targetType="portfolio_image" targetId={photo.id} />
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
            {current.caption ? <p className="photo-caption">{current.caption}</p> : null}
            {current.crewCredits ? (
              <p>
                {t.workspaceUi.credits} · {current.crewCredits}
              </p>
            ) : null}
            {current.tags?.length ? <p>{current.tags.map(tagLabel).join(' · ')}</p> : null}
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
