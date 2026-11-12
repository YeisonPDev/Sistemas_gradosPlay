// Mostrar / ocultar contraseña
const toggle = document.getElementById("togglePassword");
const password = document.getElementById("password");

if (toggle && password) {
  toggle.addEventListener("click", () => {
    const mostrar = password.type === "password";
    password.type = mostrar ? "text" : "password";
    toggle.setAttribute("aria-pressed", String(mostrar));
    toggle.setAttribute("aria-label", mostrar ? "Ocultar contraseña" : "Mostrar contraseña");
    password.focus();
  });
}

// Aviso de Bloq Mayús activado
const capsWarning = document.getElementById("capsWarning");

if (password && capsWarning) {
  const revisarMayus = (e) => {
    if (typeof e.getModifierState !== "function") return;
    capsWarning.textContent = e.getModifierState("CapsLock") ? "Bloq Mayús está activado." : "";
  };
  password.addEventListener("keydown", revisarMayus);
  password.addEventListener("keyup", revisarMayus);
  password.addEventListener("blur", () => (capsWarning.textContent = ""));
}

// Estado de carga al enviar (evita doble envío)
const form = document.getElementById("loginForm");
const submit = document.getElementById("loginSubmit");

if (form && submit) {
  form.addEventListener("submit", () => {
    submit.disabled = true;
    submit.classList.add("is-loading");
    submit.querySelector(".btn-label").textContent = "Entrando…";
  });

  // Si el navegador restaura la página desde caché (botón Atrás), reactivar el botón
  window.addEventListener("pageshow", () => {
    submit.disabled = false;
    submit.classList.remove("is-loading");
    submit.querySelector(".btn-label").textContent = "Entrar al panel";
  });
}
