import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { EncabezadoPagina } from "@/components/ui/encabezado-pagina";
import { VistaInventario } from "@/components/contabilidad/inventario/vista-inventario";
import { requerirPermiso } from "@/lib/auth";
import {
  listarArticulos,
  listarConteosFisicos,
  type MovimientoKardex,
} from "@/server/contabilidad/inventario/consultas";
import { listarCentrosCosto } from "@/server/contabilidad/centros-costo/consultas";
import { consultar } from "@/lib/db";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("contab.inventarioContable");
  return { title: `${t("titulo")} | Global Effect Nexus` };
}

export default async function PaginaInventario() {
  await requerirPermiso("contabilidad.leer");
  const t = await getTranslations("contab.inventarioContable");

  const [articulos, conteos, centrosCosto, cuentasInventario, cuentasGasto, movimientosRecientes] =
    await Promise.all([
      listarArticulos(),
      listarConteosFisicos(),
      listarCentrosCosto(),
      consultar<{ id: string; codigo: string; nombre: string }>(
        `SELECT id, codigo, nombre
           FROM contabilidad.cuenta_contable
          WHERE codigo LIKE '1.1.04.%'
            AND admite_movimiento = true
          ORDER BY codigo ASC`,
      ),
      consultar<{ id: string; codigo: string; nombre: string }>(
        `SELECT id, codigo, nombre
           FROM contabilidad.cuenta_contable
          WHERE codigo LIKE '5.2.01.%'
            AND admite_movimiento = true
          ORDER BY codigo ASC`,
      ),
      consultar<{
        id: string;
        articulo_id: string;
        tipo: any;
        fecha: string;
        cantidad: string;
        costo_unitario: string;
        costo_total: string;
        stock_anterior: string;
        stock_posterior: string;
        costo_promedio_anterior: string;
        costo_promedio_posterior: string;
        centro_costo_nombre: string | null;
        asiento_id: string | null;
        motivo: string | null;
        creado_en: string;
      }>(
        `SELECT m.id,
                m.articulo_id,
                m.tipo,
                to_char(m.fecha, 'YYYY-MM-DD') AS fecha,
                m.cantidad::text AS cantidad,
                m.costo_unitario::text AS costo_unitario,
                m.costo_total::text AS costo_total,
                m.stock_anterior::text AS stock_anterior,
                m.stock_posterior::text AS stock_posterior,
                m.costo_promedio_anterior::text AS costo_promedio_anterior,
                m.costo_promedio_posterior::text AS costo_promedio_posterior,
                cc.nombre AS centro_costo_nombre,
                m.asiento_id,
                m.motivo,
                m.creado_en::text AS creado_en
           FROM contabilidad.inventario_movimiento m
      LEFT JOIN contabilidad.centro_costo cc ON cc.id = m.centro_costo_id
          ORDER BY m.fecha DESC, m.creado_en DESC
          LIMIT 50`,
      ),
    ]);

  const centrosFormateados = centrosCosto.map((c) => ({
    id: c.id,
    codigo: c.codigo,
    nombre: c.nombre,
  }));

  const movimientosFormateados: MovimientoKardex[] = movimientosRecientes.map((m) => ({
    ...m,
    cantidad: Number(m.cantidad),
    costo_unitario: Number(m.costo_unitario),
    costo_total: Number(m.costo_total),
    stock_anterior: Number(m.stock_anterior),
    stock_posterior: Number(m.stock_posterior),
    costo_promedio_anterior: Number(m.costo_promedio_anterior),
    costo_promedio_posterior: Number(m.costo_promedio_posterior),
  }));

  return (
    <div className="space-y-6 animate-entrada">
      <EncabezadoPagina
        titulo={t("titulo")}
      />

      <VistaInventario
        articulos={articulos}
        movimientosRecientes={movimientosFormateados}
        conteos={conteos}
        centrosCosto={centrosFormateados}
        cuentasInventario={cuentasInventario}
        cuentasGasto={cuentasGasto}
      />
    </div>
  );
}
