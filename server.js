// ==========================
// server.js
// ==========================

import express from "express";
import session from "express-session";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import supabase from "./supabaseClient.js";
import path, { dirname } from "path";
import { fileURLToPath } from "url";

dotenv.config();
const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const isProduction = process.env.NODE_ENV === "production" || process.env.VERCEL === "1";

// Canal de Supabase Realtime (broadcast) para avisar a los navegadores de cambios.
// Los navegadores ya no leen la tabla "grados" directamente.
const CANAL_GRADOS = "grados-estado";
const canalGrados = supabase.channel(CANAL_GRADOS);

// === Configuración general ===
app.disable("x-powered-by");
app.set("trust proxy", 1); // Vercel está detrás de un proxy (necesario para cookies "secure")
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// Servir archivos estáticos desde la carpeta /public
app.use(express.static(path.join(__dirname, "public")));

// Configurar motor de plantillas EJS
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// === Sesiones ===
// Nota: en Vercel las sesiones en memoria no se conservan entre reinicios.
// Para algo persistente usar Supabase Auth o un store externo.
let sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret) {
  // Sin secreto configurado se usa uno aleatorio: es seguro, pero las sesiones
  // se pierden cada vez que el servidor se reinicia.
  sessionSecret = crypto.randomBytes(32).toString("hex");
  console.warn("SESSION_SECRET no está definido; se usará un secreto temporal.");
}

app.use(
  session({
    name: "grados.sid",
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: isProduction,
      maxAge: 8 * 60 * 60 * 1000, // 8 horas
    },
  })
);

// === Middleware para proteger rutas ===
function requireLogin(req, res, next) {
  if (!req.session.user) {
    if (req.path === "/updateEstado") {
      return res.status(401).json({ error: "Sesión expirada" });
    }
    return res.redirect("/");
  }
  next();
}

// === Contraseñas ===
const BCRYPT_ROUNDS = 12;
const esHashBcrypt = (valor) => typeof valor === "string" && /^\$2[aby]\$\d{2}\$/.test(valor);

// Hash fijo para comparar cuando el usuario no existe (evita revelar usuarios por tiempo de respuesta)
const HASH_FALSO = bcrypt.hashSync(crypto.randomBytes(16).toString("hex"), BCRYPT_ROUNDS);

function comparacionSegura(a, b) {
  const ha = crypto.createHash("sha256").update(String(a)).digest();
  const hb = crypto.createHash("sha256").update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

async function verificarContraseña(usuario, contraseña) {
  const guardada = usuario?.contraseña;

  if (!usuario || !guardada) {
    await bcrypt.compare(contraseña, HASH_FALSO);
    return false;
  }

  if (esHashBcrypt(guardada)) {
    return bcrypt.compare(contraseña, guardada);
  }

  // Migración automática: la contraseña aún está en texto plano.
  // Si coincide, se reemplaza por su hash bcrypt.
  if (!comparacionSegura(contraseña, guardada)) return false;

  const hash = await bcrypt.hash(contraseña, BCRYPT_ROUNDS);
  const { error } = await supabase.from("users").update({ contraseña: hash }).eq("id", usuario.id);
  if (error) console.error("No se pudo cifrar la contraseña del usuario", usuario.id, error.message);
  return true;
}

// === Página de login ===
app.get("/", (req, res) => {
  if (req.session.user) return res.redirect("/dashboard");
  res.render("login", { error: null });
});

// === Procesar login ===
app.post("/login", async (req, res) => {
  const { user, contraseña } = req.body;
  const errorLogin = () => res.status(401).render("login", { error: "Usuario o contraseña incorrectos" });

  if (typeof user !== "string" || typeof contraseña !== "string" || !user.trim() || !contraseña) {
    return errorLogin();
  }

  const { data: usuario, error } = await supabase
    .from("users")
    .select("id, user, nombre, contraseña")
    .eq("user", user.trim())
    .maybeSingle();

  if (error) {
    console.error("Error consultando usuario:", error.message);
    return res.status(500).render("login", { error: "Error del servidor. Intenta de nuevo." });
  }

  if (!(await verificarContraseña(usuario, contraseña))) {
    return errorLogin();
  }

  // Nueva sesión para evitar fijación de sesión. Solo se guardan datos no sensibles.
  req.session.regenerate((err) => {
    if (err) return res.status(500).render("login", { error: "Error del servidor. Intenta de nuevo." });
    req.session.user = { id: usuario.id, user: usuario.user, nombre: usuario.nombre };
    req.session.save(() => res.redirect("/dashboard"));
  });
});

// === Página principal (Dashboard) ===
app.get("/dashboard", requireLogin, async (req, res) => {
  const { data: grados, error } = await supabase
    .from("grados")
    .select("id, Estudiante, Codigo, Acudiente_1, Acudiente_2, estado1, estado2")
    .order("Estudiante", { ascending: true });

  if (error) return res.status(500).send("Error al cargar datos");

  res.render("dashboard", {
    grados,
    user: req.session.user,
    // Clave pública (anon): solo se usa para escuchar el canal de avisos.
    // Nunca enviar aquí la clave service_role.
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY || "",
    canal: CANAL_GRADOS,
  });
});

// === API para actualizar estado de acudiente ===
app.post("/updateEstado", requireLogin, async (req, res) => {
  const { id, acudiente, estado } = req.body;

  const idNum = Number(id);
  const acudienteStr = String(acudiente);
  const estadoBool = estado === true || estado === 1 || estado === "1";
  const estadoValido = [true, false, 1, 0, "1", "0"].includes(estado);

  if (!Number.isInteger(idNum) || idNum <= 0 || !["1", "2"].includes(acudienteStr) || !estadoValido) {
    return res.status(400).json({ error: "Datos inválidos" });
  }

  const campo = `estado${acudienteStr}`;
  const { data, error } = await supabase
    .from("grados")
    .update({ [campo]: estadoBool })
    .eq("id", idNum)
    .select("id, estado1, estado2")
    .maybeSingle();

  if (error) {
    console.error("Error actualizando estado:", error.message);
    return res.status(500).json({ error: "No se pudo guardar el cambio" });
  }
  if (!data) return res.status(404).json({ error: "Registro no encontrado" });

  // Avisar al resto de navegadores (solo id y estados, sin datos personales).
  // Se espera la respuesta porque en Vercel el proceso puede congelarse al responder.
  try {
    await canalGrados.httpSend("estado", { id: data.id, estado1: data.estado1, estado2: data.estado2 });
  } catch (err) {
    console.error("No se pudo enviar el aviso en tiempo real:", err?.message || err);
  }

  res.json({ success: true });
});

// === Cerrar sesión ===
app.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("grados.sid");
    res.redirect("/");
  });
});

// === Exportar para Vercel ===
const PORT = process.env.PORT || 3000;

// En entorno local:
if (process.env.VERCEL !== "1") {
  app.listen(PORT, () =>
    console.log(`Servidor corriendo en http://localhost:${PORT}`)
  );
}

// Vercel necesita esta exportación
export default app;
