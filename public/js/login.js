// Mostrar / ocultar contraseña
const toggle = document.getElementById("togglePassword");
const password = document.getElementById("password");

if (toggle && password) {
  toggle.addEventListener("click", () => {
    const visible = password.type === "text";
    password.type = visible ? "password" : "text";
    toggle.setAttribute("aria-label", visible ? "Mostrar contraseña" : "Ocultar contraseña");
  });
}
