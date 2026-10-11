import { Button } from "@heroui/react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import { pageWindow } from "./reading";

export function Pagination({
  page,
  total,
  change,
  disabled = false,
  label = "게시글 페이지",
}: {
  page: number;
  total: number;
  change: (page: number) => void;
  disabled?: boolean;
  label?: string;
}) {
  const pages = Math.max(1, Math.ceil(total / 20));
  const [jump, setJump] = useState(String(page));
  useEffect(() => setJump(String(page)), [page]);
  if (pages === 1) return null;
  return (
    <nav className="community-pages" aria-label={label}>
      <div className="community-page-buttons">
        <Button
          size="sm"
          variant="ghost"
          isDisabled={disabled || page === 1}
          onPress={() => change(1)}
        >
          처음
        </Button>
        <Button
          size="sm"
          isIconOnly
          variant="ghost"
          aria-label="이전 페이지"
          isDisabled={disabled || page === 1}
          onPress={() => change(page - 1)}
        >
          <ChevronLeft size={17} />
        </Button>
        {pageWindow(page, pages).map((n) => (
          <Button
            key={n}
            size="sm"
            variant={n === page ? "primary" : "ghost"}
            aria-label={`${n}페이지`}
            aria-current={n === page ? "page" : undefined}
            isDisabled={disabled}
            onPress={() => change(n)}
          >
            {n}
          </Button>
        ))}
        <Button
          size="sm"
          isIconOnly
          variant="ghost"
          aria-label="다음 페이지"
          isDisabled={disabled || page === pages}
          onPress={() => change(page + 1)}
        >
          <ChevronRight size={17} />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          isDisabled={disabled || page === pages}
          onPress={() => change(pages)}
        >
          끝
        </Button>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const n = Number(jump);
          if (Number.isSafeInteger(n) && n >= 1 && n <= pages) change(n);
        }}
      >
        <label>
          페이지{" "}
          <input
            aria-label="이동할 페이지"
            type="number"
            inputMode="numeric"
            min={1}
            max={pages}
            required
            value={jump}
            onChange={(e) => setJump(e.target.value)}
          />
        </label>
        <span>/ {pages.toLocaleString()}</span>
        <Button size="sm" variant="outline" type="submit" isDisabled={disabled}>
          이동
        </Button>
      </form>
    </nav>
  );
}
