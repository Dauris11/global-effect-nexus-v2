// Pruebas del motor de prioridades (puras: sin base de datos).
// Uso: npx tsx --test scripts/probar-prioridades.ts
import assert from "node:assert/strict";
import { test } from "node:test";

import { responsabilidadesPorDefecto } from "../src/lib/prioridades/defaults";
import { agrupar, calcular, severidadDe } from "../src/lib/prioridades/score";
import type { ContextoPrioridades, PrioridadItem, TipoPrioridad } from "../src/lib/prioridades/types";
import { esVisible, filtrarVisibles } from "../src/lib/prioridades/visibilidad";

const HOY = "2026-11-27";
// En las pruebas «el día» de un instante es su fecha UTC: determinista sin zona horaria.
const diaDe = (d: Date) => d.toISOString().slice(0, 10);
const en = (dias: number) => new Date(Date.parse(`${HOY}T12:00:00Z`) + dias * 86_400_000);

function item(parcial: Partial<PrioridadItem> & { tipo: TipoPrioridad; id?: string }) {
  const base: Omit<PrioridadItem, "severidad" | "score"> = {
    id: parcial.id ?? `${parcial.tipo}:1`,
    titulo: "x",
    contexto: "y",
    modulo: "m",
    href: "/x",
    accion: { label: "Hacer", kind: "link" },
    ...parcial,
  };

  return calcular(base, HOY, diaDe);
}

const ctx = (rol: string, userId: string, extra: TipoPrioridad[] | null = null): ContextoPrioridades => ({
  userId,
  rol,
  hoy: HOY,
  responsabilidades: extra ? new Set(extra) : responsabilidadesPorDefecto(rol as never),
});

test("severidad: vencido / hoy / ≤3 días / normal", () => {
  assert.equal(severidadDe(en(-1), HOY, diaDe), "vencido");
  assert.equal(severidadDe(en(0), HOY, diaDe), "hoy");
  assert.equal(severidadDe(en(3), HOY, diaDe), "pronto");
  assert.equal(severidadDe(en(4), HOY, diaDe), "normal");
  assert.equal(severidadDe(undefined, HOY, diaDe), "normal");
});

test("score = severidad + bloqueo + prioridad + antigüedad (tope 20)", () => {
  assert.equal(item({ tipo: "tarea_vencida", venceEn: en(-1) }).score, 100);
  assert.equal(item({ tipo: "tarea_hoy", venceEn: en(0) }).score, 60);
  assert.equal(item({ tipo: "tarea_semana", venceEn: en(2) }).score, 40);
  assert.equal(item({ tipo: "tarea_semana", venceEn: en(9) }).score, 10);
  assert.equal(item({ tipo: "solicitud_por_decidir", bloquea: true }).score, 10 + 30);
  assert.equal(item({ tipo: "tarea_hoy", venceEn: en(0), prioridadTarea: "urgente" }).score, 60 + 40);
  assert.equal(item({ tipo: "tarea_hoy", venceEn: en(0), prioridadTarea: "alta" }).score, 60 + 20);
  assert.equal(item({ tipo: "tarea_hoy", venceEn: en(0), prioridadTarea: "media" }).score, 60 + 5);
  assert.equal(item({ tipo: "solicitud_por_decidir", creadoEn: en(-5) }).score, 10 + 5);
  assert.equal(item({ tipo: "solicitud_por_decidir", creadoEn: en(-90) }).score, 10 + 20);
  assert.equal(
    item({ tipo: "tarea_vencida", venceEn: en(-1), bloquea: true, prioridadTarea: "urgente", creadoEn: en(-3) }).score,
    100 + 30 + 40 + 3,
  );
});

test("dos administrativos con responsabilidades distintas ven listas distintas", () => {
  const items = [
    item({ tipo: "solicitud_por_decidir", id: "solicitud_por_decidir:a" }),
    item({ tipo: "alta_expediente_por_revisar", id: "alta_expediente_por_revisar:b" }),
    item({ tipo: "carta_mensual_pendiente", id: "carta_mensual_pendiente:c" }),
  ];
  const ana = ctx("admin", "ana", ["solicitud_por_decidir"]);
  const luis = ctx("admin", "luis", ["alta_expediente_por_revisar", "carta_mensual_pendiente"]);
  const deAna = filtrarVisibles(items, ana, diaDe).map((i) => i.id);
  const deLuis = filtrarVisibles(items, luis, diaDe).map((i) => i.id);

  assert.deepEqual(deAna, ["solicitud_por_decidir:a"]);
  assert.deepEqual(deLuis, ["alta_expediente_por_revisar:b", "carta_mensual_pendiente:c"]);
});

test("(a) lo asignado a mí se ve aunque el tipo no esté en mis responsabilidades; lo de otro no", () => {
  const mio = item({ tipo: "tarea_hoy", venceEn: en(0), responsableId: "ana" });
  const ajeno = item({ tipo: "tarea_hoy", venceEn: en(0), responsableId: "luis", id: "tarea_hoy:2" });

  assert.equal(esVisible(mio, ctx("admin", "ana"), diaDe), true);
  assert.equal(esVisible(ajeno, ctx("admin", "ana"), diaDe), false);
});

