import { currentRoute } from "../community/postAddress";
import { bucketWidth, controlAction, screenOf, type Action, type UxEvent, type Screen, type ResultAction } from "./model";
import { studyEnabled } from "./config";
import { restoreStudySession } from "./session";
import { subscribeStudySignals } from "./signals";
import { createScrollTracker } from "./scroll";
export { studyEnabled } from "./config";

// Keep the visit ID and sequence when upgrading. Existing logs are never reset.
const key = "voku-ux-study-v2";
let raw: string | null = null;
try { raw = sessionStorage.getItem(key); } catch { /* restricted storage */ }
const session = restoreStudySession(raw, location.hostname === "localhost" || location.hostname === "127.0.0.1" || new URLSearchParams(location.search).get("ux_test") === "1");
let dispose: (() => void) | undefined;
let buffer: UxEvent[] = [];
let sending = false;
const persist = () => { try { sessionStorage.setItem(key, JSON.stringify(session)); } catch { /* in-memory visit */ } };
export function bootStudy() { if (studyEnabled && !dispose) { persist(); dispose = startTracking(); } }
function payload(events: UxEvent[]) { return JSON.stringify({ version: 3, session: session.id, device: bucketWidth(innerWidth), test: session.test, events }); }
async function flush(unloading = false) {
  if (!studyEnabled || !buffer.length) return;
  // Beacon may overlap an in-flight request; (visit, seq) makes retries idempotent.
  if (unloading) {
    for (let offset = 0; offset < buffer.length; offset += 20) {
      const rows = buffer.slice(offset, offset + 20);
      if (!navigator.sendBeacon("/api/ux/events", new Blob([payload(rows)], { type: "application/json" }))) break;
    }
    return;
  }
  if (sending) return;
  const rows = buffer.slice(0, 20), body = payload(rows);
  sending = true;
  try {
    const response = await fetch("/api/ux/events", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "omit", body, keepalive: true });
    if (response.ok || (response.status >= 400 && response.status < 500)) buffer = buffer.filter(e => !rows.some(r => r.seq === e.seq));
  } catch { /* bounded in-memory retry; never block application work */ }
  finally { sending = false; }
}
const controls = 'a,button,[role="tab"],[role="menuitem"],[role="option"]';
function clicked(element: Element): { action?: Action; value?: number; target?: Screen } {
  const control = element.closest(controls);
  if (!control || control.closest('[data-ux-ignore], [inert]') || control.hasAttribute("disabled") || control.getAttribute("aria-disabled") === "true") return {};
  const label = (control.getAttribute("aria-label") || control.textContent || "").trim().replace(/\s+/g, " ");
  let target: Screen | undefined;
  let external = false;
  if (control.matches("a")) {
    try {
      const url = new URL(control.getAttribute("href") || "", location.href);
      if (url.origin === location.origin) target = screenOf(url.hash.startsWith("#/") ? url.hash.slice(1) : url.pathname);
      else external = true;
    } catch { /* URLs and labels are never emitted */ }
  }
  const region = control.closest('.community-photo-lightbox') ? "photo" : control.closest('.archive-recent') ? "recent" : control.closest('.archive-path') ? "archive-path" : "";
  let action = controlAction(label, control.getAttribute("class") || "", target, region);
  let value: number | undefined;
  if (control.matches('.home-image-banner')) { action = "banner.open"; value = parseInt(control.closest('.home-banner-slide')?.getAttribute('aria-label') || "", 10) || undefined; }
  else if (control.closest('.home-carousel-dots')) { action = "banner.select"; value = Array.from(control.parentElement?.children || []).indexOf(control) + 1; }
  if (!action && external) action = "link.external";
  if (action === "archive.year" || (action === "reader.page_jump" && /^\d+쪽/.test(label))) value = parseInt(label, 10);
  if (action === "board.category") value = ["전체", "자유글", "추억", "질문", "동문소식", "공지"].indexOf(label);
  if (action === "popular.select") value = ["많이 본 글", "댓글 많은 글", "인기 큐시트"].indexOf(label);
  return { action, ...(value !== undefined ? { value } : {}), ...(target ? { target } : {}) };
}
function gestureAction(element: Element): Action {
  if (element.closest('.home-carousel')) return "gesture.banner";
  if (element.closest('.time-ring')) return "gesture.archive";
  if (element.closest('.reader')) return "gesture.reader";
  if (element.closest('.community-photo-gallery,.community-photo-lightbox')) return "gesture.photo";
  if (element.closest('.home-main')) return "gesture.home";
  return "gesture.other";
}
function rootScrollInput(element: Element | null) {
  if (element?.closest('input,textarea,select,[contenteditable="true"],[role="slider"],[data-ux-ignore]')) return false;
  for (let node = element; node && node !== document.body; node = node.parentElement) {
    if (node.scrollHeight > node.clientHeight + 2 && /auto|scroll/.test(getComputedStyle(node).overflowY)) return false;
  }
  return true;
}
function startTracking() {
  const routeKey = () => { const path = currentRoute(); return path.split("?")[0] + (screenOf(path) === "archive" ? "?" + path.split("?")[1] : ""); };
  let screen = screenOf(currentRoute()), previousRoute = routeKey(), lastTick = performance.now(), activeMs = 0, lastInteraction = lastTick;
  const scrollTracker = createScrollTracker(scrollY);
  let scrollFrame = 0;
  let touch: { x: number; y: number; pinch: boolean; screen: Screen; action: Action; root: boolean } | undefined;
  let press: { x: number; y: number; screen: Screen; at: number; control: Element; data: ReturnType<typeof clicked> } | undefined;
  let pointerClick: { control: Element; at: number } | undefined;
  let keyboardAt = 0;
  const emit = (kind: UxEvent["kind"], extra: Partial<UxEvent> = {}) => {
    if ((extra.screen || screen) === "private") return;
    buffer.push({ seq: ++session.seq, at: Date.now(), kind, screen, ...extra }); persist();
    if (buffer.length > 100) buffer.shift();
    if (buffer.length >= 20) void flush();
  };
  const tick = () => { const now = performance.now(); if (document.visibilityState === "visible" && now - lastInteraction < 60000) activeMs += Math.min(now - lastTick, 1000); lastTick = now; };
  const leave = () => { tick(); emit("leave", { value: Math.round(activeMs / 1000) }); activeMs = 0; };
  const route = () => {
    const next = screenOf(currentRoute()), key = routeKey();
    if (key !== previousRoute) { leave(); screen = next; previousRoute = key; scrollTracker.reset(scrollY); emit("enter"); }
  };
  const click = (event: MouseEvent) => {
    lastInteraction = performance.now();
    if (!(event.target instanceof Element)) return;
    const control = event.target.closest(controls);
    // React Aria/assistive virtual clicks can follow a recorded pointer release.
    if (pointerClick?.control === control && Date.now() - pointerClick.at < 750 && keyboardAt < pointerClick.at) return;
    if (event.detail !== 0) return;
    const data = clicked(event.target); if (data.action) emit("click", data);
  };
  const pointerDown = (event: PointerEvent) => {
    lastInteraction = performance.now();
    if (event.button !== 0 || !(event.target instanceof Element)) return;
    if (event.pointerType === "mouse" && event.clientX >= document.documentElement.clientWidth) scrollTracker.input(performance.now());
    const control = event.target.closest(controls);
    if (control) press = { x: event.clientX, y: event.clientY, screen, at: Date.now(), control, data: clicked(control) };
  };
  const pointerUp = (event: PointerEvent) => {
    if (press && event.target instanceof Element && event.target.closest(controls) === press.control && Math.hypot(event.clientX - press.x, event.clientY - press.y) < 16 && press.data.action) {
      emit("click", { ...press.data, screen: press.screen, at: press.at });
      pointerClick = { control: press.control, at: Date.now() };
    }
    press = undefined;
  };
  const pointerCancel = () => { press = undefined; };
  const submit = (event: Event) => {
    if (!(event.target instanceof HTMLFormElement) || event.target.closest('[data-ux-ignore]')) return;
    emit("click", { action: screen === "reader" ? "reader.page_jump" : screen === "auth" ? "auth.submit" : screen === "write" ? "write.submit" : screen === "post" ? "comment.submit" : screen === "search" || screen === "board" ? "search.submit" : "form.submit" });
  };
  const scroll = () => {
    if (scrollFrame) return;
    scrollFrame = requestAnimationFrame(() => {
      scrollFrame = 0;
      const event = scrollTracker.sample(scrollY, document.documentElement.scrollHeight - innerHeight, performance.now());
      if (event) { if (event.kind === "scroll_user") lastInteraction = performance.now(); emit(event.kind, event); }
    });
  };
  const wheel = (event: WheelEvent) => { if (event.isTrusted && event.deltaY && !event.ctrlKey && rootScrollInput(event.target instanceof Element ? event.target : null)) { lastInteraction = performance.now(); scrollTracker.input(lastInteraction); } };
  const touchStart = (event: TouchEvent) => {
    lastInteraction = performance.now();
    if (touch) { touch.pinch ||= event.touches.length > 1; return; }
    const first = event.touches[0];
    if (first && event.target instanceof Element) touch = { x: first.clientX, y: first.clientY, pinch: event.touches.length > 1, screen, action: gestureAction(event.target), root: rootScrollInput(event.target) };
  };
  const touchMove = (event: TouchEvent) => {
    const next = event.touches[0];
    if (event.isTrusted && touch?.root && !touch.pinch && next && Math.abs(next.clientY - touch.y) > 6 && Math.abs(next.clientY - touch.y) > Math.abs(next.clientX - touch.x)) scrollTracker.input(performance.now());
  };
  const touchEnd = (event: TouchEvent) => {
    if (!touch || event.touches.length) return;
    const last = event.changedTouches[0];
    if (touch.pinch && touch.screen === "reader") emit("gesture", { value: 2, action: touch.action, screen: touch.screen });
    else if (last && Math.abs(last.clientX - touch.x) > 70 && Math.abs(last.clientY - touch.y) < 60) emit("gesture", { value: last.clientX > touch.x ? 1 : -1, action: touch.action, screen: touch.screen });
    touch = undefined;
  };
  const touchCancel = () => { touch = undefined; };
  const keydown = (event: KeyboardEvent) => {
    lastInteraction = performance.now(); keyboardAt = Date.now();
    if (event.isTrusted && ["ArrowDown", "ArrowUp", "PageDown", "PageUp", "Home", "End", " "].includes(event.key) && rootScrollInput(event.target instanceof Element ? event.target : null) && !(event.target instanceof Element && event.target.closest(controls))) scrollTracker.input(lastInteraction);
  };
  const unsubscribe = subscribeStudySignals(signal => {
    route();
    if (signal.kind === "auto_scroll") scrollTracker.automatic(signal.action, performance.now());
    else emit(signal.kind, signal);
  });
  const imageStates = new WeakMap<HTMLImageElement, string>();
  const imageResult = (element: EventTarget | null, value: 0 | 1) => {
    if (!(element instanceof HTMLImageElement) || element.closest('[data-ux-ignore],[inert]')) return;
    const action: ResultAction | undefined = element.matches('.cue-image') ? "reader.image" : element.closest('.community-photo-gallery,.community-photo-lightbox') ? "post.image" : element.closest('.home-image-banner') ? "banner.image" : undefined;
    if (!action) return;
    const key = `${element.currentSrc || element.src}:${value}`;
    if (imageStates.get(element) === key) return;
    imageStates.set(element, key);
    emit("result", { action, value });
  };
  const imageLoad = (event: Event) => imageResult(event.target, 1);
  const imageError = (event: Event) => imageResult(event.target, 0);
  const cachedImages = (root: ParentNode) => root.querySelectorAll<HTMLImageElement>('.cue-image,.community-photo-gallery img,.community-photo-lightbox img,.home-image-banner img').forEach(img => { if (img.complete && img.naturalWidth > 0) imageResult(img, 1); });
  const images = new MutationObserver(records => { for (const record of records) for (const node of record.addedNodes) if (node instanceof Element) { if (node instanceof HTMLImageElement && node.complete && node.naturalWidth > 0) imageResult(node, 1); cachedImages(node); } });
  const visibility = () => { tick(); if (document.visibilityState === "hidden") { emit("engagement", { value: Math.round(activeMs / 1000) }); activeMs = 0; void flush(true); } else { lastTick = performance.now(); lastInteraction = lastTick; } };
  const pagehide = () => { leave(); void flush(true); };
  const events: [EventTarget, string, EventListener, AddEventListenerOptions | boolean][] = [
    [document, "click", click as EventListener, true], [document, "submit", submit, true], [document, "pointerdown", pointerDown as EventListener, true], [document, "pointerup", pointerUp as EventListener, true], [document, "pointercancel", pointerCancel, true],
    [window, "hashchange", route, false], [window, "popstate", route, false], [window, "scroll", scroll, { passive: true }], [window, "wheel", wheel as EventListener, { passive: true, capture: true }],
    [document, "touchstart", touchStart as EventListener, { passive: true }], [document, "touchmove", touchMove as EventListener, { passive: true }], [document, "touchend", touchEnd as EventListener, { passive: true }], [document, "touchcancel", touchCancel, { passive: true }], [document, "keydown", keydown as EventListener, true],
    [document, "visibilitychange", visibility, false], [window, "pagehide", pagehide, false], [document, "load", imageLoad, true], [document, "error", imageError, true],
  ];
  events.forEach(([target, name, listener, options]) => target.addEventListener(name, listener, options));
  images.observe(document.body, { childList: true, subtree: true });
  const timer = setInterval(() => { tick(); void flush(); }, 5000), activeTimer = setInterval(tick, 1000);
  emit("enter"); cachedImages(document); void flush();
  return () => { clearInterval(timer); clearInterval(activeTimer); cancelAnimationFrame(scrollFrame); unsubscribe(); images.disconnect(); events.forEach(([target, name, listener, options]) => target.removeEventListener(name, listener, options)); };
}
