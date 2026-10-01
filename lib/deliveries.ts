import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { execute } from "@/lib/db";
import { LINK_KINDS, type LinkKind } from "@/lib/services";
import { UPLOAD_ROOT, UploadError } from "@/lib/uploads";
import {
  EXTENSION_MIME as EXTENSIONS,
  MAX_DELIVERY_FILE_BYTES,
  MAX_DELIVERY_LINKS,
  extensionOf,
} from "@/lib/delivery-rules";

// the route files import the rules from here, so they are passed on
export { INLINE_IMAGE_EXTENSIONS, MAX_DELIVERY_FILES, extensionOf } from "@/lib/delivery-rules";

/** Revisions a client may ask for when the service did not say how many. */
export const DEFAULT_REVISIONS = 2;

// Files whose first bytes we can check, so a renamed program cannot pass as a document or an image
const SIGNATURES: Record<string, (b: Buffer) => boolean> = {
  zip: (b) => b.subarray(0, 2).toString("ascii") === "PK",
  docx: (b) => b.subarray(0, 2).toString("ascii") === "PK",
  xlsx: (b) => b.subarray(0, 2).toString("ascii") === "PK",
  pptx: (b) => b.subarray(0, 2).toString("ascii") === "PK",
  pdf: (b) => b.subarray(0, 5).toString("ascii") === "%PDF-",
  png: (b) => b.length > 8 && b[0] === 0x89 && b.subarray(1, 4).toString("ascii") === "PNG",
  jpg: (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  jpeg: (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  gif: (b) => b.subarray(0, 4).toString("ascii") === "GIF8",
  webp: (b) => b.length > 12 && b.subarray(0, 4).toString("ascii") === "RIFF" && b.subarray(8, 12).toString("ascii") === "WEBP",
  gz: (b) => b.length > 2 && b[0] === 0x1f && b[1] === 0x8b,
  rar: (b) => b.subarray(0, 4).toString("ascii") === "Rar!",
  "7z": (b) => b.length > 6 && b[0] === 0x37 && b[1] === 0x7a && b[2] === 0xbc && b[3] === 0xaf,
};

function cleanName(name: string): string {
  // no folders, no control characters
  const base = name.replace(/\\/g, "/").split("/").pop() ?? "file";
  return base.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 200) || "file";
}

/** Saves one delivery file. The bytes get a random name without an extension, the real name is kept in the database. */
export async function saveDeliveryFile(
  file: File,
  ownerId: string,
  kind: "delivery" | "request_attachment" = "delivery",
  maxBytes = MAX_DELIVERY_FILE_BYTES
): Promise<{ id: string }> {
  const name = cleanName(file.name);
  const ext = extensionOf(name);
  if (!EXTENSIONS[ext]) {
    throw new UploadError(
      `"${name}" is not an allowed file type. You can ${kind === "delivery" ? "deliver" : "attach"} archives (zip, rar, 7z), PDF, images, design files, documents, video and audio. Send anything else as a link.`
    );
  }
  if (file.size === 0) throw new UploadError(`"${name}" is empty.`);
  if (file.size > maxBytes) {
    throw new UploadError(`"${name}" is larger than ${Math.round(maxBytes / 1048576)} MB. Upload it to Drive or GitHub and add the link instead.`);
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const check = SIGNATURES[ext];
  if (check && !check(buf)) throw new UploadError(`"${name}" does not look like a real .${ext} file.`);

  const id = randomUUID();
  const folder = kind === "delivery" ? "deliveries" : "requests";
  const storageKey = `${folder}/${id}`;
  await mkdir(path.join(UPLOAD_ROOT, folder), { recursive: true });
  await writeFile(path.join(UPLOAD_ROOT, folder, id), buf);
  await execute(
    `INSERT INTO files (id, owner_id, kind, storage_key, url, original_name, mime_type, size_bytes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, ownerId, kind, storageKey, `private:${storageKey}`, name, EXTENSIONS[ext], buf.length]
  );
  return { id };
}

export interface DeliveryLinkInput {
  kind: LinkKind;
  label: string | null;
  url: string;
}

function isHttpUrl(value: string) {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/** Reads the links of a delivery (sent as JSON text). Throws an UploadError with a message for the user. */
export function parseDeliveryLinks(raw: unknown): DeliveryLinkInput[] {
  let list: unknown[] = [];
  if (typeof raw === "string" && raw.trim().startsWith("[")) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) list = parsed;
    } catch {
      throw new UploadError("Invalid links.");
    }
  }
  const out: DeliveryLinkInput[] = [];
  for (const item of list) {
    const l = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
    const url = String(l.url ?? "").trim();
    if (!url) continue;
    if (url.length > 500 || !isHttpUrl(url)) {
      throw new UploadError(`"${url.slice(0, 40)}" is not a valid link (it must start with https://).`);
    }
    const kind = LINK_KINDS.includes(l.kind as LinkKind) ? (l.kind as LinkKind) : "other";
    const label = String(l.label ?? "").trim().slice(0, 60);
    if (!out.some((x) => x.url === url)) out.push({ kind, label: label || null, url });
  }
  if (out.length > MAX_DELIVERY_LINKS) throw new UploadError(`You can add up to ${MAX_DELIVERY_LINKS} links.`);
  return out;
}
