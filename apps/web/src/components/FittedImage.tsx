import { useState, type CSSProperties, type ImgHTMLAttributes } from 'react';

export function FittedImage({
  src,
  alt,
  onLoad,
  ...props
}: ImgHTMLAttributes<HTMLImageElement> & { src: string; alt: string }) {
  const [dimensions, setDimensions] = useState<{ src: string; ratio: number }>();
  const ratio = dimensions?.src === src ? dimensions.ratio : 0.75;
  return (
    <span className="fitted-image" style={{ '--photo-ratio': ratio } as CSSProperties}>
      <img
        {...props}
        src={src}
        alt={alt}
        onLoad={(event) => {
          const image = event.currentTarget;
          if (image.naturalHeight)
            setDimensions({ src, ratio: image.naturalWidth / image.naturalHeight });
          onLoad?.(event);
        }}
      />
    </span>
  );
}
