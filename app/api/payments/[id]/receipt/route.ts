import { readFile } from "node:fs/promises";
import path from "node:path";
import { queryOne, type RowDataPacket } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { UPLOAD_ROOT } from "@/lib/uploads";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const KEY_RE = /^receipts\/[0-9a-f-]{36}\.(png|jpg|webp|pdf)$/;

// A transfer receipt is private: only the client who paid and admins can open it.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getSessionUser();
  if (!me) return new Response("Please log in.", { status: 401 });

  const { id } = await params;
  if (!UUID_RE.test(id)) return new Response("Not found", { status: 404 });

  const row = await queryOne<RowDataPacket & { user_id: string; storage_key: string; mime_type: string }>(
    `SELECT p.user_id, f.storage_key, f.mime_type
       FROM payments p JOIN files f ON f.id = p.receipt_file_id
      WHERE p.id = ?`,
    [id]
  );
  // Same answer whether it does not exist or belongs to someone else
  if (!row || (me.role !== "admin" && row.user_id !== me.id) || !KEY_RE.test(row.storage_key)) {
    return new Response("Not found", { status: 404 });
  }

  try {
    const data = await readFile(path.join(UPLOAD_ROOT, row.storage_key));
    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": row.mime_type,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Disposition": "inline",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
