// The rules for delivering work. Plain constants only, so both the server and the browser can import this file.

export const MAX_DELIVERY_FILES = 5;
export const MAX_DELIVERY_FILE_BYTES = 25 * 1024 * 1024; // 25 MB per file; bigger work goes in a link
export const MAX_DELIVERY_LINKS = 8;

// Only these kinds of files can be delivered. Programs (exe, bat, js, ...) are not on the list on purpose.
export const EXTENSION_MIME: Record<string, string> = {
  zip: "application/zip", rar: "application/vnd.rar", "7z": "application/x-7z-compressed",
  tar: "application/x-tar", gz: "application/gzip",
  pdf: "application/pdf",
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", gif: "image/gif",
  psd: "image/vnd.adobe.photoshop", ai: "application/postscript", fig: "application/octet-stream",
  sketch: "application/octet-stream", xd: "application/octet-stream", svg: "image/svg+xml",
  doc: "application/msword", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint", pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  txt: "text/plain", md: "text/markdown", csv: "text/csv", json: "application/json",
  mp4: "video/mp4", mov: "video/quicktime", webm: "video/webm", mp3: "audio/mpeg", wav: "audio/wav",
  ttf: "font/ttf", otf: "font/otf", woff: "font/woff", woff2: "font/woff2",
  sql: "application/sql", ico: "image/x-icon",
};

export const ALLOWED_EXTENSIONS = Object.keys(EXTENSION_MIME);

/** Images the browser may show directly; everything else is always a download. */
export const INLINE_IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "webp", "gif"];

export function extensionOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i + 1).toLowerCase() : "";
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
