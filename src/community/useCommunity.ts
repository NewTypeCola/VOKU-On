import { useCallback, useEffect, useRef, useState } from "react";
import { api, supabase, live, configurationError, errorText, hasAuthCallback, invalidateCommunityReads } from "./client";
import { preview } from "./preview";
import { oauthReturnKey, safeReturnPath, readOAuthError } from "./oauth";
import { authScreenPath, hasRecovery, pendingExternalAuth, readAuthReturn, readExternalAuth, readPendingEmail, savePendingEmail, saveRecovery } from "./authFlow";
import { refreshOnReturn } from "./refreshOnReturn";
import { needsAuthRefresh } from "./authRefresh";
import type { Account, Action, CommunityPost } from "./types";
import { studyEnabled } from "../ux/config";
import { studyMember } from "../ux/member";

export function useCommunity(notify: (message: string) => void, navigate?: (path: string, replace?: boolean, keepScroll?: boolean, restoreScroll?: boolean) => void, studyOperator = false) {
  const [account, setAccount] = useState<Account | null>(null);
  const [homePosts, setHomePosts] = useState<CommunityPost[]>([]);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(configurationError);
  const [authError, setAuthError] = useState("");
  const [recovery, setRecovery] = useState(false);
  const recoveryRef = useRef(false);
  const callback = useRef(hasAuthCallback);
  const request = useRef(0);
  const identity = useRef<string | null>(null);
  const refresh = useCallback(async () => {
    const ticket = ++request.current;
    try {
      const [a, f] = await Promise.all([api.account(studyOperator), api.feed()]);
      if (ticket !== request.current) return;
      setAccount(a);
      let oauthNext: string | null = null;
      try { oauthNext = sessionStorage.getItem(oauthReturnKey); } catch { /* restricted storage */ }
      if ((!studyEnabled || studyOperator) && a && !recoveryRef.current && (oauthNext || readExternalAuth() || (callback.current && readPendingEmail()?.kind === "signup"))) {
        const context = readAuthReturn();
        const destination = studyEnabled && studyOperator ? "/ux-log" : context?.next || safeReturnPath(oauthNext);
        try { sessionStorage.removeItem(oauthReturnKey); } catch { /* restricted storage */ }
        pendingExternalAuth(null);
        savePendingEmail(null);
        callback.current = false;
        history.replaceState(history.state, "", location.pathname + location.hash);
        const path = a.profile.profileComplete ? destination : authScreenPath("profile", destination, context?.back || destination);
        if (navigate) navigate(path, true, false, true);
        else location.hash = path;
      }
      setHomePosts(f.posts);
      setError(configurationError);
      setRevision((n) => n + 1);
      return a;
    } catch (e) {
      if (ticket === request.current) {
        setError(errorText(e));
      }
    } finally {
      if (ticket === request.current) setLoading(false);
    }
  }, [navigate, studyOperator]);
  const refreshLatest = useCallback(() => {
    invalidateCommunityReads();
    return refresh();
  }, [refresh]);
  useEffect(() => refreshOnReturn(() => { void refreshLatest(); }), [refreshLatest]);
  useEffect(() => {
    if (studyEnabled && !studyOperator) {
      void refresh();
      const unsubscribe = studyMember.subscribe(() => void refresh());
      return () => { request.current++; unsubscribe(); };
    }
    const failedCallback = (message: string) => {
      try { sessionStorage.removeItem(oauthReturnKey); } catch { /* restricted storage */ }
      pendingExternalAuth(null);
      callback.current = false;
      const context = readAuthReturn();
      const path = authScreenPath(readPendingEmail() ? "confirm" : "login", context?.next || "/board", context?.back || "/board");
      history.replaceState(history.state, "", "/#" + path);
      window.dispatchEvent(new HashChangeEvent("hashchange"));
      setAuthError(message);
      notify(message);
    };
    const oauthError = readOAuthError(location.search, location.hash, readExternalAuth() || undefined);
    if (oauthError) failedCallback(oauthError);
    if (!supabase) void refresh();
    const subscription = supabase?.auth.onAuthStateChange((event, session) => {
      // A successful PKCE exchange removes `code` before INITIAL_SESSION.
      // A reused link or a different browser can leave it behind without a session error.
      if (event === "INITIAL_SESSION" && callback.current && new URLSearchParams(location.search).has("code")) {
        failedCallback("인증 링크를 확인하지 못했어요. 인증을 시작한 브라우저에서 다시 시도하거나 메일의 인증번호를 입력해 주세요.");
      }
      const shouldRefresh = needsAuthRefresh(event, identity.current, session?.user.id || null,
        callback.current || !!readExternalAuth() || !!readPendingEmail());
      if (identity.current !== (session?.user.id || null)) {
        identity.current = session?.user.id || null;
        setAccount(null);
        setLoading(true);
        request.current++;
      }
      if (
        event === "PASSWORD_RECOVERY" ||
        (event === "INITIAL_SESSION" && hasRecovery(session?.user.id)) ||
        (event === "SIGNED_IN" &&
          new URLSearchParams(location.search).get("auth") === "recovery")
      ) {
        recoveryRef.current = true;
        setRecovery(true);
        if (session && event !== "INITIAL_SESSION") saveRecovery(session.user.id);
      }
      if (event === "SIGNED_OUT") { recoveryRef.current = false; setRecovery(false); saveRecovery(null); }
      if (!shouldRefresh) return;
      if (event !== "INITIAL_SESSION") invalidateCommunityReads();
      if (event === "SIGNED_OUT") setAccount(null);
      if (event === "SIGNED_IN" || event === "PASSWORD_RECOVERY") setAuthError("");
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
  }, [refresh, studyOperator]);
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
    authError,
    clearAuthError: () => setAuthError(""),
    recovery,
    setRecovery(value: boolean) { recoveryRef.current = value; setRecovery(value); if (!value) saveRecovery(null); },
    refresh,
    refreshLatest,
    action,
    async studyLogin() {
      if (!studyEnabled || studyOperator) return;
      studyMember.login();
      await refresh();
    },
    async previewLogin(role: "member" | "admin") {
      if (live) return;
      setAccount(null);
      preview.login(role);
      invalidateCommunityReads();
      await refresh();
    },
    async logout() {
      if (studyEnabled && !studyOperator) studyMember.logout();
      else if (supabase) {
        const { error } = await supabase.auth.signOut(studyEnabled ? { scope: "local" } : undefined);
        if (error) throw error;
      } else preview.logout();
      recoveryRef.current = false;
      setRecovery(false);
      saveRecovery(null);
      setAccount(null);
      invalidateCommunityReads();
      await refresh();
    },
  };
}
export type Community = ReturnType<typeof useCommunity>;
