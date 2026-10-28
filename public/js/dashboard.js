import { createClient } from "https://esm.sh/@supabase/supabase-js@2.78.0";

// ---------- Elementos ----------
const busqueda = document.getElementById("busqueda");
const btnClear = document.getElementById("btnClear");
const btnToggleStats = document.getElementById("btnToggleStats");
const statsContainer = document.getElementById("statsContainer");
const statCards = document.querySelectorAll(".stat-card");
const filas = Array.from(document.querySelectorAll("#tablaGrados tbody tr"));
const resultCount = document.getElementById("resultCount");
const emptyState = document.getElementById("emptyState");
const liveIndicator = document.getElementById("liveIndicator");
const liveText = document.getElementById("liveText");

const CLASES_FILA = {
  ambos: "fila-ambos-asistieron",
  uno: "fila-uno-asistio",
  ninguno: "fila-ninguno-asistio",
};

let filtroActivo = null;

// ---------- Estadísticas ----------
btnToggleStats.addEventListener("click", () => {
  const mostrar = statsContainer.hidden;
  statsContainer.hidden = !mostrar;
  btnToggleStats.classList.toggle("active", mostrar);
  btnToggleStats.setAttribute("aria-expanded", String(mostrar));
  btnToggleStats.querySelector("span").textContent = mostrar ? "Ocultar estadísticas" : "Ver estadísticas";
});

function actualizarContadores() {
  const contar = (clase) => filas.filter((f) => f.classList.contains(clase)).length;
  document.getElementById("countAmbos").textContent = contar(CLASES_FILA.ambos);
  document.getElementById("countUno").textContent = contar(CLASES_FILA.uno);
  document.getElementById("countNinguno").textContent = contar(CLASES_FILA.ninguno);
  document.getElementById("countTotal").textContent = filas.length;
}

// ---------- Filtros (búsqueda + tarjeta de estadística) ----------
function aplicarFiltros() {
  const texto = busqueda.value.trim().toLowerCase();
  let visibles = 0;

  filas.forEach((fila) => {
    const coincideTexto = !texto || fila.textContent.toLowerCase().includes(texto);
    const coincideEstado =
      !filtroActivo || filtroActivo === "todos" || fila.classList.contains(CLASES_FILA[filtroActivo]);
    const visible = coincideTexto && coincideEstado;
    fila.hidden = !visible;
    if (visible) visibles++;
  });

  btnClear.hidden = !texto;
  emptyState.hidden = visibles > 0;
  resultCount.textContent =
    visibles === filas.length ? `${filas.length} estudiantes` : `${visibles} de ${filas.length} estudiantes`;
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
  const nombre = fila.querySelector(`[data-name="${n}"]`);
  nombre.classList.toggle("estado-verde", asistio);
  nombre.classList.toggle("estado-rojo", !asistio);
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
  setLive(false, "Tiempo real desactivado");
}

// ---------- Inicio ----------
actualizarContadores();
aplicarFiltros();
