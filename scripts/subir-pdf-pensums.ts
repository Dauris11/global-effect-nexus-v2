// Sube a la base (bucket privado + `archivo_academico`) el PDF oficial de cada pénsum cargado,
// para que se vea en la carrera, no en el repo. Idempotente: si el pénsum ya tiene su PDF, lo salta.
// Uso: npx tsx scripts/subir-pdf-pensums.ts
import { randomUUID } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";

import { config } from "dotenv";

config({ path: ".env.local" });

const { consultar, consultarUna, pool } = await import("../src/lib/db");
const { MAXIMO_ENTREGA, subirMaterial } = await import("../src/lib/supabase/almacen");

const UNPHU: Record<string, [string, string]> = {
  "ingenieria-civil_2024-1": ["Ingeniería Civil", "2024-1"],
  "ingenieria-en-sistemas-computacionales_2024-1": ["Ingeniería en Sistemas Computacionales", "2024-1"],
  "ingenieria-geomatica_2024-1": ["Ingeniería Geomática", "2024-1"],
  "ingenieria-industrial": ["Ingeniería Industrial", "2024"],
  "ingenieria-quimica_2024-1": ["Ingeniería Química", "2024-1"],
  "licenciatura-en-administracion-de-empresas_2024-1": ["Administración de Empresas", "2024-1"],
  "licenciatura-en-administracion-hotelera_2024-1": ["Administración Hotelera", "2024-1"],
  "licenciatura-en-arquitectura-y-urbanismo_2024-1": ["Arquitectura y Urbanismo", "2024-1"],
  "licenciatura-en-contabilidad-y-auditoria_2024-1": ["Contabilidad y Auditoría", "2024-1"],
  "licenciatura-en-derecho_2024-1": ["Derecho", "2024-1"],
  "licenciatura-en-diseno-de-interiores_2024-1": ["Diseño de Interiores", "2024-1"],
  "licenciatura-en-educacion-fisica_2024-1": ["Educación Física", "2024-1"],
  "licenciatura-en-educacion-mencion-educacion-especial_2024-1": ["Educación, mención Educación Especial", "2024-1"],
  "licenciatura-en-educacion-orientacion-matematica-y-fisica": ["Educación, orientación Matemática y Física", "2024"],
  "licenciatura-en-farmacia_2024-1": ["Farmacia", "2024-1"],
  "licenciatura-en-fisica-orientada-a-la-educacion-secundaria": ["Física orientada a la Educación Secundaria", "2024"],
  "licenciatura-en-gestion-aeronautica": ["Gestión Aeronáutica", "2024"],
  "licenciatura-en-mercadotecnia_2024-1": ["Mercadotecnia", "2024-1"],
  "licenciatura-en-negocios-internacionales_2024-1": ["Negocios Internacionales", "2024-1"],
  "licenciatura-en-psicologia-clinica_2024-1": ["Psicología Clínica", "2024-1"],
  "licenciatura-en-psicologia-educativa_2024-1": ["Psicología Educativa", "2024-1"],
  "licenciatura-en-psicologia-organizacional": ["Psicología Organizacional", "2024"],
  "tecnico-en-agrimensura_2024-1": ["Técnico en Agrimensura", "2024-1"],
  "doctor-en-medicina_2024-1": ["Medicina", "2024-1"],
  "doctor-en-odontologia_2024-1": ["Odontología", "2024-1"],
};
const CARRERAS_UC: Record<string, string> = {
  ICI: "Ingeniería Civil", ADM: "Administración de Empresas", ARQ: "Arquitectura", BIA: "Bioanálisis", CON: "Contabilidad", DER: "Derecho",
  ENF: "Enfermería", ISC: "Ingeniería en Sistemas de Computación", IIN: "Ingeniería Industrial", MED: "Medicina", MDT: "Mercadotecnia", ODO: "Odontología", PSI: "Psicología",
};

const { execFileSync } = await import("node:child_process");
const admin = await consultarUna<{ id: string }>(`SELECT u.id FROM usuario u JOIN rol r ON r.id = u.rol_id WHERE r.nombre IN ('super_admin','admin') ORDER BY u.created_at LIMIT 1`);
const trabajos: { ruta: string; siglas: string; carrera: string; version: string }[] = [];

for (const f of readdirSync("docs/PENSUMS/UCATECI").filter((x) => x.endsWith(".pdf"))) {
  const t = execFileSync("pdftotext", ["-layout", `docs/PENSUMS/UCATECI/${f}`, "-"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  const version = /Versi[oó]n:\s*(\S+)/.exec(t)?.[1];
  const siglas = /Carrera:\s*\(\s*(\w+)\s*\)/.exec(t)?.[1];

  if (version && siglas && CARRERAS_UC[siglas]) trabajos.push({ ruta: `docs/PENSUMS/UCATECI/${f}`, siglas: "UCATECI", carrera: CARRERAS_UC[siglas], version });
}

for (const [base, [carrera, version]] of Object.entries(UNPHU)) trabajos.push({ ruta: `docs/PENSUMS/UNPHU/${base}.pdf`, siglas: "UNPHU", carrera, version });

let subidos = 0;

for (const t of trabajos) {
  const p = await consultarUna<{ id: string; tiene: boolean }>(
    `SELECT p.id, EXISTS (SELECT 1 FROM archivo_academico a WHERE a.pensum_id = p.id AND a.tipo = 'pensum_pdf') AS tiene
       FROM pensum p JOIN carrera c ON c.id = p.carrera_id JOIN universidad u ON u.id = c.universidad_id
      WHERE u.siglas = $1 AND c.nombre = $2 AND p.version = $3`,
    [t.siglas, t.carrera, t.version],
  );

  if (!p) { console.log("· sin pénsum en la base:", t.siglas, t.carrera, t.version); continue; }
  if (p.tiene) { console.log("= ya tiene PDF:", t.siglas, t.carrera); continue; }

  const bytes = readFileSync(t.ruta);

  if (statSync(t.ruta).size > MAXIMO_ENTREGA) { console.log("! pasa de 10 MB, no se sube:", t.ruta); continue; }

  const destino = `academico/pensums/${p.id}/${randomUUID()}.pdf`;
  const s = await subirMaterial(destino, new File([bytes], "archivo.pdf", { type: "application/pdf" }));

  if (!s.ok) { console.log("! falló la subida:", t.ruta); continue; }

  await consultar(
    `INSERT INTO archivo_academico (pensum_id, tipo, ruta, nombre, tamano, subido_por) VALUES ($1, 'pensum_pdf', $2, $3, $4, $5)`,
    [p.id, destino, t.ruta.split("/").pop()!.slice(0, 160), bytes.length, admin!.id],
  );
  subidos++;
  console.log("✓", t.siglas, t.carrera, t.version);
}

console.log(`Subidos ${subidos} de ${trabajos.length}`);
await pool.end();
