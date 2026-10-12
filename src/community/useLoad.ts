import { useEffect, useState } from "react";
import { errorText } from "./client";

const sameQuery = (a: unknown[], b: unknown[]) =>
  a.length === b.length && a.every((value, i) => Object.is(value, b[i]));

/** Keep a settled screen visible during refresh, never across a query/identity change. */
export function useLoad<T>(loader: () => Promise<T>, query: unknown[], revision = 0, delay = 0) {
  const [state, setState] = useState<{
    query: unknown[]; data: T | null; error: string; pending: boolean;
  }>({ query, data: null, error: "", pending: true });
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setState(previous => ({
      query, data: sameQuery(previous.query, query) ? previous.data : null,
      error: "", pending: true,
    }));
    const load = () => {
      void Promise.resolve().then(loader).then(
        data => { if (active) setState({ query, data, error: "", pending: false }); },
        error => {
          // A failed permission check must not leave private content on screen.
          if (active) setState({ query, data: null, error: errorText(error), pending: false });
        },
      );
    };
    const timer = delay ? setTimeout(load, delay) : undefined;
    if (!delay) load();
    return () => { active = false; clearTimeout(timer); };
  }, [...query, revision, retry, delay]);
  const current = sameQuery(state.query, query);
  return {
    data: current ? state.data : null,
    error: current ? state.error : "",
    loading: !current || (state.pending && state.data === null),
    refreshing: current && state.pending && state.data !== null,
    retry: () => setRetry(n => n + 1),
  };
}
