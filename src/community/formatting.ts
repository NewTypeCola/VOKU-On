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
export function formatSelection(
  value: string,
  start: number,
  end: number,
  kind: "bold" | "list" | "link",
  url = "",
) {
  let selected = value.slice(start, end);
  let replacement: string;
  if (kind === "list") {
    start = value.lastIndexOf("\n", Math.max(0, start - 1)) + 1;
    const next = value.indexOf("\n", end);
    end = next < 0 ? value.length : next;
    selected = value.slice(start, end);
    replacement = selected
      .split("\n")
      .map((line) => "- " + line.replace(/^- /, ""))
      .join("\n");
  } else if (kind === "bold") replacement = `**${selected || "강조할 내용"}**`;
  else {
    const href = safeLink(url);
    if (!href) throw Error("http 또는 https로 시작하는 링크를 입력해 주세요.");
    replacement = `[${selected || "링크"}](${href.replace(/\(/g, "%28").replace(/\)/g, "%29")})`;
  }
  const text = value.slice(0, start) + replacement + value.slice(end);
  if (text.length > 10000)
    throw Error("내용은 10,000자까지 입력할 수 있습니다.");
  return { text, start, end: start + replacement.length };
}
