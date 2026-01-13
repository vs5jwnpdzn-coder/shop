// assets/ui.js
(function(){
  function showToast(text, type="ok"){
    const t = document.createElement("div");
    t.className = "toast " + type;
    t.textContent = text;

    document.body.appendChild(t);

    setTimeout(() => {
      t.style.opacity = "0";
      t.style.transform = "translateY(14px)";
      setTimeout(() => t.remove(), 300);
    }, 2400);
  }

  window.showToast = showToast;
})();