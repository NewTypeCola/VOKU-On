type Point = { x: number; y: number; time: number };
type Destination = "/archive" | "/board";

// Commit only a deliberate horizontal gesture. Once vertical scrolling starts,
// later sideways drift must never turn it into navigation.
export function createHomeTabSwipe() {
  let start: Point | null = null;
  let horizontal = false;
  const cancel = () => { start = null; horizontal = false; };
  const move = (point: Point) => {
    if (!start) return false;
    const x = Math.abs(point.x - start.x), y = Math.abs(point.y - start.y);
    if (point.time - start.time > 1200) { cancel(); return false; }
    if (!horizontal && Math.max(x, y) >= 12) {
      if (x <= y * 1.7) { cancel(); return false; }
      horizontal = true;
    }
    return horizontal;
  };
  return {
    begin(point: Point, viewportWidth: number) {
      cancel();
      // Leave browser back/forward gestures at the screen edges alone.
      if (point.x <= 24 || point.x >= viewportWidth - 24) return;
      start = point;
    },
    move,
    end(point: Point): Destination | null {
      let destination: Destination | null = null;
      if (move(point) && start) {
        const dx = point.x - start.x, dy = point.y - start.y;
        if (Math.abs(dx) >= 72 && Math.abs(dx) > Math.abs(dy) * 1.7) {
          destination = dx > 0 ? "/archive" : "/board";
        }
      }
      cancel();
      return destination;
    },
    cancel,
  };
}
