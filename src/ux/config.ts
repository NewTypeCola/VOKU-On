const env = (import.meta as ImportMeta & { env?: Record<string, string> }).env || {};
export const studyEnabled = typeof location !== "undefined" && env.VITE_UX_STUDY_ENABLED === "true" &&
  [env.VITE_UX_STUDY_ORIGIN, "http://127.0.0.1:5240", "http://localhost:5240"].includes(location.origin) && location.hostname !== "voku.pages.dev";
