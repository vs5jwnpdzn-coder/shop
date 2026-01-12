// assets/wallet.js
(function(){
  "use strict";

  function formatEURFromCents(cents){
    const n = (Number(cents) || 0) / 100;
    return `€${n.toFixed(2)}`;
  }

  async function api(path, opts){
    const res = await fetch(path, {
      credentials: "include",
      headers: { "Content-Type": "application/json", ...(opts?.headers||{}) },
      ...opts
    });
    const data = await res.json().catch(() => ({}));
    if(!res.ok){
      const err = new Error(data?.error || `HTTP_${res.status}`);
      err.data = data;
      throw err;
    }
    return data;
  }

  async function refreshBalanceUI(){
    const walletEl = document.getElementById("wallet");
    const balEl = document.getElementById("balance");
    if(!walletEl || !balEl) return;

    try{
      const data = await api("/api/balance");
      walletEl.style.display = "flex";
      balEl.textContent = formatEURFromCents(data.balanceCents);
    }catch(e){
      // nicht eingeloggt -> wallet ausblenden
      walletEl.style.display = "none";
    }
  }
  document.addEventListener("DOMContentLoaded", () => {
    refreshBalanceUI();
  });

  // (optional) exports
  window.refreshBalanceUI = refreshBalanceUI;
})();