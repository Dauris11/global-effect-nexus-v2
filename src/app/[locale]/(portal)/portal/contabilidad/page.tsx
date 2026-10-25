import type { Metadata } from "next";
import { ArrowRight, Info, Landmark, Plus, Sun } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Monto } from "@/components/contabilidad/comun";
import { LanzadorModulos } from "@/components/contabilidad/inicio/lanzador-modulos";
import { ParaHoy, type PendienteVisible } from "@/components/contabilidad/inicio/para-hoy";
import { ListaRecibos } from "@/components/contabilidad/recibos/lista-recibos";
import { Button } from "@/components/ui/button";
import { EncabezadoPagina } from "@/components/ui/encabezado-pagina";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { Link } from "@/i18n/navigation";
import { requerirPermiso } from "@/lib/auth";
import { visibilidadDeRol } from "@/server/visibilidad/consultas";
import { formatearMonto, sumarMontos } from "@/lib/contabilidad/formato";
import { GRUPOS_CONTABLES, modulosDeGrupo } from "@/lib/contabilidad/modulos";
import { claveDia, fechaCorta } from "@/lib/fechas";
import { TARJETA } from "@/lib/paleta";
import { usuarioTienePermiso } from "@/lib/rbac";
import { cuentasConSaldo, tasaVigente } from "@/server/contabilidad/bancos/consultas";
import { pendientesDelDepartamento } from "@/server/contabilidad/inicio/consultas";
import { leerFiltroRecibos, recibos } from "@/server/contabilidad/recibos/consultas";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "contab.inicio" });
  return { title: t("antetitulo") };
}

/**
 * Inicio del Departamento de Contabilidad (§4.1).
 *
 * Se ordena por la pregunta que se hace quien entra: qué me toca hoy. Primero lo
 * que espera a alguien (borradores, cuentas por pagar vencidas, rendiciones,
 * arqueos y conciliaciones abiertas), después dónde está el dinero y, al final,
 * todos los módulos del departamento agrupados —los de `/contabilidad` y las
 * herramientas que viven en otras áreas—, sacados de `MODULOS_CONTABLES`.
 *
 * La puerta es `contabilidad.leer`, no el rol: `super_admin` entra a mirar
 * (auditoría) y no ve ningún botón que escriba. Cada módulo y cada pendiente se
 * filtra con el permiso de la persona, no del rol, para que las excepciones de
 * `usuario_permiso` valgan también aquí.
 */
