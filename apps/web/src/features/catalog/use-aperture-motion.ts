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
const COAST_DECAY_MS = 1400;

export function useApertureMotion() {
  const stage = useRef<HTMLElement>(null);
  const ring = useRef<HTMLDivElement>(null);
  const blade = useRef<SVGPathElement>(null);
  const target = useRef(0);
  const rotation = useRef(0);
  const speed = useRef(CRUISE_SPEED);
  const activeStep = useRef(0);
  const manualSelection = useRef(false);
  const interacting = useRef(false);
  const pointer = useRef<{ id: number; angle: number; time: number; velocity: number } | null>(
    null,
  );
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
        if (automatic && !manualSelection.current) {
          const cruise = Math.sign(speed.current) * CRUISE_SPEED;
          const excess = speed.current - cruise;
          const decay = -Math.expm1(-delta / COAST_DECAY_MS);
          target.current += cruise * delta + excess * COAST_DECAY_MS * decay;
          speed.current -= excess * decay;
        }
        const distance = target.current - rotation.current;
        const movement = distance * -Math.expm1(-delta / (manualSelection.current ? 120 : 24));
        const angle =
          motion.matches || Math.abs(distance) < 0.015
            ? target.current
            : rotation.current +
              (manualSelection.current
                ? Math.sign(movement) * Math.min(Math.abs(movement), delta * 0.15)
                : movement);
        if (angle !== rotation.current) {
          rotation.current = angle;
          if (ring.current) ring.current.style.transform = `rotate(${-angle}deg)`;
          blade.current?.setAttribute('transform', bladePivot(angle));
        }
        if (manualSelection.current && Math.abs(target.current - angle) < 0.2)
          manualSelection.current = false;
        if (Math.round(angle / GENRE_STEP) !== activeStep.current) {
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
      time: event.timeStamp,
      velocity: 0,
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
    const travel = angularDelta(angle, drag.angle);
    const elapsed = Math.max(1, event.timeStamp - drag.time);
    const sample = Math.max(-0.45, Math.min(0.45, travel / elapsed));
    // Discard old momentum when the hand reverses direction.
    if (sample * drag.velocity < 0) drag.velocity = 0;
    drag.velocity += (sample - drag.velocity) * -Math.expm1(-elapsed / 45);
    target.current += travel;
    drag.time = event.timeStamp;
    drag.angle = angle;
  };
  const onPointerEnd = (event: PointerEvent<HTMLDivElement>) => {
    const drag = pointer.current;
    if (drag?.id !== event.pointerId) return;
    pointer.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
    if (
      event.type === 'pointerup' &&
      !paused &&
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      const releaseSpeed =
        Math.abs(drag.velocity) * 0.65 * Math.exp(-(event.timeStamp - drag.time) / 100);
      speed.current =
        (Math.sign(drag.velocity) || Math.sign(speed.current)) *
        Math.max(CRUISE_SPEED, Math.min(0.12, releaseSpeed));
    } else {
      select(Math.round(target.current / GENRE_STEP));
    }
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
