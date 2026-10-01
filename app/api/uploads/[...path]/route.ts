import { readFile } from "node:fs/promises";
import path from "node:path";
import { UPLOAD_ROOT } from "@/lib/uploads";

const TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  webp: "image/webp",
  pdf: "application/pdf",
};

// Only names we generated ourselves: <folder>/<uuid>.<ext>
const SAFE = /^(avatars|covers|logos|cvs|work_medias)\/[0-9a-f-]{36}\.(png|jpg|webp|pdf)$/;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: parts } = await params;
  const key = parts.join("/");
  if (!SAFE.test(key)) return new Response("Not found", { status: 404 });

  try {
    const data = await readFile(path.join(UPLOAD_ROOT, key));
    const ext = key.slice(key.lastIndexOf(".") + 1);
    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": TYPES[ext],
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
