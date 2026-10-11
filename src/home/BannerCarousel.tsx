import { Pause, Play } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Go } from "../community/shared";
import { BANNER_INTERVAL_MS, homeBanners } from "./banner";
import { HomeLink } from "./HomeLink";
import { useAutoAdvance } from "./useAutoAdvance";

const SLIDE_DURATION = 480;
type Slide = { index: number; previous: number | null; direction: number; revision: number };

export function BannerCarousel({ go }: { go: Go }) {
  const count = homeBanners.length;
  const [slide, setSlide] = useState<Slide>({ index: 0, previous: null, direction: 1, revision: 0 });
  const activeSlide = useRef<HTMLDivElement>(null);
  const leavingSlide = useRef<HTMLDivElement>(null);
  const gesture = useRef<{ x: number; y: number } | null>(null);
  const suppressClickUntil = useRef(0);
  const active = homeBanners[slide.index];
  const previous = slide.previous === null ? null : homeBanners[slide.previous];
  const autoplay = useAutoAdvance<HTMLDivElement>({
    interval: BANNER_INTERVAL_MS, itemKey: slide.index, enabled: count > 1,
    advance: () => move(1),
  });
  const select = (index: number, direction = index > slide.index ? 1 : -1) => {
    if (count < 2 || slide.previous !== null) return;
    autoplay.restart();
    if (index === slide.index) return;
    setSlide((current) => ({ index, previous: autoplay.reducedMotion ? null : current.index, direction, revision: current.revision + 1 }));
  };
  function move(step: number) { if (count > 1) select((slide.index + step + count) % count, Math.sign(step)); }

  useLayoutEffect(() => {
    if (slide.previous === null) return;
    const finish = () => setSlide((current) => current.revision === slide.revision ? { ...current, previous: null } : current);
    if (autoplay.reducedMotion || !activeSlide.current?.animate || !leavingSlide.current) { finish(); return; }
    const options: KeyframeAnimationOptions = { duration: SLIDE_DURATION, easing: "cubic-bezier(.2, .8, .2, 1)", fill: "both" };
    const incoming = activeSlide.current.animate([
      { transform: `translateX(${slide.direction * 100}%)` }, { transform: "translateX(0%)" },
    ], options);
    const outgoing = leavingSlide.current.animate([
      { transform: "translateX(0%)" }, { transform: `translateX(${-slide.direction * 100}%)` },
    ], options);
    void incoming.finished.then(finish).catch(() => {});
    return () => {
      incoming.cancel();
      outgoing.cancel();
    };
  }, [slide.previous, slide.revision, slide.direction, autoplay.reducedMotion]);
  useEffect(() => {
    if (!autoplay.inView || !autoplay.visible || count < 2) return;
    const next = new Image();
    next.src = homeBanners[(slide.index + 1) % count].src;
  }, [slide.index, count, autoplay.inView, autoplay.visible]);

  if (!active) return null;
  return <div ref={autoplay.ref} className="home-carousel" data-home-swipe-ignore role="region" aria-roledescription="캐러셀" aria-label="홈 이미지 배너"
    {...autoplay.interaction}
    onKeyDown={(event) => {
      if (count < 2 || !["ArrowLeft", "ArrowRight"].includes(event.key)) return;
      event.preventDefault();
      move(event.key === "ArrowLeft" ? -1 : 1);
    }}>
    <div className="home-carousel-stage" onTouchStart={(event) => {
      if (event.touches.length !== 1 || (event.target as HTMLElement).closest("button")) { gesture.current = null; return; }
      gesture.current = { x: event.touches[0].clientX, y: event.touches[0].clientY };
    }} onTouchEnd={(event) => {
      const start = gesture.current, end = event.changedTouches[0];
      gesture.current = null;
      if (!start || !end || count < 2) return;
      const dx = end.clientX - start.x, dy = end.clientY - start.y;
      if (Math.abs(dx) >= 40 && Math.abs(dx) > Math.abs(dy) * 1.5) {
        suppressClickUntil.current = Date.now() + 500;
        move(dx < 0 ? 1 : -1);
      }
    }} onTouchCancel={() => { gesture.current = null; }}
      onClickCapture={(event) => {
        if (Date.now() < suppressClickUntil.current) { event.preventDefault(); event.stopPropagation(); }
      }}>
      {previous && <div ref={leavingSlide} className="home-banner-slide is-leaving" aria-hidden="true">
        <img src={previous.src} width={previous.width} height={previous.height} alt="" />
      </div>}
      <div ref={activeSlide} className="home-banner-slide is-current" role="group" aria-roledescription="슬라이드" aria-label={`${slide.index + 1} / ${count}`} aria-live={autoplay.running ? "off" : "polite"}>
        <HomeLink path={active.path} go={go} className="home-image-banner" label={active.label}>
          <img src={active.src} width={active.width} height={active.height} alt={active.alt} fetchPriority={slide.index === 0 ? "high" : "auto"} />
        </HomeLink>
      </div>
      <span className="home-banner-label">예시 배너</span>
      {count > 1 && <div className="home-carousel-overlay">
        <div className="home-carousel-dots" role="group" aria-label="배너 선택">
          {homeBanners.map((banner, index) => <button type="button" key={banner.id}
            aria-label={`${count}개 중 ${index + 1}번째 배너: ${banner.label}`}
            aria-current={index === slide.index ? "true" : undefined}
            onClick={() => select(index)}><span aria-hidden="true" /></button>)}
        </div>
        <button type="button" className="home-carousel-toggle" aria-label={autoplay.playing ? "배너 자동 넘김 멈추기" : "배너 자동 넘김 시작하기"}
          onClick={autoplay.toggle}>{autoplay.playing ? <Pause size={16} aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}</button>
      </div>}
    </div>
  </div>;
}
