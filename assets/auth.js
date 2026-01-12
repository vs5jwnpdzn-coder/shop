// assets/auth.js
(function(){
  "use strict";

  // Optional: nur für Anzeige (Name), Auth kommt IMMER über Cookie/API.
  const USER_KEY = "ps_user";

  function saveUserDisplay(user){
    try { sessionStorage.setItem(USER_KEY, JSON.stringify(user || null)); } catch {}
  }
  function getUserDisplay(){
    try { return JSON.parse(sessionStorage.getItem(USER_KEY) || "null"); }
    catch { return null; }
  }

  async function api(path, options){
    const res = await fetch(path, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options && options.headers ? options.headers : {})
      },
      credentials: "include"
    });

    // JSON safe
    let data = null;
    try { data = await res.json(); } catch {}
    return { ok: res.ok, status: res.status, data };
  }

  async function isLoggedIn(){
    // Wir nutzen /api/balance als "Session-Check"
    const r = await api("/api/balance", { method: "GET" });
    return r.ok;
  }

  async function logout(){
    await api("/api/logout", { method: "POST", body: "{}" });
    saveUserDisplay(null);
    location.reload();
  }

  async function renderAuth(){
    const authArea = document.getElementById("authArea");
    if(!authArea) return;

    const logged = await isLoggedIn();

    if(!logged){
      authArea.innerHTML = `<a class="btn btnPrimary" href="login.html">Customer Login</a>`;
      return;
    }

    const u = getUserDisplay();
    const name = (u && (u.name || u.email)) ? String(u.name || u.email) : "Customer";

    authArea.innerHTML = `
      <span class="hello">Hi, ${name}</span>
      <button class="btn btnGhost" type="button" id="logoutBtn">Logout</button>
    `;
    const btn = document.getElementById("logoutBtn");
    if(btn) btn.addEventListener("click", logout);
  }

  // Exports
  window.renderAuth = renderAuth;
  window.logout = logout;
  window.saveUserDisplay = saveUserDisplay;

  document.addEventListener("DOMContentLoaded", () => {
    renderAuth();
  });
})();