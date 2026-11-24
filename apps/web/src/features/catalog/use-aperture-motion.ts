import { useEffect, useRef, useState, type PointerEvent } from 'react';
import {
  GENRE_STEP,
  angularDelta,
  nearestGenreAngle,
  pointerAngle,
  wrapGenre,
} from './aperture-geometry';

export function useApertureMotion() {
  const stage = useRef<HTMLElement>(null);
  const ring = useRef<HTMLDivElement>(null);
  const innerRing = useRef<SVGGElement>(null);
  const target = useRef(0);
  const rotation = useRef(0);
  const ambient = useRef(0);
  const activeStep = useRef(0);
  const manualSelection = useRef(false);
  const interacting = useRef(false);
  const pointer = useRef<{ id: number; angle: number } | null>(null);
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0;
    let lastTime = 0;
    let lastScroll = window.scrollY;
    let visible = false;
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
    });
    if (stage.current) observer.observe(stage.current);
    const onScroll = () => {
      const delta = window.scrollY - lastScroll;
      lastScroll = window.scrollY;
      if (visible && !paused && !pointer.current && !motion.matches)
        target.current += delta * 0.035;
    };
    const animate = (time: number) => {
      const delta = Math.min(time - (lastTime || time), 64);
      lastTime = time;
      if (visible && !document.hidden) {
        const automatic = !paused && !interacting.current && !pointer.current && !motion.matches;
        if (automatic && !manualSelection.current) target.current += delta * 0.0015;
        if (automatic) ambient.current += delta * 0.001;
        const angle =
          motion.matches || pointer.current
            ? target.current
            : rotation.current + (target.current - rotation.current) * (1 - Math.exp(-delta / 320));
        rotation.current = angle;
        if (ring.current) ring.current.style.transform = `rotate(${-angle}deg)`;
        if (innerRing.current) {
          const insideAngle = -angle * 0.32 + ambient.current;
          const scale = 1 + Math.sin((angle * Math.PI) / 90) * 0.025;
          innerRing.current.setAttribute(
            'transform',
            `translate(400 400) rotate(${insideAngle}) scale(${scale}) translate(-400 -400)`,
          );
        }
        if (manualSelection.current && Math.abs(target.current - angle) < 0.2)
          manualSelection.current = false;
        if (
          !manualSelection.current &&
          Math.abs(angle - activeStep.current * GENRE_STEP) > GENRE_STEP * 0.6
        ) {
          activeStep.current = Math.round(angle / GENRE_STEP);
          setActive(wrapGenre(activeStep.current));
        }
      }
      frame = requestAnimationFrame(animate);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    frame = requestAnimationFrame(animate);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('scroll', onScroll);
    };
  }, [paused]);

  const select = (index: number) => {
    target.current = nearestGenreAngle(target.current, index);
    activeStep.current = Math.round(target.current / GENRE_STEP);
    manualSelection.current = true;
    setActive(wrapGenre(index));
  };
  const angleAtPointer = (event: PointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    return pointerAngle(
      event.clientX,
      event.clientY,
      bounds.left + bounds.width / 2,
      bounds.top + bounds.height / 2,
    );
  };
  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!event.isPrimary || event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    pointer.current = { id: event.pointerId, angle: angleAtPointer(event) };
    target.current = rotation.current;
    manualSelection.current = false;
    interacting.current = false;
    setDragging(true);
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (pointer.current?.id !== event.pointerId) return;
    const angle = angleAtPointer(event);
    target.current -= angularDelta(pointer.current.angle, angle);
    pointer.current.angle = angle;
  };
  const onPointerEnd = (event: PointerEvent<HTMLDivElement>) => {
    if (pointer.current?.id !== event.pointerId) return;
    pointer.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
    select(Math.round(target.current / GENRE_STEP));
    setDragging(false);
  };
  const setInteracting = (value: boolean) => {
    interacting.current = value;
  };
  return {
    stage,
    ring,
    innerRing,
    active,
    paused,
    dragging,
    setPaused,
    setInteracting,
    select,
    dragHandlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: onPointerEnd,
      onPointerCancel: onPointerEnd,
      onLostPointerCapture: onPointerEnd,
    },
  };
}
