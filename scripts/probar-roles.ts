// Pruebas de roles (puras: sin base de datos ni servidor).
// Uso: npx tsx --test scripts/probar-roles.ts
import assert from "node:assert/strict";
import { test } from "node:test";

import { responsabilidadesPorDefecto } from "../src/lib/prioridades/defaults";
import { TIPOS_TECNICOS } from "../src/lib/prioridades/catalogo";
import type { ContextoPrioridades, PrioridadItem } from "../src/lib/prioridades/types";
import { esVisible } from "../src/lib/prioridades/visibilidad";
import {
  esPermisoTecnico,
  esRolTotal,
  PERMISOS,
  PERMISOS_POR_ROL,
  PERMISOS_TECNICOS,
  ROLES,
  usuarioTienePermiso,
} from "../src/lib/rbac";
import {
  ROLE_COLOR,
  ROLE_DESCRIPTION,
  ROLE_LABEL,
  ROLES_VER_COMO_ORDEN,
  puedeVerComo,
  rolesAsignablesPor,
  rolesVerComo,
  validarCambioDeCuenta,
} from "../src/lib/roles";
import {
  firmarSuplantacion,
  leerSuplantacion,
} from "../src/lib/suplantacion";

const owner = { rol: "owner" as const, permisosRol: PERMISOS_POR_ROL.owner };
const developer = { rol: "developer" as const, permisosRol: PERMISOS_POR_ROL.developer };

// ── esRolTotal vs permisos técnicos ─────────────────────────────────────────────────────────────
test("owner y developer son roles totales (pasan requerirRol)", () => {
  assert.equal(esRolTotal("owner"), true);
  assert.equal(esRolTotal("developer"), true);
  assert.equal(esRolTotal("admin"), false);
});

test("los seis permisos tecnico.* existen y son solo del developer de fábrica", () => {
  assert.equal(PERMISOS_TECNICOS.length, 6);
  for (const p of PERMISOS_TECNICOS) {
    assert.ok(esPermisoTecnico(p));
    assert.ok(PERMISOS_POR_ROL.developer.includes(p), `developer tiene ${p}`);
    for (const rol of ROLES.filter((r) => r !== "developer")) {
      assert.ok(!PERMISOS_POR_ROL[rol].includes(p), `${rol} no debe tener ${p}`);
    }
  }
});

test("owner pasa el negocio pero NO los permisos técnicos, aunque se los pongan", () => {
  assert.equal(usuarioTienePermiso(owner, "contabilidad.aprobar"), true);
  assert.equal(usuarioTienePermiso(owner, "usuarios.administrar"), true);
  for (const p of PERMISOS_TECNICOS) assert.equal(usuarioTienePermiso(owner, p), false, p);

  // Ni con el reparto completo en `rol_permiso` ni con una excepción personal.
  const forzado = { rol: "owner" as const, permisosRol: PERMISOS, excepciones: [{ permiso: "tecnico.ia" as const, concedido: true }] };
  for (const p of PERMISOS_TECNICOS) assert.equal(usuarioTienePermiso(forzado, p), false, p);
});

test("developer tiene todo, técnico incluido; con «ver como» otro rol deja de tenerlo", () => {
  for (const p of PERMISOS) assert.equal(usuarioTienePermiso(developer, p), true, p);

  const comoOwner = { rol: "owner" as const, permisosRol: PERMISOS_POR_ROL.owner };
  assert.equal(usuarioTienePermiso(comoOwner, "tecnico.dev_panel"), false);
});

test("una excepción personal no da un permiso técnico a un admin", () => {
  const admin = { rol: "admin" as const, excepciones: [{ permiso: "tecnico.auditoria" as const, concedido: true }] };
  assert.equal(usuarioTienePermiso(admin, "tecnico.auditoria"), false);
});

// ── Reglas de asignación ────────────────────────────────────────────────────────────────────────
const base = { objetivoActivo: true, propietariosActivos: 2 };

