type ShareDevice = {
  share?: (data: ShareData) => Promise<void>;
  clipboard?: { writeText: (text: string) => Promise<void> };
};
export type ShareResult = "shared" | "cancelled" | "copied" | "failed";

function legacyCopy(text: string) {
  if (typeof document === "undefined") return false;
  const input = document.createElement("textarea");
  input.value = text;
  input.readOnly = true;
  input.style.cssText = "position:fixed;left:0;top:0;opacity:0;font-size:16px";
  const focused = document.activeElement as HTMLElement | null;
  document.body.append(input);
  input.select();
  input.setSelectionRange(0, text.length);
  try { return document.execCommand("copy"); }
  catch { return false; }
  finally { input.remove(); focused?.focus({ preventScroll: true }); }
}

/** Called from the button, before any network work loses user activation. */
export async function shareLink(data: ShareData & { url: string }, device: ShareDevice = navigator): Promise<ShareResult> {
  if (device.share) {
    try {
      await device.share(data);
      return "shared";
    } catch (error) {
      if ((error as { name?: string })?.name === "AbortError") return "cancelled";
    }
  }
  try {
    if (!device.clipboard) return legacyCopy(data.url) ? "copied" : "failed";
    await device.clipboard.writeText(data.url);
    return "copied";
  } catch {
    return legacyCopy(data.url) ? "copied" : "failed";
  }
}
