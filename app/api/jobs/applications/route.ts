import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { listMyApplications, sweepJobs } from "@/lib/jobs";

// A creator's own applications (they stay visible even if the plan has ended)
export async function GET() {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  if (me.role !== "creator") return NextResponse.json({ error: "Only creator accounts have applications." }, { status: 403 });
  try {
    await sweepJobs();
    return NextResponse.json({ applications: await listMyApplications(me.id) });
  } catch (err) {
    console.error("list applications failed:", err);
    return NextResponse.json({ error: "Could not load your applications." }, { status: 500 });
  }
}
