// /api/balance.js
function readCookie(req, name) {
  const raw = req.headers.cookie || "";
  const m = raw.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : null;
}

export default async function handler(req, res) {
  const email = readCookie(req, "ps_email");
  if (!email) return res.status(401).json({ error: "not_logged_in" });

  // ✅ Vercel: ohne DB ist Balance nicht persistent.
  // TODO: später aus DB laden (oder HoodPay Ledger).
  return res.json({ balanceCents: 0 });
}