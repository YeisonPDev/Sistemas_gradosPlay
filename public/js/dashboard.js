import { createClient } from "https://esm.sh/@supabase/supabase-js@2.78.0";

// ---------- Elementos ----------
const busqueda = document.getElementById("busqueda");
const btnClear = document.getElementById("btnClear");
const btnToggleStats = document.getElementById("btnToggleStats");
const statsContainer = document.getElementById("statsContainer");
const statCards = document.querySelectorAll(".stat-card");
const tbody = document.querySelector("#tablaGrados tbody");
const filas = Array.from(tbody.querySelectorAll("tr[data-id]"));
const separador = document.getElementById("separadorCeremonias");
const separadorTexto = document.getElementById("separadorTexto");
const tabsCeremonia = Array.from(document.querySelectorAll(".ceremonia-tab"));
const resultCount = document.getElementById("resultCount");
const emptyState = document.getElementById("emptyState");
const liveIndicator = document.getElementById("liveIndicator");
const liveText = document.getElementById("liveText");

const CLASES_FILA = {
  ambos: "fila-ambos-asistieron",
  uno: "fila-uno-asistio",
  ninguno: "fila-ninguno-asistio",
};

const TODAS = "*";
const CLAVE_CEREMONIA = "grados.ceremoniaActiva";

let filtroActivo = null;

// Búsqueda sin distinguir mayúsculas ni tildes ("perez" encuentra "Pérez").
const normalizar = (texto) =>
  String(texto ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

filas.forEach((fila) => {
  fila.dataset.search = normalizar(fila.dataset.search);
});

// ---------- Ceremonias ----------
// La ceremonia activa tiene prioridad: sin búsqueda solo se ven sus estudiantes;
// al buscar, primero salen los de la ceremonia activa y luego los de otras
// ceremonias, marcados con un aviso para no confundirlos.
const leerCeremoniaGuardada = () => {
  try {
    return localStorage.getItem(CLAVE_CEREMONIA);
  } catch {
    return null;
  }
};

const guardarCeremonia = (valor) => {
  try {
    localStorage.setItem(CLAVE_CEREMONIA, valor);
  } catch {
    /* sin almacenamiento: no pasa nada */
  }
};

const existeTab = (valor) => tabsCeremonia.some((t) => t.dataset.ceremonia === valor);
const guardada = leerCeremoniaGuardada();
let ceremoniaActiva = guardada !== null && existeTab(guardada) ? guardada : tabsCeremonia[0]?.dataset.ceremonia ?? TODAS;

const esDeCeremoniaActiva = (fila) => ceremoniaActiva === TODAS || fila.dataset.ceremonia === ceremoniaActiva;
const nombreCeremonia = (valor) => (valor === TODAS ? "todas las ceremonias" : valor || "sin ceremonia");

function pintarTabs() {
  tabsCeremonia.forEach((tab) => {
    const valor = tab.dataset.ceremonia;
    tab.setAttribute("aria-selected", String(valor === ceremoniaActiva));
    tab.querySelector(".ceremonia-tab-count").textContent =
      valor === TODAS ? filas.length : filas.filter((f) => f.dataset.ceremonia === valor).length;
  });
}

tabsCeremonia.forEach((tab) => {
  tab.addEventListener("click", () => {
    ceremoniaActiva = tab.dataset.ceremonia;
    guardarCeremonia(ceremoniaActiva);
    pintarTabs();
    actualizarContadores();
    aplicarFiltros();
  });
});

// ---------- Estadísticas ----------
btnToggleStats.addEventListener("click", () => {
  const mostrar = statsContainer.hidden;
  statsContainer.hidden = !mostrar;
  btnToggleStats.classList.toggle("active", mostrar);
  btnToggleStats.setAttribute("aria-expanded", String(mostrar));
  btnToggleStats.querySelector("span").textContent = mostrar ? "Ocultar estadísticas" : "Ver estadísticas";
});

// Las estadísticas corresponden a la ceremonia activa.
function actualizarContadores() {
  const delaCeremonia = filas.filter(esDeCeremoniaActiva);
  const contar = (clase) => delaCeremonia.filter((f) => f.classList.contains(clase)).length;
  document.getElementById("countAmbos").textContent = contar(CLASES_FILA.ambos);
  document.getElementById("countUno").textContent = contar(CLASES_FILA.uno);
  document.getElementById("countNinguno").textContent = contar(CLASES_FILA.ninguno);
  document.getElementById("countTotal").textContent = delaCeremonia.length;
}

// ---------- Filtros (ceremonia + búsqueda + tarjeta de estadística) ----------
function aplicarFiltros() {
  const texto = normalizar(busqueda.value);
  const principales = [];
  const otras = [];
  let totalCeremonia = 0;

  filas.forEach((fila) => {
    const enActiva = esDeCeremoniaActiva(fila);
    const coincideTexto = !texto || fila.dataset.search.includes(texto);
    const coincideEstado =
      !filtroActivo || filtroActivo === "todos" || fila.classList.contains(CLASES_FILA[filtroActivo]);

    // Los de otras ceremonias solo aparecen cuando se está buscando.
    const visible = coincideTexto && coincideEstado && (enActiva || Boolean(texto));
    fila.hidden = !visible;
    fila.classList.toggle("otra-ceremonia", !enActiva);
    fila.querySelector(".aviso-otra-ceremonia").hidden = enActiva;

    if (enActiva) totalCeremonia++;
    if (visible) (enActiva ? principales : otras).push(fila);
  });

  // Orden: primero la ceremonia activa, luego el separador y las demás ceremonias.
  const ocultas = filas.filter((f) => f.hidden);
  tbody.append(...principales, separador, ...otras, ...ocultas);

  separador.hidden = otras.length === 0;
  separadorTexto.textContent =
    principales.length === 0
      ? `No se encontró en ${nombreCeremonia(ceremoniaActiva)} · resultados en otras ceremonias`
      : "También encontrados en otras ceremonias";

  const visibles = principales.length + otras.length;
  btnClear.hidden = !texto;
  emptyState.hidden = visibles > 0;

  const etiqueta = ceremoniaActiva === TODAS ? "" : ` · ${nombreCeremonia(ceremoniaActiva)}`;
  let resumen =
    principales.length === totalCeremonia
      ? `${totalCeremonia} estudiantes${etiqueta}`
      : `${principales.length} de ${totalCeremonia} estudiantes${etiqueta}`;
  if (otras.length) resumen += ` (+${otras.length} en otras ceremonias)`;
  resultCount.textContent = resumen;
}

busqueda.addEventListener("input", aplicarFiltros);

btnClear.addEventListener("click", () => {
  busqueda.value = "";
  aplicarFiltros();
  busqueda.focus();
});

statCards.forEach((card) => {
  card.addEventListener("click", () => {
    const filtro = card.dataset.filter;
    filtroActivo = filtroActivo === filtro ? null : filtro;
    statCards.forEach((c) => c.classList.toggle("active", c.dataset.filter === filtroActivo));
    aplicarFiltros();
  });
});

// ---------- Estado de cada fila ----------
function pintarAcudiente(fila, n, asistio) {
  const caja = fila.querySelector(`.acudiente-item[data-name="${n}"]`);
  caja.classList.toggle("asistio", asistio);
  caja.classList.toggle("no-asistio", !asistio);
}

function actualizarClaseFila(fila) {
  const a1 = fila.querySelector('[data-acudiente="1"]').checked;
  const a2 = fila.querySelector('[data-acudiente="2"]').checked;

  fila.classList.remove(...Object.values(CLASES_FILA));
  if (a1 && a2) fila.classList.add(CLASES_FILA.ambos);
  else if (a1 || a2) fila.classList.add(CLASES_FILA.uno);
  else fila.classList.add(CLASES_FILA.ninguno);

  actualizarContadores();
  aplicarFiltros();
}

function resaltar(fila, clase, ms) {
  fila.classList.add(clase);
  setTimeout(() => fila.classList.remove(clase), ms);
}

// ---------- Marcar / desmarcar asistencia ----------
document.querySelectorAll(".check").forEach((chk) => {
  chk.addEventListener("change", async () => {
    const fila = chk.closest("tr");
    const acudiente = chk.dataset.acudiente;
    const nuevoEstado = chk.checked;

    if (!nuevoEstado && !confirm("¿Deseas cambiar a NO ASISTIÓ?")) {
      chk.checked = true;
      return;
    }

    chk.disabled = true;
    try {
      const res = await fetch("/updateEstado", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: fila.dataset.id, acudiente, estado: nuevoEstado ? 1 : 0 }),
      });

      if (res.status === 401) {
        window.location.href = "/";
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      pintarAcudiente(fila, acudiente, nuevoEstado);
      actualizarClaseFila(fila);
      resaltar(fila, nuevoEstado ? "flash-ok" : "flash-off", 1200);
    } catch (err) {
      console.error("No se pudo actualizar el estado:", err);
      chk.checked = !nuevoEstado;
      alert("No se pudo guardar el cambio. Revisa tu conexión e inténtalo de nuevo.");
    } finally {
      chk.disabled = false;
    }
  });
});

