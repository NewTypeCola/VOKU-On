import { postPath, routeHref } from "./postAddress";
import { Button } from "@heroui/react";
import { ChevronLeft, ChevronRight, Pin } from "lucide-react";
import { useRef, useState } from "react";
import type { CommunityPost } from "./types";
import type { Go } from "./shared";

export function NoticeBanners({
  notices,
  go,
}: {
  notices: CommunityPost[];
  go: Go;
}) {
  const track = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const move = (next: number) => {
    const card = track.current?.children[next] as HTMLElement | undefined;
    if (card && track.current)
      track.current.scrollTo({
        left:
          card.offsetLeft -
          (track.current.children[0] as HTMLElement).offsetLeft,
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
      });
  };
  return (
    <section className="community-notice-banners" aria-label="공지 배너">
      <div
        className="community-notice-track"
        ref={track}
        tabIndex={0}
        aria-label="공지를 좌우로 넘겨 볼 수 있어요"
        onScroll={() => {
          const container = track.current;
          if (!container) return;
          const first = container.children[0] as HTMLElement;
          const closest = Array.from(container.children).reduce(
            (best, card, n) =>
              Math.abs(
                (card as HTMLElement).offsetLeft -
                  first.offsetLeft -
                  container.scrollLeft,
              ) <
              Math.abs(
                (container.children[best] as HTMLElement).offsetLeft -
                  first.offsetLeft -
                  container.scrollLeft,
              )
                ? n
                : best,
            0,
          );
          setIndex(closest);
        }}
      >
        {notices.map((post) => (
          <a
            key={post.id}
            className="community-notice-card"
            href={routeHref(postPath(post))}
            onClick={(event) => {
              if (event.metaKey || event.ctrlKey || event.shiftKey) return;
              event.preventDefault();
              go(postPath(post));
            }}
          >
            <span>
              <Pin size={14} />
              공지
            </span>
            <strong>{post.title}</strong>
            <ChevronRight size={17} />
          </a>
        ))}
      </div>
      {notices.length > 1 && (
        <nav className="community-notice-controls" aria-label="공지 배너 이동">
          <Button
            variant="ghost"
            isIconOnly
            aria-label="이전 공지"
            isDisabled={index === 0}
            onPress={() => move(index - 1)}
          >
            <ChevronLeft size={18} />
          </Button>
          <span aria-live="polite">
            {index + 1} / {notices.length}
          </span>
          <Button
            variant="ghost"
            isIconOnly
            aria-label="다음 공지"
            isDisabled={index === notices.length - 1}
            onPress={() => move(index + 1)}
          >
            <ChevronRight size={18} />
          </Button>
        </nav>
      )}
    </section>
  );
}
