import { studyOperation } from "../ux/signals";
import { Button, Modal } from "@heroui/react";
import { ArrowLeft, ArrowRight, ImagePlus, X, ZoomIn } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { uid } from "../data";
import { ErrorLine } from "./shared";
import { MAX_PHOTOS, preparePhoto } from "./photoFiles";
import {
  resolvePhotos,
  releasePhotoUrls,
  type DraftPhoto,
} from "./photoStorage";
import type { PostPhoto } from "./types";

export function PhotoPicker({
  photos,
  change,
  disabled,
  preparing,
  children,
}: {
  photos: DraftPhoto[];
  change: (value: DraftPhoto[]) => void;
  disabled: boolean;
  preparing: (value: boolean) => void;
  children?: ReactNode;
}) {
  const input = useRef<HTMLInputElement>(null);
  const current = useRef(photos);
  current.current = photos;
  const active = useRef(true);
  const [error, setError] = useState("");
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      releasePhotoUrls(current.current);
    };
  }, []);
  const select = async (files: File[]) => {
    setError("");
    if (files.length + photos.length > MAX_PHOTOS) {
      setError("사진은 한 글에 6장까지 첨부할 수 있어요.");
      return;
    }
    if (!files.length) return;
    preparing(true);
    const next: DraftPhoto[] = [];
    try {
      for (const file of files) {
        const blob = await preparePhoto(file);
        next.push({
          id: uid(),
          path: "",
          url: URL.createObjectURL(blob),
          file: blob,
        });
      }
      if (active.current) change([...photos, ...next]);
      else releasePhotoUrls(next);
    } catch (e) {
      releasePhotoUrls(next);
      if (active.current) setError((e as Error).message);
    } finally {
      if (active.current) preparing(false);
    }
  };
  const move = (from: number, delta: number) => {
    const next = [...photos];
    [next[from], next[from + delta]] = [next[from + delta], next[from]];
    change(next);
  };
  return (
    <section className="community-photo-picker" aria-label="사진 첨부">
      <div className="community-photo-picker-heading">
        <Button
          variant="ghost"
          isDisabled={disabled || photos.length >= MAX_PHOTOS}
          onPress={() => input.current?.click()}
        >
          <ImagePlus size={17} />
          사진 추가
        </Button>
        {children}
      </div>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        disabled={disabled}
        aria-label="첨부할 사진 선택"
        hidden
        onChange={(e) => {
          const files = Array.from(e.target.files || []);
          e.target.value = "";
          void select(files);
        }}
      />
      {!!photos.length && (
        <p className="community-photo-summary" role="status">사진 {photos.length} / 6 · 첫 사진이 대표 사진이에요.</p>
      )}
      {!!photos.length && (
        <ol className="community-photo-previews">
          {photos.map((p, i) => (
            <li key={p.id}>
              <img src={p.url} alt={`첨부 사진 ${i + 1}`} />
              <span>
                {i + 1}
                {i === 0 ? " · 대표 사진" : ""}
              </span>
              <div>
                <Button
                  size="sm"
                  variant="ghost"
                  isIconOnly
                  aria-label={`${i + 1}번 사진 앞으로`}
                  isDisabled={disabled || i === 0}
                  onPress={() => move(i, -1)}
                >
                  <ArrowLeft size={16} />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  isIconOnly
                  aria-label={`${i + 1}번 사진 뒤로`}
                  isDisabled={disabled || i === photos.length - 1}
                  onPress={() => move(i, 1)}
                >
                  <ArrowRight size={16} />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  isIconOnly
                  aria-label={`${i + 1}번 사진 제거`}
                  isDisabled={disabled}
                  onPress={() => {
                    releasePhotoUrls([p]);
                    change(photos.filter((x) => x.id !== p.id));
                  }}
                >
                  <X size={16} />
                </Button>
              </div>
            </li>
          ))}
        </ol>
      )}
      <ErrorLine text={error} />
      {(photos.length > 0 || error) && (
        <details className="community-photo-help">
          <summary>사진 첨부 안내</summary>
          <p>JPG·PNG·WebP, 한 장당 15MB까지 첨부할 수 있어요. 사진은 업로드할 때 자동으로 줄입니다. 첫 사진은 목록과 공유 미리보기에 표시돼요.</p>
        </details>
      )}
    </section>
  );
}
export function PhotoGallery({
  photos,
  title,
}: {
  photos: PostPhoto[];
  title: string;
}) {
  const [images, setImages] = useState<DraftPhoto[]>([]),
    [error, setError] = useState(""),
    [retry, setRetry] = useState(0),
    [selected, setSelected] = useState<number | null>(null),
    [zoom, setZoom] = useState(false);
  const identity = photos.map((p) => p.id).join(",");
  useEffect(() => {
    let active = true,
      loaded: DraftPhoto[] = [];
    setImages([]);
    setError("");
    setSelected(null);
    setZoom(false);
    const finish = studyOperation("content.photos");
    resolvePhotos(photos)
      .then((value) => {
        loaded = value;
        if (active) { setImages(value); if (photos.length) finish(1); }
        else releasePhotoUrls(value);
      })
      .catch((e) => {
        if (active) { setError((e as Error).message); finish(0); }
      });
    return () => {
      active = false;
      releasePhotoUrls(loaded);
    };
  }, [identity, retry]);
  if (!photos.length) return null;
  const show = (index: number) => {
    setSelected(index);
    setZoom(false);
  };
  return (
    <section
      className="community-photo-gallery"
      aria-label={`첨부 사진 ${photos.length}장`}
    >
      {!images.length && !error && <p role="status">사진 불러오는 중…</p>}
      {error && (
        <div>
          <ErrorLine text={error} />
          <Button variant="outline" onPress={() => setRetry((n) => n + 1)}>
            사진 다시 불러오기
          </Button>
        </div>
      )}
      {images.map((p, i) => (
        <button
          key={p.id}
          className="community-photo-open"
          onClick={() => show(i)}
          aria-label={`${i + 1}번 사진 크게 보기`}
        >
          <img
            src={p.url}
            alt={`${title} 첨부 사진 ${i + 1}`}
            loading="lazy"
            onError={() =>
              setError(
                "사진 연결이 만료되었거나 불러오지 못했어요. 다시 불러와 주세요.",
              )
            }
          />
          <span>
            <ZoomIn size={15} />
            크게 보기 · {i + 1} / {images.length}
          </span>
        </button>
      ))}
      <Modal.Backdrop
        isOpen={selected !== null}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <Modal.Container size="full">
          <Modal.Dialog className="community-photo-lightbox">
            <Modal.Header>
              <Modal.Heading>
                사진 {(selected ?? 0) + 1} / {images.length}
              </Modal.Heading>
              <Modal.CloseTrigger aria-label="사진 닫기" />
            </Modal.Header>
            <Modal.Body>
              <div className={`community-photo-full ${zoom ? "zoomed" : ""}`}>
                <img
                  src={images[selected ?? 0]?.url}
                  alt={`${title} 첨부 사진 ${(selected ?? 0) + 1}`}
                />
              </div>
            </Modal.Body>
            <Modal.Footer>
              <Button
                variant="secondary"
                isDisabled={selected === 0}
                onPress={() => show(selected! - 1)}
              >
                이전 사진
              </Button>
              <Button
                variant="secondary"
                aria-pressed={zoom}
                onPress={() => setZoom(!zoom)}
              >
                {zoom ? "화면에 맞춤" : "확대"}
              </Button>
              <Button
                variant="secondary"
                isDisabled={selected === images.length - 1}
                onPress={() => show(selected! + 1)}
              >
                다음 사진
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </section>
  );
}
