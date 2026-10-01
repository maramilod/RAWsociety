import type { buildPayload } from "./form";

export type SubmitResult = { ok: true } | { ok: false; error: string; notConnected?: boolean };

/** Sends the custom request (and its attached files) to the server, as a multipart form. */
export async function submitCustomRequest(
  payload: ReturnType<typeof buildPayload>,
  files: File[]
): Promise<SubmitResult> {
  const form = new FormData();
  form.append("payload", JSON.stringify(payload));
  for (const f of files) form.append("files", f);
  try {
    const res = await fetch("/api/custom-requests", { method: "POST", body: form });
    if (res.ok) return { ok: true };
    const data = await res.json().catch(() => ({}));
    return { ok: false, error: data.error || "Could not send your request." };
  } catch {
    return { ok: false, error: "Network error. Please try again." };
  }
}
