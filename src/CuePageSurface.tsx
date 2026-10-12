import { useEffect, useImperativeHandle, useLayoutEffect, useRef, useState, type ReactNode, type Ref } from "react";
import { clampView, fittedView, pageLayout, panView, pinchView, type PageView, type Point } from "./readerGeometry";

type Gesture =
  | { kind: "pinch"; ids: number[]; distance: number; center: Point; view: PageView }
  | { kind: "pan"; id: number; last: Point; captured: boolean };

export type CuePageControls = {
  zoom: (factor: number) => void;
  fit: () => void;
  restore: (view: PageView) => void;
};

export default function CuePageSurface({
  width, height, angle, page, onActive, onViewChange, controlsRef, children,
}: {
  width: number;
  height: number;
  angle: number;
  page: number;
  onActive: () => void;
  onViewChange?: (view: PageView) => void;
  controlsRef?: Ref<CuePageControls>;
  children: ReactNode;
}) {
  const surface = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<PageView>(fittedView);
  const viewRef = useRef(view);
  const active = useRef(onActive);
  active.current = onActive;
  const changed = useRef(onViewChange);
  changed.current = onViewChange;
  const gesture = useRef<Gesture | null>(null);
  const mouse = useRef<Point | null>(null);
  const layout = pageLayout(width, height, angle);
  const apply = (next: PageView) => {
    if (next.scale === viewRef.current.scale && next.x === viewRef.current.x && next.y === viewRef.current.y) return;
    viewRef.current = next;
    setView(next);
    const el = surface.current;
    if (el?.clientWidth && el.clientHeight) changed.current?.({ scale: next.scale, x: next.x / el.clientWidth, y: next.y / el.clientHeight });
  };
  useImperativeHandle(controlsRef, () => ({
    zoom(factor) {
      const el = surface.current;
      if (!el) return;
      active.current();
      const bounds = { width: el.clientWidth, height: el.clientHeight };
      const rect = el.getBoundingClientRect();
      const toolbar = document.querySelector(".reader-tools")?.getBoundingClientRect().bottom || 0;
      // Enlarge the part actually on screen, not the center of a long sheet below it.
      const center = { x: bounds.width / 2, y: Math.max(0, Math.min(bounds.height, (Math.max(toolbar, rect.top) + Math.min(window.innerHeight, rect.bottom)) / 2 - rect.top)) };
      apply(pinchView(viewRef.current, center, center, viewRef.current.scale * factor, bounds));
    },
    fit: () => apply(fittedView()),
    restore(next) {
      const el = surface.current;
      if (el) apply(clampView({ scale: next.scale, x: next.x * el.clientWidth, y: next.y * el.clientHeight }, { width: el.clientWidth, height: el.clientHeight }));
    },
  }));
  useLayoutEffect(() => {
    gesture.current = null;
    mouse.current = null;
    apply(fittedView());
  }, [angle]);

  useEffect(() => {
    const element = surface.current;
    if (!element) return;
    const bounds = () => ({ width: element.clientWidth, height: element.clientHeight });
    const position = (touch: Touch): Point => ({ x: touch.clientX, y: touch.clientY });
    const local = (point: Point): Point => {
      const rect = element.getBoundingClientRect();
      return { x: point.x - rect.left, y: point.y - rect.top };
    };
    const pair = (a: Touch, b: Touch) => ({
      distance: Math.max(1, Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)),
      center: local({ x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2 }),
    });
    // Both fingers must start on this sheet; a neighboring sheet never joins it.
    const owned = (event: TouchEvent) => Array.from(event.touches)
      .filter(touch => touch.target instanceof Node && element.contains(touch.target));
    const beginPinch = (touches: Touch[]) => {
      const [a, b] = touches;
      gesture.current = { kind: "pinch", ids: [a.identifier, b.identifier], ...pair(a, b), view: { ...viewRef.current } };
    };
    const start = (event: TouchEvent) => {
      active.current();
      const touches = owned(event);
      if (touches.length >= 2) {
        if (event.cancelable) event.preventDefault();
        beginPinch(touches);
      } else if (touches.length === 1) {
        gesture.current = { kind: "pan", id: touches[0].identifier, last: position(touches[0]), captured: false };
      }
      // A stationary single touch remains native, including image long-press.
    };
    const move = (event: TouchEvent) => {
      const touches = owned(event);
      if (touches.length >= 2) {
        if (event.cancelable) event.preventDefault();
        let current = gesture.current;
        if (current?.kind !== "pinch" || !current.ids.every(id => touches.some(t => t.identifier === id))) {
          beginPinch(touches);
          current = gesture.current;
        }
        if (current?.kind !== "pinch") return;
        const a = touches.find(t => t.identifier === current.ids[0])!;
        const b = touches.find(t => t.identifier === current.ids[1])!;
        const next = pair(a, b);
        apply(pinchView(current.view, current.center, next.center, current.view.scale * next.distance / current.distance, bounds()));
      } else if (touches.length === 1 && gesture.current?.kind === "pan") {
        const current = gesture.current;
        const point = position(touches[0]);
        const delta = { x: point.x - current.last.x, y: point.y - current.last.y };
        current.last = point;
        if (viewRef.current.scale <= 1 && !current.captured) return;
        if (event.cancelable) event.preventDefault();
        const next = panView(viewRef.current, delta, bounds());
        apply(next.view);
        // At the image edge, keep moving through the continuous document.
        if (Math.abs(delta.y) >= Math.abs(delta.x) && next.overflowY)
          window.scrollBy({ top: -next.overflowY, behavior: "instant" });
      }
    };
    const end = (event: TouchEvent) => {
      const touches = owned(event);
      const wasCaptured = gesture.current?.kind === "pinch" ||
        (gesture.current?.kind === "pan" && gesture.current.captured);
      if (touches.length >= 2) beginPinch(touches);
      else if (touches.length === 1) gesture.current = {
        kind: "pan", id: touches[0].identifier, last: position(touches[0]), captured: !!wasCaptured,
      };
      else gesture.current = null;
    };
    const cancel = () => { gesture.current = null; };
    const wheel = (event: WheelEvent) => {
      if (!event.ctrlKey) return;
      event.preventDefault();
      active.current();
      const point = local({ x: event.clientX, y: event.clientY });
      const pixels = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? element.clientHeight : 1);
      apply(pinchView(viewRef.current, point, point, viewRef.current.scale * Math.exp(-pixels * .01), bounds()));
    };
    element.addEventListener("touchstart", start, { passive: false });
    element.addEventListener("touchmove", move, { passive: false });
    element.addEventListener("touchend", end);
    element.addEventListener("touchcancel", cancel);
    element.addEventListener("wheel", wheel, { passive: false });
    let previousBounds = bounds();
    const resize = new ResizeObserver(() => {
      const next = bounds();
      apply(clampView({ ...viewRef.current,
        x: previousBounds.width ? viewRef.current.x * next.width / previousBounds.width : 0,
        y: previousBounds.height ? viewRef.current.y * next.height / previousBounds.height : 0,
      }, next));
      previousBounds = next;
    });
    resize.observe(element);
    return () => {
      element.removeEventListener("touchstart", start);
      element.removeEventListener("touchmove", move);
      element.removeEventListener("touchend", end);
      element.removeEventListener("touchcancel", cancel);
      element.removeEventListener("wheel", wheel);
      resize.disconnect();
    };
  }, []);

  return (
    <div
      ref={surface}
      className={`cue-sheet ${view.scale > 1 ? "is-magnified" : ""}`}
      style={{ aspectRatio: layout.aspectRatio, touchAction: view.scale > 1 ? "none" : "pan-y" }}
      data-scale={view.scale.toFixed(3)}
      data-rotation={angle}
      tabIndex={0}
      role="group"
      aria-label={`${page}쪽 이미지`}
      aria-describedby="cue-gesture-help"
      onFocus={() => active.current()}
      onKeyDown={event => {
        if (event.target !== event.currentTarget) return;
        const element = event.currentTarget;
        const bounds = { width: element.clientWidth, height: element.clientHeight };
        const center = { x: bounds.width / 2, y: bounds.height / 2 };
        if (["+", "=", "-"].includes(event.key)) {
          event.preventDefault();
          apply(pinchView(viewRef.current, center, center, viewRef.current.scale * (event.key === "-" ? .8 : 1.25), bounds));
        } else if (["0", "Escape"].includes(event.key)) {
          event.preventDefault();
          apply(fittedView());
        } else if (viewRef.current.scale > 1 && event.key.startsWith("Arrow")) {
          event.preventDefault();
          const delta = { x: event.key === "ArrowLeft" ? 40 : event.key === "ArrowRight" ? -40 : 0, y: event.key === "ArrowUp" ? 40 : event.key === "ArrowDown" ? -40 : 0 };
          const next = panView(viewRef.current, delta, bounds);
          apply(next.view);
          if (next.overflowY) window.scrollBy({ top: -next.overflowY, behavior: "instant" });
        }
      }}
      onPointerDown={event => {
        if (event.pointerType !== "mouse" || event.button !== 0 || viewRef.current.scale <= 1) return;
        event.preventDefault();
        active.current();
        mouse.current = { x: event.clientX, y: event.clientY };
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={event => {
        if (!mouse.current || event.pointerType !== "mouse") return;
        const delta = { x: event.clientX - mouse.current.x, y: event.clientY - mouse.current.y };
        mouse.current = { x: event.clientX, y: event.clientY };
        apply(panView(viewRef.current, delta, { width: event.currentTarget.clientWidth, height: event.currentTarget.clientHeight }).view);
      }}
      onPointerUp={() => { mouse.current = null; }}
      onPointerCancel={() => { mouse.current = null; }}
      onLostPointerCapture={() => { mouse.current = null; }}
    >
      <div className="cue-sheet-zoom" style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})` }}>
        <div className="cue-sheet-image" style={{ width: `${layout.imageWidthPercent}%`, transform: `translate(-50%, -50%) rotate(${angle}deg)` }}>
          {children}
        </div>
      </div>
    </div>
  );
}
