// Cifra con bcrypt todas las contraseñas que sigan en texto plano en la tabla "users".
// Uso:  npm run hash-passwords
// Es seguro ejecutarlo varias veces: las contraseñas ya cifradas se omiten.

import bcrypt from "bcryptjs";
import supabase from "../supabaseClient.js";

const BCRYPT_ROUNDS = 12;
const esHashBcrypt = (valor) => typeof valor === "string" && /^\$2[aby]\$\d{2}\$/.test(valor);

const { data: usuarios, error } = await supabase.from("users").select("id, contraseña");
if (error) {
  console.error("Error leyendo usuarios:", error.message);
  process.exit(1);
}

let cifradas = 0;
let omitidas = 0;

for (const u of usuarios) {
  if (!u.contraseña || esHashBcrypt(u.contraseña)) {
    omitidas++;
    continue;
  }
  const hash = await bcrypt.hash(u.contraseña, BCRYPT_ROUNDS);
  const { error: errUpdate } = await supabase.from("users").update({ contraseña: hash }).eq("id", u.id);
  if (errUpdate) {
    console.error(`Usuario ${u.id}: no se pudo actualizar (${errUpdate.message})`);
  } else {
    cifradas++;
  }
}

console.log(`Listo. Cifradas: ${cifradas}. Omitidas (ya cifradas o vacías): ${omitidas}.`);
