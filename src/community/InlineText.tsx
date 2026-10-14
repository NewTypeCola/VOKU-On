import { inlineParts, plainTextParts } from "./formatting";
import { studyEnabled } from "../ux/tracker";
import { studyLink } from "../ux/model";

export function InlineText({ text, plain = false }: { text: string; plain?: boolean }) {
  return (plain ? plainTextParts(text) : inlineParts(text)).map((part, i) =>
    part.type === "bold" ? (
      <strong key={i}>{part.text}</strong>
    ) : part.type === "link" ? (
      <a key={i} href={part.href ? studyLink(part.href, studyEnabled, location.origin) : undefined} target="_blank" rel="noopener noreferrer">
        {part.text}
      </a>
    ) : (
      part.text
    ),
  );
}
