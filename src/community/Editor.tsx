import { Button, Input, Label, TextArea, TextField } from "@heroui/react";
import { useRef, useState } from "react";
import { Bold, Link, List } from "lucide-react";
import { Dialog, ErrorLine } from "./shared";
import { formatSelection } from "./formatting";
import { PostBody } from "./PostBody";
export function Editor({
  body,
  format,
  change,
  disabled,
}: {
  body: string;
  format: string;
  change: (body: string, format: string) => void;
  disabled: boolean;
}) {
  const area = useRef<HTMLTextAreaElement>(null);
  const selection = useRef({ start: 0, end: 0 });
  const [preview, setPreview] = useState(false),
    [link, setLink] = useState(false),
    [url, setUrl] = useState(""),
    [error, setError] = useState("");
  const remember = () => {
    if (area.current)
      selection.current = {
        start: area.current.selectionStart,
        end: area.current.selectionEnd,
      };
  };
  const apply = (kind: "bold" | "list" | "link") => {
    try {
      const result = formatSelection(
        body,
        selection.current.start,
        selection.current.end,
        kind,
        url,
      );
      change(result.text, "markdown");
      setError("");
      setLink(false);
      requestAnimationFrame(() => {
        area.current?.focus();
        area.current?.setSelectionRange(result.start, result.end);
      });
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <div className="community-editor">
      <div
        className="community-editor-tools"
        role="group"
        aria-label="본문 서식"
      >
        <Button
          size="sm"
          variant="ghost"
          isDisabled={disabled || preview}
          onPress={() => apply("bold")}
        >
          <Bold size={16} />
          굵게
        </Button>
        <Button
          size="sm"
          variant="ghost"
          isDisabled={disabled || preview}
          onPress={() => apply("list")}
        >
          <List size={16} />
          목록
        </Button>
        <Button
          size="sm"
          variant="ghost"
          isDisabled={disabled || preview}
          onPress={() => {
            setUrl("");
            setError("");
            setLink(true);
          }}
        >
          <Link size={16} />
          링크
        </Button>
        <Button
          size="sm"
          variant="ghost"
          aria-pressed={preview}
          onPress={() => setPreview(!preview)}
        >
          {preview ? "계속 쓰기" : "미리보기"}
        </Button>
      </div>
      {preview ? (
        <section
          className="community-editor-preview"
          aria-label="본문 미리보기"
        >
          <PostBody
            body={body || "아직 작성한 내용이 없어요."}
            format={format}
          />
        </section>
      ) : (
        <TextField
          isRequired
          isDisabled={disabled}
          value={body}
          onChange={(value) => change(value, format)}
        >
          <Label>내용</Label>
          <TextArea
            ref={area}
            onSelect={remember}
            onBlur={remember}
            rows={10}
            maxLength={10000}
            placeholder="방송실의 기억, 오늘의 안부를 편하게 남겨주세요."
          />
        </TextField>
      )}
      <span className="community-count">
        {body.length.toLocaleString()} / 10,000
      </span>
      {!link && <ErrorLine text={error} />}
      <Dialog title="본문에 링크 넣기" open={link} close={() => setLink(false)}>
        <div className="community-form">
          <TextField value={url} onChange={setUrl}>
            <Label>연결할 주소</Label>
            <Input type="url" placeholder="https://" />
          </TextField>
          <ErrorLine text={error} />
          <Button onPress={() => apply("link")}>링크 넣기</Button>
        </div>
      </Dialog>
    </div>
  );
}
