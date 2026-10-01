import { NextResponse } from "next/server";
import { execute } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { isUuid } from "@/lib/custom-requests";
import { sweepJobs } from "@/lib/jobs";

// The client closes their own job: no more applications, the ones still waiting are closed too
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  if (me.role !== "client") return NextResponse.json({ error: "Only the client who posted a job can change it." }, { status: 403 });

  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "Job not found." }, { status: 404 });

  try {
    const body = await request.json().catch(() => ({}));
    if (body?.action !== "close") return NextResponse.json({ error: "Unknown action." }, { status: 400 });

    const r = await execute("UPDATE job_posts SET status = 'closed' WHERE id = ? AND client_id = ? AND status = 'open'", [id, me.id]);
    if (r.affectedRows === 0) {
      return NextResponse.json({ error: "This job was not found or is no longer open." }, { status: 409 });
    }
    await sweepJobs();
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("close job failed:", err);
    return NextResponse.json({ error: "Could not close the job." }, { status: 500 });
  }
}
