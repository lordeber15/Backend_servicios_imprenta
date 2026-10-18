// Falla si `npm audit` (dependencias de producción) reporta una
// vulnerabilidad que no esté en audit-excepciones.json, o si una excepción
// ya pasó su fecha de revisión. Así ninguna vulnerabilidad nueva pasa en
// silencio y las aceptadas se vuelven a evaluar periódicamente.
// Uso: node scripts/auditar-dependencias.js
const { execFileSync } = require("child_process");
const path = require("path");
const excepciones = require(path.join(__dirname, "..", "audit-excepciones.json"));

let salida;
try {
  salida = execFileSync("npm", ["audit", "--omit=dev", "--json"], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
} catch (e) {
  salida = e.stdout; // npm audit sale con código ≠ 0 cuando encuentra algo
}
const vulns = JSON.parse(salida).vulnerabilities || {};
const hoy = new Date().toISOString().slice(0, 10);
const problemas = [];

for (const [paquete, v] of Object.entries(vulns)) {
  const ex = excepciones[paquete];
  if (!ex) problemas.push(`✗ ${v.severity.padEnd(8)} ${paquete} — sin excepción documentada`);
  else if (ex.revisar_antes < hoy) problemas.push(`✗ ${paquete} — la excepción venció el ${ex.revisar_antes}: volver a evaluarla`);
  else console.log(`  · ${v.severity.padEnd(8)} ${paquete} — aceptada hasta ${ex.revisar_antes}: ${ex.motivo}`);
}
for (const paquete of Object.keys(excepciones)) {
  if (!vulns[paquete]) console.log(`  ℹ ${paquete} ya no aparece en npm audit: quitar su excepción`);
}

if (problemas.length) {
  console.error(problemas.join("\n"));
  process.exit(1);
}
console.log("✓ Dependencias de producción sin vulnerabilidades no evaluadas");
