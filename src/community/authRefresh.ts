import type { AuthChangeEvent } from "@supabase/supabase-js";

// SIGNED_IN also means an existing session was confirmed (including in another
// tab). A real identity change or a pending login return still needs fresh data.
// TOKEN_REFRESHED keeps revalidating server-side permissions in the background.
export function needsAuthRefresh(event: AuthChangeEvent, previousId: string | null, nextId: string | null, pendingReturn: boolean) {
  return event !== "SIGNED_IN" || previousId !== nextId || pendingReturn;
}
