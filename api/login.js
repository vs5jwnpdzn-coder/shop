// /api/login.js
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });

  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: "missing_credentials" });

  if (String(email).toLowerCase() !== "demo@shop.com" || String(password) !== "demo1234") {
    return res.status(401).json({ error: "invalid_login" });
  }

  // Cookie (Demo Auth)
  res.setHeader("Set-Cookie", [
    `ps_email=${encodeURIComponent("demo@shop.com")}; Path=/; HttpOnly; SameSite=Lax`,
  ]);

  return res.json({ ok: true, user: { email: "demo@shop.com", name: "Demo Customer" } });
}