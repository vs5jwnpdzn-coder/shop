// assets/auth.js
(function(){
  function getAuth(){
    try { return JSON.parse(sessionStorage.getItem("auth") || "null"); }
    catch { return null; }
  }

  function logout(){
    sessionStorage.removeItem("auth");
    location.reload();
  }

  function renderAuth(){
    const authArea = document.getElementById("authArea");
    if(!authArea) return;

    const user = getAuth();

    if(!user){
      authArea.innerHTML = `<a class="btn btnPrimary" href="login.html">Customer Login</a>`;
      return;
    }

    const name = (user.name || user.email || "Customer").toString();
    authArea.innerHTML = `
      <span class="hello">Hi, ${name}</span>
      <button class="btn btnGhost" type="button" id="logoutBtn">Logout</button>
    `;
    const b = document.getElementById("logoutBtn");
    if(b) b.addEventListener("click", logout);
  }

  document.addEventListener("DOMContentLoaded", renderAuth);

  // optional exports
  window.getAuth = getAuth;
  window.renderAuth = renderAuth;
})();