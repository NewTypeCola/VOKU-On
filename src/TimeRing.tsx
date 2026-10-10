import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@heroui/react";
import { ArrowRight, ChevronLeft, ChevronRight, MoveHorizontal, Pause, Play } from "lucide-react";
import type { ArchiveRecord } from "./data";
import type { RingScene } from "./ringScene";
import yearPreviews from "./yearPreviews.json";

type Props = {
  catalog: ArchiveRecord[];
  years: number[];
  year: number;
  onYearChange: (year: number) => void;
  onOpenRecord: (record: ArchiveRecord) => void;
};

function PreviewPage({ image, label }: { image: string; label: string }) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  return (
    <span className={`ring-preview-paper ${loaded ? "is-loaded" : ""}`}>
      {!failed && <img src={image} alt={label} draggable={false} decoding="async" onLoad={() => setLoaded(true)} onError={() => setFailed(true)} />}
      {!loaded && <span className="ring-preview-loading">{failed ? "원고 열기" : "첫 장 불러오는 중"}</span>}
    </span>
  );
}

export default function TimeRing({ catalog, years, year, onYearChange, onOpenRecord }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const scene = useRef<RingScene | null>(null);
  const onChange = useRef(onYearChange);
  const latestYear = useRef(year);
  onChange.current = onYearChange;
  latestYear.current = year;
  const [status, setStatus] = useState<"loading" | "ready" | "unavailable">("loading");
  const [paused, setPaused] = useState(false);
  const examples = useMemo(() => new Map(yearPreviews.previews.map((preview) => {
    const record = catalog.find((item) => item.id === preview.recordId);
    return [preview.year, { preview, record }] as const;
  })), [catalog]);
  const example = examples.get(year);

  useEffect(() => {
    // Preload only the adjacent years so turning the ring remains responsive.
    const index = years.indexOf(year);
    for (const offset of [-1, 1]) {
      const next = examples.get(years[(index + offset + years.length) % years.length]);
      if (next) { const image = new Image(); image.src = next.preview.image; }
    }
  }, [year, years, examples]);

  useEffect(() => {
    let disposed = false;
    let instance: RingScene | null = null;
    const unavailable = () => { if (!disposed) setStatus("unavailable"); };
    import("./ringScene").then(({ RingScene }) => {
      if (disposed || !canvas.current) return;
      try {
        instance = new RingScene(canvas.current, catalog, years, latestYear.current,
          (value) => onChange.current(value), unavailable);
        scene.current = instance;
        setStatus("ready");
      } catch {
        unavailable();
      }
    }).catch(unavailable);
    return () => { disposed = true; instance?.dispose(); scene.current = null; };
  }, [catalog, years]);

  useEffect(() => { scene.current?.setYear(year); }, [year]);
  useEffect(() => { scene.current?.setPaused(paused); }, [paused, status]);
  const step = (direction: number) => {
    const index = years.indexOf(year);
    onYearChange(years[(index + direction + years.length) % years.length]);
  };
  const count = catalog.filter((record) => record.year === year).length;

  return (
    <section className="time-ring" aria-label="시간의 고리" data-year={year}>
      <div className={`time-ring-stage ${status === "unavailable" ? "ring-unavailable" : ""}`}>
        <canvas
          ref={canvas}
          className="time-ring-canvas"
          role="slider"
          tabIndex={0}
          aria-label="시간의 고리 연도 선택"
          aria-valuemin={years[0]}
          aria-valuemax={years.at(-1)}
          aria-valuenow={year}
          aria-valuetext={`${year}년, 원고 ${count}건`}
          aria-describedby="ring-instruction"
          onKeyDown={(event) => {
            if (["ArrowLeft", "ArrowDown", "ArrowRight", "ArrowUp", "Home", "End"].includes(event.key)) {
              event.preventDefault();
              if (event.key === "Home") onYearChange(years[0]);
              else if (event.key === "End") onYearChange(years[years.length - 1]);
              else step(["ArrowRight", "ArrowUp"].includes(event.key) ? 1 : -1);
            }
          }}
        />
        {status !== "ready" && <div className="ring-placeholder" aria-hidden="true" />}
        <div className="time-ring-center">
          <div className="ring-year-controls">
            <Button isIconOnly variant="ghost" aria-label="이전 연도" onPress={() => step(-1)}><ChevronLeft size={20} /></Button>
            <strong>{year}</strong>
            <Button isIconOnly variant="ghost" aria-label="다음 연도" onPress={() => step(1)}><ChevronRight size={20} /></Button>
          </div>
          {example?.record && (
            <button
              className="ring-preview"
              onClick={() => onOpenRecord(example.record!)}
              aria-label={`${year}년 예시 원고, ${example.record.title} ${example.record.issue}회 큐시트 읽기`}
            >
              <PreviewPage key={example.record.id} image={example.preview.image} label={`${year}년 ${example.record.title} ${example.record.issue}회 첫 장`} />
              <span className="ring-preview-title">{example.record.title}<ArrowRight size={12} /></span>
            </button>
          )}
        </div>
      </div>
      <p id="ring-instruction" className="ring-instruction"><MoveHorizontal size={14} />{status === "unavailable" ? "화살표로 연도를 골라보세요" : "좌우로 돌려보세요"}</p>
      {status === "ready" && <Button isIconOnly variant="ghost" className="ring-motion-toggle"
        aria-label={paused ? "관람객 움직임 재생" : "관람객 움직임 일시정지"}
        onPress={() => setPaused((value) => !value)}>
        {paused ? <Play size={13} /> : <Pause size={13} />}
      </Button>}
    </section>
  );
}
