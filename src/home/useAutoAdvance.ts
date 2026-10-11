import { useEffect, useRef, useState, type FocusEvent, type KeyboardEvent, type PointerEvent, type RefObject } from "react";

// The timer and its CSS progress animation share a cycle and pause together.
// Pausing preserves the remaining time; selecting an item starts a new cycle.
export function useAutoAdvance<T extends HTMLElement>({
  interval, itemKey, advance, enabled = true, visibilityRef,
}: {
  interval: number; itemKey: string | number; advance: () => void; enabled?: boolean;
  visibilityRef?: RefObject<HTMLElement | null>;
}) {
  const ref = useRef<T>(null);
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const [playing, setPlaying] = useState(() => !window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const [hovered, setHovered] = useState(false);
  const [keyboardFocus, setKeyboardFocus] = useState(false);
  const [interacting, setInteracting] = useState(false);
  const [visible, setVisible] = useState(() => !document.hidden);
  const [inView, setInView] = useState(false);
  const [revision, setRevision] = useState(0);
  const cycle = `${itemKey}:${revision}`;
  const elapsed = useRef({ cycle, time: 0 });
  const onAdvance = useRef(advance);
  onAdvance.current = advance;
  const running = enabled && playing && !hovered && !keyboardFocus && !interacting && visible && inView;

  useEffect(() => {
    const visibility = () => setVisible(!document.hidden);
    const release = () => setInteracting(false);
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const motionChange = () => {
      setReducedMotion(motion.matches);
      if (motion.matches) setPlaying(false);
    };
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting && entry.intersectionRatio >= 0.5), { threshold: [0, 0.5] });
    const target = visibilityRef?.current || ref.current;
    if (target) observer.observe(target);
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("pointerup", release);
    window.addEventListener("pointercancel", release);
    window.addEventListener("blur", release);
    motion.addEventListener("change", motionChange);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("pointerup", release);
      window.removeEventListener("pointercancel", release);
      window.removeEventListener("blur", release);
      motion.removeEventListener("change", motionChange);
    };
  }, [visibilityRef]);

  useEffect(() => {
    if (elapsed.current.cycle !== cycle) elapsed.current = { cycle, time: 0 };
    if (!running) return;
    const started = performance.now();
    const timer = window.setTimeout(() => {
      elapsed.current.time = interval;
      onAdvance.current();
    }, Math.max(0, interval - elapsed.current.time));
    return () => {
      window.clearTimeout(timer);
      elapsed.current.time = Math.min(interval, elapsed.current.time + performance.now() - started);
    };
  }, [running, interval, cycle]);

  const toggle = () => {
    if (!playing) setKeyboardFocus(false);
    setPlaying((value) => !value);
  };
  return {
    ref, running, playing, reducedMotion, visible, inView, cycle,
    restart: () => setRevision((value) => value + 1),
    toggle,
    interaction: {
      onPointerEnter: (event: PointerEvent<T>) => { if (event.pointerType === "mouse") setHovered(true); },
      onPointerLeave: (event: PointerEvent<T>) => { if (event.pointerType === "mouse") setHovered(false); },
      onPointerDownCapture: () => setInteracting(true),
      onFocusCapture: (event: FocusEvent<T>) => setKeyboardFocus(event.target.matches(":focus-visible")),
      onBlurCapture: (event: FocusEvent<T>) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setKeyboardFocus(false);
      },
      onKeyDownCapture: (event: KeyboardEvent<T>) => { if (event.key === "Tab") setKeyboardFocus(true); },
    },
  };
}
