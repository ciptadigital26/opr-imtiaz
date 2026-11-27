// Vercel API Route: POST /api/telegram-send
// Menghantar OPR yang telah DISAHKAN ke group Telegram rasmi sekolah.
//
// Environment Variables (Vercel → Project → Settings → Environment Variables):
//   TELEGRAM_BOT_TOKEN   token daripada @BotFather
//   TELEGRAM_CHAT_ID     ID group (contoh -1001234567890)
//   SUPABASE_URL, SUPABASE_ANON_KEY
//
// Request: multipart/form-data, header Authorization: Bearer <JWT pengguna>
//   file, caption, format ("image"|"pdf"), opr_id   → hantar OPR
//   action = "test"                                 → mesej ujian (admin sahaja)

import { json, missingEnv, getUser, rest, isAdmin } from "./_lib.js";

export async function POST(req) {
  const miss = missingEnv("TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID", "SUPABASE_URL", "SUPABASE_ANON_KEY");
  if (miss) return miss;
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  const user = await getUser(req);
  if (!user) return json({ ok: false, error: "Sila log masuk semula" }, 401);

  let form;
  try { form = await req.formData(); } catch { return json({ ok: false, error: "Format permintaan tidak sah" }, 400); }

  const tg = async (method, body) => {
    const r = await fetch(`https://api.telegram.org/bot${token}/${method}`, { method: "POST", body });
    return r.json().catch(() => ({ ok: false, description: `Telegram HTTP ${r.status}` }));
  };

  // --- Uji sambungan (admin sahaja) ---
  if (form.get("action") === "test") {
    if (!(await isAdmin(user))) return json({ ok: false, error: "Hanya admin boleh menguji sambungan" }, 403);
    const m = new FormData();
    m.append("chat_id", chatId);
    m.append("text", "✅ Ujian sambungan OPR IDEXS GENERATOR – SM Imtiaz YT Dungun berjaya.");
    const out = await tg("sendMessage", m);
    return out.ok ? json({ ok: true }) : json({ ok: false, error: out.description || "Telegram menolak permintaan" }, 502);
  }

  // --- Hantar OPR ---
  const file = form.get("file");
  const caption = String(form.get("caption") ?? "").slice(0, 1000);
  const isPdf = form.get("format") === "pdf";
  const oprId = String(form.get("opr_id") ?? "");
  if (!file || typeof file.arrayBuffer !== "function" || file.size === 0) return json({ ok: false, error: "Fail OPR tiada" }, 400);
  if (!oprId) return json({ ok: false, error: "ID OPR tiada" }, 400);

  const q = await rest(user, `oprs?id=eq.${encodeURIComponent(oprId)}&select=id,status`);
  const opr = q.ok ? (await q.json())[0] : null;
  if (!opr) return json({ ok: false, error: "OPR tidak dijumpai atau tiada kebenaran" }, 404);
  if (opr.status !== "confirmed" && opr.status !== "sent") return json({ ok: false, error: "OPR belum disahkan (CONFIRM)" }, 409);

  const name = file.name || (isPdf ? "OPR.pdf" : "OPR.jpg");
  const send = (field, method) => {
    const m = new FormData();
    m.append("chat_id", chatId);
    m.append("caption", caption);
    m.append(field, file, name);
    return tg(method, m);
  };
  let out = isPdf ? await send("document", "sendDocument") : await send("photo", "sendPhoto");
  if (!out.ok && !isPdf) out = await send("document", "sendDocument"); // gambar terlalu besar → hantar sebagai dokumen

  await rest(user, `oprs?id=eq.${encodeURIComponent(oprId)}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      status: out.ok ? "sent" : opr.status,
      tg_status: out.ok ? "SENT SUCCESSFULLY" : "FAILED",
      tg_sent_at: new Date().toISOString(),
      tg_error: out.ok ? null : out.description || "unknown",
    }),
  });

  return out.ok
    ? json({ ok: true, status: "SENT SUCCESSFULLY" })
    : json({ ok: false, status: "FAILED", error: out.description || "Telegram menolak permintaan" }, 502);
}

export function GET() {
  return json({ ok: true, service: "telegram-send", configured: !!(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) });
}
