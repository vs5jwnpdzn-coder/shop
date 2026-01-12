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
  function addToCart(id, qty){
    const pid = Number(id);
    const q = Math.max(1, Math.min(99, Number(qty || 1)));

    const items = getCart();
    const idx = items.findIndex(x => Number(x.id) === pid);

    if(idx >= 0){
      items[idx].qty = Math.max(1, Math.min(99, Number(items[idx].qty || 0) + q));
    } else {
      items.push({ id: pid, qty: q });
    }

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

    // Nicht auf cart.html -> nur Badge updaten
    if(!itemsWrap){
      updateBadge();
      return;
    }

    const cart = getCart();

    // Produktdaten aus products-data.js (Browser: window.PRODUCTS)
    const products = Array.isArray(window.PRODUCTS) ? window.PRODUCTS : [];
    const byId = new Map(products.map(p => [Number(p.id), p]));

    // Bereinigen: nur gültige Produkte + qty 1..99
    const cleaned = cart
      .map(it => ({
        id: Number(it.id),
        qty: Math.max(1, Math.min(99, Number(it.qty || 1)))
      }))
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

    const shipping = 0;
    const total = subtotal + shipping;

    if(subtotalEl) subtotalEl.textContent = formatEUR(subtotal);
    if(shippingEl) shippingEl.textContent = formatEUR(shipping);
    if(totalEl) totalEl.textContent = formatEUR(total);

    updateBadge();
  }

  // ===== CART EVENTS =====
  function changeQty(id, delta){
    const items = getCart();
    const idx = items.findIndex(x => Number(x.id) === Number(id));
    if(idx < 0) return;

    items[idx].qty = Math.max(1, Math.min(99, Number(items[idx].qty || 1) + delta));
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
    if(!checkoutBtn) return;

    checkoutBtn.addEventListener("click", async () => {
      if(checkoutBtn.disabled) return;

      const cart = getCart();
      if(!cart.length){
        toast("Warenkorb ist leer", "error");
        return;
      }

      checkoutBtn.disabled = true;
      const oldText = checkoutBtn.textContent;
      checkoutBtn.textContent = "Processing…";

      try{
        const res = await fetch("/api/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ cart })
        });

        const data = await res.json().catch(() => null);

        if(res.status === 401){
          location.href = "login.html?next=" + encodeURIComponent("cart.html");
          return;
        }

        if(res.status === 402){
          const bal = data?.balanceCents ?? 0;
          const tot = data?.totalCents ?? 0;
          toast(
            `Nicht genug Guthaben. Balance: €${(bal/100).toFixed(2)} • Total: €${(tot/100).toFixed(2)}`,
            "error"
          );
          return;
        }

        if(!res.ok){
          console.error("Checkout error:", res.status, data);
          toast("Checkout fehlgeschlagen (Server)", "error");
          return;
        }

        // ✅ Erfolg
        clearCart();
        updateBadge();
        renderCart();
        window.refreshBalanceUI?.();

        toast("✅ Bestellung erfolgreich", "ok");

        // ✅ Success URL mit Details
        location.href =
  "success.html?paid=1" +
  "&orderId=" + encodeURIComponent(data.orderId || "") +
  "&totalCents=" + encodeURIComponent(String(data.totalCents ?? ""));
      } catch(err){
        console.error(err);
        toast("Server nicht erreichbar", "error");
      } finally{
        // Wenn redirect passiert, ist egal — sonst Button wieder frei
        checkoutBtn.disabled = false;
        checkoutBtn.textContent = oldText;
      }
    });
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