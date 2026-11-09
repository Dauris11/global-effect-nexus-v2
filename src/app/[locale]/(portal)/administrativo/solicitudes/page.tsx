import type { Metadata } from "next";
import { History, Inbox, Send, ShoppingCart, UserRound } from "lucide-react";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";

import { FormularioCompra } from "@/components/solicitudes/formulario-compra";
import { FormularioSolicitud } from "@/components/solicitudes/formulario-solicitud";
import { TarjetaSolicitud } from "@/components/solicitudes/tarjeta-solicitud";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { EncabezadoPagina } from "@/components/ui/encabezado-pagina";
import { mensajesCliente } from "@/i18n/mensajes-cliente";
import { requerirUsuario } from "@/lib/auth";
import { claveDia } from "@/lib/fechas";
import {
  usuarioTienePermiso,
} from "@/lib/rbac";
import {
  esTipoSolicitud,
  REGLAS,
  revisaAlgo,
  tiposQuePuedeCrear,
} from "@/lib/solicitudes";
import { redirigir } from "@/i18n/navigation";
import {
  estudiantesParaSolicitud,
  resueltasPor,
  solicitudesDe,
  solicitudesPorAtender,
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

/**
 * Bandeja de solicitudes del personal (migración 0031).
 *
 * Tres bloques y cada uno responde a una pregunta distinta:
 *
 *   · Por atender — lo que espera una decisión MÍA. Solo sale si el rol revisa
 *     algo; la lista ya viene filtrada por `accionesPermitidas`, así que nunca
 *     aparece lo que pedí yo (separación de funciones).
 *   · Pedir — el alta de una solicitud interna, con los tipos que mi rol puede
 *     pedir. Todo el personal puede pedir al menos un gasto.
 *   · Mis solicitudes y resueltas — cómo va lo mío y qué decidí ya.
 *
 * Sin permiso de entrada porque todo el personal pide algo. El estudiante no
 * entra: sus trámites viven en su portal, con su ficha sacada de la sesión.
 */
export default async function PaginaSolicitudes({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ tipo?: string }>;
}) {
  const [{ locale }, { tipo: tipoPedido }] = await Promise.all([params, searchParams]);

  const usuario = await requerirUsuario();
  if (usuario.rol === "estudiante") {
    redirigir("/portal/estudiante/solicitudes", locale);
  }

  const revisa = revisaAlgo(usuario);
  const tipos = tiposQuePuedeCrear(usuario);
  const conEstudiante = tipos.some((tipo) => REGLAS[tipo].estudiante !== "no");

  const [t, porAtender, mias, resueltas, estudiantes, mensajes] = await Promise.all([
    getTranslations({ locale, namespace: "requests" }),
    revisa ? solicitudesPorAtender(usuario) : Promise.resolve([]),
    solicitudesDe(usuario),
    revisa ? resueltasPor(usuario) : Promise.resolve([]),
    conEstudiante
      ? estudiantesParaSolicitud(!usuarioTienePermiso(usuario, "expedientes.leer"))
      : Promise.resolve([]),
    mensajesCliente(["requests"]),
  ]);

  return (
    <div className="animate-entrada mx-auto max-w-5xl space-y-6">
      <EncabezadoPagina titulo={t("staffTitle")} />

      <NextIntlClientProvider messages={mensajes}>
        {revisa && (
          <Bloque
            icono={Inbox}
            titulo={t("pendingTitle")}
            vacio={t("pendingEmpty")}
            solicitudes={porAtender}
            mostrarSolicitante
            contar
          />
        )}

        {/* Todo rol puede pedir una compra a contabilidad con su cotización. */}
        <Card className="rounded-card border-linea shadow-card">
          <CardContent className="space-y-4 pt-5">
            <CardTitle>
              <ShoppingCart className="size-4" />
              {t("purchase.title")}
            </CardTitle>
            <FormularioCompra />
          </CardContent>
        </Card>

        {tipos.length > 0 && (
          <Card className="rounded-card border-linea shadow-card">
            <CardContent className="space-y-4 pt-5">
              <CardTitle>
                <Send className="size-4" />
                {t("newTitle")}
              </CardTitle>
              <FormularioSolicitud
                origen="personal"
                tipos={tipos}
                estudiantes={estudiantes}
                minimoFecha={claveDia()}
                tipoInicial={esTipoSolicitud(tipoPedido) ? tipoPedido : undefined}
              />
            </CardContent>
          </Card>
        )}

        <Bloque
          icono={UserRound}
          titulo={t("mineTitle")}
          vacio={t("mineEmpty")}
          solicitudes={mias}
        />

        {revisa && resueltas.length > 0 && (
          <Bloque
            icono={History}
            titulo={t("resolvedTitle")}
            vacio=""
            solicitudes={resueltas}
            mostrarSolicitante
          />
        )}
      </NextIntlClientProvider>
    </div>
  );
}

function Bloque({
  icono: Icono,
  titulo,
  vacio,
  solicitudes,
  mostrarSolicitante = false,
  contar = false,
}: {
  icono: React.ComponentType<{ className?: string }>;
  titulo: string;
  vacio: string;
  solicitudes: readonly FilaSolicitud[];
  mostrarSolicitante?: boolean;
  contar?: boolean;
}) {
  return (
    <section className="space-y-3">
      <h2 className="flex items-center gap-2 text-sm font-bold">
        <Icono className="size-4 text-marca-600" />
        {titulo}
        {contar && solicitudes.length > 0 && (
          <Badge className="bg-tinta text-[10px] text-background">
            {solicitudes.length}
          </Badge>
        )}
      </h2>

      {solicitudes.length === 0 ? (
        <p className="text-muted-foreground rounded-card border border-dashed border-linea px-4 py-6 text-center text-sm">
          {vacio}
        </p>
      ) : (
        <ul className="space-y-3">
          {solicitudes.map((solicitud) => (
            <TarjetaSolicitud
              key={solicitud.id}
              solicitud={solicitud}
              mostrarSolicitante={mostrarSolicitante}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
