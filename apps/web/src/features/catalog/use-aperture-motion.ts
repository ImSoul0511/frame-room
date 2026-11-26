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
const DRAG_THRESHOLD = 1;
const DRAG_PREVIEW_LIMIT = GENRE_STEP * 0.75;

export function useApertureMotion() {
  const stage = useRef<HTMLElement>(null);
  const ring = useRef<HTMLDivElement>(null);
  const blade = useRef<SVGPathElement>(null);
  const target = useRef(0);
  const rotation = useRef(0);
  const direction = useRef(1);
  const activeStep = useRef(0);
  const manualSelection = useRef(false);
  const interacting = useRef(false);
  const pauseRequested = useRef(false);
  const wake = useRef<() => void>(() => {});
  const pointer = useRef<{ id: number; angle: number; start: number; travel: number } | null>(null);
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0;
    let lastTime: number | undefined;
    let visible = false;
    const cruising = () =>
      visible && !pauseRequested.current && !interacting.current && !motion.matches;
    const schedule = () => {
      if (frame) return;
      if (!document.hidden && (manualSelection.current || pointer.current || cruising())) {
        frame = requestAnimationFrame(animate);
      } else {
        lastTime = undefined;
      }
    };
    const animate = (time: number) => {
      frame = 0;
      // Limit the advance after a dropped frame so the lens never jumps to catch up.
      const delta = Math.min(time - (lastTime ?? time), 32);
      lastTime = time;
      let angle = rotation.current;
      let step = activeStep.current;
      const selecting = manualSelection.current;
      if (!document.hidden && (selecting || pointer.current)) {
        const distance = target.current - angle;
        const movement = distance * -Math.expm1(-delta / (selecting ? 120 : 24));
        angle =
          motion.matches || Math.abs(distance) < 0.2
            ? target.current
            : angle +
              (selecting
                ? Math.sign(movement) * Math.min(Math.abs(movement), delta * 0.15)
                : movement);
        if (selecting && angle === target.current) {
          manualSelection.current = false;
          step = Math.round(angle / GENRE_STEP);
        }
      } else if (!document.hidden && cruising()) {
        angle += direction.current * CRUISE_SPEED * delta;
        target.current = angle;
        const nextStep = step + direction.current;
        if ((angle - nextStep * GENRE_STEP) * direction.current >= 0) step = nextStep;
      }
      if (angle !== rotation.current) {
        rotation.current = angle;
        if (ring.current) ring.current.style.transform = `rotate(${-angle}deg)`;
        blade.current?.setAttribute('transform', bladePivot(angle));
      }
      if (step !== activeStep.current) {
        activeStep.current = step;
        setActive(wrapGenre(step));
      }
      schedule();
    };
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      schedule();
    });
    if (stage.current) observer.observe(stage.current);
    const onVisibilityChange = () => {
      lastTime = undefined;
      schedule();
    };
    wake.current = schedule;
    document.addEventListener('visibilitychange', onVisibilityChange);
    motion.addEventListener('change', schedule);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      document.removeEventListener('visibilitychange', onVisibilityChange);
      motion.removeEventListener('change', schedule);
    };
  }, []);

  const select = (index: number) => {
    target.current = nearestGenreAngle(target.current, index);
    manualSelection.current = true;
    direction.current = Math.sign(target.current - rotation.current) || direction.current;
    wake.current();
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
    wake.current();
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
    wake.current();
  };
  const updatePaused = (value: boolean) => {
    pauseRequested.current = value;
    setPaused(value);
    wake.current();
  };
  return {
    stage,
    ring,
    blade,
    active,
    paused,
    dragging,
    setPaused: updatePaused,
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
