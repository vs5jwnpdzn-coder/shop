// /api/logout.js
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });

  res.setHeader("Set-Cookie", [
    `ps_email=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`,
  ]);

  return res.json({ ok: true });
}