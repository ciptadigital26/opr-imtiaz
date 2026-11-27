// Vercel API Route: POST /api/ai-extract
// AI Vision untuk membaca pamphlet / poster / banner / kertas kerja dan menjana impak.
// Menggunakan Claude API (Anthropic).
//
// Environment Variables (Vercel → Project → Settings → Environment Variables):
//   ANTHROPIC_API_KEY    sk-ant-...
//   AI_MODEL             (pilihan) default: claude-sonnet-5-5
//   SUPABASE_URL, SUPABASE_ANON_KEY
//
// Request JSON: { prompt: string, images: [{ type: "image/jpeg", data: "<base64>" }] }
// Response    : { ok: true, json: <objek JSON>, text: "<jawapan mentah>" }

import { json, missingEnv, getUser } from "./_lib.js";

function parseJson(text) {
  const t = String(text || "").trim();
  try { return JSON.parse(t); } catch {}
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) { try { return JSON.parse(fence[1]); } catch {} }
  const a = t.search(/[\[{]/), b = Math.max(t.lastIndexOf("}"), t.lastIndexOf("]"));
  if (a >= 0 && b > a) { try { return JSON.parse(t.slice(a, b + 1)); } catch {} }
  return null;
}

export async function POST(req) {
  const miss = missingEnv("ANTHROPIC_API_KEY", "SUPABASE_URL", "SUPABASE_ANON_KEY");
  if (miss) return miss;

  const user = await getUser(req);
  if (!user) return json({ ok: false, error: "Sila log masuk semula" }, 401);

  let body;
  try { body = await req.json(); } catch { return json({ ok: false, error: "JSON tidak sah" }, 400); }
  const prompt = String(body?.prompt ?? "").slice(0, 60000);
  if (!prompt) return json({ ok: false, error: "Prompt kosong" }, 400);
  const images = (Array.isArray(body.images) ? body.images : []).slice(0, 4).filter((i) => i && i.data);

  const content = images.map((i) => ({
    type: "image",
    source: {
      type: "base64",
      media_type: ["image/jpeg", "image/png", "image/webp", "image/gif"].includes(i.type) ? i.type : "image/jpeg",
      data: i.data,
    },
  }));
  content.push({ type: "text", text: prompt + "\n\nBalas dengan JSON sahaja, tanpa teks lain." });

  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.AI_MODEL || "claude-sonnet-5-5",
      max_tokens: 2000,
      messages: [{ role: "user", content }],
    }),
  });
  const out = await r.json().catch(() => ({}));
  if (!r.ok) return json({ ok: false, error: out?.error?.message || `AI ralat ${r.status}` }, r.status === 429 ? 429 : 502);

  const text = (out.content || []).filter((c) => c.type === "text").map((c) => c.text).join("");
  const parsed = parseJson(text);
  if (parsed === null) return json({ ok: false, error: "AI tidak memberi JSON yang sah", text }, 502);
  return json({ ok: true, json: parsed, text });
}

export function GET() {
  return json({ ok: true, service: "ai-extract", configured: !!process.env.ANTHROPIC_API_KEY });
}