export default async function PortalContabilidad({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const idioma = locale === "en" ? "en" : "es";
  const usuario = await requerirPermiso("contabilidad.leer");

  const [t, tMiDia, tc, cuentas, tasa, pendientes, recientes] = await Promise.all([
    getTranslations({ locale, namespace: "contab.inicio" }),
    getTranslations({ locale, namespace: "miDia" }),
    getTranslations({ locale, namespace: "contab" }),
    cuentasConSaldo(),
    tasaVigente(),
    pendientesDelDepartamento(),
    recibos(leerFiltroRecibos({}), 5),
  ]);

  const fueraDelMenu = new Set((await visibilidadDeRol(usuario.rol)).fueraDelMenu);
  const puede = (permiso: Parameters<typeof usuarioTienePermiso>[1]) =>
    usuarioTienePermiso(usuario, permiso);

  const todos: PendienteVisible[] = [
    { clave: "cxpVencidas", cuantos: pendientes.cxp_vencidas, href: "/contabilidad/cuentas-por-pagar", urgente: true },
    { clave: "cxpSemana", cuantos: pendientes.cxp_semana, href: "/contabilidad/cuentas-por-pagar" },
    { clave: "recibosBorrador", cuantos: pendientes.recibos_borrador, href: "/contabilidad/recibos?estado=borrador" },
    { clave: "facturasBorrador", cuantos: pendientes.facturas_borrador, href: "/contabilidad/proveedores" },
    ...(puede("rendicion.revisar")
      ? [{ clave: "rendiciones" as const, cuantos: pendientes.rendiciones, href: "/administrativo/rendiciones" }]
      : []),
    { clave: "arqueos", cuantos: pendientes.arqueos_abiertos, href: "/contabilidad/cajas" },
    { clave: "conciliaciones", cuantos: pendientes.conciliaciones_abiertas, href: "/contabilidad/bancos" },
  ];
  const paraHoy = todos.filter((pendiente) => pendiente.cuantos > 0);

  const grupos = GRUPOS_CONTABLES.map((grupo) => ({
    grupo,
    modulos: modulosDeGrupo(grupo).filter(
      (modulo) => (!modulo.permiso || puede(modulo.permiso)) && !fueraDelMenu.has(modulo.href),
    ),
  })).filter((grupo) => grupo.modulos.length > 0);

  const activas = cuentas.filter((c) => c.estado === "activa");
  // El total en pesos solo si TODAS las cuentas tienen equivalente: un
  // total que omite en silencio la cuenta en dólares sería falso.
  const totalDop = activas.every((c) => c.saldo_dop !== null)
    ? sumarMontos(activas.map((c) => c.saldo_dop ?? "0"))
    : null;
  const tasaVieja = tasa && tasa.fecha < claveDia();

  return (
    <div className="mx-auto max-w-6xl space-y-8 md:space-y-10">
      <EncabezadoPagina
        antetitulo={t("antetitulo")}
        titulo={t("titulo")}
        subtitulo={t("subtitulo")}
        acciones={
          <>
            {/* La cola de decisiones de hoy es lo primero que se busca aquí. */}
            <Button asChild variant="outline">
              <Link href="/contabilidad/mi-dia">
                <Sun className="size-4" />
                {tMiDia("title")}
              </Link>
            </Button>
            {usuarioTienePermiso(usuario, "contabilidad.registrar") && (
              <Button asChild>
                <Link href="/contabilidad/recibos/nuevo">
                  <Plus className="size-4" />
                  {t("nuevoRecibo")}
                </Link>
              </Button>
            )}
          </>
        }
      />

      <section className="space-y-4">
        <h2 className="texto-titulo-seccion">{t("paraHoy.titulo")}</h2>
        <ParaHoy pendientes={paraHoy} />
      </section>

      <section className="space-y-4 border-t border-linea pt-8">
        <div className="flex items-end justify-between gap-3">
          <h2 className="texto-titulo-seccion">{t("saldos")}</h2>
          {totalDop && (
            <p className="text-right">
              <span className="texto-meta block">{t("totalDop")}</span>
              <span className="text-lg font-semibold text-tinta">{formatearMonto(totalDop, "DOP")}</span>
            </p>
          )}
        </div>
        {activas.length === 0 ? (
          <EstadoVacio icono={Landmark} titulo={tc("bancos.vacio")} texto={tc("bancos.vacioTexto")} />
        ) : (
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {activas.map((cuenta) => (
              <li key={cuenta.id} className="min-w-0">
                <Link href={`/contabilidad/bancos/${cuenta.id}`} className={`${TARJETA.interactiva} block p-5`}>
                  <p className="texto-meta">{cuenta.nombre}</p>
                  <p className="mt-1 text-2xl font-semibold text-tinta">
                    <Monto valor={cuenta.saldo} moneda={cuenta.moneda} />
                  </p>
                  {cuenta.moneda === "USD" && (
                    <p className="texto-meta">
                      {cuenta.saldo_dop
                        ? t("equivalente", { monto: formatearMonto(cuenta.saldo_dop, "DOP") })
                        : t("sinTasa")}
                    </p>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
        <p className="flex items-start gap-2 text-sm text-tinta-2">
          <Info className="mt-0.5 size-4 shrink-0 text-marca-600" />
          {tasa
            ? tasaVieja
              ? t("tasaVieja", { fecha: fechaCorta(tasa.fecha, idioma) })
              : t("tasaDe", { compra: tasa.compra, venta: tasa.venta, fuente: tasa.fuente, fecha: fechaCorta(tasa.fecha, idioma) })
            : t("tasaVacia")}
        </p>
      </section>

      <section className="space-y-4 border-t border-linea pt-8">
        <div>
          <h2 className="texto-titulo-seccion">{t("modulos")}</h2>
          <p className="texto-meta">{t("modulosTexto")}</p>
        </div>
        <LanzadorModulos grupos={grupos} />
      </section>

      <section className="space-y-4 border-t border-linea pt-8">
        <div className="flex items-center justify-between gap-3">
          <h2 className="texto-titulo-seccion">{t("recientes")}</h2>
          <Link href="/contabilidad/recibos" className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-marca-600 hover:underline">
            {t("verTodos")}
            <ArrowRight className="size-4" />
          </Link>
        </div>
        {recientes.length > 0 && <ListaRecibos filas={recientes.slice(0, 5)} idioma={idioma} />}
      </section>
    </div>
  );
}
