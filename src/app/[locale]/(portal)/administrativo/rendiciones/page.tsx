import type { Metadata } from "next";
import { Calculator, CalendarCheck, Info, Receipt } from "lucide-react";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { EmptyState } from "@/components/app/empty-state";
import { FilterBar } from "@/components/app/filter-bar";
import { MenuMasAcciones } from "@/components/app/menu-mas-acciones";
import { PageHeader } from "@/components/app/page-header";
import { ListaRendiciones } from "@/components/colaborador/lista-rendiciones";
import { SubirRendicion } from "@/components/colaborador/subir-rendicion";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { mensajesCliente } from "@/i18n/mensajes-cliente";
import { requerirUsuario } from "@/lib/auth";
import { usuarioTienePermiso } from "@/lib/rbac";
import { ESTADOS_RENDICION } from "@/lib/torre-control";
import {
  becadosParaRendicion,
  misRendiciones,
  programasParaRendicion,
  solicitudesParaRendir,
  todasRendiciones,
} from "@/server/colaborador/consultas";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "rendicion" });

  return { title: t("pageTitle") };
}

/** Sin tildes ni mayúsculas, para que «Ramirez» encuentre «Ramírez». */
const normalizar = (texto: string) =>
  texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Etiqueta de cada estado en `rendicion.*` (las claves históricas no siguen el valor). */
const CLAVE_ESTADO = {
  enviada: "stateEnviada",
  en_revision: "stateEnRevision",
  aprobada: "stateAprobada",
  rechazada: "stateRechazada",
  contabilizada: "stateContabilizada",
} as const;

/**
 * Módulo de Rendición de Gastos y Facturas con OCR, en patrón Lista.
 *
 * Permite a los colaboradores (docentes, líderes de Habitudes, administración y contabilidad)
 * subir comprobantes de compras operativas con escaneo inteligente de NCF y RNC ante DGII,
 * imputando cada egreso a los programas sociales de la fundación.
 *
 * La bandeja va primero; subir un comprobante es el botón del encabezado y abre un panel.
 * Sin solicitud aprobada no hay nada que rendir (el servidor lo rechazaría), así que en
 * lugar del botón sale un aviso que lleva a crear la solicitud de gasto.
 *
 * Los filtros viven en la URL. Las dos consultas traen TODAS las rendiciones visibles
 * (sin LIMIT), por eso los conteos de los chips se sacan de esa misma lista en el
 * servidor y coinciden siempre con las filas.
 */
