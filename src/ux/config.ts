const env = (import.meta as ImportMeta & { env?: Record<string, string> }).env || {};
export function isStudyOrigin(enabled: string | undefined, configured: string | undefined, origin: string) {
  return enabled === "true" && origin !== "https://voku.pages.dev" &&
    [configured, "http://127.0.0.1:5240", "http://localhost:5240"].includes(origin);
}
export const studyEnabled = typeof location !== "undefined" && isStudyOrigin(env.VITE_UX_STUDY_ENABLED, env.VITE_UX_STUDY_ORIGIN, location.origin);
