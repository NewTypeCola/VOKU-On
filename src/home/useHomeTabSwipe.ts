import { useEffect, useRef } from "react";
import type { Go } from "../community/shared";
import { createHomeTabSwipe } from "./tabSwipe";

const controls = '[data-home-swipe-ignore], button, input, textarea, select, summary, [contenteditable]:not([contenteditable="false"]), [role="button"], [role="tab"], [role="slider"]';

export function useHomeTabSwipe(go: Go) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const swipe = createHomeTabSwipe();
    let touchId: number | null = null;
    let suppressClickUntil = 0;
    const cancel = () => { touchId = null; swipe.cancel(); };
    const selectedText = () => !!window.getSelection()?.toString();
    const point = (touch: Touch, event: TouchEvent) => ({ x: touch.clientX, y: touch.clientY, time: event.timeStamp });
    const start = (event: TouchEvent) => {
      cancel();
      if (event.defaultPrevented || event.touches.length !== 1 || selectedText() ||
        (window.visualViewport?.scale ?? 1) > 1 ||
        !(event.target instanceof Element) || event.target.closest(controls)) return;
      touchId = event.touches[0].identifier;
      swipe.begin(point(event.touches[0], event), window.innerWidth);
    };
    const move = (event: TouchEvent) => {
      if (touchId === null) return;
      if (event.defaultPrevented || event.touches.length !== 1 || !event.cancelable || selectedText()) { cancel(); return; }
      const touch = Array.from(event.touches).find(item => item.identifier === touchId);
      if (touch && swipe.move(point(touch, event))) {
        event.preventDefault();
        suppressClickUntil = Date.now() + 500;
      }
    };
    const end = (event: TouchEvent) => {
      const touch = Array.from(event.changedTouches).find(item => item.identifier === touchId);
      if (!touch || event.touches.length || event.defaultPrevented || selectedText()) { cancel(); return; }
      const destination = swipe.end(point(touch, event));
      cancel();
      if (destination && event.cancelable) {
        event.preventDefault();
        suppressClickUntil = Date.now() + 500;
        go(destination);
      }
    };
    const click = (event: MouseEvent) => {
      if (event.detail !== 0 && Date.now() < suppressClickUntil) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    element.addEventListener("touchstart", start, { passive: true });
    element.addEventListener("touchmove", move, { passive: false });
    element.addEventListener("touchend", end, { passive: false });
    element.addEventListener("touchcancel", cancel);
    element.addEventListener("click", click, true);
    window.addEventListener("scroll", cancel, { passive: true });
    window.addEventListener("blur", cancel);
    document.addEventListener("visibilitychange", cancel);
    return () => {
      element.removeEventListener("touchstart", start);
      element.removeEventListener("touchmove", move);
      element.removeEventListener("touchend", end);
      element.removeEventListener("touchcancel", cancel);
      element.removeEventListener("click", click, true);
      window.removeEventListener("scroll", cancel);
      window.removeEventListener("blur", cancel);
      document.removeEventListener("visibilitychange", cancel);
    };
  }, [go]);
  return ref;
}
