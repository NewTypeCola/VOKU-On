import { uid } from "../data";

let temporary: string | undefined;
export function viewerId(): string {
  const key = "voku-community-viewer";
  try {
    const value = localStorage.getItem(key);
    if (value && /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value))
      return value;
    const next = (temporary ||= uid());
    localStorage.setItem(key, next);
    return next;
  } catch {
    return (temporary ||= uid());
  }
}
