// assets/auth.js
(function(){
  "use strict";

  async function api(path, options){
    const res = await fetch(path, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options && options.headers ? options.headers : {})
      },
      credentials: "include"
    });

    let data = null;
    try { data = await res.json(); } catch {}
    return { ok: res.ok, status: res.status, data };
  }

  async function isLoggedIn(){
    // Session-Check über /api/balance
    const r = await api("/api/balance", { method: "GET" });
    return r.ok;
  }

  async function logout(){
    await api("/api/logout", { method: "POST", body: "{}" });
    location.reload();
  }

  async function renderAuth(){
    const authArea = document.getElementById("authArea");
    if(!authArea) return;

    const logged = await isLoggedIn();

    if(!logged){
      authArea.innerHTML = `<a class="btn btnPrimary" href="login.html">Login</a>`;
      return;
    }

    authArea.innerHTML = `
      <button class="btn btnGhost" type="button" id="logoutBtn">Logout</button>
    `;

    const btn = document.getElementById("logoutBtn");
    if(btn) btn.addEventListener("click", logout);
  }

  // Exports
  window.renderAuth = renderAuth;
  window.logout = logout;

  document.addEventListener("DOMContentLoaded", () => {
    renderAuth();
  });
})();