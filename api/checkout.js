// /api/checkout.js
import path from "path";

function readCookie(req, name) {
  const raw = req.headers.cookie || "";
  const m = raw.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : null;
}

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

async function loadCatalog() {
  // products-data.js muss CommonJS export unterstützen:
  // if (typeof module !== "undefined" && module.exports) module.exports = PRODUCTS;
  const file = path.join(process.cwd(), "public", "products-data.js");
  const mod = await import("file://" + file + "?cacheBust=" + Date.now());
  const products = mod?.default || mod?.PRODUCTS || mod; // je nach Export-Art
  const list = Array.isArray(products) ? products : (Array.isArray(products?.PRODUCTS) ? products.PRODUCTS : []);
  return new Map(list.map(p => [Number(p.id), p]));
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });

  const email = readCookie(req, "ps_email");
  if (!email) return res.status(401).json({ error: "not_logged_in" });

  const cart = Array.isArray(req.body?.cart) ? req.body.cart : [];
  if (!cart.length) return res.status(400).json({ error: "cart_empty" });

  const catalog = await loadCatalog();
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

  // ✅ Ohne DB ist balance hier Demo = 0
  const balanceCents = 0;

  if (balanceCents < totalCents) {
    return res.status(402).json({
      error: "insufficient_balance",
      totalCents,
      balanceCents,
    });
  }

  // TODO: später DB Update: balance -= totalCents

  return res.json({
    ok: true,
    orderId: "ord_" + Math.random().toString(16).slice(2),
    totalCents,
    balanceCents: balanceCents - totalCents,
  });
}