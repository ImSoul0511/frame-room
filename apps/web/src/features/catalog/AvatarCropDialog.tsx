import { useRef, useState, type PointerEvent } from 'react';
import { Action, Feedback, Modal } from '../../components/ui';
import { useStrings } from '../../lib/i18n';

const clamp = (value: number) => Math.max(-1, Math.min(1, value));

export function AvatarCropDialog({
  source,
  kind,
  busy,
  uploadError,
  onClose,
  onApply,
  onReplace,
}: {
  source: string;
  kind: 'avatar' | 'cover';
  busy: boolean;
  uploadError: Error | null;
  onClose: () => void;
  onApply: (file: File) => void;
  onReplace: () => void;
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
  const cover = kind === 'cover';
  const ratio = cover ? 3 : 1;
  const cropHeight = size ? Math.min(size.width / ratio, size.height) / zoom : 1;
  const cropWidth = cropHeight * ratio;
  const scaledWidth = size ? size.width / cropWidth : 1;
  const scaledHeight = size ? size.height / cropHeight : 1;
  const move = (event: PointerEvent<HTMLDivElement>) => {
    if (!drag.current || !stageRef.current) return;
    const { width, height } = stageRef.current.getBoundingClientRect();
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
            (event.clientY - drag.current.y) / ((height * (scaledHeight - 1)) / 2),
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
      canvas.width = cover ? 1200 : 512;
      canvas.height = cover ? 400 : 512;
      const context = canvas.getContext('2d');
      if (!context) throw new Error();
      context.drawImage(
        image,
        ((size.width - cropWidth) * (1 - x)) / 2,
        ((size.height - cropHeight) * (1 - y)) / 2,
        cropWidth,
        cropHeight,
        0,
        0,
        canvas.width,
        canvas.height,
      );
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (!blob) throw new Error();
      onApply(new File([blob], `${kind}.png`, { type: 'image/png' }));
    } catch {
      setError(t.profileUi.avatarCropError);
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal
      title={cover ? t.profileUi.changeCover : t.profileUi.editAvatar}
      onClose={() => {
        if (!busy && !saving) onClose();
      }}
    >
      <div className="avatar-crop-dialog">
        <p className="muted">{t.profileUi.avatarCropHint}</p>
        <div
          className={cover ? 'avatar-crop-stage cover-crop-stage' : 'avatar-crop-stage'}
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
        <Feedback error={uploadError} />
        <div className="row wrap">
          <Action onClick={() => void apply()} pending={saving || busy} disabled={!size}>
            {t.profileUi.applyAvatar}
          </Action>
          <Action secondary onClick={onReplace} disabled={saving || busy}>
            {cover ? t.profileUi.chooseCover : t.profileUi.chooseAvatar}
          </Action>
          <Action secondary onClick={onClose} disabled={saving || busy}>
            {t.cancel}
          </Action>
        </div>
      </div>
    </Modal>
  );
}
