export type PageView = { scale: number; x: number; y: number };
export type Point = { x: number; y: number };
export type PageBounds = { width: number; height: number };
export const fittedView = (): PageView => ({ scale: 1, x: 0, y: 0 });
export const limitScale = (scale: number) => Math.min(4, Math.max(1, scale));

export function clampView(view: PageView, bounds: PageBounds): PageView {
  const scale = limitScale(view.scale);
  return {
    scale,
    x: Math.min(0, Math.max(bounds.width * (1 - scale), view.x)),
    y: Math.min(0, Math.max(bounds.height * (1 - scale), view.y)),
  };
}

// Keep the document point between the fingers under their moving midpoint.
export function pinchView(
  start: PageView,
  startPoint: Point,
  nextPoint: Point,
  scale: number,
  bounds: PageBounds,
): PageView {
  const nextScale = limitScale(scale);
  const ratio = nextScale / start.scale;
  return clampView({
    scale: nextScale,
    x: nextPoint.x - (startPoint.x - start.x) * ratio,
    y: nextPoint.y - (startPoint.y - start.y) * ratio,
  }, bounds);
}

export function panView(start: PageView, delta: Point, bounds: PageBounds) {
  const wanted = { ...start, x: start.x + delta.x, y: start.y + delta.y };
  const view = clampView(wanted, bounds);
  return { view, overflowY: wanted.y - view.y };
}

export function pageLayout(width: number, height: number, angle: number) {
  const sideways = Math.abs(angle / 90) % 2 === 1;
  return {
    aspectRatio: sideways ? height / width : width / height,
    imageWidthPercent: sideways ? width / height * 100 : 100,
  };
}

export function episodeLink(href: string, recordId: string) {
  const url = new URL(href);
  url.search = "";
  url.hash = `/read/${encodeURIComponent(recordId)}`;
  return url.href;
}
