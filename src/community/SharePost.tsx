import { Button, Input, Label, TextField } from "@heroui/react";
import { Copy, Share2 } from "lucide-react";
import { useState } from "react";
import { Dialog, ErrorLine } from "./shared";
import type { CommunityPost } from "./types";
export function SharePost({
  post,
  live,
  notify,
}: {
  post: CommunityPost;
  live: boolean;
  notify: (value: string) => void;
}) {
  const [open, setOpen] = useState(false),
    [error, setError] = useState("");
  const url = `${location.origin}/share/${encodeURIComponent(post.id)}`;
  if (!live || post.isSecret || post.readable === false || post.status !== "published") return null;
  return (
    <>
      <Button
        isIconOnly
        variant="ghost"
        className="icon-button"
        aria-label="게시글 공유"
        onPress={() => {
          setOpen(true);
          setError("");
        }}
      >
        <Share2 size={20} />
      </Button>
      <Dialog title="게시글 공유" open={open} close={() => setOpen(false)}>
        <div className="community-form">
          <p className="community-help">
            카카오톡 등에 이 주소를 보내면 글 제목과 대표 사진을 미리 볼 수
            있어요.
          </p>
          <TextField isReadOnly value={url}>
            <Label>공유 주소</Label>
            <Input
              aria-label="게시글 공유 주소"
              onFocus={(e) => e.target.select()}
            />
          </TextField>
          <Button
            variant="outline"
            onPress={async () => {
              try {
                await navigator.clipboard.writeText(url);
                setError("");
                notify("공유 주소를 복사했어요.");
              } catch {
                setError("주소를 길게 누르거나 선택해 복사해 주세요.");
              }
            }}
          >
            <Copy size={17} />
            링크 복사
          </Button>
          {!!navigator.share && (
            <Button
              onPress={async () => {
                try {
                  await navigator.share({
                    title: post.title,
                    text: post.title,
                    url,
                  });
                } catch (e) {
                  if ((e as Error).name !== "AbortError")
                    setError(
                      "공유 창을 열지 못했어요. 링크 복사를 이용해 주세요.",
                    );
                }
              }}
            >
              <Share2 size={17} />
              다른 앱으로 공유
            </Button>
          )}
          <ErrorLine text={error} />
        </div>
      </Dialog>
    </>
  );
}
