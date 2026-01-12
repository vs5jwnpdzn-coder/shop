// cart.js
(function(){
  // ===== TOAST (statt alert) =====
  function ensureToast(){
    if(document.getElementById("toastHost")) return;
    const host = document.createElement("div");
    host.id = "toastHost";
    host.style.cssText = `
      position: fixed;
      left: 50%;
      bottom: 18px;
      transform: translateX(-50%);
      z-index: 9999;
      display: grid;
      gap: 10px;
      pointer-events: none;
    `;
    document.body.appendChild(host);
  }

  function showToast(text){
    ensureToast();
    const host = document.getElementById("toastHost");
    const t = document.createElement("div");
    t.textContent = text;
    t.style.cssText = `
      pointer-events: none;
      padding: 10px 12px;
      border-radius: 14px;
      border: 1px solid rgba(255,255,255,.14);
      background: rgba(10,12,18,.78);
      color: rgba(243,246,255,.95);
      font-weight: 950;
      letter-spacing: .2px;
      box-shadow: 0 18px 56px rgba(0,0,0,.48);
      backdrop-filter: blur(10px);
      opacity: 0;
      transform: translateY(6px);
      transition: opacity .18s ease, transform .18s ease;
      max-width: min(520px, 92vw);
      text-align: center;
    `;
    host.appendChild(t);

    requestAnimationFrame(() => {
      t.style.opacity = "1";
      t.style.transform = "translateY(0px)";
    });

    setTimeout(() => {
      t.style.opacity = "0";
      t.style.transform = "translateY(6px)";
      setTimeout(() => t.remove(), 220);
    }, 1600);
  }

  // ===== CART STORAGE =====
  function getCart(){
    try { return JSON.parse(localStorage.getItem("cart") || "[]"); }
    catch { return []; }
  }
  function setCart(items){
    localStorage.setItem("cart", JSON.stringify(items));
  }

  function updateBadge(){
    const items = getCart();
    const count = items.reduce((sum, it) => sum + (Number(it.qty) || 0), 0);
    const el = document.getElementById("cartCount");
    if(el) el.textContent = String(count);
  }

  // ===== PRICE HELPERS =====
  function parsePrice(value){
    if(value == null) return 0;
    const s = String(value).replace(",", ".").replace(/[^0-9.]/g, "");
    const n = Number(s);
    return Number.isFinite(n) ? n : 0;
  }
  function formatEUR(n){
    return `€${(Math.round(n * 100) / 100).toFixed(2)}`;
  }
  function productUnitPrice(p){
    const sale = parsePrice(p.salePrice);
    if(sale > 0) return sale;
    return parsePrice(p.price);
  }

  // ===== AUTH CHECK (für Checkout) =====
  function getAuth(){
    try { return JSON.parse(sessionStorage.getItem("auth") || "null"); }
    catch { return null; }
  }

  // ===== RENDER CART (nur auf cart.html relevant) =====
  function renderCart(){
    const itemsWrap = document.getElementById("cartItems");
    const emptyEl = document.getElementById("cartEmpty");
    const subtotalEl = document.getElementById("subtotal");
    const shippingEl = document.getElementById("shipping");
    const totalEl = document.getElementById("total");

    if(!itemsWrap) return; // nicht cart.html

    const cart = getCart();

    const products = Array.isArray(window.PRODUCTS) ? window.PRODUCTS : [];
    const byId = new Map(products.map(p => [Number(p.id), p]));

    // bereinigen
    const cleaned = cart
      .map(it => ({ id: Number(it.id), qty: Math.max(1, Number(it.qty || 1)) }))
      .filter(it => byId.has(it.id));

    if(JSON.stringify(cleaned) !== JSON.stringify(cart)) setCart(cleaned);

    itemsWrap.innerHTML = "";
    let subtotal = 0;

    if(cleaned.length === 0){
      if(emptyEl) emptyEl.style.display = "block";
      if(subtotalEl) subtotalEl.textContent = formatEUR(0);
      if(shippingEl) shippingEl.textContent = formatEUR(0);
      if(totalEl) totalEl.textContent = formatEUR(0);
      updateBadge();
      return;
    }

    if(emptyEl) emptyEl.style.display = "none";

    for(const it of cleaned){
      const p = byId.get(it.id);
      const unit = productUnitPrice(p);
      const line = unit * it.qty;
      subtotal += line;

      const imgSrc = p.img || "images/placeholder.jpg";
      const out = (p.stock === false);

      const el = document.createElement("div");
      el.className = "item";
      el.innerHTML = `
        <div class="thumb">
          <img src="${imgSrc}" alt="${p.name || "Product"}">
        </div>

        <div>
          <div class="name">${p.name || "Product"}</div>
          <div class="meta">
            ${p.tag ? `<span style="opacity:.85">${p.tag}</span> • ` : ``}
            <span style="opacity:.85">Unit: ${formatEUR(unit)}</span>
            ${out ? ` • <span style="opacity:.75">OUT OF STOCK</span>` : ``}
          </div>
        </div>

        <div class="right">
          <div class="linePrice">${formatEUR(line)}</div>

          <div class="qty">
            <button type="button" data-act="dec" data-id="${it.id}">−</button>
            <span>${it.qty}</span>
            <button type="button" data-act="inc" data-id="${it.id}" ${out ? "disabled" : ""}>+</button>
          </div>

          <button class="linkBtn" type="button" data-act="remove" data-id="${it.id}">Remove</button>
        </div>
      `;
      itemsWrap.appendChild(el);
    }

    const shipping = 0;
    const total = subtotal + shipping;

    if(subtotalEl) subtotalEl.textContent = formatEUR(subtotal);
    if(shippingEl) shippingEl.textContent = formatEUR(shipping);
    if(totalEl) totalEl.textContent = formatEUR(total);

    updateBadge();
  }

  // ===== EVENTS =====
  function changeQty(id, delta){
    const items = getCart();
    const idx = items.findIndex(x => Number(x.id) === Number(id));
    if(idx < 0) return;

    const next = Math.max(1, Math.min(99, Number(items[idx].qty || 1) + delta));
    items[idx].qty = next;
    setCart(items);
    renderCart();
  }

  function removeItem(id){
    const items = getCart().filter(x => Number(x.id) !== Number(id));
    setCart(items);
    renderCart();
  }

  function bindCartEvents(){
    const itemsWrap = document.getElementById("cartItems");
    if(itemsWrap){
      itemsWrap.addEventListener("click", (e) => {
        const btn = e.target.closest("button");
        if(!btn) return;

        const act = btn.getAttribute("data-act");
        const id = btn.getAttribute("data-id");
        if(!act || !id) return;

        if(act === "dec") changeQty(id, -1);
        if(act === "inc") changeQty(id, +1);
        if(act === "remove") removeItem(id);
      });
    }

    const checkoutBtn = document.getElementById("checkoutBtn");
    if(checkoutBtn){
      checkoutBtn.addEventListener("click", () => {
        const user = getAuth();
        if(!user){
          location.href = "login.html?next=" + encodeURIComponent("cart.html");
          return;
        }
        showToast("Checkout (Demo): Du bist eingeloggt ✅");
      });
    }
  }

  // ===== INIT =====
  document.addEventListener("DOMContentLoaded", () => {
    updateBadge();
    renderCart();
    bindCartEvents();
  });

  // Export (optional)
  window.updateBadge = updateBadge;
  window.renderCart = renderCart;
  window.showToast = showToast;
})();