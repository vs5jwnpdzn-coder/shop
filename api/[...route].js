// api/[...route].js
const path = require("path");
const fs = require("fs");

// --------------------
// In-memory Store (Demo)
// --------------------
function store() {
  if (!globalThis.__ps_store) {
    globalThis.__ps_store = {
      users: new Map(),         // email -> { email, name, balanceCents }
      pendingTopups: new Map(), // topupId -> { email, amountCents, createdAt }
      topupLog: [],             // { email, amountCents, ts }
    };
  }
  return globalThis.__ps_store;
}

function getOrCreateUser(email) {
  const s = store();
  const key = String(email || "").toLowerCase();
  if (!s.users.has(key)) s.users.set(key, { email: key, name: "Customer", balanceCents: 0 });
  return s.users.get(key);
}

// --------------------
// Cookies
// --------------------
function parseCookies(req) {
  const raw = req.headers.cookie || "";
  const out = {};
  raw.split(";").forEach((part) => {
    const [k, ...rest] = part.trim().split("=");
    if (!k) return;
    out[k] = decodeURIComponent(rest.join("=") || "");
  });
  return out;
}
function setCookie(res, name, value, opts = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  parts.push(`Path=${opts.path || "/"}`);
  if (opts.httpOnly !== false) parts.push("HttpOnly");
  parts.push(`SameSite=${opts.sameSite || "Lax"}`);
  if (opts.secure) parts.push("Secure");
  if (opts.maxAge != null) parts.push(`Max-Age=${opts.maxAge}`);
  res.setHeader("Set-Cookie", parts.join("; "));
}
function clearCookie(res, name) {
  res.setHeader("Set-Cookie", `${name}=; Path=/; Max-Age=0; SameSite=Lax; HttpOnly`);
}

function json(res, code, data) {
  res.statusCode = code;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve) => {
    let buf = "";
    req.on("data", (d) => (buf += d));
    req.on("end", () => {
      if (!buf) return resolve(null);
      try {
        resolve(JSON.parse(buf));
      } catch {
        resolve(null);
      }
    });
  });
}

// --------------------
// Catalog (from public/products-data.js)
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
  const file = path.join(process.cwd(), "public", "products-data.js");
  if (!fs.existsSync(file)) return new Map();
  delete require.cache[require.resolve(file)];
  const products = require(file); // products-data.js exports PRODUCTS
  const list = Array.isArray(products) ? products : [];
  return new Map(list.map((p) => [Number(p.id), p]));
}

// --------------------
// Limits (Anti-Fraud light)
// --------------------
const TOPUP_MIN_CENTS = 1000;   // 10€
const TOPUP_MAX_CENTS = 50000;  // 500€
const TOPUP_DAILY_LIMIT_CENTS = 200000; // 2000€ / 24h

function sumTopupsLast24h(email) {
  const s = store();
  const now = Date.now();
  const dayAgo = now - 24 * 60 * 60 * 1000;
  let sum = 0;
  for (const t of s.topupLog) {
    if (t.email === email && t.ts >= dayAgo) sum += t.amountCents;
  }
  return sum;
}

function assertTopupAmount(amountCents) {
  const n = Number(amountCents);
  if (!Number.isFinite(n)) return { ok: false, error: "invalid_amount" };
  if (!Number.isInteger(n)) return { ok: false, error: "amount_not_integer" };
  if (n < TOPUP_MIN_CENTS) return { ok: false, error: "min_10_eur" };
  if (n > TOPUP_MAX_CENTS) return { ok: false, error: "max_500_eur" };
  if (n % 100 !== 0) return { ok: false, error: "must_be_whole_eur" };
  return { ok: true };
}

// --------------------
// Auth helper
// --------------------
function requireAuth(req, res) {
  const cookies = parseCookies(req);
  const email = cookies.ps_email;
  if (!email) {
    json(res, 401, { error: "not_logged_in" });
    return null;
  }
  return getOrCreateUser(email);
}

