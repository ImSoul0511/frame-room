import { useEffect, useRef, useState, type PointerEvent } from 'react';
import {
  GENRE_STEP,
  angularDelta,
  bladePivot,
  nearestGenreAngle,
  pointerAngle,
  wrapGenre,
} from './aperture-geometry';

const CRUISE_SPEED = 0.0035; // degrees per millisecond
const SETTLE_HOLD_MS = 420;
const DRAG_THRESHOLD = 1;
const DRAG_PREVIEW_LIMIT = GENRE_STEP * 0.75;

export function useApertureMotion() {
  const stage = useRef<HTMLElement>(null);
  const ring = useRef<HTMLDivElement>(null);
  const blade = useRef<SVGPathElement>(null);
  const target = useRef(0);
  const rotation = useRef(0);
  const speed = useRef(CRUISE_SPEED);
  const activeStep = useRef(0);
  const manualSelection = useRef(false);
  const holdUntil = useRef(0);
  const interacting = useRef(false);
  const pointer = useRef<{ id: number; angle: number; start: number; travel: number } | null>(null);
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
      if (visible && !paused && !pointer.current && !manualSelection.current && !motion.matches)
        target.current += delta * 0.035;
    };
    const animate = (time: number) => {
      const delta = Math.min(time - (lastTime || time), 64);
      lastTime = time;
      if (visible && !document.hidden && (time >= holdUntil.current || motion.matches)) {
        const automatic = !paused && !interacting.current && !pointer.current && !motion.matches;
        const boundary = activeStep.current * GENRE_STEP;
        const selecting = manualSelection.current;
        if (!selecting && !pointer.current) {
          if (automatic) target.current += speed.current * delta;
          target.current = Math.max(
            boundary - GENRE_STEP,
            Math.min(boundary + GENRE_STEP, target.current),
          );
        }
        const distance = target.current - rotation.current;
        const movement = distance * -Math.expm1(-delta / (selecting ? 120 : 24));
        const angle =
          motion.matches || Math.abs(distance) < 0.2
            ? target.current
            : rotation.current +
              (selecting
                ? Math.sign(movement) * Math.min(Math.abs(movement), delta * 0.15)
                : movement);
        if (angle !== rotation.current) {
          rotation.current = angle;
          if (ring.current) ring.current.style.transform = `rotate(${-angle}deg)`;
          blade.current?.setAttribute('transform', bladePivot(angle));
        }
        if (
          !pointer.current &&
          angle === target.current &&
          (selecting || Math.abs(angle - boundary) >= GENRE_STEP)
        ) {
          // Commit at a blade endpoint and hold it while React renders the next genre.
          manualSelection.current = false;
          const step = Math.round(angle / GENRE_STEP);
          if (step !== activeStep.current) {
            holdUntil.current = time + SETTLE_HOLD_MS;
            activeStep.current = step;
            setActive(wrapGenre(step));
          }
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
    manualSelection.current = true;
    speed.current =
      (Math.sign(target.current - rotation.current) || Math.sign(speed.current)) * CRUISE_SPEED;
  };
  const stepBy = (offset: number) => {
    const from = manualSelection.current
      ? Math.round(target.current / GENRE_STEP)
      : activeStep.current;
    select(from + offset);
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
    pointer.current = {
      id: event.pointerId,
      angle: angleAtPointer(event),
      start: rotation.current,
      travel: 0,
    };
    target.current = rotation.current;
    manualSelection.current = false;
    interacting.current = false;
    setDragging(true);
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = pointer.current;
    if (drag?.id !== event.pointerId) return;
    const angle = angleAtPointer(event);
    drag.travel += angularDelta(drag.angle, angle);
    drag.angle = angle;
    const boundary = activeStep.current * GENRE_STEP;
    target.current = Math.max(
      boundary - DRAG_PREVIEW_LIMIT,
      Math.min(boundary + DRAG_PREVIEW_LIMIT, drag.start + drag.travel),
    );
  };
  const onPointerEnd = (event: PointerEvent<HTMLDivElement>) => {
    const drag = pointer.current;
    if (drag?.id !== event.pointerId) return;
    pointer.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
    const move = event.type === 'pointerup' && Math.abs(drag.travel) >= DRAG_THRESHOLD;
    select(activeStep.current + (move ? Math.sign(drag.travel) : 0));
    setDragging(false);
  };
  const setInteracting = (value: boolean) => {
    interacting.current = value;
  };
  return {
    stage,
    ring,
    blade,
    active,
    paused,
    dragging,
    setPaused,
    setInteracting,
    select,
    stepBy,
    dragHandlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: onPointerEnd,
      onPointerCancel: onPointerEnd,
      onLostPointerCapture: onPointerEnd,
    },
  };
}
