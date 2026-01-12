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