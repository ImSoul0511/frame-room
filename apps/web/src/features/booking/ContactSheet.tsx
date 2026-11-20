import { useState } from 'react';
import type { Image } from '../../lib/types';
import { useStrings } from '../../lib/i18n';
import { Provenance } from '../../components/ui';
import { PhotoViewer } from './PhotoViewer';

export function ContactSheet({
  images,
  selection,
  canSelect,
  onChange,
  maxSelection = 200,
  feedbackImageIds = [],
  onExport,
}: {
  maxSelection?: number;
  feedbackImageIds?: string[];
  onExport?: () => void;
  images: Image[];
  selection: string[];
  canSelect: boolean;
  onChange: (ids: string[]) => void;
}) {
  const t = useStrings();
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [activeId, setActiveId] = useState<string | null>(null);
  const visible = images.filter(
    (image, index) =>
      (filter === 'all' ||
        (filter === 'selected'
          ? selection.includes(image.id)
          : filter === 'feedback'
            ? feedbackImageIds.includes(image.id)
            : !selection.includes(image.id))) &&
      (!search.trim() ||
        `${String(index + 1).padStart(3, '0')} ${image.caption}`
          .toLowerCase()
          .includes(search.trim().toLowerCase())),
  );
  const toggle = (id: string) => {
    if (canSelect && (selection.includes(id) || selection.length < maxSelection))
      onChange(
        selection.includes(id)
          ? selection.filter((selected) => selected !== id)
          : [...selection, id],
      );
  };
  return (
    <section className="contact-sheet" aria-label={t.proofing.contactSheet}>
      <div className="contact-sheet-heading">
        <div>
          <p className="eyebrow">{t.proofing.contactSheet}</p>
          <p>{t.proofing.hint}</p>
        </div>
        <p className="sheet-count" aria-live="polite">
          <strong>{selection.length}</strong> {t.proofing.selected}{' '}
          <span>
            / {images.length} {t.proofing.photos}
          </span>
        </p>
      </div>
      {images.length ? (
        <div className="sheet-filters">
          <button className="chip" aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>
            {t.proofing.allPhotos}
          </button>
          <button
            className="chip"
            aria-pressed={filter === 'selected'}
            onClick={() => setFilter('selected')}
          >
            {t.proofing.selectedOnly}
          </button>
          <button
            className="chip"
            aria-pressed={filter === 'unselected'}
            onClick={() => setFilter('unselected')}
          >
            {t.tools.notSelected}
          </button>
          <button
            className="chip"
            aria-pressed={filter === 'feedback'}
            onClick={() => setFilter('feedback')}
          >
            {t.tools.withFeedback}
          </button>
          {onExport ? (
            <button className="chip" disabled={!selection.length} onClick={onExport}>
              {t.tools.exportSelection}
            </button>
          ) : null}
          {!canSelect ? <span>{t.proofing.readOnly}</span> : null}
        </div>
      ) : null}
      {images.length ? (
        <label className="sheet-search">
          {t.tools.findFrame}
          <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} />
        </label>
      ) : null}
      {!images.length ? (
        <div className="sheet-empty">
          <span aria-hidden="true">＋</span>
          <h3>{t.proofing.noPhotos}</h3>
          <p>{t.proofing.uploadHint}</p>
        </div>
      ) : !visible.length ? (
        <p className="sheet-empty">
          {filter === 'selected' ? t.proofing.noSelected : t.explore.noResults}
        </p>
      ) : (
        <div className="contact-grid">
          {visible.map((image) => (
            <figure
              key={image.id}
              className={
                selection.includes(image.id) ? 'contact-frame is-selected' : 'contact-frame'
              }
            >
              <button
                className="contact-preview"
                onClick={() => setActiveId(image.id)}
                aria-label={`${t.proofing.open} ${image.caption || images.indexOf(image) + 1}`}
              >
                <img
                  src={image.thumbnailUrl ?? image.url}
                  alt={image.caption || t.booking.gallery}
                  loading="lazy"
                />
                <span className="preview-open" aria-hidden="true">
                  ↗
                </span>
              </button>
              <figcaption>
                <span className="frame-index">
                  {String(images.indexOf(image) + 1).padStart(3, '0')}
                </span>
                <span className="frame-caption">
                  {image.caption}
                  <Provenance value={image.provenance} />
                </span>
                {canSelect ? (
                  <label className="contact-check">
                    <input
                      type="checkbox"
                      aria-label={`${t.booking.selected}: ${image.caption || image.id}`}
                      checked={selection.includes(image.id)}
                      disabled={!selection.includes(image.id) && selection.length >= maxSelection}
                      onChange={() => toggle(image.id)}
                    />
                  </label>
                ) : selection.includes(image.id) ? (
                  <span aria-label={t.booking.selected}>✓</span>
                ) : null}
              </figcaption>
            </figure>
          ))}
        </div>
      )}
      {activeId ? (
        <PhotoViewer
          images={images}
          initialId={activeId}
          selection={selection}
          canSelect={canSelect}
          onToggle={toggle}
          maxSelection={maxSelection}
          onClose={() => setActiveId(null)}
        />
      ) : null}
    </section>
  );
}
