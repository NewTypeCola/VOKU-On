import type { ArchiveRecord } from "./data";
import type { RingScene } from "./ringScene";

let modulePromise: Promise<typeof import("./ringScene")> | undefined;
export function preloadTimeRing() {
  return modulePromise ??= import("./ringScene").catch((error) => {
    modulePromise = undefined;
    throw error;
  });
}

// One reusable canvas/GPU scene. Leaving the archive stops all animation work.
let resident: { scene: RingScene; canvas: HTMLCanvasElement; catalog: ArchiveRecord[]; years: string } | undefined;
let expiry: ReturnType<typeof setTimeout> | undefined;
export function mountTimeRing(
  host: HTMLDivElement, Scene: typeof RingScene, catalog: ArchiveRecord[], years: number[],
  year: number, change: (year: number) => void, unavailable: () => void,
) {
  clearTimeout(expiry);
  const yearKey = years.join(",");
  if (resident && (resident.catalog !== catalog || resident.years !== yearKey || !resident.scene.usable)) {
    resident.scene.dispose();
    resident.canvas.remove();
    resident = undefined;
  }
  if (!resident) {
    const canvas = document.createElement("canvas");
    canvas.className = "time-ring-canvas";
    canvas.setAttribute("aria-hidden", "true");
    host.append(canvas);
    try {
      const scene = new Scene(canvas, catalog, years, year, change, unavailable);
      resident = { scene, canvas, catalog, years: yearKey };
    } catch (error) {
      canvas.remove();
      throw error;
    }
  } else {
    host.append(resident.canvas);
    resident.scene.resume(change, unavailable);
    resident.scene.setYear(year);
  }
  const current = resident;
  return {
    scene: current.scene,
    release() {
      if (current.canvas.parentElement !== host) return;
      current.scene.suspend();
      current.canvas.remove();
      // Release GPU memory if the archive is not revisited for two minutes.
      expiry = setTimeout(() => {
        if (resident !== current) return;
        current.scene.dispose();
        resident = undefined;
      }, 120000);
    },
  };
}
