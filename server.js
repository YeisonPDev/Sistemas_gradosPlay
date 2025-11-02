// ==========================
// server.js
// ==========================

import express from "express";
import session from "express-session";
import dotenv from "dotenv";
import supabase from "./supabaseClient.js";
import path, { dirname } from "path";
import { fileURLToPath } from "url";

dotenv.config();
const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// === Configuración general ===
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Servir archivos estáticos desde la carpeta /public
app.use(express.static(path.join(__dirname, "public")));

// Configurar motor de plantillas EJS
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// === Sesiones ===
// ⚠️ En Vercel las sesiones no se conservan entre reinicios.
// Para algo persistente usar Supabase Auth o JWT.
app.use(
  session({
    secret: process.env.SESSION_SECRET || "clave-secreta",
    resave: false,
    saveUninitialized: false,
  })
);

// === Middleware para proteger rutas ===
function requireLogin(req, res, next) {
  if (!req.session.user) {
    return res.redirect("/");
  }
  next();
}

// === Página de login ===
app.get("/", (req, res) => {
  res.render("login", { error: null });
});

// === Procesar login ===
app.post("/login", async (req, res) => {
  const { user, contraseña } = req.body;

  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("user", user)
    .eq("contraseña", contraseña)
    .single();

  if (error || !data) {
    return res.render("login", { error: "Usuario o contraseña incorrectos" });
  }

  req.session.user = data;
  res.redirect("/dashboard");
});

// === Página principal (Dashboard) ===
app.get("/dashboard", requireLogin, async (req, res) => {
  const { data: grados, error } = await supabase.from("grados").select("*");
  if (error) return res.status(500).send("Error al cargar datos");
  res.render("dashboard", { grados, user: req.session.user });
});

// === API para actualizar estado de acudiente ===
app.post("/updateEstado", requireLogin, async (req, res) => {
  const { id, acudiente, estado } = req.body;
  const campo = acudiente === "1" ? "estado1" : "estado2";

  const { error } = await supabase
    .from("grados")
    .update({ [campo]: estado })
    .eq("id", id);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// === Cerrar sesión ===
app.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/");
  });
});

// === Exportar para Vercel ===
const PORT = process.env.PORT || 3000;

// En entorno local:
if (process.env.VERCEL !== "1") {
  app.listen(PORT, () =>
    console.log(`✅ Servidor corriendo en puerto ${PORT}`)
  );
}

// Vercel necesita esta exportación
export default app;
