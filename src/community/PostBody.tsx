import { inlineParts, plainTextParts } from "./formatting";
function InlineText({ text, plain = false }: { text: string; plain?: boolean }) {
  return (plain ? plainTextParts(text) : inlineParts(text)).map((part, i) =>
    part.type === "bold" ? (
      <strong key={i}>{part.text}</strong>
    ) : part.type === "link" ? (
      <a key={i} href={part.href} target="_blank" rel="noopener noreferrer">
        {part.text}
      </a>
    ) : (
      part.text
    ),
  );
}
export function PostBody({ body, format }: { body: string; format?: string }) {
  if (format !== "markdown")
    return <div className="community-body"><InlineText text={body} plain /></div>;
  const blocks: { list: boolean; lines: string[] }[] = [];
  for (const line of body.split("\n")) {
    const list = line.startsWith("- ");
    const last = blocks.at(-1);
    if (last?.list === list) last.lines.push(list ? line.slice(2) : line);
    else blocks.push({ list, lines: [list ? line.slice(2) : line] });
  }
  return (
    <div className="community-body community-formatted">
      {blocks.map((block, i) =>
        block.list ? (
          <ul key={i}>
            {block.lines.map((line, j) => (
              <li key={j}>
                <InlineText text={line} />
              </li>
            ))}
          </ul>
        ) : (
          <p key={i}>
            {block.lines.map((line, j) => (
              <span key={j}>
                {j > 0 && <br />}
                <InlineText text={line} />
              </span>
            ))}
          </p>
        ),
      )}
    </div>
  );
}
