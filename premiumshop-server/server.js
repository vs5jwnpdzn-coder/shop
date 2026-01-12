// premiumshop-server/server.js
const express = require("express");
const path = require("path");
const fs = require("fs");
const cookieParser = require("cookie-parser");
require("dotenv").config();

const app = express();

// ✅ JSON + rawBody merken (für spätere Signature-Checks)
app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf; // Buffer
  }
}));
app.use(cookieParser());

// === Frontend (eine Ebene höher) ===
const FRONTEND_DIR = path.resolve(__dirname, "..");
app.use(express.static(FRONTEND_DIR));

// --------------------
// Helpers: Preise / Catalog
// --------------------
function parseEURToCents(value) {
  const s = String(value || "").replace(",", ".").replace(/[^0-9.]/g, "");
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

function unitPriceCents(p) {
  const sale = parseEURToCents(p?.salePrice);
  if (sale > 0) return sale;
  return parseEURToCents(p?.price);
}

function loadCatalog() {
  const file = path.join(FRONTEND_DIR, "products-data.js");
  if (!fs.existsSync(file)) {
    console.warn("⚠️ products-data.js nicht gefunden:", file);
    return new Map();
  }
  delete require.cache[require.resolve(file)];
  const products = require(file); // products-data.js: module.exports = PRODUCTS;
  const list = Array.isArray(products) ? products : [];
  return new Map(list.map((p) => [Number(p.id), p]));
}

function getCatalogFresh() {
  return loadCatalog();
}
// ===== Limits (Anti-Fraud Light) =====
const TOPUP_MIN_CENTS = 1000;   // 10€
const TOPUP_MAX_CENTS = 50000;  // 500€
const TOPUP_DAILY_LIMIT_CENTS = 200000; // 2000€ pro 24h (kannst du ändern)

// In-Memory Log (Demo). In echt: DB.
const topupLog = []; 
// { email, amountCents, ts }
function sumTopupsLast24h(email){
  const now = Date.now();
  const dayAgo = now - 24 * 60 * 60 * 1000;

  let sum = 0;
  for(const t of topupLog){
    if(t.email === email && t.ts >= dayAgo){
      sum += t.amountCents;
    }
  }
  return sum;
}
// --------------------
// Mini-DB (Demo) in RAM
// --------------------
const users = new Map(); // email -> { email, name, balanceCents }
function getOrCreateUser(email) {
  const key = String(email || "").toLowerCase();
  if (!users.has(key)) {
    users.set(key, { email: key, name: "Customer", balanceCents: 0 });
  }
  return users.get(key);
}

// Pending Topups (RAM) => später DB
// topupId -> { email, amountCents, createdAt }
const pendingTopups = new Map();

// --------------------
// Auth (Cookie)
// --------------------
function requireAuth(req, res, next) {
  const email = req.cookies.ps_email;
  if (!email) return res.status(401).json({ error: "not_logged_in" });
  req.user = getOrCreateUser(email);
  next();
}

app.post("/api/login", (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: "missing_credentials" });

  if (String(email).toLowerCase() !== "demo@shop.com" || String(password) !== "demo1234") {
    return res.status(401).json({ error: "invalid_login" });
  }

  const user = getOrCreateUser(email);
  user.name = "Demo Customer";

  res.cookie("ps_email", user.email, {
    httpOnly: true,
    sameSite: "lax",
  });

  res.json({ ok: true, user: { email: user.email, name: user.name } });
});

app.post("/api/logout", (req, res) => {
  res.clearCookie("ps_email");
  res.json({ ok: true });
});

// --------------------
// Wallet
// --------------------
app.get("/api/balance", requireAuth, (req, res) => {
  res.json({ balanceCents: req.user.balanceCents });
});

// --------------------
// HoodPay Topup Create
// --------------------
function assertTopupAmount(amountCents, email) {
  const n = Number(amountCents);
  if (!Number.isFinite(n)) return { ok: false, error: "invalid_amount" };
  if (!Number.isInteger(n)) return { ok: false, error: "amount_not_integer" };
  if (n % 100 !== 0) return { ok: false, error: "must_be_whole_eur" };

  if (n < TOPUP_MIN_CENTS) return { ok: false, error: "min_topup" };
  if (n > TOPUP_MAX_CENTS) return { ok: false, error: "max_topup" };

  const used = sumTopupsLast24h(email);
  if (used + n > TOPUP_DAILY_LIMIT_CENTS) return { ok: false, error: "daily_limit_exceeded" };

  return { ok: true };
}

function baseUrlFromReq(req) {
  return `${req.protocol}://${req.get("host")}`;
}

