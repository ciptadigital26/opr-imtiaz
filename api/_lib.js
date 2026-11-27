// Fungsi bantu dikongsi oleh Vercel API Routes.
// Fail bermula dengan "_" tidak menjadi route.
// Log masuk & pangkalan data kekal di Supabase; semakan dibuat dengan JWT pengguna
// (semua pertanyaan tertakluk kepada Row Level Security).

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

export const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

export function missingEnv(...names) {
  const miss = names.filter((n) => !process.env[n]);
  return miss.length ? json({ ok: false, error: `Environment Variable belum ditetapkan di Vercel: ${miss.join(", ")}` }, 500) : null;
}

// Sahkan pengguna daripada header Authorization: Bearer <JWT Supabase>
export async function getUser(req) {
  const auth = req.headers.get("authorization") || "";
  if (!auth.startsWith("Bearer ") || auth.length < 20) return null;
  const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: SUPABASE_ANON_KEY, Authorization: auth } });
  if (!r.ok) return null;
  const u = await r.json();
  return u?.id ? { id: u.id, email: u.email, auth } : null;
}

// Panggil Supabase REST (PostgREST) sebagai pengguna tersebut
export function rest(user, path, init = {}) {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: user.auth,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
}

export async function isAdmin(user) {
  const r = await rest(user, "rpc/is_admin", { method: "POST", body: "{}" });
  return r.ok && (await r.json()) === true;
}
