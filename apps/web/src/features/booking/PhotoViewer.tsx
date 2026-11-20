import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import type { Image } from '../../lib/types';
import { useStrings } from '../../lib/i18n';
import { SignedImage } from '../../components/SignedImage';
import { Provenance } from '../../components/ui';

export function PhotoViewer({
  images,
  initialId,
  selection,
  canSelect,
  onToggle,
  onClose,
  maxSelection = 200,
}: {
  maxSelection?: number;
  images: Image[];
  initialId: string;
  selection: string[];
  canSelect: boolean;
  onToggle: (id: string) => void;
  onClose: () => void;
}) {
  const t = useStrings();
  const titleId = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const [index, setIndex] = useState(
    Math.max(
      0,
      images.findIndex((image) => image.id === initialId),
    ),
  );
  const [zoom, setZoom] = useState(false);
  const [comparisonId, setComparisonId] = useState('');
  const current = images[index];
  const comparison = images.find((image) => image.id === comparisonId && image.id !== current?.id);
  useEffect(() => {
    const previousFocus = document.activeElement;
    const element = dialog.current;
    element?.showModal();
    return () => {
      element?.close();
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
  }, []);
  if (!current) return null;
  const canToggle =
    canSelect && (selection.includes(current.id) || selection.length < maxSelection);
  const move = (direction: number) => {
    setIndex((previous) => (previous + direction + images.length) % images.length);
    setZoom(false);
  };
  const keyboard = (event: KeyboardEvent<HTMLDialogElement>) => {
    if (event.target instanceof HTMLElement && event.target.closest('input, select, textarea'))
      return;
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      move(1);
    }
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      move(-1);
    }
    if (event.key.toLowerCase() === 's' && canToggle) {
      event.preventDefault();
      onToggle(current.id);
    }
  };
  return (
    <dialog
      ref={dialog}
      className="photo-viewer"
      aria-labelledby={titleId}
      onCancel={onClose}
      onKeyDown={keyboard}
    >
      <header className="viewer-header">
        <div>
          <p className="eyebrow">{t.proofing.contactSheet}</p>
          <h2 id={titleId}>{current.caption || t.proofing.open}</h2>
        </div>
        <button className="viewer-tool" onClick={onClose} aria-label={t.close}>
          ×
        </button>
      </header>
      <div className="viewer-toolbar">
        <span className="viewer-counter" aria-live="polite">
          {String(index + 1).padStart(2, '0')} / {String(images.length).padStart(2, '0')}
        </span>
        <button className="viewer-tool" aria-pressed={zoom} onClick={() => setZoom(!zoom)}>
          {zoom ? t.proofing.zoomOut : t.proofing.zoomIn}
        </button>
        {images.length > 1 ? (
          <label className="viewer-compare">
            {t.proofing.compare}
            <select
              aria-label={t.proofing.compare}
              value={comparison?.id ?? ''}
              onChange={(event) => {
                setComparisonId(event.target.value);
                setZoom(false);
              }}
            >
              <option value="">{t.proofing.noCompare}</option>
              {images.map((image, imageIndex) => (
                <option key={image.id} value={image.id} disabled={image.id === current.id}>
                  {image.caption || `${t.proofing.open} ${imageIndex + 1}`}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>
      <div className={`viewer-stage ${comparison ? 'is-comparing' : ''}`}>
        <figure className={`viewer-image ${zoom ? 'is-zoomed' : ''}`}>
          <SignedImage src={current.url} alt={current.caption || t.proofing.open} />
          <figcaption>
            <Provenance value={current.provenance} />
          </figcaption>
        </figure>
        {comparison ? (
          <figure className={`viewer-image ${zoom ? 'is-zoomed' : ''}`}>
            <SignedImage src={comparison.url} alt={comparison.caption || t.proofing.open} />
            <figcaption>
              {comparison.caption}
              <Provenance value={comparison.provenance} />
            </figcaption>
          </figure>
        ) : null}
      </div>
      <div className="viewer-navigation">
        <button className="viewer-tool" onClick={() => move(-1)} disabled={images.length < 2}>
          ← {t.proofing.previous}
        </button>
        {canSelect ? (
          <button
            className="viewer-tool viewer-select"
            disabled={!canToggle}
            aria-pressed={selection.includes(current.id)}
            onClick={() => onToggle(current.id)}
          >
            {selection.includes(current.id) ? `✓ ${t.proofing.deselect}` : `+ ${t.proofing.select}`}
          </button>
        ) : (
          <span>{t.proofing.readOnly}</span>
        )}
        <button className="viewer-tool" onClick={() => move(1)} disabled={images.length < 2}>
          {t.proofing.next} →
        </button>
      </div>
      <div className="viewer-filmstrip">
        {images.map((image, imageIndex) => (
          <button
            key={image.id}
            className={imageIndex === index ? 'is-current' : ''}
            aria-label={`${t.proofing.open} ${image.caption || imageIndex + 1}`}
            aria-pressed={imageIndex === index}
            onClick={() => {
              setIndex(imageIndex);
              setZoom(false);
            }}
          >
            <img src={image.url} alt="" loading="lazy" />
            {selection.includes(image.id) ? <span aria-hidden="true">✓</span> : null}
          </button>
        ))}
      </div>
      <p className="viewer-shortcuts">
        {canSelect ? t.proofing.shortcuts : t.proofing.readOnlyShortcuts}
      </p>
    </dialog>
  );
}
