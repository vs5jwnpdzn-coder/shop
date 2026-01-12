// assets/wallet.js
(function(){
  function getBalance(){
    return Number(localStorage.getItem("balance") || 0);
  }
  function setBalance(n){
    localStorage.setItem("balance", String(Math.max(0, n)));
  }
  function formatEUR(n){
    return "€" + n.toFixed(2);
  }
  window.getBalance = getBalance;
  window.setBalance = setBalance;
  window.formatEUR = formatEUR;
})();
document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("topupBtn");
  const balEl = document.getElementById("balance");

  if(!btn || !balEl) return;

  btn.addEventListener("click", () => {
    const amount = 20; // Demo-Aufladung €20
    const next = getBalance() + amount;
    setBalance(next);

    balEl.textContent = formatEUR(next);

    if(typeof window.showToast === "function"){
      window.showToast(`Guthaben +€${amount.toFixed(2)}`, "ok");
    }
  });
});