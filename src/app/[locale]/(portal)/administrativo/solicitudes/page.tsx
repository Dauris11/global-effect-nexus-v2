import type { Metadata } from "next";
import { Inbox } from "lucide-react";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { EmptyState } from "@/components/app/empty-state";
import { FilterBar } from "@/components/app/filter-bar";
import { PageHeader } from "@/components/app/page-header";
import { CrearSolicitud } from "@/components/solicitudes/crear-solicitud";
import { ListaSolicitudes } from "@/components/solicitudes/lista-solicitudes";
import { TablaMisSolicitudes } from "@/components/solicitudes/tabla-mis-solicitudes";
import { Button } from "@/components/ui/button";
import { mensajesCliente } from "@/i18n/mensajes-cliente";
import { Link, redirigir } from "@/i18n/navigation";
import { requerirUsuario } from "@/lib/auth";
import { claveDia } from "@/lib/fechas";
import { usuarioTienePermiso } from "@/lib/rbac";
import {
  esEstadoSolicitud,
  esSolicitudDinamica,
  ESTADOS_SOLICITUD,
  esTipoSolicitud,
  REGLAS,
  revisaAlgo,
  TIPOS_SOLICITUD_ACTIVOS,
  tiposQuePuedeCrear,
} from "@/lib/solicitudes";
import { proveedoresActivosPorProposito } from "@/server/contabilidad/proveedores/consultas";
import {
  listarLugaresPasaje,
  listarTiposMaterial,
} from "@/server/parametros/catalogos-consultas";
import {
  conteosSolicitudes,
  estudiantesParaSolicitud,
  solicitudesDe,
  solicitudesPorAtender,
  solicitudesRevisionPorEstado,
  type FilaSolicitud,
} from "@/server/solicitudes/consultas";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "requests" });

  return { title: t("staffTitle") };
}

const POR_ATENDER = "por_atender";
const POR_COMPLETAR = "por_completar";
const MIAS = "mias";

/** Sin tildes ni mayúsculas, para que «Rodriguez» encuentre «Rodríguez». */
const normalizar = (texto: string) =>
  texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * Bandeja de solicitudes del personal (migración 0031), en patrón Lista.
 *
 * Una sola lista y un solo parámetro de vista (`estado`):
 *
 *   · Quien revisa algo entra en «Por atender» —lo que espera una decisión MÍA; la
 *     lista ya viene filtrada por `accionesPermitidas`, así que nunca aparece lo que
 *     pedí yo (separación de funciones)—. Desde ahí puede pasar a «Mías» o a un estado
 *     de su ámbito (lo que antes eran el historial y los tabs de estado).
 *   · Quien no revisa ve solo lo que pidió, con chips por estado.
 *
 * Sin permiso de entrada porque todo el personal pide algo. El estudiante no entra:
 * sus trámites viven en su portal. Los conteos de los chips salen del servidor
 * (`conteosSolicitudes`) con el mismo criterio de visibilidad que las listas.
 */
