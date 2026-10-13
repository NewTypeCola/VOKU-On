import { checkPhotoFile } from "./photoFiles";
import { PROFILE_PHOTO_LIMIT } from "./profilePhoto";

// A fresh JPEG strips camera metadata and bounds the public avatar's size.
export async function prepareProfilePhoto(file: File): Promise<Blob> {
  checkPhotoFile(file);
  const bitmap = await createImageBitmap(file).catch(() => { throw Error("사진을 읽지 못했어요. 다른 JPG, PNG, WebP 사진을 선택해 주세요."); });
  try {
    if (!bitmap.width || !bitmap.height || bitmap.width * bitmap.height > 60000000) throw Error("사진 크기가 너무 큽니다. 크기를 줄여 다시 선택해 주세요.");
    const side = Math.min(bitmap.width, bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = Math.min(512, side);
    const context = canvas.getContext("2d");
    if (!context) throw Error("이 브라우저에서 사진을 준비할 수 없습니다.");
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.86, 0.7, 0.5]) {
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/jpeg", quality));
      if (blob?.type === "image/jpeg" && blob.size <= PROFILE_PHOTO_LIMIT) return blob;
    }
    throw Error("사진 용량을 줄이지 못했어요. 다른 사진을 선택해 주세요.");
  } finally { bitmap.close(); }
}
