import { useLayoutEffect, type RefObject } from "react";
import { POST_BODY_LIMIT } from "./composerFields";

export function Editor({ body, change, disabled, area, error }: {
  body: string;
  change: (body: string) => void;
  disabled: boolean;
  area: RefObject<HTMLTextAreaElement | null>;
  error: string;
}) {
  useLayoutEffect(() => {
    const input = area.current;
    if (!input) return;
    const resize = () => {
      input.style.height = "auto";
      input.style.height = `${input.scrollHeight}px`;
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [body, area]);
  return (
    <div className="community-editor">
      <label htmlFor="community-post-body">내용</label>
      <textarea
        id="community-post-body"
        ref={area}
        value={body}
        onChange={(event) => change(event.target.value)}
        disabled={disabled}
        required
        aria-invalid={!!error}
        aria-describedby={error ? "community-post-body-error" : undefined}
        rows={8}
        maxLength={POST_BODY_LIMIT}
        placeholder="오랜만의 안부도, 방송실의 추억도 좋아요."
      />
      {error && <p id="community-post-body-error" className="community-error" role="alert">{error}</p>}
      {body.length >= POST_BODY_LIMIT * 0.9 && (
        <p className="community-compose-count">
          {body.length.toLocaleString()} / {POST_BODY_LIMIT.toLocaleString()}자
        </p>
      )}
    </div>
  );
}
