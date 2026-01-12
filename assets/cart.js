// assets/cart.js
(function(){
  "use strict";

  // ===== CART STORAGE =====
  function getCart(){
    try { return JSON.parse(localStorage.getItem("cart") || "[]"); }
    catch { return []; }
  }

  function setCart(items){
    localStorage.setItem("cart", JSON.stringify(items));
  }

  function clearCart(){
    localStorage.removeItem("cart");
  }

  // ===== TOAST (optional) =====
  function toast(msg, type="ok"){
    if(typeof window.showToast === "function"){
      window.showToast(msg, type);
      return;
    }
    // fallback mini-toast
    const d = document.createElement("div");
    d.style.cssText = `
      position:fixed;left:50%;bottom:18px;transform:translateX(-50%);
      padding:10px 12px;border-radius:14px;
      border:1px solid rgba(255,255,255,.14);
      background:rgba(10,12,18,.78);
      color:rgba(243,246,255,.95);
      font-weight:950;letter-spacing:.2px;
      box-shadow:0 18px 56px rgba(0,0,0,.48);
      backdrop-filter:blur(10px);
      z-index:9999;
    `;
    d.textContent = msg;
    document.body.appendChild(d);
    setTimeout(() => d.remove(), 1400);
  }

  // ===== PRICE HELPERS =====
  // akzeptiert: "€14.99", "14.99", "14,99", usw.
  function parsePrice(value){
    if(value == null) return 0;
    const s = String(value).replace(",", ".").replace(/[^0-9.]/g, "");
    const n = Number(s);
    return Number.isFinite(n) ? n : 0;
  }

  function formatEUR(n){
    return `€${(Math.round(n * 100) / 100).toFixed(2)}`;
  }

  // nimmt salePrice wenn vorhanden, sonst price
  function productUnitPrice(p){
    const sale = parsePrice(p && p.salePrice);
    if(sale > 0) return sale;
    return parsePrice(p && p.price);
  }

  // ===== BADGE =====
  function updateBadge(){
    const items = getCart();
    const count = items.reduce((sum, it) => sum + (Number(it.qty) || 0), 0);
    const el = document.getElementById("cartCount");
    if(el) el.textContent = String(count);
  }

  // ===== ADD TO CART (global) =====
  // damit product.html / products.html einfach window.addToCart(id, qty) callen können
  function addToCart(id, qty){
    const pid = Number(id);
    const q = Math.max(1, Math.min(99, Number(qty || 1)));

    const items = getCart();
    const idx = items.findIndex(x => Number(x.id) === pid);

    if(idx >= 0) items[idx].qty = Math.max(1, Math.min(99, Number(items[idx].qty || 0) + q));
    else items.push({ id: pid, qty: q });

    setCart(items);
    updateBadge();
    return items;
  }

  // ===== CART PAGE RENDER (nur wenn cart.html Elemente existieren) =====
  function renderCart(){
    const itemsWrap   = document.getElementById("cartItems");
    const emptyEl     = document.getElementById("cartEmpty");
    const subtotalEl  = document.getElementById("subtotal");
    const shippingEl  = document.getElementById("shipping");
    const totalEl     = document.getElementById("total");

    // Wenn nicht auf cart.html -> nichts rendern
    if(!itemsWrap) {
      updateBadge();
      return;
    }

    const cart = getCart();

    // Produktdaten
    const products = Array.isArray(window.PRODUCTS) ? window.PRODUCTS : [];
    const byId = new Map(products.map(p => [Number(p.id), p]));

    // Bereinigen (nur gültige IDs, qty >= 1)
    const cleaned = cart
      .map(it => ({ id: Number(it.id), qty: Math.max(1, Math.min(99, Number(it.qty || 1))) }))
      .filter(it => byId.has(it.id));

    // falls bereinigt anders -> speichern
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

      const imgSrc = (p && p.img) ? p.img : "images/placeholder.jpg";

      const el = document.createElement("div");
      el.className = "item";
      el.innerHTML = `
        <div class="thumb">
          <img src="${imgSrc}" alt="${(p && p.name) ? p.name : "Product"}">
        </div>

        <div>
          <div class="name">${(p && p.name) ? p.name : "Product"}</div>
          <div class="meta">
            ${p && p.tag ? `<span style="opacity:.85">${p.tag}</span> • ` : ``}
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
      itemsWrap.appendChild(el);
    }

    // shipping demo (0.00)
    const shipping = 0;
    const total = subtotal + shipping;

    if(subtotalEl) subtotalEl.textContent = formatEUR(subtotal);
    if(shippingEl) shippingEl.textContent = formatEUR(shipping);
    if(totalEl) totalEl.textContent = formatEUR(total);

    updateBadge();
  }

  // ===== CART EVENTS (cart.html) =====
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
        // Auth kommt aus assets/auth.js (oder fallback)
        const user = (typeof window.getAuth === "function")
          ? window.getAuth()
          : (() => {
              try { return JSON.parse(sessionStorage.getItem("auth") || "null"); }
              catch { return null; }
            })();

        if(!user){
          location.href = "login.html?next=" + encodeURIComponent("cart.html");
          return;
        }

        const cart = getCart();
        if(!cart.length){
          toast("Warenkorb ist leer", "error");
          return;
        }

        // Total aus UI
        const totalEl = document.getElementById("total");
        const total = totalEl ? parsePrice(totalEl.textContent) : 0;

        // Wallet Integration (Demo): braucht window.getBalance() / window.setBalance()
        const balance = (typeof window.getBalance === "function") ? window.getBalance() : 0;

        if(balance < total){
          toast("Nicht genug Guthaben – bitte aufladen", "error");
          return;
        }

        if(typeof window.setBalance === "function"){
          window.setBalance(balance - total);
        }

        clearCart();
        updateBadge();
        renderCart();

        // Wallet UI refresh (falls du #balance hast)
        const balEl = document.getElementById("balance");
        if(balEl && typeof window.getBalance === "function"){
          balEl.textContent = formatEUR(window.getBalance());
        }

        toast("✅ Bestellung erfolgreich (Demo)", "ok");
      });
    }
  }

  // ===== INIT =====
  document.addEventListener("DOMContentLoaded", () => {
    updateBadge();
    renderCart();
    bindCartEvents();
  });

  // ===== EXPORTS (global) =====
  window.getCart = getCart;
  window.setCart = setCart;
  window.clearCart = clearCart;

  window.updateBadge = updateBadge;
  window.addToCart = addToCart;

  window.parsePrice = parsePrice;
  window.formatEUR = formatEUR;
})();