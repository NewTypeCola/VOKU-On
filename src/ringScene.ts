import * as THREE from "three";
import type { ArchiveRecord } from "./data";
import { RingVisitors, VISITOR_ACTIONS } from "./ringVisitors";

const TAU = Math.PI * 2;
const mod = (n: number, size: number) => ((n % size) + size) % size;
const PAPER = "#ede4cd";
const COVERS = ["#9aab94", "#bba776", "#a7b8ba", "#bf957c", "#929f8c", "#b6af9b"];

/** One paper bundle per real catalog record. No scan textures or OCR are loaded. */
export class RingScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.OrthographicCamera(-12, 12, 10, -10, .1, 100);
  private root = new THREE.Group();
  private visitors = new RingVisitors();
  private covers: THREE.InstancedMesh;
  private paper: THREE.InstancedMesh;
  private color = new THREE.Color();
  private yearsByInstance: number[] = [];
  private coverColors: THREE.Color[] = [];
  private resizeObserver: ResizeObserver;
  private intersectionObserver: IntersectionObserver;
  private abort = new AbortController();
  private rotation = 0;
  private target = 0;
  private selected: number;
  private frame = 0;
  private paused = false;
  private animationTime = 0;
  private previousTime = 0;
  private visible = true;
  private reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  private motion = matchMedia("(prefers-reduced-motion: reduce)");
  private drag: { id: number; x: number; y: number; rotation: number; moved: boolean; vertical: boolean } | null = null;
  private disposed = false;
  private active = true;
  private lost = false;
  get usable() { return !this.disposed && !this.lost; }

  constructor(
    private canvas: HTMLCanvasElement,
    catalog: ArchiveRecord[],
    private years: number[],
    year: number,
    private change: (year: number) => void,
    private unavailable: () => void,
  ) {
    this.selected = year;
    canvas.dataset.sceneCreatedAt = String(Date.now());
    this.rotation = this.target = -years.indexOf(year) / years.length * TAU;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = .98;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.shadowMap.autoUpdate = false;
    this.renderer.shadowMap.needsUpdate = true;
    this.camera.position.set(0, 29, 25);
    this.camera.lookAt(0, 0, 0);
    this.scene.add(new THREE.HemisphereLight("#fff9e9", "#7b8b73", 1.85));
    const sun = new THREE.DirectionalLight("#fff4da", 2.7);
    sun.position.set(-12, 24, 10);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, { left: -13, right: 13, top: 13, bottom: -13, near: 1, far: 60 });
    sun.shadow.bias = -.001;
    sun.shadow.normalBias = .035;
    this.scene.add(sun);
    const rim = new THREE.DirectionalLight("#f4f8ff", 1.2);
    rim.position.set(10, 8, -10);
    this.scene.add(rim, this.root);
    this.root.add(this.visitors.group);
    canvas.dataset.visitorCount = String(this.visitors.count);
    canvas.dataset.visitorActions = VISITOR_ACTIONS.join(",");

    const textureCanvas = document.createElement("canvas");
    textureCanvas.width = 32; textureCanvas.height = 128;
    const ctx = textureCanvas.getContext("2d")!;
    ctx.fillStyle = PAPER; ctx.fillRect(0, 0, 32, 128);
    for (let y = 0; y < 128; y += 5) {
      ctx.fillStyle = y % 15 === 0 ? "#bdb39d" : "#d4c9b2";
      ctx.fillRect(0, y, 32, 1);
    }
    const texture = new THREE.CanvasTexture(textureCanvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    this.paper = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({ map: texture, roughness: .9 }), catalog.length);
    this.covers = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({ roughness: .8 }), catalog.length);
    this.paper.castShadow = true; this.paper.receiveShadow = true;
    this.covers.castShadow = true;
    this.paper.frustumCulled = this.covers.frustumCulled = false;
    this.root.add(this.paper, this.covers);
    const dummy = new THREE.Object3D();
    let index = 0;
    const byYear = new Map<number, ArchiveRecord[]>();
    for (const record of catalog) {
      const group = byYear.get(record.year) || [];
      group.push(record);
      byYear.set(record.year, group);
    }
    for (const [yi, y] of years.entries()) {
      const records = (byYear.get(y) || [])
        .sort((a, b) => a.term - b.term || a.slug.localeCompare(b.slug) || a.issue.localeCompare(b.issue, "ko", { numeric: true }));
      const lanes = 12;
      const columns = Math.ceil(records.length / lanes);
      records.forEach((record, ordinal) => {
        const lane = ordinal % lanes;
        const a = (yi + ((Math.floor(ordinal / lanes) + .5) / columns - .5) * .89) / years.length * TAU;
        const r = 5.45 + lane * .36;
        const width = Math.min(.16, r * TAU / years.length / columns * .77);
        const height = .22 + Math.min(record.pages, 110) * .028;
        const base = .07;
        dummy.position.set(Math.sin(a) * r, base + height / 2, Math.cos(a) * r);
        dummy.rotation.set(0, a, 0);
        dummy.scale.set(width, height, .29);
        dummy.updateMatrix(); this.paper.setMatrixAt(index, dummy.matrix);
        dummy.position.y = base + height + .022;
        dummy.scale.set(width + .012, .045, .31);
        dummy.updateMatrix(); this.covers.setMatrixAt(index, dummy.matrix);
        let hash = 0;
        for (const char of record.slug) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
        this.coverColors.push(new THREE.Color(COVERS[hash % COVERS.length]));
        this.yearsByInstance.push(y);
        index++;
      });
    }
    this.highlight(year);

    const guides: THREE.Vector3[] = [];
    for (let i = 0; i < years.length * 4; i++) {
      const a = (i / 4 - .5) / years.length * TAU;
      const length = i % 4 === 0 ? .28 : .1;
      guides.push(new THREE.Vector3(Math.sin(a) * 10.15, .01, Math.cos(a) * 10.15),
        new THREE.Vector3(Math.sin(a) * (10.15 + length), .01, Math.cos(a) * (10.15 + length)));
    }
    this.root.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(guides),
      new THREE.LineBasicMaterial({ color: "#919888", transparent: true, opacity: .6 })));
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(100, 100), new THREE.ShadowMaterial({ opacity: .16 }));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);
    const pointer = new THREE.Mesh(new THREE.ConeGeometry(.15, .42, 3), new THREE.MeshBasicMaterial({ color: "#a85939" }));
    pointer.rotation.x = -Math.PI / 2;
    pointer.position.set(0, .02, 10.8);
    this.scene.add(pointer);

    const signal = this.abort.signal;
    canvas.addEventListener("pointerdown", this.down, { signal });
    canvas.addEventListener("pointermove", this.move, { signal });
    canvas.addEventListener("pointerup", this.up, { signal });
    canvas.addEventListener("pointercancel", this.cancel, { signal });
    canvas.addEventListener("lostpointercapture", this.cancel, { signal });
    canvas.addEventListener("webglcontextlost", (event) => { event.preventDefault(); this.lost = true; this.visible = false; this.unavailable(); }, { signal });
    this.motion.addEventListener("change", () => { this.reduced = this.motion.matches; this.previousTime = 0; this.request(); }, { signal });
    document.addEventListener("visibilitychange", () => { this.previousTime = 0; if (!document.hidden) this.request(); }, { signal });
    this.resizeObserver = new ResizeObserver(this.resize);
    this.resizeObserver.observe(canvas);
    this.intersectionObserver = new IntersectionObserver(([entry]) => {
      this.visible = entry.isIntersecting; this.previousTime = 0;
      if (this.visible) this.request();
    });
    this.intersectionObserver.observe(canvas);
    this.resize();
  }

  private highlight(year: number) {
    this.selected = year;
    this.yearsByInstance.forEach((y, index) => {
      this.color.copy(this.coverColors[index]);
      if (y === year) this.color.set("#285f48");
      this.covers.setColorAt(index, this.color);
      this.paper.setColorAt(index, this.color.set(y === year ? "#c3d5b8" : "#ffffff"));
    });
    this.covers.instanceColor!.needsUpdate = true;
    this.paper.instanceColor!.needsUpdate = true;
  }

  setYear(year: number) {
    if (this.selected !== year) this.highlight(year);
    if (this.drag?.moved) return;
    const angle = -this.years.indexOf(year) / this.years.length * TAU;
    this.target += Math.atan2(Math.sin(angle - this.target), Math.cos(angle - this.target));
    this.request();
  }

  suspend() {
    this.active = false;
    cancelAnimationFrame(this.frame);
    this.frame = 0;
    this.previousTime = 0;
  }

  resume(change: (year: number) => void, unavailable: () => void) {
    this.change = change;
    this.unavailable = unavailable;
    this.active = true;
    this.visible = true;
    this.previousTime = 0;
    this.resize();
  }

  setPaused(paused: boolean) {
    this.paused = paused;
    this.previousTime = 0;
    this.request();
  }

  private resize = () => {
    // CSS page transforms must not lower the canvas resolution when the menu closes.
    const width = this.canvas.clientWidth, height = this.canvas.clientHeight;
    if (!width || !height) return;
    this.renderer.setSize(width, height, false);
    // Let the paper ring extend past both sides of the mobile viewport.
    const halfWidth = 7.1;
    const halfHeight = halfWidth * height / width;
    this.camera.left = -halfWidth; this.camera.right = halfWidth;
    this.camera.top = halfHeight; this.camera.bottom = -halfHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.shadowMap.needsUpdate = true;
    this.request();
  };

  private down = (event: PointerEvent) => {
    if (!event.isPrimary || event.button !== 0) return;
    this.drag = { id: event.pointerId, x: event.clientX, y: event.clientY, rotation: this.target, moved: false, vertical: false };
  };
  private move = (event: PointerEvent) => {
    const d = this.drag;
    if (!d || d.id !== event.pointerId || d.vertical) return;
    const dx = event.clientX - d.x, dy = event.clientY - d.y;
    if (!d.moved) {
      if (Math.hypot(dx, dy) < 6) return;
      if (Math.abs(dy) > Math.abs(dx)) { d.vertical = true; return; }
      d.moved = true;
      this.canvas.setPointerCapture(event.pointerId);
      this.canvas.classList.add("is-dragging");
    }
    this.target = d.rotation + dx * .009;
    const index = mod(Math.round(-this.target / TAU * this.years.length), this.years.length);
    const year = this.years[index];
    if (year !== this.selected) { this.highlight(year); this.change(year); }
    this.request();
  };
  private up = (event: PointerEvent) => {
    const d = this.drag;
    if (!d || d.id !== event.pointerId) return;
    if (!d.moved && !d.vertical) {
      const rect = this.canvas.getBoundingClientRect();
      const ray = new THREE.Raycaster();
      ray.setFromCamera(new THREE.Vector2((event.clientX - rect.left) / rect.width * 2 - 1,
        -(event.clientY - rect.top) / rect.height * 2 + 1), this.camera);
      this.scene.updateMatrixWorld(true);
      const hit = ray.intersectObject(this.paper)[0];
      if (hit?.instanceId !== undefined) {
        const year = this.yearsByInstance[hit.instanceId];
        this.highlight(year); this.change(year);
      }
    }
    this.drag = null;
    this.canvas.classList.remove("is-dragging");
    if (this.canvas.hasPointerCapture(event.pointerId)) this.canvas.releasePointerCapture(event.pointerId);
    this.setYear(this.selected);
  };
  private cancel = () => {
    if (!this.drag) return;
    this.drag = null;
    this.canvas.classList.remove("is-dragging");
    this.setYear(this.selected);
  };
  private request = () => {
    if (!this.frame && this.active && !this.disposed && this.visible && !document.hidden) this.frame = requestAnimationFrame(this.draw);
  };
  private draw = (now: number) => {
    this.frame = 0;
    if (!this.active || this.disposed || !this.visible || document.hidden) { this.previousTime = 0; return; }
    const animated = !this.paused && !this.reduced;
    const moving = this.rotation !== this.target;
    // The quiet scene runs at 30 fps; ring manipulation keeps the display's cadence.
    if (animated && !moving && this.previousTime && now - this.previousTime < 32) { this.request(); return; }
    const delta = this.previousTime ? Math.min((now - this.previousTime) / 1000, .06) : 0;
    this.previousTime = now;
    const diff = this.target - this.rotation;
    this.rotation = this.reduced || Math.abs(diff) < .0005 ? this.target : this.rotation + diff * .2;
    this.root.rotation.y = this.rotation;
    if (moving) this.renderer.shadowMap.needsUpdate = true;
    if (animated) { this.animationTime += delta; this.visitors.update(this.animationTime); }
    const motion = this.reduced ? "reduced" : this.paused ? "paused" : "playing";
    if (this.canvas.dataset.visitorMotion !== motion) this.canvas.dataset.visitorMotion = motion;
    this.renderer.render(this.scene, this.camera);
    if (this.rotation !== this.target || animated) this.request();
  };

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.frame);
    this.abort.abort(); this.resizeObserver.disconnect(); this.intersectionObserver.disconnect();
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    this.scene.traverse((object) => {
      if (object instanceof THREE.Mesh || object instanceof THREE.Line) {
        geometries.add(object.geometry);
        for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
          materials.add(material);
        }
      }
      if (object instanceof THREE.InstancedMesh) object.dispose();
      if (object instanceof THREE.DirectionalLight) object.shadow.dispose();
    });
    for (const geometry of geometries) geometry.dispose();
    for (const material of materials) {
      if ("map" in material) (material.map as THREE.Texture | null)?.dispose();
      material.dispose();
    }
    this.renderer.dispose();
  }
}
