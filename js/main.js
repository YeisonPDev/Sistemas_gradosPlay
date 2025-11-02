import { createClient } from "https://esm.sh/@supabase/supabase-js";

const supabase = createClient(
  "https://dmgwjnsxmawqtecbkgcf.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtZ3dqbnN4bWF3cXRlY2JrZ2NmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTczNDI2OTYsImV4cCI6MjA3MjkxODY5Nn0.ToZ5Im4ci6BAgvHUHheEIP2YQqQ1_0T13-Re6kLxJ4w"
);
// Selección de elementos
const checkboxes = document.querySelectorAll(".check");
const busqueda = document.getElementById("busqueda");
const filas = document.querySelectorAll("#tablaGrados tbody tr");

// 🎯 Filtro de búsqueda en tiempo real
busqueda.addEventListener("input", (e) => {
  const valor = e.target.value.toLowerCase();
  filas.forEach((fila) => {
    const texto = fila.innerText.toLowerCase();
    fila.style.display = texto.includes(valor) ? "" : "none";
  });
});

// 🎯 Actualización de estado (cuando el usuario marca o desmarca)
checkboxes.forEach((chk) => {
  chk.addEventListener("change", async (e) => {
    const fila = e.target.closest("tr");
    const id = fila.dataset.id;
    const acudiente = e.target.dataset.acudiente;
    const nuevoEstado = e.target.checked ? 1 : 0;

    if (!e.target.checked) {
      const confirmar = confirm("¿Deseas cambiar a NO ASISTIÓ?");
      if (!confirmar) {
        e.target.checked = true;
        return;
      }
    }

    const res = await fetch("/updateEstado", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, acudiente, estado: nuevoEstado }),
    });

    if (res.ok) {
      fila.style.transition = "background-color 0.5s ease";
      fila.style.backgroundColor = nuevoEstado ? "#c8f7c5" : "#f7c5c5";
      setTimeout(() => (fila.style.backgroundColor = ""), 1500);
    }
  });
});

// ⚡ SUSCRIPCIÓN EN TIEMPO REAL
const canal = supabase.channel("realtime:grados");

canal.on(
  "postgres_changes",
  { event: "*", schema: "public", table: "grados" },
  (payload) => {
    const fila = document.querySelector(`tr[data-id='${payload.new.id}']`);
    if (!fila) return;

    // Buscar los elementos del acudiente
    const chk1 = fila.querySelector('[data-acudiente="1"]');
    const chk2 = fila.querySelector('[data-acudiente="2"]');

    if (payload.new.estado1 !== undefined) {
      chk1.checked = payload.new.estado1;
      fila.querySelector(".acudiente-item:nth-child(1)").style.color = payload
        .new.estado1
        ? "green"
        : "red";
    }

    if (payload.new.estado2 !== undefined) {
      chk2.checked = payload.new.estado2;
      fila.querySelector(".acudiente-item:nth-child(2)").style.color = payload
        .new.estado2
        ? "green"
        : "red";
    }

    // 💫 Efecto visual breve en la fila
    fila.style.transition = "background-color 0.4s ease";
    fila.style.backgroundColor = "#e7f3ff";
    setTimeout(() => (fila.style.backgroundColor = ""), 800);
  }
);

canal.subscribe();
