export const MAX_PHOTOS = 6;
export function checkPhotoFile(file: Pick<File, "type" | "size">) {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
    throw Error("JPG, PNG, WebP 사진을 선택해 주세요.");
  if (file.size <= 0 || file.size > 15 * 1024 * 1024)
    throw Error("사진 한 장은 15MB 이하여야 합니다.");
}
export async function preparePhoto(file: File): Promise<Blob> {
  checkPhotoFile(file);
  const bitmap = await createImageBitmap(file);
  try {
    if (
      !bitmap.width ||
      !bitmap.height ||
      bitmap.width * bitmap.height > 60000000
    )
      throw Error("사진 크기가 너무 큽니다. 크기를 줄여 다시 선택해 주세요.");
    const ratio = Math.min(1, 2400 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * ratio));
    canvas.height = Math.max(1, Math.round(bitmap.height * ratio));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw Error("이 브라우저에서 사진을 준비할 수 없습니다.");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.86, 0.72, 0.55]) {
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", quality),
      );
      if (blob?.type === "image/jpeg" && blob.size <= 2097152) return blob;
    }
    throw Error("사진 용량을 줄일 수 없습니다. 더 작은 사진을 선택해 주세요.");
  } finally {
    bitmap.close();
  }
}
