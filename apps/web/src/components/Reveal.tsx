import { useEffect, useRef, type ReactNode } from 'react';

export function Reveal({
  children,
  className = '',
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = ref.current;
    if (
      !node ||
      !('IntersectionObserver' in window) ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      node?.classList.add('is-revealed');
      return;
    }
    node.classList.add('reveal-ready');
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          node.classList.remove('reveal-ready');
          node.classList.add('is-revealed');
          observer.disconnect();
        }
      },
      { rootMargin: '0px 0px -32px 0px', threshold: 0.08 },
    );
    const frame = requestAnimationFrame(() => observer.observe(node));
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      node.classList.remove('reveal-ready');
    };
  }, []);
  return (
    <div
      ref={ref}
      className={`scroll-reveal ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}
