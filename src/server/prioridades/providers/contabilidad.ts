import { consultar } from "@/lib/db";
import { cuentasConSaldo } from "@/server/contabilidad/bancos/consultas";
import { usuarioTienePermiso } from "@/lib/rbac";

import { diaComoFecha, type ItemCrudo, type Proveedor } from "../tipos";

const TASA_USD_APROX = 60; // Solo para comparar contra el umbral de dirección; el pago usa su tasa real.

/**
 * Contabilidad: comprobantes por validar, asientos sin procesar, cuentas por pagar (vencidas y por
 * vencer a 7 días) y compras aprobadas por pagar. Pendientes: caja chica, conciliación, cierre de
 * mes y liquidez negativa (faltan sus fuentes de datos).
 */
export const proveedorContabilidad: Proveedor = {
  nombre: "contabilidad",
  tipos: ["comprobante_por_validar", "asiento_sin_procesar", "cxp_vencida", "cxp_por_vencer", "compra_aprobada_por_pagar", "liquidez_negativa"],
  async getItems({ usuario, hoy }) {
    if (!usuarioTienePermiso(usuario, "contabilidad.leer")) return [];

    const [comprobantes, asientos, cxp, cuentas] = await Promise.all([
      consultar<{ id: string; folio: string; proveedor: string | null; monto: number; moneda: string; creado: string }>(
        `SELECT id, folio::text, proveedor_nombre AS proveedor, monto::float8 AS monto, moneda, created_at::text AS creado
           FROM contabilidad.comprobante_recibido WHERE estado = 'recibido' ORDER BY created_at LIMIT 50`,
      ),
      consultar<{ id: string; numero: string; concepto: string; creado: string }>(
        `SELECT id, numero::text, concepto, creado_en::text AS creado
           FROM contabilidad.asiento WHERE procesado_en IS NULL AND NOT anulado ORDER BY creado_en LIMIT 50`,
      ),
      consultar<{ id: string; origen: string; beneficiario: string | null; concepto: string; saldo: number; moneda: string; vence: string; creado: string }>(
        `SELECT id, origen, beneficiario, concepto, saldo::float8 AS saldo, moneda,
                fecha_vencimiento::text AS vence, creado_en::text AS creado
           FROM contabilidad.cuenta_por_pagar
          WHERE estado IN ('pendiente', 'programada', 'pagada_parcial') AND saldo > 0
            AND (origen = 'solicitud' OR fecha_vencimiento <= $1::date + 7)
          ORDER BY fecha_vencimiento LIMIT 100`,
        [hoy],
      ),
      cuentasConSaldo(),
    ]);

    const items: ItemCrudo[] = [];

    // Liquidez negativa: la suma de los bancos activos (en pesos) quedó bajo cero. Es una prioridad, no un banner.
    const saldoTotal = cuentas.filter((c) => c.estado === "activa").reduce((t, c) => t + Number(c.saldo_dop ?? 0), 0);
    if (saldoTotal < 0) {
      items.push({
        id: "liquidez_negativa:00000000-0000-0000-0000-000000000000",
        tipo: "liquidez_negativa",
        titulo: "Cubrir el saldo negativo en bancos",
        contexto: `Saldo total RD$ ${saldoTotal.toLocaleString("es-DO", { maximumFractionDigits: 0 })}`,
        modulo: "contabilidad",
        href: "/contabilidad/bancos",
        venceEn: diaComoFecha(hoy),
        bloquea: true,
        accion: { label: "Ver bancos", kind: "link" },
      });
    }

    for (const c of comprobantes) {
      items.push({
        id: `comprobante_por_validar:${c.id}`,
        tipo: "comprobante_por_validar",
        titulo: `Validar comprobante de ${c.proveedor ?? "proveedor sin nombre"}`,
        contexto: `Comprobante #${c.folio} · ${c.moneda} ${c.monto.toLocaleString("es-DO")}`,
        modulo: "contabilidad",
        href: "/contabilidad/comprobantes-recibidos",
        creadoEn: new Date(c.creado),
        bloquea: true,
        accion: { label: "Validar", kind: "link" },
      });
    }

    for (const a of asientos) {
      items.push({
        id: `asiento_sin_procesar:${a.id}`,
        tipo: "asiento_sin_procesar",
        titulo: `Contabilizar asiento ${a.numero}`,
        contexto: a.concepto,
        modulo: "contabilidad",
        href: `/contabilidad/asientos/${a.id}`,
        creadoEn: new Date(a.creado),
        accion: { label: "Contabilizar", kind: "inline", action: "asiento:procesar" },
      });
    }

    for (const c of cxp) {
      const montoUsd = c.moneda === "USD" ? c.saldo : c.saldo / TASA_USD_APROX;
      const nombre = c.beneficiario ?? c.concepto;
      const base = { modulo: "contabilidad", href: "/contabilidad/cuentas-por-pagar", venceEn: diaComoFecha(c.vence), creadoEn: new Date(c.creado), montoUsd } as const;
      const contexto = `${c.moneda} ${c.saldo.toLocaleString("es-DO")} · ${c.concepto}`;

      items.push(
        c.origen === "solicitud"
          ? { ...base, id: `compra_aprobada_por_pagar:${c.id}`, tipo: "compra_aprobada_por_pagar", titulo: `Pagar compra a ${nombre}`, contexto, accion: { label: "Pagar", kind: "link" } }
          : c.vence < hoy
            ? { ...base, id: `cxp_vencida:${c.id}`, tipo: "cxp_vencida", titulo: `Pagar factura vencida de ${nombre}`, contexto, accion: { label: "Pagar", kind: "link" } }
            : { ...base, id: `cxp_por_vencer:${c.id}`, tipo: "cxp_por_vencer", titulo: `Programar pago a ${nombre}`, contexto, accion: { label: "Programar pago", kind: "link" } },
      );
    }

    return items;
  },
};