export default async function PaginaSolicitudes({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ tipo?: string; estado?: string; q?: string; clase?: string; nuevo?: string }>;
}) {
  const [{ locale }, { tipo: tipoPedido, estado: estadoPedido, q, clase, nuevo }] = await Promise.all([
    params,
    searchParams,
  ]);

  const usuario = await requerirUsuario();
  if (usuario.rol === "estudiante") {
    redirigir("/portal/estudiante/solicitudes", locale);
  }

  const revisa = revisaAlgo(usuario);
  const tipos = tiposQuePuedeCrear(usuario);
  const conEstudiante = tipos.some((tipo) => REGLAS[tipo].estudiante !== "no");

  // Quien revisa arranca en «Por atender»; quien no, en todo lo suyo (sin filtro de estado).
  const vista = revisa
    ? estadoPedido === MIAS || estadoPedido === POR_COMPLETAR || esEstadoSolicitud(estadoPedido)
      ? estadoPedido
      : POR_ATENDER
    : esEstadoSolicitud(estadoPedido)
      ? estadoPedido
      : null;
  const claseFiltro = (TIPOS_SOLICITUD_ACTIVOS as readonly string[]).includes(clase ?? "") ? clase : null;
  const busqueda = normalizar((q ?? "").trim());

  const [
    t,
    tl,
    abiertas,
    conteos,
    filasVista,
    propias,
    estudiantes,
    tiposMaterial,
    lugaresPasaje,
    proveedoresEstudiantes,
    mensajes,
  ] = await Promise.all([
    getTranslations({ locale, namespace: "requests" }),
    getTranslations({ locale, namespace: "listas" }),
    revisa ? solicitudesPorAtender(usuario, { incluirAprobadas: true }) : Promise.resolve([] as FilaSolicitud[]),
    conteosSolicitudes(usuario),
    revisa && esEstadoSolicitud(vista)
      ? solicitudesRevisionPorEstado(usuario, vista)
      : Promise.resolve(null),
    // Lo propio solo se pide si la vista lo necesita; los conteos ya no dependen de esto.
    vista === MIAS || !revisa ? solicitudesDe(usuario) : Promise.resolve([] as FilaSolicitud[]),
    conEstudiante
      ? estudiantesParaSolicitud(!usuarioTienePermiso(usuario, "expedientes.leer"))
      : Promise.resolve([]),
    listarTiposMaterial(true),
    listarLugaresPasaje(true),
    proveedoresActivosPorProposito("estudiantes"),
    mensajesCliente(["requests", "estados"]),
  ]);

  // Lo que requiere mi decisión vs. lo ya aprobado que falta ejecutar: ambas salen de la misma
  // consulta, así que la separación de funciones sigue siendo la de `accionesPermitidas`.
  const porAtender = abiertas.filter((f) => f.estado !== "aprobada");
  const porCompletar = abiertas.filter((f) => f.estado === "aprobada");
  const catalogos = { tiposMaterial, lugaresPasaje, proveedoresEstudiantes };

  const base: readonly FilaSolicitud[] =
    vista === POR_ATENDER
      ? porAtender
      : vista === POR_COMPLETAR
        ? porCompletar
      : vista === MIAS || !revisa
        ? propias.filter((f) => (vista && vista !== MIAS ? f.estado === vista : true))
        : (filasVista ?? []);

  const filas = base.filter((f) => {
    if (claseFiltro && f.tipo !== claseFiltro) return false;
    if (!busqueda) return true;

    return normalizar(
      [`#${f.folio}`, f.titulo, f.solicitante, f.estudiante, t(`type.${f.tipo}` as never)]
        .filter(Boolean)
        .join(" "),
    ).includes(busqueda);
  });

  const totalPropias = Object.values(conteos.propias).reduce((n, c) => n + c, 0);
  const chips = revisa
    ? [
        { value: POR_ATENDER, label: tl("solicitudes.porAtender"), count: porAtender.length },
        { value: POR_COMPLETAR, label: tl("solicitudes.porCompletar"), count: porCompletar.length },
        { value: MIAS, label: tl("solicitudes.mias"), count: totalPropias },
        ...ESTADOS_SOLICITUD.filter((e) => (conteos.revision[e] ?? 0) > 0 || vista === e).map((e) => ({
          value: e,
          label: t(`status.${e}`),
          count: conteos.revision[e] ?? 0,
        })),
      ]
    : ESTADOS_SOLICITUD.filter((e) => (conteos.propias[e] ?? 0) > 0 || vista === e).map((e) => ({
        value: e,
        label: t(`status.${e}`),
        count: conteos.propias[e] ?? 0,
      }));

  const tipoInicial = esTipoSolicitud(tipoPedido) ? tipoPedido : undefined;
  const abrirInicial = Boolean(
    tipoInicial &&
      (esSolicitudDinamica(tipoInicial) || (tipos as readonly string[]).includes(tipoInicial)),
  );
  // Todo el personal puede crear solicitudes dinámicas (MATERIALES, PASAJE, OTRO).
  const botonSolicitud = (conAtajo: boolean) => (
    <CrearSolicitud
      modo="solicitud"
      tipos={tipos}
      estudiantes={estudiantes}
      catalogos={catalogos}
      minimoFecha={claveDia()}
      tipoInicial={tipoInicial}
      abrirInicial={conAtajo && abrirInicial}
    />
  );
  const botonCompra = (variante: "default" | "outline") => <CrearSolicitud modo="compra" variante={variante} />;

  const hayBusqueda = Boolean(busqueda || claseFiltro);
  const mostrarSolicitante = revisa && vista !== MIAS;

  return (
    <div className="animate-entrada space-y-6">
      <NextIntlClientProvider messages={mensajes}>
        <PageHeader
          title={t("staffTitle")}
          primaryAction={botonSolicitud(true)}
          secondaryActions={botonCompra("outline")}
        />

        <Suspense fallback={null}>
          <FilterBar
            chips={chips}
            totalChips={revisa ? undefined : totalPropias}
            porDefecto={revisa ? POR_ATENDER : undefined}
            placeholder={tl("solicitudes.buscar")}
            selectores={[
              {
                param: "clase",
                label: tl("solicitudes.tipoFiltro"),
                todos: tl("solicitudes.todosTipos"),
                opciones: TIPOS_SOLICITUD_ACTIVOS.map((x) => ({ value: x, label: t(`type.${x}` as never) })),
              },
            ]}
          />
        </Suspense>

        {filas.length === 0 ? (
          hayBusqueda ? (
            <EmptyState
              icon={Inbox}
              title={tl("solicitudes.sinResultados")}
              action={
                <Button asChild variant="outline">
                  <Link href={revisa && vista !== POR_ATENDER ? `/administrativo/solicitudes?estado=${vista}` : "/administrativo/solicitudes"}>
                    {tl("solicitudes.quitarBusqueda")}
                  </Link>
                </Button>
              }
            />
          ) : vista === POR_ATENDER ? (
            <EmptyState
              icon={Inbox}
              title={t("pendingEmpty")}
              action={
                <Button asChild variant="outline">
                  <Link href="/administrativo/solicitudes?estado=mias">{tl("solicitudes.verMias")}</Link>
                </Button>
              }
            />
          ) : revisa && vista !== MIAS ? (
            <EmptyState
              icon={Inbox}
              title={t("filteredEmpty")}
              action={
                <Button asChild variant="outline">
                  <Link href="/administrativo/solicitudes">{tl("solicitudes.volverPorAtender")}</Link>
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={Inbox}
              title={t("mineEmpty")}
              action={botonSolicitud(false)}
            />
          )
        ) : vista === MIAS || !revisa ? (
          <TablaMisSolicitudes
            resaltarId={/^[0-9a-f-]{36}$/i.test(nuevo ?? "") ? nuevo : undefined}
            filas={filas}
            catalogos={catalogos}
          />
        ) : (
          <ListaSolicitudes
            resaltarId={/^[0-9a-f-]{36}$/i.test(nuevo ?? "") ? nuevo : undefined}
            filas={filas}
            mostrarSolicitante={mostrarSolicitante}
            catalogos={catalogos}
          />
        )}
      </NextIntlClientProvider>
    </div>
  );
}
