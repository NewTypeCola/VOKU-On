// Browser focus and visibility often fire together. Share one refresh and avoid
// background polling; reconnecting also recovers from a failed offline request.
export function refreshOnReturn(
  refresh: () => void,
  page: Pick<Document, "visibilityState" | "addEventListener" | "removeEventListener"> = document,
  browser: Pick<Window, "addEventListener" | "removeEventListener"> = window,
) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const schedule = () => {
    clearTimeout(timer);
    if (page.visibilityState === "visible") timer = setTimeout(refresh, 250);
  };
  page.addEventListener("visibilitychange", schedule);
  browser.addEventListener("focus", schedule);
  browser.addEventListener("online", schedule);
  return () => {
    clearTimeout(timer);
    page.removeEventListener("visibilitychange", schedule);
    browser.removeEventListener("focus", schedule);
    browser.removeEventListener("online", schedule);
  };
}
