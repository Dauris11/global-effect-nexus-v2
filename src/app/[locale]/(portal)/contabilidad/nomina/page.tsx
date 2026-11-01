import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { EncabezadoPagina } from "@/components/ui/encabezado-pagina";
import { VistaNomina } from "@/components/contabilidad/nomina/vista-nomina";
import { requerirPermiso } from "@/lib/auth";
import { listarNominas, listarEmpleados } from "@/server/contabilidad/nomina/consultas";
import { listarTerceros } from "@/server/contabilidad/terceros/consultas";
import { listarCentrosCosto } from "@/server/contabilidad/centros-costo/consultas";
import { consultar } from "@/lib/db";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("contab.nomina");
  return { title: `${t("titulo")} | Global Effect Nexus` };
}

export default async function PaginaNomina() {
  await requerirPermiso("contabilidad.leer");
  const t = await getTranslations("contab.nomina");

  const [nominas, empleados, terceros, centrosCosto, cuentasBanco] = await Promise.all([
    listarNominas(),
    listarEmpleados(),
    listarTerceros({ filtro: "todos" }),
    listarCentrosCosto(),
    consultar<{ id: string; codigo: string; nombre: string }>(
      `SELECT id, codigo, nombre
         FROM contabilidad.cuenta_contable
        WHERE codigo LIKE '1.1.02.%'
          AND admite_movimiento = true
        ORDER BY codigo ASC`,
    ),
  ]);

  const tercerosFormateados = terceros.map((t) => ({
    id: t.id,
    nombre: t.nombreRazonSocial,
    identificacion: t.identificacion,
  }));

  const centrosFormateados = centrosCosto.map((c) => ({
    id: c.id,
    codigo: c.codigo,
    nombre: c.nombre,
  }));

  return (
    <div className="space-y-6 animate-entrada">
      <EncabezadoPagina
        titulo={t("titulo")}
      />

      <VistaNomina
        nominas={nominas}
        empleados={empleados}
        terceros={tercerosFormateados}
        centrosCosto={centrosFormateados}
        cuentasBanco={cuentasBanco}
      />
    </div>
  );
}
