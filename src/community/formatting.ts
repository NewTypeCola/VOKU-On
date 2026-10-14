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
// Trim sentence punctuation, but keep balanced brackets that belong to a URL.
function urlText(value: string): string {
  const opening = "([{", closing = ")]}";
  const balance = [0, 0, 0];
  for (const char of value) {
    if (opening.includes(char)) balance[opening.indexOf(char)]++;
    if (closing.includes(char)) balance[closing.indexOf(char)]--;
  }
  let end = value.length;
  while (end) {
    const char = value[end - 1], index = closing.indexOf(char);
    if (/[.,!?;:…。，、！？；：]/u.test(char)) end--;
    else if (index >= 0 && balance[index] < 0) { balance[index]++; end--; }
    else break;
  }
  return value.slice(0, end);
}
export function plainTextParts(text: string): Inline[] {
  const parts: Inline[] = [];
  const pattern = /(?:https?:\/\/|www\.)[^\s<>"'`\\\u0000-\u001f\u007f\u200b-\u200d\ufeff“”‘’「」『』【】〈〉《》]+/giu;
  let start = 0;
  for (const match of text.matchAll(pattern)) {
    const index = match.index!;
    // Avoid turning part of another address or scheme into a separate link.
    if (index && /[\p{L}\p{N}_@./:+-]/u.test(text[index - 1])) continue;
    const label = urlText(match[0]);
    const href = safeLink(/^www\./i.test(label) ? `https://${label}` : label);
    if (!href) continue;
    if (index > start) parts.push({ type: "text", text: text.slice(start, index) });
    parts.push({ type: "link", text: label, href });
    start = index + label.length;
  }
  if (start < text.length) parts.push({ type: "text", text: text.slice(start) });
  return parts;
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
