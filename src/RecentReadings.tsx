import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight, History } from "lucide-react";
import type { ArchiveRecord } from "./data";
import { READING_POSITION_CHANGED } from "./readerPosition";
import { recentReadings } from "./recentReadingHistory";
import "./RecentReadings.css";

export function RecentReadings({ catalog, openRecord }: {
  catalog: ArchiveRecord[];
  openRecord: (record: ArchiveRecord, resume: boolean) => void;
}) {
  const [items, setItems] = useState(() => recentReadings(catalog));
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    const update = () => setItems(recentReadings(catalog));
    update();
    window.addEventListener(READING_POSITION_CHANGED, update);
    window.addEventListener("storage", update);
    return () => {
      window.removeEventListener(READING_POSITION_CHANGED, update);
      window.removeEventListener("storage", update);
    };
  }, [catalog]);
  if (!items.length) return null;
  return <section className="archive-recent" aria-labelledby="recent-readings-heading">
    <div className="archive-recent-heading">
      <h2 id="recent-readings-heading"><History size={17} aria-hidden="true" />최근 본 큐시트</h2>
      <button type="button" aria-expanded={expanded} aria-controls="recent-readings-list" onClick={() => setExpanded(value => !value)}>
        {expanded ? "접기" : `펼치기 (${items.length})`}<ChevronDown size={15} aria-hidden="true" />
      </button>
    </div>
    <div id="recent-readings-list" hidden={!expanded}>
      <p className="archive-recent-note">이 기기에서 읽은 기록 · 누르면 읽던 위치로 이어져요.</p>
      {items.map(({ record, position }) => <button type="button" className="archive-recent-row" key={record.id} onClick={() => openRecord(record, true)}>
        <span><strong>{record.title} <span>{record.issue}회</span></strong><small>{record.year}년 {record.term}학기 · {position.page} / {record.pages}쪽</small></span>
        <ChevronRight size={17} aria-hidden="true" />
      </button>)}
    </div>
  </section>;
}
