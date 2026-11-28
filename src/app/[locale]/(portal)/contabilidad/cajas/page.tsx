import type { Metadata } from "next";
import { Wallet } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { FormularioCaja } from "@/components/contabilidad/cajas/formulario-caja";
import { TarjetaCaja } from "@/components/contabilidad/cajas/tarjeta-caja";
import { EncabezadoPagina } from "@/components/ui/encabezado-pagina";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { requerirPermiso } from "@/lib/auth";
import { usuarioTienePermiso } from "@/lib/rbac";
import {
  cuentasAuxiliaresDeActivo,
  cuentasConSaldo,
} from "@/server/contabilidad/bancos/consultas";
import { listarCajas } from "@/server/contabilidad/cajas/consultas";
import { listarUsuariosSolicitantes } from "@/server/contabilidad/proveedores/consultas";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "contab.cajas" });
  return { title: t("titulo") };
}

export default async function PaginaCajas({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const usuario = await requerirPermiso("contabilidad.leer");
  const puedeCrear = usuarioTienePermiso(usuario, "contabilidad.configurar");

  const [t, cajas, responsables, cuentasContables, cuentasBancoRaw] = await Promise.all([
    getTranslations({ locale, namespace: "contab.cajas" }),
    listarCajas(),
    listarUsuariosSolicitantes(),
    puedeCrear ? cuentasAuxiliaresDeActivo() : Promise.resolve([]),
    cuentasConSaldo(),
  ]);

  const cuentasBancarias = cuentasBancoRaw
    .filter((b) => b.estado === "activa")
    .map((b) => ({
      id: b.id,
      nombre: b.nombre,
      banco: b.banco,
      numero: b.numero,
      moneda: b.moneda,
    }));

  return (
    <div className="space-y-6 animate-entrada">
      <EncabezadoPagina
        titulo={t("titulo")}
        acciones={
          puedeCrear ? (
            <FormularioCaja
              responsables={responsables}
              cuentasContables={cuentasContables}
              cuentasBancarias={cuentasBancarias}
            />
          ) : undefined
        }
      />
      {cajas.length === 0 ? (
        <EstadoVacio icono={Wallet} titulo={t("vacio")} />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cajas.map((caja) => (
            <TarjetaCaja
              key={caja.id}
              caja={caja}
              usuarios={responsables}
              cuentasBancarias={cuentasBancarias}
              usuarioActualId={usuario.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}