test("(b) con responsable asignado el tipo ya no basta: lo atiende solo esa persona", () => {
  const conResponsable = item({ tipo: "solicitud_por_decidir", responsableId: "luis" });

  assert.equal(esVisible(conResponsable, ctx("admin", "ana"), diaDe), false);
  assert.equal(esVisible(conResponsable, ctx("admin", "luis"), diaDe), true);
});

test("(c) super_admin ve los escalados (de otro, > 3 días vencido) y los demás no", () => {
  const viejo = item({ tipo: "tarea_vencida", venceEn: en(-4), responsableId: "luis", id: "tarea_vencida:v" });
  const reciente = item({ tipo: "tarea_vencida", venceEn: en(-2), responsableId: "luis", id: "tarea_vencida:r" });
  const dir = ctx("super_admin", "dir");
  const visibles = filtrarVisibles([viejo, reciente], dir, diaDe);

  assert.deepEqual(visibles.map((i) => i.id), ["tarea_vencida:v"]);
  assert.equal(visibles[0].escalado, true);
  assert.equal(filtrarVisibles([viejo], ctx("admin", "ana"), diaDe).length, 0);
});

test("super_admin ve el proyecto atrasado de todos", () => {
  const p = item({ tipo: "proyecto_atrasado", venceEn: en(-1), responsableId: "luis" });

  assert.equal(esVisible(p, ctx("super_admin", "dir"), diaDe), true);
  assert.equal(esVisible(p, ctx("admin", "ana"), diaDe), false);
});

test("contabilidad solo atiende solicitudes de Compra o Gasto", () => {
  const compra = item({ tipo: "solicitud_por_decidir", subtipo: "compra", id: "solicitud_por_decidir:c" });
  const carta = item({ tipo: "solicitud_por_decidir", subtipo: "carta", id: "solicitud_por_decidir:k" });
  const conta = ctx("contabilidad", "conta");

  assert.equal(esVisible(compra, conta, diaDe), true);
  assert.equal(esVisible(carta, conta, diaDe), false);
});

test("agrupar: Vencido · Hoy · Esta semana · Más adelante + Esperando a otros, por score", () => {
  const lista = agrupar(
    [
      item({ tipo: "tarea_vencida", venceEn: en(-2), id: "tarea_vencida:1" }),
      item({ tipo: "tarea_vencida", venceEn: en(-1), bloquea: true, id: "tarea_vencida:2" }),
      item({ tipo: "tarea_hoy", venceEn: en(0), id: "tarea_hoy:1" }),
      item({ tipo: "tarea_semana", venceEn: en(5), id: "tarea_semana:1" }),
      item({ tipo: "tarea_semana", venceEn: en(20), id: "tarea_semana:2" }),
      item({ tipo: "solicitud_por_decidir", esperandoA: "Luis", id: "solicitud_por_decidir:9" }),
    ],
    HOY,
    diaDe,
  );

  assert.deepEqual(lista.grupos.vencido.map((i) => i.id), ["tarea_vencida:2", "tarea_vencida:1"]);
  assert.deepEqual(lista.grupos.hoy.map((i) => i.id), ["tarea_hoy:1"]);
  assert.deepEqual(lista.grupos.semana.map((i) => i.id), ["tarea_semana:1"]);
  assert.deepEqual(lista.grupos.adelante.map((i) => i.id), ["tarea_semana:2"]);
  assert.deepEqual(lista.esperando.map((i) => i.id), ["solicitud_por_decidir:9"]);
});

test("dirección solo ve las compras por pagar de monto mayor al umbral", () => {
  const grande = item({ tipo: "compra_aprobada_por_pagar", montoUsd: 5000, id: "compra_aprobada_por_pagar:g" });
  const chica = item({ tipo: "compra_aprobada_por_pagar", montoUsd: 200, id: "compra_aprobada_por_pagar:c" });
  const dir = ctx("super_admin", "dir");

  assert.equal(esVisible(grande, dir, diaDe), true);
  assert.equal(esVisible(chica, dir, diaDe), false);
  assert.equal(esVisible(chica, ctx("contabilidad", "conta"), diaDe), true);
});

test("sin fecha: lo que bloquea a alguien va en «Hoy»; lo demás, más adelante", () => {
  const lista = agrupar(
    [
      item({ tipo: "solicitud_por_decidir", bloquea: true, id: "solicitud_por_decidir:b" }),
      item({ tipo: "expediente_incompleto", id: "expediente_incompleto:x" }),
    ],
    HOY,
    diaDe,
  );

  assert.deepEqual(lista.grupos.hoy.map((i) => i.id), ["solicitud_por_decidir:b"]);
  assert.deepEqual(lista.grupos.adelante.map((i) => i.id), ["expediente_incompleto:x"]);
});
