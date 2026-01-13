// /api/hoodpay-webhook.js
export const config = {
  api: { bodyParser: true } // später evtl. raw body nötig für signature
};

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });

  // TODO sobald HoodPay Docs da sind:
  // - Signature prüfen (raw body + secret)
  // - event/status prüfen (paid)
  // - topupId/referenceId -> user -> balanceCents + amount (in DB)

  console.log("🔔 HoodPay Webhook (stub) received:", req.body);

  return res.status(200).json({ ok: true });
}