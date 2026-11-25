export const MAX_DIM = 1400;
export const MAX_BYTES = 400 * 1024;

function toBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not encode image"))), type, quality));
}

export function blobToImage(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => { resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Could not read that image")); };
    img.src = url;
  });
}

/**
 * Shrinks a picture in the browser: longest side at most 1400 px and under 400 KB.
 * A small PNG/JPEG that is already within limits is kept as is. Anything else becomes a JPEG on a
 * white background, lowering quality and then size until it fits.
 */
export async function compressImage(file: File): Promise<{ blob: Blob; width: number; height: number; note: string }> {
  const img = await blobToImage(file);
  const w0 = img.naturalWidth;
  const h0 = img.naturalHeight;
  if (!w0 || !h0) throw new Error("That image has no size");

  if (file.size <= MAX_BYTES && Math.max(w0, h0) <= MAX_DIM && (file.type === "image/png" || file.type === "image/jpeg")) {
    return { blob: file, width: w0, height: h0, note: `${Math.round(file.size / 1024)} KB, kept as is` };
  }

  let scale = Math.min(1, MAX_DIM / Math.max(w0, h0));
  const canvas = document.createElement("canvas");
  let last: Blob | null = null;
  for (let attempt = 0; attempt < 8; attempt++) {
    const w = Math.max(1, Math.round(w0 * scale));
    const h = Math.max(1, Math.round(h0 * scale));
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { alpha: false })!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, w, h);
    for (const q of [0.9, 0.8, 0.7, 0.6, 0.5]) {
      const blob = await toBlob(canvas, "image/jpeg", q);
      last = blob;
      if (blob.size <= MAX_BYTES) {
        return { blob, width: w, height: h, note: `${Math.round(file.size / 1024)} KB → ${Math.round(blob.size / 1024)} KB (${w}×${h})` };
      }
    }
    scale *= 0.82;
  }
  if (last && last.size <= 1_200_000) return { blob: last, width: canvas.width, height: canvas.height, note: `${Math.round(last.size / 1024)} KB (could not get under 400 KB)` };
  throw new Error("Could not shrink that image enough. Try a simpler or smaller picture.");
}
