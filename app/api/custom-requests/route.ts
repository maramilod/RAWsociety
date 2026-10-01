import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { execute, queryOne, type RowDataPacket } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { saveDeliveryFile } from "@/lib/deliveries";
import { UploadError, removeFiles } from "@/lib/uploads";
import {
  MAX_OPEN_CUSTOM_REQUESTS,
  MAX_OPEN_PER_CREATOR,
  MAX_REQUEST_FILES,
  MAX_REQUEST_FILE_BYTES,
  RequestError,
  cleanRequest,
  expireRequests,
  isUuid,
  listRequests,
} from "@/lib/custom-requests";
import { REQUEST_OPEN_DAYS } from "@/lib/request-status";

// The logged-in user's custom requests: a client's own, or the ones sent to a creator
export async function GET() {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  if (me.role !== "client" && me.role !== "creator") {
    return NextResponse.json({ error: "Not available for this account." }, { status: 403 });
  }
  try {
    await expireRequests();
    return NextResponse.json({ requests: await listRequests(me.id, me.role) });
  } catch (err) {
    console.error("list custom requests failed:", err);
    return NextResponse.json({ error: "Could not load your requests." }, { status: 500 });
  }
}

// A client sends a custom request (multipart: `payload` = JSON text, `files` = attachments)
export async function POST(request: Request) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  if (me.role !== "client") {
    return NextResponse.json({ error: "Only client accounts can send custom requests." }, { status: 403 });
  }

  let rawPayload: unknown;
  let files: File[];
  try {
    const form = await request.formData();
    rawPayload = JSON.parse(String(form.get("payload") ?? ""));
    files = form.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  if (files.length > MAX_REQUEST_FILES) {
    return NextResponse.json({ error: `You can attach up to ${MAX_REQUEST_FILES} files.` }, { status: 400 });
  }

  const savedFiles: string[] = [];
  try {
    const creatorId = String((rawPayload as { creatorId?: unknown })?.creatorId ?? "");
    if (!isUuid(creatorId)) return NextResponse.json({ error: "Creator not found." }, { status: 404 });

    // Only public, active creators can be hired. Their specialty (not the client's claim) picks the questions.
    const creator = await queryOne<RowDataPacket & { category: string | null }>(
      `SELECT cat.name AS category
         FROM creator_profiles p
         JOIN users u ON u.id = p.user_id AND u.deleted_at IS NULL AND u.status = 'active'
         LEFT JOIN categories cat ON cat.id = p.category_id
        WHERE p.user_id = ? AND p.is_public = 1`,
      [creatorId]
    );
    if (!creator) return NextResponse.json({ error: "This creator is not available." }, { status: 404 });

    const data = cleanRequest(rawPayload, creator.category ?? "");

    // The service to start from must belong to this creator
    if (data.baseServiceId) {
      const ok = isUuid(data.baseServiceId)
        ? await queryOne<RowDataPacket>("SELECT id FROM services WHERE id = ? AND creator_id = ?", [data.baseServiceId, creatorId])
        : null;
      if (!ok) data.baseServiceId = null;
    }

    const open = await queryOne<RowDataPacket & { total: number; same: number }>(
      `SELECT COUNT(*) AS total, COALESCE(SUM(creator_id = ?), 0) AS same
         FROM custom_requests WHERE client_id = ? AND status IN ('open','offered')`,
      [creatorId, me.id]
    );
    if (Number(open?.total ?? 0) >= MAX_OPEN_CUSTOM_REQUESTS) {
      return NextResponse.json({ error: "You have too many open requests. Please wait for some replies first." }, { status: 429 });
    }
    if (Number(open?.same ?? 0) >= MAX_OPEN_PER_CREATOR) {
      return NextResponse.json(
        { error: "You already have open requests with this creator. Wait for their answer before sending another." },
        { status: 429 }
      );
    }

    for (const f of files) {
      const saved = await saveDeliveryFile(f, me.id, "request_attachment", MAX_REQUEST_FILE_BYTES);
      savedFiles.push(saved.id);
    }

    const id = randomUUID();
    await execute(
      `INSERT INTO custom_requests
         (id, client_id, creator_id, base_service_id, category, title, summary, brief, goals, language, details, links,
          budget_type, budget_amount, budget_max, hourly_rate, hours, deadline, rush, revisions,
          usage_rights, nda, portfolio, source_files, contact, questions, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
               DATE_ADD(UTC_TIMESTAMP(3), INTERVAL ? DAY))`,
      [
        id, me.id, creatorId, data.baseServiceId, creator.category ?? "", data.title, data.summary,
        data.brief || null, data.goals || null, data.language,
        JSON.stringify(data.details), JSON.stringify(data.links),
        data.budget.type, data.budget.amount, data.budget.amountMax, data.budget.hourlyRate, data.budget.hours,
        data.deadline, data.rush ? 1 : 0, data.revisions,
        data.usageRights, data.nda ? 1 : 0, data.portfolio ? 1 : 0, data.sourceFiles ? 1 : 0,
        data.contact, data.questions || null, REQUEST_OPEN_DAYS,
      ]
    );
    for (const fileId of savedFiles) {
      await execute("INSERT INTO custom_request_files (request_id, file_id) VALUES (?, ?)", [id, fileId]);
    }
    return NextResponse.json({ id }, { status: 201 });
  } catch (err) {
    await removeFiles(savedFiles).catch(() => {});
    if (err instanceof RequestError || err instanceof UploadError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("create custom request failed:", err);
    return NextResponse.json({ error: "Could not send your request." }, { status: 500 });
  }
}
