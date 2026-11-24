import { useRef, useState, type PointerEvent } from 'react';
import { Action, Modal } from '../../components/ui';
import { useStrings } from '../../lib/i18n';

const clamp = (value: number) => Math.max(-1, Math.min(1, value));

export function AvatarCropDialog({
  source,
  onClose,
  onApply,
}: {
  source: string;
  onClose: () => void;
  onApply: (file: File) => void;
}) {
  const t = useStrings();
  const imageRef = useRef<HTMLImageElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; offsetX: number; offsetY: number } | null>(null);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [x, setX] = useState(0);
  const [y, setY] = useState(0);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const shortest = size ? Math.min(size.width, size.height) : 1;
  const scaledWidth = size ? (size.width / shortest) * zoom : 1;
  const scaledHeight = size ? (size.height / shortest) * zoom : 1;
  const move = (event: PointerEvent<HTMLDivElement>) => {
    if (!drag.current || !stageRef.current) return;
    const width = stageRef.current.getBoundingClientRect().width;
    if (scaledWidth > 1)
      setX(
        clamp(
          drag.current.offsetX +
            (event.clientX - drag.current.x) / ((width * (scaledWidth - 1)) / 2),
        ),
      );
    if (scaledHeight > 1)
      setY(
        clamp(
          drag.current.offsetY +
            (event.clientY - drag.current.y) / ((width * (scaledHeight - 1)) / 2),
        ),
      );
  };
  const apply = async () => {
    const image = imageRef.current;
    if (!image || !size) return;
    setSaving(true);
    setError('');
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 512;
      const context = canvas.getContext('2d');
      if (!context) throw new Error();
      const crop = shortest / zoom;
      context.drawImage(
        image,
        ((size.width - crop) * (1 - x)) / 2,
        ((size.height - crop) * (1 - y)) / 2,
        crop,
        crop,
        0,
        0,
        512,
        512,
      );
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (!blob) throw new Error();
      onApply(new File([blob], 'avatar.png', { type: 'image/png' }));
    } catch {
      setError(t.profileUi.avatarCropError);
      setSaving(false);
    }
  };
  return (
    <Modal title={t.profileUi.editAvatar} onClose={onClose}>
      <div className="avatar-crop-dialog">
        <p className="muted">{t.profileUi.avatarCropHint}</p>
        <div
          className="avatar-crop-stage"
          ref={stageRef}
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            drag.current = { x: event.clientX, y: event.clientY, offsetX: x, offsetY: y };
          }}
          onPointerMove={move}
          onPointerUp={() => {
            drag.current = null;
          }}
          onPointerCancel={() => {
            drag.current = null;
          }}
        >
          <img
            ref={imageRef}
            src={source}
            crossOrigin="anonymous"
            alt=""
            draggable={false}
            onLoad={(event) =>
              setSize({
                width: event.currentTarget.naturalWidth,
                height: event.currentTarget.naturalHeight,
              })
            }
            onError={() => setError(t.profileUi.avatarCropError)}
            style={{
              width: `${scaledWidth * 100}%`,
              height: `${scaledHeight * 100}%`,
              left: `${50 + x * (scaledWidth - 1) * 50}%`,
              top: `${50 + y * (scaledHeight - 1) * 50}%`,
            }}
          />
        </div>
        <label className="avatar-crop-range">
          {t.profileUi.avatarZoom}
          <input
            type="range"
            min="1"
            max="3"
            step="0.01"
            value={zoom}
            onChange={(event) => setZoom(Number(event.target.value))}
          />
        </label>
        <label className="avatar-crop-range">
          {t.profileUi.avatarHorizontal}
          <input
            type="range"
            min="-1"
            max="1"
            step="0.01"
            value={x}
            disabled={scaledWidth <= 1}
            onChange={(event) => setX(Number(event.target.value))}
          />
        </label>
        <label className="avatar-crop-range">
          {t.profileUi.avatarVertical}
          <input
            type="range"
            min="-1"
            max="1"
            step="0.01"
            value={y}
            disabled={scaledHeight <= 1}
            onChange={(event) => setY(Number(event.target.value))}
          />
        </label>
        {error ? (
          <p className="notice error" role="alert">
            {error}
          </p>
        ) : null}
        <div className="row wrap">
          <Action onClick={() => void apply()} pending={saving} disabled={!size}>
            {t.profileUi.applyAvatar}
          </Action>
          <Action secondary onClick={onClose} disabled={saving}>
            {t.cancel}
          </Action>
        </div>
      </div>
    </Modal>
  );
}
