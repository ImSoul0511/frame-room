import { useEffect, useRef, useState, type ReactNode } from 'react';

export function ScrollHeader({
  children,
  fixed = false,
}: {
  children: ReactNode;
  fixed?: boolean;
}) {
  const header = useRef<HTMLElement>(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (fixed) return;
    let frame = 0;
    let previousY = window.scrollY;
    let travel = 0;

    const update = () => {
      frame = 0;
      const maximumY = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
      const currentY = Math.max(0, Math.min(window.scrollY, maximumY));
      const delta = currentY - previousY;
      previousY = currentY;
      const element = header.current;
      if (!element) return;

      // Keep controls available while editing, navigating or using an open menu.
      if (
        currentY <= element.offsetHeight ||
        element.contains(document.activeElement) ||
        element.querySelector('details[open], [aria-expanded="true"]')
      ) {
        travel = 0;
        setHidden(false);
        return;
      }

      if (!delta) return;
      travel = Math.sign(delta) === Math.sign(travel) ? travel + delta : delta;
      // Ignore tiny scroll reversals so a touchpad does not flicker the header.
      if (Math.abs(travel) >= 12) {
        setHidden(travel > 0);
        travel = 0;
      }
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.cancelAnimationFrame(frame);
    };
  }, [fixed]);

  return (
    <header
      className={`site-header-shell${hidden ? ' is-hidden' : ''}`}
      ref={header}
      onFocusCapture={() => setHidden(false)}
    >
      {children}
    </header>
  );
}
