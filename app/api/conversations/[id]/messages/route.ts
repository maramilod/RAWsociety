import { NextResponse } from "next/server";
import { execute, query, queryOne, type RowDataPacket } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { clientAccess } from "@/lib/subscriptions";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_LENGTH = 2000;

interface ConversationRow extends RowDataPacket {
  id: string;
  client_id: string;
  creator_id: string;
}

interface MessageRow extends RowDataPacket {
  id: number;
  sender_id: string;
  body: string;
  created_at: Date;
}

// Only the two people in the conversation may use it
async function loadConversation(id: string, userId: string) {
  if (!UUID_RE.test(id)) return null;
  return queryOne<ConversationRow>(
    "SELECT id, client_id, creator_id FROM conversations WHERE id = ? AND (client_id = ? OR creator_id = ?)",
    [id, userId, userId]
  );
}

// Messages of a conversation. `?after=<id>` returns only newer ones (for polling).
// Opening a conversation marks it as read for the current user.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });

  const { id } = await params;
  const conversation = await loadConversation(id, me.id);
  if (!conversation) return NextResponse.json({ error: "Conversation not found." }, { status: 404 });

  const afterRaw = new URL(request.url).searchParams.get("after");
  const after = afterRaw !== null && /^\d+$/.test(afterRaw) ? Number(afterRaw) : null;

  try {
    const rows =
      after !== null
        ? await query<MessageRow>(
            `SELECT id, sender_id, body, created_at FROM messages
              WHERE conversation_id = ? AND id > ? AND deleted_at IS NULL
              ORDER BY id ASC LIMIT 200`,
            [id, after]
          )
        : await query<MessageRow>(
            `SELECT id, sender_id, body, created_at FROM (
                SELECT id, sender_id, body, created_at FROM messages
                 WHERE conversation_id = ? AND deleted_at IS NULL
                 ORDER BY id DESC LIMIT 100) t
              ORDER BY id ASC`,
            [id]
          );

    const column = conversation.client_id === me.id ? "client_last_read_at" : "creator_last_read_at";
    await execute(`UPDATE conversations SET ${column} = NOW(3) WHERE id = ?`, [id]);

    return NextResponse.json({
      messages: rows.map((m) => ({
        id: m.id,
        fromMe: m.sender_id === me.id,
        body: m.body,
        at: m.created_at,
      })),
    });
  } catch (err) {
    console.error("load messages failed:", err);
    return NextResponse.json({ error: "Could not load messages." }, { status: 500 });
  }
}

// Send a message
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });

  const { id } = await params;
  const conversation = await loadConversation(id, me.id);
  if (!conversation) return NextResponse.json({ error: "Conversation not found." }, { status: 404 });

  let body = "";
  try {
    const data = await request.json();
    body = String(data?.body ?? "").trim();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  if (!body) return NextResponse.json({ error: "Message is empty." }, { status: 400 });
  if (body.length > MAX_LENGTH) {
    return NextResponse.json({ error: `Message is too long (max ${MAX_LENGTH} characters).` }, { status: 400 });
  }

  // a client's messages count against the plan (creators answering are never limited)
  if (me.role === "client") {
    const { rules, messagesUsed } = await clientAccess(me.id);
    if (rules.messagesPerMonth !== null && messagesUsed >= rules.messagesPerMonth) {
      return NextResponse.json(
        {
          error:
            rules.messagesPerMonth === 0
              ? "Messaging creators is part of Business Pro and Enterprise. Upgrade your plan to send messages."
              : `You used all ${rules.messagesPerMonth} messages of this month. Upgrade to Enterprise for unlimited messages.`,
          upgrade: true,
        },
        { status: 403 }
      );
    }
  }

  try {
    const result = await execute(
      "INSERT INTO messages (conversation_id, sender_id, body) VALUES (?, ?, ?)",
      [id, me.id, body]
    );
    const saved = await queryOne<MessageRow>(
      "SELECT id, sender_id, body, created_at FROM messages WHERE id = ?",
      [result.insertId]
    );
    return NextResponse.json(
      { message: { id: saved?.id, fromMe: true, body, at: saved?.created_at } },
      { status: 201 }
    );
  } catch (err) {
    console.error("send message failed:", err);
    return NextResponse.json({ error: "Could not send the message." }, { status: 500 });
  }
}