test("solo un developer asigna o quita el rol developer", () => {
  assert.equal(validarCambioDeCuenta({ ...base, actorRol: "owner", objetivoRol: "admin", cambio: { tipo: "rol", nuevoRol: "developer" } }), "solo_developer");
  assert.equal(validarCambioDeCuenta({ ...base, actorRol: "owner", objetivoRol: "developer", cambio: { tipo: "rol", nuevoRol: "admin" } }), "solo_developer");
  assert.equal(validarCambioDeCuenta({ ...base, actorRol: "developer", objetivoRol: "admin", cambio: { tipo: "rol", nuevoRol: "developer" } }), null);
  assert.equal(validarCambioDeCuenta({ ...base, actorRol: "developer", objetivoRol: "developer", cambio: { tipo: "rol", nuevoRol: "admin" } }), null);
});

test("a una cuenta developer solo la toca un developer (desactivar, reiniciar acceso)", () => {
  for (const tipo of ["desactivar", "reiniciar_acceso", "activar", "borrar"] as const) {
    assert.equal(validarCambioDeCuenta({ ...base, actorRol: "owner", objetivoRol: "developer", cambio: { tipo } }), "solo_developer", tipo);
    assert.equal(validarCambioDeCuenta({ ...base, actorRol: "developer", objetivoRol: "developer", cambio: { tipo } }), null, tipo);
  }
});

test("solo owner o developer asignan el rol owner", () => {
  assert.equal(validarCambioDeCuenta({ ...base, actorRol: "admin", objetivoRol: "docente", cambio: { tipo: "rol", nuevoRol: "owner" } }), "solo_owner");
  assert.equal(validarCambioDeCuenta({ ...base, actorRol: "owner", objetivoRol: "docente", cambio: { tipo: "rol", nuevoRol: "owner" } }), null);
  assert.equal(validarCambioDeCuenta({ ...base, actorRol: "developer", objetivoRol: "docente", cambio: { tipo: "rol", nuevoRol: "owner" } }), null);
});

test("siempre queda al menos un owner activo", () => {
  const ultimo = { actorRol: "developer", objetivoRol: "owner", objetivoActivo: true, propietariosActivos: 1 };
  assert.equal(validarCambioDeCuenta({ ...ultimo, cambio: { tipo: "rol", nuevoRol: "admin" } }), "ultimo_owner");
  assert.equal(validarCambioDeCuenta({ ...ultimo, cambio: { tipo: "desactivar" } }), "ultimo_owner");
  assert.equal(validarCambioDeCuenta({ ...ultimo, cambio: { tipo: "borrar" } }), "ultimo_owner");
  // Dejarlo como owner no es quitarlo.
  assert.equal(validarCambioDeCuenta({ ...ultimo, cambio: { tipo: "rol", nuevoRol: "owner" } }), null);
  // Con otro owner activo sí se puede.
  assert.equal(validarCambioDeCuenta({ ...ultimo, propietariosActivos: 2, cambio: { tipo: "rol", nuevoRol: "admin" } }), null);
  // Un owner ya inactivo no cuenta como «el último»: no hay nada que proteger.
  assert.equal(validarCambioDeCuenta({ ...ultimo, objetivoActivo: false, cambio: { tipo: "borrar" } }), null);
});

test("roles asignables por actor", () => {
  assert.ok(!rolesAsignablesPor("owner").includes("developer"));
  assert.ok(rolesAsignablesPor("owner").includes("owner"));
  assert.ok(rolesAsignablesPor("developer").includes("developer"));
  assert.ok(!rolesAsignablesPor("admin").includes("owner"));
  assert.ok(!rolesAsignablesPor("owner").includes("estudiante"));
});

// ── «Ver como»: lista y orden ───────────────────────────────────────────────────────────────────
test("orden de «Ver como»", () => {
  assert.deepEqual([...ROLES_VER_COMO_ORDEN], ["owner", "admin", "contabilidad", "docente", "estudiante", "dir_habitudes", "habitudes", "chofer"]);
});

