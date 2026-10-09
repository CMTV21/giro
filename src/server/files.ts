import "server-only";
import { HttpError } from "./errors.ts";

export type SafeMime = "image/jpeg" | "image/png" | "image/webp" | "application/pdf";
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024; // stays under Vercel's 4.5 MB request limit

/** Identify a file by its bytes, never by its name or claimed type (blocks disguised HTML/SVG). */
export function sniffMime(buf: Uint8Array): SafeMime | undefined {
  const b = (i: number) => buf[i];
  if (b(0) === 0xff && b(1) === 0xd8 && b(2) === 0xff) return "image/jpeg";
  if (b(0) === 0x89 && b(1) === 0x50 && b(2) === 0x4e && b(3) === 0x47) return "image/png";
  if (b(0) === 0x52 && b(1) === 0x49 && b(2) === 0x46 && b(3) === 0x46 && b(8) === 0x57 && b(9) === 0x45 && b(10) === 0x42 && b(11) === 0x50) return "image/webp";
  if (b(0) === 0x25 && b(1) === 0x50 && b(2) === 0x44 && b(3) === 0x46 && b(4) === 0x2d) return "application/pdf";
  return undefined;
}

/** Read the `file` field of a multipart upload and validate size and type. */
export async function readUpload(request: Request): Promise<{ bytes: Uint8Array; mime: SafeMime; name: string }> {
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_UPLOAD_BYTES + 64 * 1024) throw new HttpError(413, "too_large", "That file is over 4 MB. Try a smaller photo or PDF.");
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    throw new HttpError(400, "invalid_upload", "Upload a photo or PDF.");
  }
  const file = form.get("file");
  if (!(file instanceof Blob)) throw new HttpError(400, "invalid_upload", "Upload a photo or PDF.");
  if (file.size > MAX_UPLOAD_BYTES) throw new HttpError(413, "too_large", "That file is over 4 MB. Try a smaller photo or PDF.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const mime = sniffMime(bytes);
  if (!mime) throw new HttpError(415, "unsupported_type", "Use a JPEG, PNG or WebP photo, or a PDF.");
  const name = (file instanceof File ? file.name : "upload").replace(/[^\w.\- ]+/g, "_").slice(0, 120) || "upload";
  return { bytes, mime, name };
}
