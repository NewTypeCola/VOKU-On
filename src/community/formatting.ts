export type Inline = {
  type: "text" | "bold" | "link";
  text: string;
  href?: string;
};
export function safeLink(value: string): string | null {
  try {
    const url = new URL(value.trim());
    return ["https:", "http:"].includes(url.protocol) &&
      !url.username &&
      !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}
// Deliberately small syntax: React renders every string, never untrusted HTML.
export function inlineParts(text: string): Inline[] {
  const parts: Inline[] = [];
  const pattern = /\*\*([^*\n]+)\*\*|\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g;
  let start = 0;
  for (const match of text.matchAll(pattern)) {
    if (match.index! > start)
      parts.push({ type: "text", text: text.slice(start, match.index) });
    const href = match[3] && safeLink(match[3]);
    parts.push(
      match[1]
        ? { type: "bold", text: match[1] }
        : href
          ? { type: "link", text: match[2], href }
          : { type: "text", text: match[0] },
    );
    start = match.index! + match[0].length;
  }
  if (start < text.length)
    parts.push({ type: "text", text: text.slice(start) });
  return parts;
}
