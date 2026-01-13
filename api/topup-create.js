// /api/topup-create.js
function readCookie(req, name) {
  const raw = req.headers.cookie || "";
  const m = raw.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : null;
}

function assertTopupAmount(amountCents) {
  const n = Number(amountCents);
  if (!Number.isFinite(n)) return { ok: false, error: "invalid_amount" };
  if (!Number.isInteger(n)) return { ok: false, error: "amount_not_integer" };
  if (n < 1000) return { ok: false, error: "min_10_eur" }; // 10€
  if (n > 50000) return { ok: false, error: "max_500_eur" }; // 500€
  if (n % 100 !== 0) return { ok: false, error: "must_be_whole_eur" };
  return { ok: true };
}

function baseUrl(req) {
  const proto = (req.headers["x-forwarded-proto"] || "https").toString();
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  return `${proto}://${host}`;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });

  const email = readCookie(req, "ps_email");
  if (!email) return res.status(401).json({ error: "not_logged_in" });

  const { amountCents } = req.body || {};
  const check = assertTopupAmount(amountCents);
  if (!check.ok) return res.status(400).json({ error: check.error });

  const HOODPAY_BASE_URL = process.env.HOODPAY_BASE_URL;
  const HOODPAY_API_KEY = process.env.HOODPAY_API_KEY;

  if (!HOODPAY_BASE_URL || !HOODPAY_API_KEY) {
    return res.status(500).json({ error: "missing_hoodpay_env" });
  }

  const topupId = "top_" + Math.random().toString(16).slice(2);
  const base = baseUrl(req);

  const successUrl = `${base}/success.html?paid=1&topupId=${encodeURIComponent(topupId)}`;
  const cancelUrl = `${base}/cancel.html?canceled=1&topupId=${encodeURIComponent(topupId)}`;
  const webhookUrl = `${base}/api/hoodpay-webhook`;

  // ❗️ENDPOINT/Body Platzhalter bis HoodPay antwortet
  const url = `${HOODPAY_BASE_URL}/v1/payments`;

  const body = {
    amount: Number(amountCents),
    currency: "EUR",
    description: "PremiumShop Top-up",
    referenceId: topupId,
    successUrl,
    cancelUrl,
    webhookUrl,
    customer: { email },
    metadata: { kind: "topup", referenceId: topupId }
  };

  const r = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${HOODPAY_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    return res.status(502).json({ error: "hoodpay_create_failed", details: { status: r.status, data } });
  }

  const paymentUrl = data.paymentUrl || data.checkoutUrl || data.url;
  if (!paymentUrl) {
    return res.status(502).json({ error: "hoodpay_missing_paymentUrl", details: data });
  }

  return res.json({ ok: true, topupId, paymentUrl });
}