import { readFile } from "node:fs/promises";
import path from "node:path";
import { queryOne, type RowDataPacket } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { INLINE_IMAGE_EXTENSIONS, extensionOf } from "@/lib/deliveries";
import { UPLOAD_ROOT } from "@/lib/uploads";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const KEY_RE = /^deliveries\/[0-9a-f-]{36}$/;

// Delivered files are private: only the client, the creator of the order and admins can open them.
// Pictures open in the browser; everything else is always a download.
export async function GET(request: Request, { params }: { params: Promise<{ fileId: string }> }) {
  const me = await getSessionUser();
  if (!me) return new Response("Please log in.", { status: 401 });

  const { fileId } = await params;
  if (!UUID_RE.test(fileId)) return new Response("Not found", { status: 404 });

  const row = await queryOne<
    RowDataPacket & { client_id: string; creator_id: string; storage_key: string; original_name: string; mime_type: string }
  >(
    `SELECT o.client_id, o.creator_id, f.storage_key, f.original_name, f.mime_type
       FROM delivery_files df
       JOIN deliveries d ON d.id = df.delivery_id
       JOIN orders o ON o.id = d.order_id
       JOIN files f ON f.id = df.file_id
      WHERE f.id = ?`,
    [fileId]
  );
  // Same answer whether the file does not exist or belongs to someone else
  if (!row || !KEY_RE.test(row.storage_key)) return new Response("Not found", { status: 404 });
  if (me.role !== "admin" && row.client_id !== me.id && row.creator_id !== me.id) {
    return new Response("Not found", { status: 404 });
  }

  let data: Buffer;
  try {
    data = await readFile(path.join(UPLOAD_ROOT, row.storage_key));
  } catch {
    return new Response("Not found", { status: 404 });
  }

  const wantDownload = new URL(request.url).searchParams.get("download") === "1";
  const inline = !wantDownload && INLINE_IMAGE_EXTENSIONS.includes(extensionOf(row.original_name));
  // a plain-ASCII fallback name plus the real name in the standard encoded form
  const fallback = row.original_name.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");

  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": inline ? row.mime_type : "application/octet-stream",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(row.original_name)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}
