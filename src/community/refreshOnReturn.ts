// Browser focus and visibility often fire together. Share one refresh and avoid
// background polling; reconnecting also recovers from a failed offline request.
export function refreshOnReturn(
  refresh: () => void,
  page: Pick<Document, "visibilityState" | "addEventListener" | "removeEventListener"> = document,
  browser: Pick<Window, "addEventListener" | "removeEventListener"> = window,
) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let away = page.visibilityState !== "visible";
  const schedule = () => {
    clearTimeout(timer);
    if (page.visibilityState === "visible") timer = setTimeout(refresh, 250);
  };
  const leave = () => { away = true; clearTimeout(timer); };
  const returnToPage = () => {
    if (away && page.visibilityState === "visible") { away = false; schedule(); }
  };
  const visibility = () => page.visibilityState === "visible" ? returnToPage() : leave();
  page.addEventListener("visibilitychange", visibility);
  browser.addEventListener("blur", leave);
  browser.addEventListener("focus", returnToPage);
  browser.addEventListener("online", schedule);
  return () => {
    clearTimeout(timer);
    page.removeEventListener("visibilitychange", visibility);
    browser.removeEventListener("blur", leave);
    browser.removeEventListener("focus", returnToPage);
    browser.removeEventListener("online", schedule);
  };
}
