import { Button } from "@heroui/react";
import { Share2 } from "lucide-react";
import { useRef, useState } from "react";
import { shareLink } from "../share";
import { postPath, routeHref } from "./postAddress";
import type { CommunityPost } from "./types";

export function SharePost({ post, live, notify }: {
  post: CommunityPost; live: boolean; notify: (value: string) => void;
}) {
  const pending = useRef(false);
  const [busy, setBusy] = useState(false);
  if (!live || post.isSecret || post.readable === false || post.status !== "published") return null;
  const share = async () => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    try {
      const url = post.publicCode ? new URL(routeHref(postPath(post)), location.origin).href
        : `${location.origin}/share/${encodeURIComponent(post.id)}`;
      const result = await shareLink({ title: post.title, url });
      if (result === "copied") notify("공유 주소를 복사했어요.");
      if (result === "failed") notify("공유 주소를 복사하지 못했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };
  return <Button isIconOnly variant="ghost" className="icon-button"
    aria-label="게시글 공유" isDisabled={busy} aria-busy={busy} onPress={() => void share()}>
    <Share2 size={20} />
  </Button>;
}
