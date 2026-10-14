import { checkPhotoFile } from "../community/photoFiles";
import { HOME_BANNER_BYTES } from "./banner";

export async function prepareBannerImage(file: File) {
  checkPhotoFile(file);
  const bitmap = await createImageBitmap(file).catch(() => { throw Error("이미지를 읽지 못했어요. 다른 JPG, PNG, WebP 파일을 선택해 주세요."); });
  try {
    if (!bitmap.width || !bitmap.height || bitmap.width * bitmap.height > 60000000) throw Error("이미지 크기를 줄여 다시 선택해 주세요.");
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw Error("이미지를 준비하지 못했어요.");
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    for (const quality of [.88, .76, .64]) {
      const file = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/jpeg", quality));
      if (file?.type === "image/jpeg" && file.size <= HOME_BANNER_BYTES) return { file, width: canvas.width, height: canvas.height };
    }
    throw Error("이미지 용량을 줄이지 못했어요. 더 작은 이미지를 선택해 주세요.");
  } finally { bitmap.close(); }
}
