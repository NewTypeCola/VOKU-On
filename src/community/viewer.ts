let temporary: string | undefined;
export function viewerId(): string {
  const key = "voku-community-viewer";
  try {
    const value = localStorage.getItem(key);
    if (value && /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value))
      return value;
    const next = (temporary ||= crypto.randomUUID());
    localStorage.setItem(key, next);
    return next;
  } catch {
    return (temporary ||= crypto.randomUUID());
  }
}
