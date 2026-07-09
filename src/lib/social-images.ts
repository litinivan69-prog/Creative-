const IMAGE_MAX_SIDE = 2048;
const JPEG_QUALITY = 82;

/**
 * Downloads a visual and normalizes it for social networks: EXIF rotation,
 * longest side <= 2048, JPEG. Keeps files well under upload limits so albums
 * are never rejected because of oversized generator PNGs.
 */
export async function fetchAndPrepareImage(url: string): Promise<Buffer | null> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
    if (!response.ok) return null;
    const input = Buffer.from(await response.arrayBuffer());
    const sharp = (await import("sharp")).default;
    return await sharp(input)
      .rotate()
      .resize(IMAGE_MAX_SIDE, IMAGE_MAX_SIDE, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: JPEG_QUALITY })
      .toBuffer();
  } catch {
    return null;
  }
}
