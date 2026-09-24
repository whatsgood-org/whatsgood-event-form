// Client-side photo preparation for the submit form (ENG-671).
//
// The form used to upload the operator's original file verbatim. Flyer exports from Canva /
// Photoshop (print-size PNGs, 10–30 MB) and 48 MP+ phone photos exceed Cloudinary's upload
// limits, the upload 502'd, and — because a photo is required — the submitter could not
// submit at all. We now shrink the image in the browser before it leaves the device, which
// also makes mobile uploads an order of magnitude faster.

/** Longest edge we keep. Mirrors the admin's upload-time `c_limit,w_2400` (ENG-459). */
export const MAX_EDGE = 2400;
export const JPEG_QUALITY = 0.85;
/** Hard cap on what we send. Cloudinary's image limit on our plan is 10 MB. */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
/** Small JPEG/WebP files are sent untouched once they're within MAX_EDGE. */
const PASSTHROUGH_BYTES = 1.5 * 1024 * 1024;

/** Formats we must not re-encode: animated GIFs would lose animation, SVG isn't raster. */
const NEVER_RESIZE = new Set(["image/gif", "image/svg+xml"]);

/** Scale (w, h) down so the longest edge is at most `maxEdge`. Never enlarges. */
export function fitWithin(width: number, height: number, maxEdge = MAX_EDGE): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= maxEdge) return { width, height };
  const scale = maxEdge / longest;
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

/** Whether a decoded image needs re-encoding before upload. */
export function needsReencode(type: string, bytes: number, width: number, height: number): boolean {
  if (NEVER_RESIZE.has(type)) return false;
  if (Math.max(width, height) > MAX_EDGE) return true;
  const compact = type === "image/jpeg" || type === "image/webp";
  return !(compact && bytes <= PASSTHROUGH_BYTES);
}

/** `flyer.PNG` → `flyer.jpg`. */
export function jpegName(name: string): string {
  const base = name.replace(/\.[^./\\]+$/, "") || "photo";
  return `${base}.jpg`;
}

export function formatMb(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`;
}

/**
 * A message the submitter can act on. The old uploader discarded the server response and
 * showed only "1 image failed to upload", so nobody (including us) could tell why.
 */
export function uploadErrorMessage(fileName: string, status: number | null, detail?: string): string {
  const d = (detail || "").toLowerCase();
  if (status === 413 || d.includes("too large")) {
    return `"${fileName}" is too large. Please use a photo under ${formatMb(MAX_UPLOAD_BYTES)}.`;
  }
  if (d.includes("invalid image") || d.includes("unsupported")) {
    return `"${fileName}" isn't a supported image. Please use a JPG or PNG.`;
  }
  if (status === null) {
    return `"${fileName}" couldn't upload — check your connection and try again.`;
  }
  return `"${fileName}" couldn't upload. Please try again, or try a different photo.`;
}

/**
 * Browser-only: return a file that's safe to upload. Falls back to the original whenever the
 * browser can't decode it (e.g. HEIC in Chrome) — the server can still accept those, and a
 * failed optimisation must never block an upload that would otherwise have worked.
 */
export async function prepareImageForUpload(file: File): Promise<File> {
  if (NEVER_RESIZE.has(file.type) || typeof createImageBitmap !== "function") return file;

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return file;
  }

  try {
    if (!needsReencode(file.type, file.size, bitmap.width, bitmap.height)) return file;

    const { width, height } = fitWithin(bitmap.width, bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    // JPEG has no alpha — paint white first so transparent PNG flyers don't turn black.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(bitmap, 0, 0, width, height);

    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY));
    if (!blob) return file;
    // Re-encoding a small, already-optimised image can grow it; keep the original then —
    // but only if its dimensions were already in bounds (Cloudinary also caps megapixels).
    const inBounds = Math.max(bitmap.width, bitmap.height) <= MAX_EDGE;
    if (inBounds && blob.size >= file.size) return file;
    return new File([blob], jpegName(file.name), { type: "image/jpeg", lastModified: file.lastModified });
  } catch {
    return file;
  } finally {
    bitmap.close();
  }
}