// ---------- Tiempo real (Supabase) ----------
function setLive(conectado, texto) {
  liveIndicator.classList.toggle("is-live", conectado);
  liveText.textContent = texto;
}

// El servidor envía un aviso (broadcast) con { id, estado1, estado2 } cada vez que
// alguien cambia una asistencia. El navegador no tiene acceso a la tabla.
const { supabaseUrl, supabaseKey, canal } = document.body.dataset;

if (supabaseUrl && supabaseKey && canal) {
  const supabase = createClient(supabaseUrl, supabaseKey);

  supabase
    .channel(canal)
    .on("broadcast", { event: "estado" }, ({ payload: registro }) => {
      if (!registro?.id) return;
      const fila = document.querySelector(`tr[data-id="${CSS.escape(String(registro.id))}"]`);
      if (!fila) return;

      [1, 2].forEach((n) => {
        const valor = registro[`estado${n}`];
        if (valor === undefined) return;
        fila.querySelector(`[data-acudiente="${n}"]`).checked = Boolean(valor);
        pintarAcudiente(fila, n, Boolean(valor));
      });

      actualizarClaseFila(fila);
      resaltar(fila, "flash-remote", 800);
    })
    .subscribe((status) => {
      if (status === "SUBSCRIBED") setLive(true, "En vivo");
      else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") setLive(false, "Sin conexión en vivo");
    });
} else {
  console.warn("Tiempo real desactivado: falta SUPABASE_ANON_KEY en el servidor.");
  setLive(false, "Tiempo real desactivado");
}

// ---------- Inicio ----------
pintarTabs();
actualizarContadores();
aplicarFiltros();
