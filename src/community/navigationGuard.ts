let guard: (() => boolean) | null = null;
export const allowCommunityLeave = () => guard?.() ?? true;
export function setCommunityLeaveGuard(next: (() => boolean) | null) {
  guard = next;
  return () => {
    if (guard === next) guard = null;
  };
}
