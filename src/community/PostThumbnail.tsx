import { Image } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { resolvePhotos, releasePhotoUrls } from "./photoStorage";
import type { PostPhoto } from "./types";

export function PostThumbnail({
  photo,
  count,
}: {
  photo: PostPhoto;
  count: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [url, setUrl] = useState("");
  useEffect(() => {
    let active = true,
      resolved: { url: string }[] = [];
    setUrl("");
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        observer.disconnect();
        void resolvePhotos([photo])
          .then((photos) => {
            if (!active) {
              releasePhotoUrls(photos);
              return;
            }
            resolved = photos;
            setUrl(photos[0].url);
          })
          .catch(() => {});
      },
      { rootMargin: "160px" },
    );
    if (ref.current) observer.observe(ref.current);
    return () => {
      active = false;
      observer.disconnect();
      releasePhotoUrls(resolved);
    };
  }, [photo.id, photo.path]);
  return (
    <span
      ref={ref}
      className="community-thumbnail"
      aria-label={`사진 ${count}장`}
    >
      {url ? (
        <img
          src={url}
          alt="게시글 대표 사진"
          loading="lazy"
          onError={() => setUrl("")}
        />
      ) : (
        <Image size={22} />
      )}
      {count > 1 && <small>+{count - 1}</small>}
    </span>
  );
}