// --------------------
// Main handler
// --------------------
module.exports = async (req, res) => {
  const route = (req.query.route || []).map(String); // from [...route]
  const p = "/" + route.join("/");                   // e.g. /login
  const method = req.method || "GET";

  // --- LOGIN
  if (p === "/login" && method === "POST") {
    const body = await readBody(req);
    const email = String(body?.email || "").toLowerCase();
    const password = String(body?.password || "");

    if (!email || !password) return json(res, 400, { error: "missing_credentials" });
    if (email !== "demo@shop.com" || password !== "demo1234") return json(res, 401, { error: "invalid_login" });

    const user = getOrCreateUser(email);
    user.name = "Demo Customer";

    setCookie(res, "ps_email", user.email, { httpOnly: true, sameSite: "Lax" });
    return json(res, 200, { ok: true, user: { email: user.email, name: user.name } });
  }

  // --- LOGOUT
  if (p === "/logout" && method === "POST") {
    clearCookie(res, "ps_email");
    return json(res, 200, { ok: true });
  }

  // --- BALANCE
  if (p === "/balance" && method === "GET") {
    const user = requireAuth(req, res);
    if (!user) return;
    return json(res, 200, { balanceCents: user.balanceCents });
  }

  // --- TOPUP CREATE (Stub bis HoodPay Docs da sind)
  if (p === "/topup/create" && method === "POST") {
    const user = requireAuth(req, res);
    if (!user) return;

    const body = await readBody(req);
    const amountCents = Number(body?.amountCents);

    const chk = assertTopupAmount(amountCents);
    if (!chk.ok) return json(res, 400, { error: chk.error });

    const used = sumTopupsLast24h(user.email);
    if (used + amountCents > TOPUP_DAILY_LIMIT_CENTS) {
      return json(res, 429, { error: "daily_limit_reached", usedCents: used, limitCents: TOPUP_DAILY_LIMIT_CENTS });
    }

    const s = store();
    const topupId = "top_" + Math.random().toString(16).slice(2);
    s.pendingTopups.set(topupId, { email: user.email, amountCents, createdAt: Date.now() });

    // ✅ STUB paymentUrl: solange HoodPay fehlt, simulieren wir “paid”
    // (Später ersetzen wir das durch echten HoodPay paymentUrl + Webhook)
    const paymentUrl =
      `/success.html?paid=1&kind=topup&topupId=${encodeURIComponent(topupId)}&totalCents=${encodeURIComponent(String(amountCents))}`;

    // --- STUB: direkt gutschreiben (damit dein Frontend Flow testbar bleibt)
    user.balanceCents += amountCents;
    s.topupLog.push({ email: user.email, amountCents, ts: Date.now() });
    s.pendingTopups.delete(topupId);

    return json(res, 200, { ok: true, topupId, paymentUrl });
  }

  // --- CHECKOUT
  if (p === "/checkout" && method === "POST") {
    const user = requireAuth(req, res);
    if (!user) return;

    const body = await readBody(req);
    const cart = Array.isArray(body?.cart) ? body.cart : [];
    if (!cart.length) return json(res, 400, { error: "cart_empty" });

    const catalog = loadCatalog();
    if (!catalog.size) return json(res, 500, { error: "catalog_empty" });

    let totalCents = 0;
    for (const it of cart) {
      const id = Number(it?.id);
      const qty = Math.max(1, Math.min(99, Number(it?.qty || 1)));

      const prod = catalog.get(id);
      if (!prod) return json(res, 400, { error: "unknown_product", id });

      const unit = unitPriceCents(prod);
      if (!unit) return json(res, 400, { error: "invalid_price", id });

      totalCents += unit * qty;
    }

    if (user.balanceCents < totalCents) {
      return json(res, 402, { error: "insufficient_balance", totalCents, balanceCents: user.balanceCents });
    }

    user.balanceCents -= totalCents;

    return json(res, 200, {
      ok: true,
      orderId: "ord_" + Math.random().toString(16).slice(2),
      totalCents,
      balanceCents: user.balanceCents,
    });
  }

  // --- HOODPAY WEBHOOK (Platzhalter, wird später mit echten Docs gefüllt)
  if (p === "/hoodpay/webhook" && method === "POST") {
    // TODO: Signature-Check + event parsing + credit user
    return json(res, 200, { ok: true, stub: true });
  }

  // --- default
  return json(res, 404, { error: "not_found", path: p });
};