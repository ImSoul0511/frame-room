import { useState } from 'react';

export function GenreSample({ src, alt }: { src: string; alt: string }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <img
      className="genre-sample"
      data-loaded={loaded}
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      onLoad={() => setLoaded(true)}
    />
  );
}
