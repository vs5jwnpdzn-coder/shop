// assets/wallet.js
(function(){
  "use strict";

  const KEY = "balance";

  function getBalance(){
    const n = Number(localStorage.getItem(KEY) || 0);
    return Number.isFinite(n) ? Math.max(0, n) : 0;
  }

  function setBalance(n){
    const val = Number(n);
    const safe = Number.isFinite(val) ? Math.max(0, val) : 0;
    localStorage.setItem(KEY, String(safe));
    return safe;
  }

  function formatMoneyEUR(n){
    return "€" + (Math.round(Number(n) * 100) / 100).toFixed(2);
  }

  function renderWallet(){
    const wallet = document.getElementById("wallet");
    const balEl  = document.getElementById("balance");
    if(!wallet || !balEl) return;

    wallet.style.display = "inline-flex";
    balEl.textContent = formatMoneyEUR(getBalance());
  }

  // EXPORTS
  window.getBalance = getBalance;
  window.setBalance = setBalance;
  window.renderWallet = renderWallet;

  document.addEventListener("DOMContentLoaded", () => {
    renderWallet();

    const btn = document.getElementById("topupBtn");
    const balEl = document.getElementById("balance");

    if(btn && balEl){
      btn.addEventListener("click", () => {
        const amount = 20; // Demo-Aufladung €20
        const next = setBalance(getBalance() + amount);

        balEl.textContent = formatMoneyEUR(next);

        if(typeof window.showToast === "function"){
          window.showToast(`Guthaben +${formatMoneyEUR(amount)}`, "ok");
        }
      });
    }
  });
})();