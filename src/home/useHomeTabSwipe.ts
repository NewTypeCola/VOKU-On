import { useEffect, useRef } from "react";
import { createHomeTabSwipe, type HomeSwipeDestination, type HomeSwipeTarget } from "./tabSwipe";

const controls = '[data-home-swipe-ignore], button, input, textarea, select, summary, [contenteditable]:not([contenteditable="false"]), [role="button"], [role="tab"], [role="slider"]';

export function useHomeTabSwipe(
  preview: (target: HomeSwipeTarget | null) => void,
  navigate: (path: HomeSwipeDestination, scrollTop: number) => void,
) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const panel = element.closest<HTMLElement>('[data-home-tab-panel="home"]');
    const stage = panel?.parentElement;
    if (!panel || !stage) return;
    const swipe = createHomeTabSwipe();
    let touchId: number | null = null;
    let suppressClickUntil = 0;
    let target: HomeSwipeTarget | null = null;
    let offset = 0, width = 0, destinationScroll = 0;
    let settling = false, disposed = false, revision = 0, frame = 0;
    let animations: Animation[] = [];
    const variables = ["--home-swipe-offset", "--home-swipe-origin", "--home-swipe-top", "--home-swipe-height"];
    const clearGesture = () => { touchId = null; swipe.cancel(); };
    const clearMotion = () => {
      revision++;
      cancelAnimationFrame(frame);
      animations.forEach(animation => animation.cancel());
      animations = [];
      variables.forEach(name => stage.style.removeProperty(name));
      stage.removeAttribute("data-home-swipe-state");
      target = null;
      offset = 0;
      settling = false;
    };
    const reset = () => { clearGesture(); clearMotion(); preview(null); };
    const paint = (distance: number) => {
      offset = Math.max(-width, Math.min(width, distance));
      if (offset) {
        const next = offset > 0 ? "archive" : "board";
        stage.style.setProperty("--home-swipe-origin", `${next === "archive" ? -width : width}px`);
        if (target !== next) { target = next; preview(next); }
      }
      stage.style.setProperty("--home-swipe-offset", `${offset}px`);
      stage.setAttribute("data-home-swipe-state", "dragging");
    };
    const settle = (destination: HomeSwipeDestination | null) => {
      clearGesture();
      if (!target) { reset(); return; }
      settling = true;
      stage.setAttribute("data-home-swipe-state", "settling");
      const token = ++revision;
      const from = offset;
      const to = destination ? (destination === "/archive" ? width : -width) : 0;
      const origin = target === "archive" ? -width : width;
      const finish = () => {
        if (disposed || token !== revision) return;
        if (destination) navigate(destination, destinationScroll);
        else reset();
      };
      // Let React mount the adjacent, inert panel before starting the release.
      frame = requestAnimationFrame(() => {
        if (disposed || token !== revision) return;
        const adjacent = stage.querySelector<HTMLElement>(`[data-home-tab-panel="${target}"]`);
        if (!adjacent || !panel.animate || window.matchMedia("(prefers-reduced-motion: reduce)").matches) { finish(); return; }
        const options: KeyframeAnimationOptions = {
          duration: 220 + Math.min(1, Math.abs(to - from) / width) * 120,
          easing: "cubic-bezier(.22, .7, .2, 1)", fill: "both",
        };
        animations = [
          panel.animate([{ transform: `translate3d(${from}px, 0, 0)` }, { transform: `translate3d(${to}px, 0, 0)` }], options),
          adjacent.animate([{ transform: `translate3d(${from + origin}px, 0, 0)` }, { transform: `translate3d(${to + origin}px, 0, 0)` }], options),
        ];
        void Promise.all(animations.map(animation => animation.finished)).then(finish).catch(() => {});
      });
    };
    const cancel = () => {
      if (settling) return;
      clearGesture();
      if (target) settle(null);
    };
    const selectedText = () => !!window.getSelection()?.toString();
    const point = (touch: Touch, event: TouchEvent) => ({ x: touch.clientX, y: touch.clientY, time: event.timeStamp });
    const start = (event: TouchEvent) => {
      if (settling) return;
      if (target) { cancel(); return; }
      clearGesture();
      if (event.defaultPrevented || event.touches.length !== 1 || selectedText() ||
        (window.visualViewport?.scale ?? 1) > 1 ||
        !(event.target instanceof Element) || event.target.closest(controls)) return;
      width = panel.getBoundingClientRect().width;
      if (!width) return;
      const tabBottom = stage.querySelector(".site-tab-container")?.getBoundingClientRect().bottom || 0;
      const headerHeight = document.querySelector(".site-header")?.getBoundingClientRect().height || 0;
      destinationScroll = Math.min(window.scrollY, headerHeight);
      stage.style.setProperty("--home-swipe-top", `${Math.max(0, tabBottom - stage.getBoundingClientRect().top)}px`);
      stage.style.setProperty("--home-swipe-height", `${Math.max(0, window.innerHeight - tabBottom)}px`);
      suppressClickUntil = 0;
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
        paint(swipe.offset);
      } else if (target) {
        cancel();
      }
    };
    const end = (event: TouchEvent) => {
      const touch = Array.from(event.changedTouches).find(item => item.identifier === touchId);
      if (!touch || event.touches.length || event.defaultPrevented || selectedText()) { cancel(); return; }
      if (swipe.move(point(touch, event))) paint(swipe.offset);
      const destination = swipe.end(point(touch, event));
      clearGesture();
      if (target && event.cancelable) {
        event.preventDefault();
        suppressClickUntil = Date.now() + 500;
        settle(destination);
      } else cancel();
    };
    const click = (event: MouseEvent) => {
      if (event.detail !== 0 && (settling || Date.now() < suppressClickUntil)) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    element.addEventListener("touchstart", start, { passive: true });
    element.addEventListener("touchmove", move, { passive: false });
    element.addEventListener("touchend", end, { passive: false });
    element.addEventListener("touchcancel", cancel);
    element.addEventListener("click", click, true);
    window.addEventListener("scroll", reset, { passive: true });
    window.addEventListener("resize", reset);
    window.addEventListener("blur", reset);
    document.addEventListener("visibilitychange", reset);
    return () => {
      disposed = true;
      clearGesture();
      clearMotion();
      preview(null);
      element.removeEventListener("touchstart", start);
      element.removeEventListener("touchmove", move);
      element.removeEventListener("touchend", end);
      element.removeEventListener("touchcancel", cancel);
      element.removeEventListener("click", click, true);
      window.removeEventListener("scroll", reset);
      window.removeEventListener("resize", reset);
      window.removeEventListener("blur", reset);
      document.removeEventListener("visibilitychange", reset);
    };
  }, [preview, navigate]);
  return ref;
}
