/* assets/cart.js
   Shared cart logic for all pages (products, product, cart)
   Uses localStorage key: "cart"
*/

(function(){
  "use strict";

  const CART_KEY = "cart";

  // ===== STORAGE =====
  function getCart(){
    try { return JSON.parse(localStorage.getItem(CART_KEY) || "[]"); }
    catch { return []; }
  }
  function setCart(items){
    localStorage.setItem(CART_KEY, JSON.stringify(items));
  }

  // qty clamp helper
  function clampQty(n){
    n = Number(n);
    if(!Number.isFinite(n)) n = 1;
    return Math.max(1, Math.min(99, n));
  }

  // ===== BADGE =====
  function updateBadge(){
    const items = getCart();
    const count = items.reduce((sum, it) => sum + (Number(it.qty) || 0), 0);
    const el = document.getElementById("cartCount");
    if(el) el.textContent = String(count);
  }

  // ===== CORE OPS =====
  function addToCart(id, qty = 1){
    const pid = Number(id);
    if(!Number.isFinite(pid) || pid <= 0) return;

    qty = clampQty(qty);

    const items = getCart();
    const idx = items.findIndex(x => Number(x.id) === pid);

    if(idx >= 0){
      items[idx].qty = clampQty((Number(items[idx].qty) || 0) + qty);
    } else {
      items.push({ id: pid, qty });
    }

    setCart(items);
    updateBadge();
  }

  function setCartQty(id, qty){
    const pid = Number(id);
    if(!Number.isFinite(pid) || pid <= 0) return;

    qty = clampQty(qty);

    const items = getCart();
    const idx = items.findIndex(x => Number(x.id) === pid);
    if(idx < 0) return;

    items[idx].qty = qty;
    setCart(items);
    updateBadge();
  }

  function removeFromCart(id){
    const pid = Number(id);
    const items = getCart().filter(x => Number(x.id) !== pid);
    setCart(items);
    updateBadge();
  }

  function clearCart(){
    setCart([]);
    updateBadge();
  }

  // ===== OPTIONAL: CART PAGE RENDER =====
  // If cart.html has these IDs, we can render automatically:
  // #cartItems, #cartEmpty, #subtotal, #shipping, #total, #checkoutBtn
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
  function getAuth(){
    try { return JSON.parse(sessionStorage.getItem("auth") || "null"); }
    catch { return null; }
  }

  function renderCartPage(){
    const itemsWrap = document.getElementById("cartItems");
    if(!itemsWrap) return; // not on cart.html

    const emptyEl = document.getElementById("cartEmpty");
    const subtotalEl = document.getElementById("subtotal");
    const shippingEl = document.getElementById("shipping");
    const totalEl = document.getElementById("total");

    const products = Array.isArray(window.PRODUCTS) ? window.PRODUCTS : [];
    const byId = new Map(products.map(p => [Number(p.id), p]));

    // clean cart
    const raw = getCart();
    const cleaned = raw
      .map(it => ({ id: Number(it.id), qty: clampQty(it.qty || 1) }))
      .filter(it => byId.has(it.id));

    if(JSON.stringify(cleaned) !== JSON.stringify(raw)) setCart(cleaned);

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

      const row = document.createElement("div");
      row.className = "item";
      row.innerHTML = `
        <div class="thumb">
          <img src="${imgSrc}" alt="${p.name || "Product"}">
        </div>

        <div>
          <div class="name">${p.name || "Product"}</div>
          <div class="meta">
            ${p.tag ? `<span style="opacity:.85">${p.tag}</span> • ` : ``}
            <span style="opacity:.85">Unit: ${formatEUR(unit)}</span>
          </div>
        </div>

        <div class="right">
          <div class="linePrice">${formatEUR(line)}</div>

          <div class="qty">
            <button type="button" data-act="dec" data-id="${it.id}">−</button>
            <span>${it.qty}</span>
            <button type="button" data-act="inc" data-id="${it.id}">+</button>
          </div>

          <button class="linkBtn" type="button" data-act="remove" data-id="${it.id}">Remove</button>
        </div>
      `;
      itemsWrap.appendChild(row);
    }

    const shipping = 0;
    const total = subtotal + shipping;

    if(subtotalEl) subtotalEl.textContent = formatEUR(subtotal);
    if(shippingEl) shippingEl.textContent = formatEUR(shipping);
    if(totalEl) totalEl.textContent = formatEUR(total);

    updateBadge();
  }

  function bindCartPageEvents(){
    const itemsWrap = document.getElementById("cartItems");
    if(itemsWrap){
      itemsWrap.addEventListener("click", (e) => {
        const btn = e.target.closest("button");
        if(!btn) return;
        const act = btn.getAttribute("data-act");
        const id = btn.getAttribute("data-id");
        if(!act || !id) return;

        const pid = Number(id);
        const cart = getCart();
        const found = cart.find(x => Number(x.id) === pid);
        const current = found ? clampQty(found.qty || 1) : 1;

        if(act === "dec") setCartQty(pid, current - 1);
        if(act === "inc") setCartQty(pid, current + 1);
        if(act === "remove") removeFromCart(pid);

        renderCartPage();
      });
    }

    const checkoutBtn = document.getElementById("checkoutBtn");
if(checkoutBtn){
  checkoutBtn.addEventListener("click", () => {
    const user = getAuth();
    if(!user){
      location.href = "login.html?next=cart.html";
      return;
    }

    // Platzhalter für Hoodpay
    if(typeof window.showToast === "function"){
      window.showToast("Checkout startet bald (Hoodpay)", "ok");
    }
  });
}
  }

  // ===== EXPORTS (GLOBAL) =====
  window.getCart = getCart;
  window.setCart = setCart;
  window.updateBadge = updateBadge;

  window.addToCart = addToCart;
  window.setCartQty = setCartQty;
  window.removeFromCart = removeFromCart;
  window.clearCart = clearCart;

  window.renderCartPage = renderCartPage;

  // ===== INIT =====
  document.addEventListener("DOMContentLoaded", () => {
    updateBadge();
    renderCartPage();
    bindCartPageEvents();
  });

})();