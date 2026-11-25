import { useEffect, useState } from 'react';
import { useVisible } from './use-visible';

export function GenreSample({ src, alt }: { src: string; alt: string }) {
  const { ref, visible } = useVisible<HTMLImageElement>();
  const [image, setImage] = useState<{ src: string; url: string }>();
  useEffect(() => {
    if (!visible) return;
    const controller = new AbortController();
    let url: string | undefined;
    async function load() {
      const response = await fetch(src, {
        // Local asset URLs stay the same when a sample is replaced. Vite can revalidate them.
        cache: import.meta.env.DEV ? 'no-cache' : 'force-cache',
        signal: controller.signal,
      });
      if (!response.ok) throw new Error('image unavailable');
      const blob = await response.blob();
      if (controller.signal.aborted) return;
      url = URL.createObjectURL(blob);
      setImage({ src, url });
    }
    void load().catch(() => {
      if (!controller.signal.aborted) setImage({ src, url: src });
    });
    return () => {
      controller.abort();
      if (url) URL.revokeObjectURL(url);
    };
  }, [src, visible]);
  return (
    <img ref={ref} src={image?.src === src ? image.url : undefined} alt={alt} decoding="async" />
  );
}
