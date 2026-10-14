import type { SupabaseClient } from "@supabase/supabase-js";
import { connectUsage, type UsageData } from "./index";
import {
  acquisition,
  activeDelta,
  ID,
  OPT_OUT_KEY,
  RECORD,
  routeInfo,
  SESSION_KEY,
  SESSION_MS,
  TEST_KEY,
  validIdentity,
  VISITOR_KEY,
  VISITOR_MS,
} from "./model";

type Event = UsageData & {
  id: string;
  name: string;
  at: string;
  seq: number;
  route: string;
};
type Identity = { id: string; at: number; last: number; seq: number };
const read = (storage: Storage, key: string) => {
  try {
    return JSON.parse(storage.getItem(key) || "null");
  } catch {
    return null;
  }
};
const write = (storage: Storage, key: string, value: unknown) => {
  try {
    storage.setItem(key, JSON.stringify(value));
  } catch {
    /* Memory-only session remains usable. */
  }
};
const fresh = (): Identity => ({
  id: crypto.randomUUID(),
  at: Date.now(),
  last: Date.now(),
  seq: 0,
});

export async function startUsage(client: SupabaseClient | null) {
  // Local dev is inert unless explicitly testing; collector absence never breaks the app.
  if (
    !client ||
    !crypto.randomUUID ||
    !location.hostname.endsWith(".pages.dev")
  )
    return;
  let token = "";
  try {
    token = (await client.auth.getSession()).data.session?.access_token || "";
  } catch {
    /* anonymous */
  }
  client.auth.onAuthStateChange((event, session) => {
    token = session?.access_token || "";
    if (event === "SIGNED_IN" || event === "SIGNED_OUT")
      emit("auth", { detail: event === "SIGNED_IN" ? "sign_in" : "sign_out" });
  });
  let disabled = false;
  try {
    disabled =
      localStorage.getItem(OPT_OUT_KEY) === "1" ||
      navigator.doNotTrack === "1" ||
      (navigator as Navigator & { globalPrivacyControl?: boolean })
        .globalPrivacyControl === true;
    const mark = new URLSearchParams(location.search).get("usage_test");
    if (mark === "1") localStorage.setItem(TEST_KEY, "1");
    if (mark === "0") localStorage.removeItem(TEST_KEY);
  } catch {
    /* restricted storage */
  }
  let visitor = read(localStorage, VISITOR_KEY);
  if (!validIdentity(visitor, Date.now(), VISITOR_MS)) visitor = fresh();
  let session = read(sessionStorage, SESSION_KEY);
  if (
    !validIdentity(session, Date.now(), 86_400_000) ||
    Date.now() - session.last > SESSION_MS
  )
    session = fresh();
  if (!disabled) {
    write(localStorage, VISITOR_KEY, visitor);
    write(sessionStorage, SESSION_KEY, session);
  }
  const arrival = acquisition(
    document.referrer,
    location.search,
    location.hostname,
  );
  let queue: Event[] = [],
    inFlight = false,
    failures = 0,
    dropped = 0;
  let route = routeInfo("/home"),
    routeKey = "",
    page = 0,
    readingRecord = "";
  let postContext: UsageData | null = null;
  let activeMs = 0,
    readMs = 0,
    pageMs = new Map<string, number>(),
    seenPages = new Set<string>();
  let lastTick = performance.now(),
    lastInput = lastTick,
    lastSend = Date.now();
  function renew() {
    const now = Date.now();
    if (now - session.last > SESSION_MS || now - session.at > 86_400_000) {
      // The old batch must keep its old session; discard only after its bounded retry window.
      void flush();
      if (queue.length) {
        dropped += queue.length;
        queue = [];
      }
      session = fresh();
      seenPages.clear();
      pageMs.clear();
      if (route.route !== "post" || postContext)
        queue.push({
          id: crypto.randomUUID(),
          at: new Date(now).toISOString(),
          seq: ++session.seq,
          name: "page_view",
          route: route.route,
          ...postContext,
        });
      if (route.record)
        queue.push({
          id: crypto.randomUUID(),
          at: new Date(now).toISOString(),
          seq: ++session.seq,
          name: "read_open",
          route: route.route,
          record: route.record,
        });
    }
    session.last = now;
    write(sessionStorage, SESSION_KEY, session);
  }
  function emit(name: string, data: UsageData = {}) {
    if (disabled) return;
    renew();
    // Copy an explicit allowlist. Never serialize an action payload, DOM text, URL or exception.
    const safe: UsageData = {};
    if (data.record && RECORD.test(data.record)) safe.record = data.record;
    if (data.entity && ID.test(data.entity)) safe.entity = data.entity;
    if (Number.isInteger(data.page) && data.page! > 0 && data.page! < 2000)
      safe.page = data.page;
    if (Number.isFinite(data.value))
      safe.value = Math.max(0, Math.min(600000, Math.round(data.value!)));
    if (data.detail && /^[a-z_]{1,32}$/.test(data.detail))
      safe.detail = data.detail;
    if (data.sample) safe.sample = true;
    if (queue.length >= 300) {
      dropped++;
      return;
    }
    queue.push({
      id: crypto.randomUUID(),
      at: new Date().toISOString(),
      seq: ++session.seq,
      name,
      route: route.route,
      ...safe,
    });
    write(sessionStorage, SESSION_KEY, session);
    if (queue.length >= 20) void flush();
  }
  function durations() {
    if (activeMs >= 1 && (route.route !== "post" || postContext))
      emit("engagement", { ...postContext, value: Math.min(30000, activeMs) });
    if (readMs >= 1 && readingRecord)
      emit("read_tick", {
        record: readingRecord,
        value: Math.min(30000, readMs),
        page,
      });
    activeMs = 0;
    readMs = 0;
  }
  async function flush() {
    if (disabled || inFlight || !queue.length) return;
    inFlight = true;
    lastSend = Date.now();
    const batch = queue.splice(0, 20),
      currentSession = session.id;
    let test = false;
    try {
      test = localStorage.getItem(TEST_KEY) === "1";
    } catch {
      /* memory */
    }
    try {
      const response = await fetch("/api/usage", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          v: 1,
          visitor: visitor.id,
          session: currentSession,
          test,
          automated: navigator.webdriver === true,
          ...arrival,
          events: batch,
        }),
        keepalive: true,
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) throw Error("delivery");
      const result = await response.json();
      if (result.limited) throw Error("limited");
      failures = 0;
    } catch {
      failures++;
      if (failures <= 2 && session.id === currentSession)
        queue = [...batch, ...queue].slice(0, 300);
      else {
        dropped += batch.length;
        failures = 0;
      }
    } finally {
      inFlight = false;
    }
  }
  connectUsage({
    event(name, data) {
      if (name === "post_view" && route.route === "post") {
        if (postContext?.entity === data?.entity) return;
        postContext = data || {};
        emit("page_view", postContext);
      }
      emit(name, data);
    },
    navigate(path) {
      const next = routeInfo(path);
      if (next.key === routeKey) return;
      durations();
      route = next;
      routeKey = next.key;
      readingRecord = "";
      page = 0;
      postContext = null;
      lastInput = performance.now();
      if (next.route !== "post") emit("page_view");
      if (next.record) emit("read_open", { record: next.record });
    },
    reading(record, nextPage) {
      if (readingRecord !== record) {
        durations();
        readingRecord =
          route.route === "reader" &&
          route.record === record &&
          RECORD.test(record)
            ? record
            : "";
      }
      page = nextPage;
    },
  });
  const interaction = () => {
    lastInput = performance.now();
  };
  for (const name of ["pointerdown", "keydown", "scroll", "touchstart"])
    window.addEventListener(name, interaction, { passive: true });
  const pause = () => {
    durations();
    void flush();
    lastTick = performance.now();
    if (document.visibilityState === "visible") lastInput = lastTick;
  };
  document.addEventListener("visibilitychange", pause);
  window.addEventListener("pagehide", pause);
  window.addEventListener("pageshow", () => {
    lastTick = performance.now();
    lastInput = lastTick;
  });
  window.addEventListener("storage", (event) => {
    if (event.key === OPT_OUT_KEY && event.newValue === "1") {
      disabled = true;
      queue = [];
      activeMs = 0;
      readMs = 0;
    }
  });
  window.setInterval(() => {
    const now = performance.now(),
      delta = activeDelta(
        now,
        lastTick,
        document.visibilityState === "visible",
        lastInput,
      );
    lastTick = now;
    if (disabled) return;
    activeMs += delta;
    if (delta && readingRecord && page) {
      const img = document.querySelector<HTMLImageElement>(
        `.reader .cue-page[data-page="${page}"] img.cue-image`,
      );
      const box = img?.getBoundingClientRect();
      const visible =
        box &&
        Math.min(box.bottom, innerHeight) - Math.max(box.top, 100) >=
          Math.min(200, box.height * 0.3);
      if (
        img?.complete &&
        img.naturalWidth > 0 &&
        visible &&
        !document.querySelector(".modal__dialog")
      ) {
        readMs += delta;
        const key = readingRecord + ":" + page,
          ms = (pageMs.get(key) || 0) + delta;
        pageMs.set(key, ms);
        if (ms >= 2000 && !seenPages.has(key)) {
          seenPages.add(key);
          emit("read_page", { record: readingRecord, page });
        }
      }
    }
    if (
      Date.now() - lastSend >= 15000 ||
      activeMs >= 29000 ||
      readMs >= 29000
    ) {
      durations();
      if (dropped) {
        const value = dropped;
        dropped = 0;
        emit("delivery_drop", { value });
      }
      void flush();
    }
  }, 1000);
  window.addEventListener(
    "error",
    (event) =>
      emit("error", { detail: event.target === window ? "script" : "image" }),
    true,
  );
  window.addEventListener("unhandledrejection", () =>
    emit("error", { detail: "unknown" }),
  );
  // Official observers report scalar vital values only; no attribution/DOM selectors are sent.
  void import("web-vitals")
    .then(({ onLCP, onCLS, onINP, onTTFB }) => {
      const send = (metric: { name: string; value: number }) =>
        emit("vital", {
          detail: metric.name.toLowerCase(),
          value: metric.name === "CLS" ? metric.value * 1000 : metric.value,
        });
      onLCP(send);
      onCLS(send);
      onINP(send);
      onTTFB(send);
    })
    .catch(() => {});
}
