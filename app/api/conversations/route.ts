import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { execute, query, queryOne, type RowDataPacket } from "@/lib/db";
import { getSessionUser } from "@/lib/session";

interface ConversationRow extends RowDataPacket {
  id: string;
  client_id: string;
  other_id: string;
  other_name: string;
  other_image: string | null;
  category: string | null;
  unread: number | null;
  last_body: string | null;
  last_sender: string | null;
  last_at: Date | null;
  created_at: Date;
}

// The logged-in user's conversations, newest activity first
export async function GET() {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });

  try {
    const rows = await query<ConversationRow>(
      `SELECT c.id, c.client_id, c.created_at,
              ou.id AS other_id, ou.name AS other_name, ou.image AS other_image,
              cat.name AS category,
              un.unread_count AS unread,
              lm.body AS last_body, lm.sender_id AS last_sender, lm.created_at AS last_at
         FROM conversations c
         JOIN users ou ON ou.id = IF(c.client_id = ?, c.creator_id, c.client_id)
         LEFT JOIN creator_profiles cp ON cp.user_id = c.creator_id
         LEFT JOIN categories cat ON cat.id = cp.category_id
         LEFT JOIN conversation_unread un ON un.conversation_id = c.id AND un.user_id = ?
         LEFT JOIN messages lm ON lm.id = (
                SELECT MAX(m.id) FROM messages m
                 WHERE m.conversation_id = c.id AND m.deleted_at IS NULL)
        WHERE (c.client_id = ? OR c.creator_id = ?)
          AND (c.client_id = ? OR c.last_message_at IS NOT NULL)
        ORDER BY COALESCE(c.last_message_at, c.created_at) DESC
        LIMIT 100`,
      [me.id, me.id, me.id, me.id, me.id]
    );

    return NextResponse.json({
      conversations: rows.map((r) => ({
        id: r.id,
        name: r.other_name,
        image: r.other_image,
        // only clients talk to creators, so a specialty is shown when the other side is a creator
        subtitle: r.client_id === me.id ? r.category : null,
        unread: Number(r.unread ?? 0),
        lastMessage: r.last_body
          ? { body: r.last_body, fromMe: r.last_sender === me.id, at: r.last_at }
          : null,
      })),
    });
  } catch (err) {
    console.error("list conversations failed:", err);
    return NextResponse.json({ error: "Could not load conversations." }, { status: 500 });
  }
}

// Start (or reopen) a conversation with a creator. Only clients can start one.
export async function POST(request: Request) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  if (me.role !== "client") {
    return NextResponse.json(
      { error: "Only client accounts can message creators." },
      { status: 403 }
    );
  }

  let creatorId = "";
  try {
    const body = await request.json();
    creatorId = String(body?.creatorId ?? "");
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  try {
    const creator = await queryOne<RowDataPacket & { user_id: string }>(
      `SELECT p.user_id
         FROM creator_profiles p
         JOIN users u ON u.id = p.user_id AND u.deleted_at IS NULL AND u.status = 'active'
        WHERE p.user_id = ? AND p.is_public = 1`,
      [creatorId]
    );
    if (!creator) return NextResponse.json({ error: "Creator not found." }, { status: 404 });

    const existing = await queryOne<RowDataPacket & { id: string }>(
      "SELECT id FROM conversations WHERE client_id = ? AND creator_id = ?",
      [me.id, creator.user_id]
    );
    if (existing) return NextResponse.json({ id: existing.id });

    const id = randomUUID();
    try {
      await execute(
        "INSERT INTO conversations (id, client_id, creator_id) VALUES (?, ?, ?)",
        [id, me.id, creator.user_id]
      );
      return NextResponse.json({ id }, { status: 201 });
    } catch (err) {
      // Two quick clicks: the unique (client, creator) pair already exists
      if ((err as { code?: string }).code === "ER_DUP_ENTRY") {
        const again = await queryOne<RowDataPacket & { id: string }>(
          "SELECT id FROM conversations WHERE client_id = ? AND creator_id = ?",
          [me.id, creator.user_id]
        );
        if (again) return NextResponse.json({ id: again.id });
      }
      throw err;
    }
  } catch (err) {
    console.error("start conversation failed:", err);
    return NextResponse.json({ error: "Could not start the conversation." }, { status: 500 });
  }
}