// ✅ PLACEHOLDER: Endpoint + Body-Felder werden angepasst sobald HoodPay Docs da sind
async function hoodpayCreatePayment({ amountCents, currency, referenceId, successUrl, cancelUrl, webhookUrl, customerEmail }) {
  const HOODPAY_BASE_URL = process.env.HOODPAY_BASE_URL;
  const HOODPAY_API_KEY = process.env.HOODPAY_API_KEY;

  if (!HOODPAY_BASE_URL || !HOODPAY_API_KEY) {
    const e = new Error("missing_hoodpay_env");
    e.status = 500;
    e.details = "Setze HOODPAY_BASE_URL und HOODPAY_API_KEY in .env";
    throw e;
  }

  const url = `${HOODPAY_BASE_URL}/v1/payments`; // <- placeholder

  const body = {
    amount: amountCents,
    currency: currency || "EUR",
    description: "PremiumShop Top-up",
    referenceId,
    successUrl,
    cancelUrl,
    webhookUrl,
    customer: { email: customerEmail },
    metadata: { referenceId, kind: "topup" }
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${HOODPAY_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = new Error("hoodpay_create_failed");
    e.status = 502;
    e.details = { status: res.status, data };
    throw e;
  }

  const paymentUrl = data.paymentUrl || data.checkoutUrl || data.url;
  if (!paymentUrl) {
    const e = new Error("hoodpay_missing_paymentUrl");
    e.status = 502;
    e.details = data;
    throw e;
  }

  return { paymentUrl, raw: data };
}
app.get("/api/topup/status", requireAuth, (req, res) => {
  const topupId = String(req.query.topupId || "");
  if (!topupId) return res.status(400).json({ error: "missing_topupId" });

  const topup = pendingTopups.get(topupId);

  // Wenn nicht mehr pending -> entweder credited oder unknown
  if (!topup) {
    return res.json({ ok: true, status: "credited_or_unknown" });
  }

  // Security: nur eigener User darf seinen Status sehen
  if (topup.email !== req.user.email) {
    return res.status(403).json({ error: "forbidden" });
  }

  return res.json({
    ok: true,
    status: "pending",
    amountCents: topup.amountCents
  });
});
app.post("/api/topup/create", requireAuth, async (req, res) => {
  const { amountCents } = req.body || {};
  const check = assertTopupAmount(amountCents, req.user.email);
  if (!check.ok) return res.status(400).json({ error: check.error });

  const topupId = "top_" + Math.random().toString(16).slice(2);

  pendingTopups.set(topupId, {
    email: req.user.email,
    amountCents: Number(amountCents),
    createdAt: Date.now(),
  });

  const base = baseUrlFromReq(req);
  const successUrl = `${base}/topup-success.html?paid=1&topupId=${encodeURIComponent(topupId)}`;
  const cancelUrl  = `${base}/cancel.html?canceled=1&topupId=${encodeURIComponent(topupId)}`;
  const webhookUrl = `${base}/api/hoodpay/webhook`;

  try {
    const r = await hoodpayCreatePayment({
      amountCents: Number(amountCents),
      currency: "EUR",
      referenceId: topupId,
      successUrl,
      cancelUrl,
      webhookUrl,
      customerEmail: req.user.email,
    });

    res.json({ ok: true, topupId, paymentUrl: r.paymentUrl });
  } catch (e) {
    console.error("Topup create error:", e.status, e.details || e.message);
    pendingTopups.delete(topupId);
    res.status(e.status || 500).json({ error: e.message || "topup_create_failed", details: e.details || null });
  }
});

// --------------------
// HoodPay Webhook (1×, sauber)
// --------------------
function verifyHoodpaySignature(req) {
  const secret = process.env.HOODPAY_WEBHOOK_SECRET;
  if (!secret) return true; // DEV: solange Docs fehlen

  const sig = req.headers["hoodpay-signature"] || req.headers["x-hoodpay-signature"];
  // TODO: nach HoodPay Docs: HMAC(req.rawBody, secret) berechnen + vergleichen
  return Boolean(sig); // placeholder
}

app.post("/api/hoodpay/webhook", (req, res) => {
  if (!verifyHoodpaySignature(req)) {
    return res.status(401).json({ error: "invalid_signature" });
  }

  // PLACEHOLDER: Event-Struktur wird nach Docs angepasst
  const event = req.body || {};
  const type = event.type;
  const data = event.data || event;

  const referenceId = data.referenceId || data.reference_id || data.metadata?.referenceId;
  const status = String(data.status || "").toLowerCase();

  if (!referenceId) return res.status(400).json({ error: "missing_referenceId" });

  const topup = pendingTopups.get(referenceId);
  if (!topup) return res.json({ ok: true, ignored: true });

  const isPaid =
    type === "payment.paid" ||
    status === "paid" ||
    status === "succeeded" ||
    status === "success";

  if (!isPaid) return res.json({ ok: true, pending: true });

  const user = getOrCreateUser(topup.email);
  user.balanceCents += Number(topup.amountCents);
  topupLog.push({ email: user.email, amountCents: Number(topup.amountCents), ts: Date.now() });

  pendingTopups.delete(referenceId);
  return res.json({ ok: true });
});

// --------------------
// Checkout (Balance -> Einkauf)
// --------------------
app.post("/api/checkout", requireAuth, (req, res) => {
  const cart = Array.isArray(req.body?.cart) ? req.body.cart : [];
  if (!cart.length) return res.status(400).json({ error: "cart_empty" });

  const catalog = getCatalogFresh();
  if (!catalog.size) return res.status(500).json({ error: "catalog_empty" });

  let totalCents = 0;

  for (const it of cart) {
    const id = Number(it?.id);
    const qty = Math.max(1, Math.min(99, Number(it?.qty || 1)));

    const p = catalog.get(id);
    if (!p) return res.status(400).json({ error: "unknown_product", id });

    const unit = unitPriceCents(p);
    if (!unit) return res.status(400).json({ error: "invalid_price", id });

    totalCents += unit * qty;
  }

  if (req.user.balanceCents < totalCents) {
    return res.status(402).json({
      error: "insufficient_balance",
      totalCents,
      balanceCents: req.user.balanceCents,
    });
  }

  req.user.balanceCents -= totalCents;

  res.json({
    ok: true,
    orderId: "ord_" + Math.random().toString(16).slice(2),
    totalCents,
    balanceCents: req.user.balanceCents
  });
});

// --------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server läuft auf http://localhost:${PORT}`);
});