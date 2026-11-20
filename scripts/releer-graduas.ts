// Lee los graduas que se subieron antes de existir el lector (o cuya lectura falló).
// Uso: npx tsx --env-file=.env.local scripts/releer-graduas.ts
import { enTransaccion } from "@/lib/db";
import { releerGraduasPendientes } from "@/server/universidades/gradua-importar";

const r = await releerGraduasPendientes(enTransaccion as never);

console.log(`leídos: ${r.leidos}`, r.fallidos.length ? `· no se pudieron leer: ${r.fallidos.join(", ")}` : "");
process.exit(0);
