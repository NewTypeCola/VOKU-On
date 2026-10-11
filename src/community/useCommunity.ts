import { useCallback, useEffect, useRef, useState } from "react";
import { api, supabase, live, configurationError, errorText, invalidateCommunityReads } from "./client";
import { preview } from "./preview";
import { oauthReturnKey, safeReturnPath, readOAuthError } from "./oauth";
import { refreshOnReturn } from "./refreshOnReturn";
import type { Account, Action, CommunityPost } from "./types";

export function useCommunity(notify: (message: string) => void) {
  const [account, setAccount] = useState<Account | null>(null);
  const [homePosts, setHomePosts] = useState<CommunityPost[]>([]);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(configurationError);
  const [recovery, setRecovery] = useState(false);
  const request = useRef(0);
  const identity = useRef<string | null>(null);
  const refresh = useCallback(async () => {
    const ticket = ++request.current;
    try {
      const [a, f] = await Promise.all([api.account(), api.feed()]);
      if (ticket !== request.current) return;
      setAccount(a);
      const oauthNext = sessionStorage.getItem(oauthReturnKey);
      if (a && oauthNext) {
        const destination = safeReturnPath(oauthNext);
        sessionStorage.removeItem(oauthReturnKey);
        history.replaceState(history.state, "", location.pathname + location.hash);
        location.hash = a.profile.profileComplete ? destination : `/auth?mode=profile&next=${encodeURIComponent(destination)}`;
      }
      setHomePosts(f.posts);
      setError(configurationError);
      setRevision((n) => n + 1);
    } catch (e) {
      if (ticket === request.current) {
        setError(errorText(e));
      }
    } finally {
      if (ticket === request.current) setLoading(false);
    }
  }, []);
  const refreshLatest = useCallback(() => {
    invalidateCommunityReads();
    return refresh();
  }, [refresh]);
  useEffect(() => refreshOnReturn(() => { void refreshLatest(); }), [refreshLatest]);
  useEffect(() => {
    const oauthError = readOAuthError(location.search, location.hash);
    if (oauthError) {
      sessionStorage.removeItem(oauthReturnKey);
      history.replaceState(history.state, "", location.pathname + "#/auth");
      notify(oauthError);
    }
    if (!supabase) void refresh();
    const subscription = supabase?.auth.onAuthStateChange((event, session) => {
      if (identity.current !== (session?.user.id || null)) {
        identity.current = session?.user.id || null;
        setAccount(null);
        setLoading(true);
        request.current++;
      }
      if (
        event === "PASSWORD_RECOVERY" ||
        (event === "SIGNED_IN" &&
          new URLSearchParams(location.search).get("auth") === "recovery")
      )
        setRecovery(true);
      if (event !== "INITIAL_SESSION") invalidateCommunityReads();
      if (event === "SIGNED_OUT") setAccount(null);
      // Auth callbacks must not await another auth call while its lock is held.
      queueMicrotask(() => void refresh());
    });
    const onStorage = (e: StorageEvent) => {
      if (e.key === "voku-community-preview-v1" && !live) location.reload();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      request.current++;
      subscription?.data.subscription.unsubscribe();
      window.removeEventListener("storage", onStorage);
    };
  }, [refresh]);
  const action = async (
    name: Action,
    payload: Record<string, unknown>,
    message?: string,
  ) => {
    const result = await api.action(name, payload);
    await refresh();
    if (message) notify(message);
    return result;
  };
  return {
    live,
    account,
    profile: account?.profile || null,
    homePosts,
    revision,
    loading,
    error,
    recovery,
    setRecovery,
    refresh,
    refreshLatest,
    action,
    async previewLogin(role: "member" | "admin") {
      if (live) return;
      setAccount(null);
      preview.login(role);
      invalidateCommunityReads();
      await refresh();
    },
    async logout() {
      if (supabase) {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
      } else preview.logout();
      setAccount(null);
      invalidateCommunityReads();
      await refresh();
    },
  };
}
export type Community = ReturnType<typeof useCommunity>;