export default async function PaginaRendiciones({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ estado?: string; q?: string; programa?: string }>;
}) {
  const [{ locale }, { estado: estadoPedido, q, programa: programaPedido }] = await Promise.all([
    params,
    searchParams,
  ]);
  const usuario = await requerirUsuario();

  const puedeRevisar = usuarioTienePermiso(usuario, "rendicion.revisar");
  // `admin` revisa rendiciones pero no entra en contabilidad: el atajo solo
  // se ofrece a quien la puerta va a dejar pasar.
  const veContabilidad = usuarioTienePermiso(usuario, "contabilidad.leer");

  // Ver a qué estudiante se imputó un gasto es ver estudiantes: quien revisa
  // lo necesita para validar, y quien tiene `expedientes.leer` ya lo veía.
  const puedeElegirEstudiante = usuarioTienePermiso(usuario, "expedientes.leer");
  const verEstudiante = puedeElegirEstudiante || puedeRevisar;

  const [t, tl, programas, solicitudes, becados, todas, mensajes] = await Promise.all([
    getTranslations({ locale, namespace: "rendicion" }),
    getTranslations({ locale, namespace: "listas" }),
    programasParaRendicion(),
    solicitudesParaRendir(usuario.id),
    puedeElegirEstudiante ? becadosParaRendicion() : Promise.resolve(null),
    puedeRevisar ? todasRendiciones(verEstudiante) : misRendiciones(usuario.id, verEstudiante),
    mensajesCliente(["rendicion", "colaborador", "admin"]),
  ]);

  const estado = ESTADOS_RENDICION.find((e) => e === estadoPedido) ?? null;
  const programa = programas.find((p) => p.id === programaPedido)?.id ?? null;
  const busqueda = normalizar((q ?? "").trim());

  const conteo = (e: string) => todas.filter((r) => r.estado === e).length;
  const chips = ESTADOS_RENDICION.filter((e) => conteo(e) > 0 || estado === e).map((e) => ({
    value: e,
    label: t(CLAVE_ESTADO[e]),
    count: conteo(e),
  }));

  const filas = todas.filter((r) => {
    if (estado && r.estado !== estado) return false;
    if (programa && r.programa_id !== programa) return false;
    if (!busqueda) return true;

    return normalizar(
      [r.proveedor_nombre, r.codigo, r.ncf, r.empleado_nombre, r.concepto].filter(Boolean).join(" "),
    ).includes(busqueda);
  });

  const hayFiltros = Boolean(estado || programa || busqueda);
  const puedeRendir = solicitudes.length > 0;
  const subir = <SubirRendicion programas={programas} solicitudes={solicitudes} becados={becados} />;
  // El aviso es un `info` (docs/ux-rules.md): marca suave con icono, nunca rojo.
  const crearGasto = (
    <Button asChild>
      <Link href="/administrativo/solicitudes?tipo=gasto">{tl("rendiciones.crearSolicitudGasto" as never)}</Link>
    </Button>
  );

  return (
    <div className="animate-entrada space-y-6">
      <NextIntlClientProvider messages={mensajes}>
        <PageHeader
          title={t("heading")}
          primaryAction={puedeRendir ? subir : undefined}
          secondaryActions={
            <MenuMasAcciones
              acciones={[
                { etiqueta: t("backToToday"), icono: <CalendarCheck />, href: "/bandeja?tab=tareas" },
                ...(veContabilidad
                  ? [{ etiqueta: t("viewAccountingHub"), icono: <Calculator />, href: "/portal/contabilidad" }]
                  : []),
              ]}
            />
          }
        />

        {!puedeRendir && (
          <div
            role="status"
            className="flex flex-col items-start gap-3 rounded-card bg-marca-50 p-4 text-marca-700 sm:flex-row sm:items-center sm:justify-between"
          >
            <p className="flex items-start gap-2 text-sm">
              <Info aria-hidden className="mt-0.5 size-4 shrink-0" />
              <span>{t("noApprovedRequest")}</span>
            </p>
            {crearGasto}
          </div>
        )}

        <Suspense fallback={null}>
          <FilterBar
            chips={chips}
            totalChips={todas.length}
            placeholder={tl("rendiciones.buscar" as never)}
            selectores={[
              {
                param: "programa",
                label: tl("rendiciones.programa" as never),
                todos: tl("rendiciones.todosProgramas" as never),
                opciones: programas.map((p) => ({ value: p.id, label: p.nombre })),
              },
            ]}
          />
        </Suspense>

        {filas.length === 0 ? (
          hayFiltros ? (
            <EmptyState
              icon={Receipt}
              title={tl("rendiciones.sinResultados" as never)}
              action={
                <Button asChild variant="outline">
                  <Link href="/administrativo/rendiciones">{tl("rendiciones.quitarFiltros" as never)}</Link>
                </Button>
              }
            />
          ) : puedeRendir ? (
            <EmptyState icon={Receipt} title={t("noVouchersTitle")} description={t("noVouchersSubtitle")} action={subir} />
          ) : (
            // El aviso de arriba ya trae el botón de la acción siguiente.
            <EmptyState readOnly icon={Receipt} title={t("noVouchersTitle")} description={t("noVouchersSubtitle")} />
          )
        ) : (
          <ListaRendiciones rendiciones={filas} puedeRevisar={puedeRevisar} />
        )}
      </NextIntlClientProvider>
    </div>
  );
}
