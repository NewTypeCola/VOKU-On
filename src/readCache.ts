/** Short, memory-only coalescing for identical reads. Never cache failures. */
export function createReadCache<T>(ttl = 0, limit = 20, now = Date.now) {
  const entries = new Map<string, { promise: Promise<T>; expires: number }>();
  return {
    clear() { entries.clear(); },
    read(key: string, load: () => Promise<T>): Promise<T> {
      const previous = entries.get(key);
      if (previous && previous.expires > now()) return previous.promise;
      entries.delete(key);
      const entry = { promise: Promise.resolve().then(load), expires: Infinity };
      entry.promise = entry.promise.then(value => {
        entry.expires = now() + ttl;
        if (ttl === 0 && entries.get(key) === entry) entries.delete(key);
        return value;
      }, error => {
        if (entries.get(key) === entry) entries.delete(key);
        throw error;
      });
      if (entries.size >= limit) entries.delete(entries.keys().next().value!);
      entries.set(key, entry);
      return entry.promise;
    },
  };
}