test("el developer puede ver como Propietario; el owner no, pero sí como los demás; nadie como developer", () => {
  assert.deepEqual([...rolesVerComo("developer")], [...ROLES_VER_COMO_ORDEN]);
  assert.ok(puedeVerComo("developer", "owner"));
  assert.ok(!puedeVerComo("owner", "owner"));
  assert.deepEqual([...rolesVerComo("owner")], ROLES_VER_COMO_ORDEN.filter((r) => r !== "owner"));
  assert.ok(!puedeVerComo("developer", "developer"));
  assert.ok(!puedeVerComo("owner", "developer"));
  assert.deepEqual([...rolesVerComo("admin")], []);
  assert.deepEqual([...rolesVerComo(undefined)], []);
});

test("etiquetas, descripciones y colores cubren todos los roles", () => {
  for (const rol of ROLES) {
    assert.ok(ROLE_LABEL[rol].startsWith("roles."), rol);
    assert.ok(ROLE_DESCRIPTION[rol].startsWith("roleDescriptions."), rol);
    assert.ok(ROLE_COLOR[rol], rol);
  }
});

// ── Prioridades por rol ─────────────────────────────────────────────────────────────────────────
const HOY = "2026-11-27";
const diaDe = (d: Date) => d.toISOString().slice(0, 10);
const ctx = (rol: string): ContextoPrioridades => ({ userId: "u1", rol, hoy: HOY, responsabilidades: responsabilidadesPorDefecto(rol as never) });
const item = (tipo: PrioridadItem["tipo"]): PrioridadItem => ({
  id: `${tipo}:1`, tipo, titulo: "x", contexto: "y", modulo: "m", href: "/x",
  accion: { label: "Hacer", kind: "link" }, severidad: "normal", score: 0,
});

test("developer solo recibe prioridades técnicas; owner no las recibe", () => {
  const dev = responsabilidadesPorDefecto("developer");
  assert.deepEqual([...dev].sort(), ["error_produccion", "integracion_caida", "job_fallido"]);
  assert.equal(esVisible(item("job_fallido"), ctx("developer"), diaDe), true);
  assert.equal(esVisible(item("liquidez_negativa"), ctx("developer"), diaDe), false);
  assert.equal(esVisible(item("solicitud_pendiente_direccion"), ctx("developer"), diaDe), false);

  for (const t of TIPOS_TECNICOS) {
    assert.equal(esVisible(item(t), ctx("owner"), diaDe), false, `owner no recibe ${t}`);
    assert.equal(esVisible(item(t), { ...ctx("admin"), responsabilidades: new Set([t]) }, diaDe), false, `admin no recibe ${t}`);
  }
  assert.equal(esVisible(item("solicitud_pendiente_direccion"), ctx("owner"), diaDe), true);
});

// ── Cookie firmada de «Ver como usuario…» ───────────────────────────────────────────────────────
const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const C = "33333333-3333-4333-8333-333333333333";

test("cookie de suplantación: firma, manipulación y vencimiento", () => {
  const ahora = Date.parse("2026-11-28T12:00:00Z");
  const valor = firmarSuplantacion({ objetivoId: A, realId: B }, "secreto", ahora, 3600);

  assert.deepEqual(leerSuplantacion(valor, "secreto", ahora + 1000), { objetivoId: A, realId: B });
  assert.equal(leerSuplantacion(valor, "otro-secreto", ahora + 1000), null);
  assert.equal(leerSuplantacion(valor.replace(A, C), "secreto", ahora + 1000), null);
  assert.equal(leerSuplantacion(valor, "secreto", ahora + 3601 * 1000), null);
  assert.equal(leerSuplantacion(undefined, "secreto"), null);
  assert.equal(leerSuplantacion(A, "secreto"), null);
});
