import { fetchImageBlob } from "./api";
import { blobToImage } from "./imageTools";

const cache = new Map<string, Promise<HTMLImageElement>>();

/** Loads a stored picture once and keeps it for the session. */
export function getImage(id: string): Promise<HTMLImageElement> {
  let p = cache.get(id);
  if (!p) {
    p = fetchImageBlob(id).then(blobToImage);
    p.catch(() => cache.delete(id));
    cache.set(id, p);
  }
  return p;
}

/** Remember a picture we just uploaded so it does not need fetching back. */
export function primeImage(id: string, img: HTMLImageElement) {
  cache.set(id, Promise.resolve(img));
}
