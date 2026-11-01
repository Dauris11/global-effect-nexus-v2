import type { Metadata } from "next";
import {
  Activity,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Lock,
  ScrollText,
  Search,
  Users,
  X,
} from "lucide-react";
import { getTranslations } from "next-intl/server";

import { CifraAcademica } from "@/components/academico/cifra";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EncabezadoPagina } from "@/components/ui/encabezado-pagina";
import { Input } from "@/components/ui/input";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { requerirRol } from "@/lib/auth";
import { fechaConHora } from "@/lib/fechas";
import { TARJETA, VACIO } from "@/lib/paleta";
import {
  actoresDeAuditoria,
  eventosDeAuditoria,
  POR_PAGINA,
  resumenDeAuditoria,
  vocabularioDeAuditoria,
} from "@/server/auditoria/consultas";

/** Clase del desplegable nativo, la misma del resto del proyecto. */
const SELECT =
  "border-input focus-visible:border-ring focus-visible:ring-ring/50 h-9 w-full rounded-md border bg-card px-2 text-base shadow-xs outline-none focus-visible:ring-[3px] sm:text-sm";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "audit" });

  return { title: t("title") };
}

/**
 * Visor del registro de auditoría.
 *
 * Cierra la deuda más vieja del sistema: `audit_log` se escribía desde siete
 * módulos y **no había forma de leerlo** salvo por SQL. Un registro que nadie
 * puede consultar no disuade a nadie y no sirve para rendir cuentas: solo
 * ocupa disco.
 *
 * SOLO `super_admin`. No es una pantalla de coordinación: enseña lo que ha
 * hecho cada cuenta, y eso incluye a quien coordina.
 *
 * Y una cosa que esta pantalla NO hace, escrita aquí para que no se pierda: **el
 * detalle del antiguo módulo de psicología no se enseña**. Esas filas son de
 * antes de la 0030 —que borró las tablas clínicas pero no toca `audit_log`— y
 * aparecen con su acción, su autor y su hora, sin el `datos` ni el id de la
 * fila: la consulta las tapa en el propio SELECT. Ver la cabecera de
 * `@/server/auditoria/consultas`.
 *
 * Sin JavaScript de cliente: filtros en un `form method="get"` y la paginación
 * en dos enlaces.
 */
export default async function PaginaAuditoria({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    q?: string;
    entidad?: string;
    accion?: string;
    usuario?: string;
    desde?: string;
    hasta?: string;
    pagina?: string;
  }>;
}) {
  const { locale } = await params;
  const { q, entidad, accion, usuario, desde, hasta, pagina } =
    await searchParams;
  const idioma: Locale = locale === "en" ? "en" : "es";

  await requerirRol(["super_admin"]);

  const t = await getTranslations({ locale, namespace: "audit" });

  const [vocabulario, actores] = await Promise.all([
    vocabularioDeAuditoria(),
    actoresDeAuditoria(),
  ]);

  // Todo lo que llega por la URL se comprueba contra lo que existe de verdad:
  // una entidad inventada iría al SQL como un filtro que no casa nada, y la
  // pantalla parecería vacía en vez de decir que el filtro está mal.
  const busqueda = (q ?? "").trim().slice(0, 80);
  const entidadOk = entidad && vocabulario.entidades.includes(entidad) ? entidad : null;
  const accionOk = accion && vocabulario.acciones.includes(accion) ? accion : null;
  const usuarioOk = usuario && UUID.test(usuario) ? usuario : null;
  const desdeOk = desde && /^\d{4}-\d{2}-\d{2}$/.test(desde) ? desde : null;
  const hastaOk = hasta && /^\d{4}-\d{2}-\d{2}$/.test(hasta) ? hasta : null;
  const paginaOk = Math.max(1, Number(pagina) || 1);

  const filtro = {
    busqueda,
    entidad: entidadOk,
    accion: accionOk,
    usuarioId: usuarioOk,
    desde: desdeOk,
    hasta: hastaOk,
    pagina: paginaOk,
  };

  const [eventos, resumen] = await Promise.all([
    eventosDeAuditoria(filtro),
    resumenDeAuditoria(filtro),
  ]);

  const hayFiltro = Boolean(
    busqueda || entidadOk || accionOk || usuarioOk || desdeOk || hastaOk,
  );

  const ultima = Math.max(1, Math.ceil(resumen.total / POR_PAGINA));

  /** La misma URL con otra página, conservando los filtros puestos. */
  const enlace = (destino: number) => {
    const parametros = new URLSearchParams();

    if (busqueda) parametros.set("q", busqueda);
    if (entidadOk) parametros.set("entidad", entidadOk);
    if (accionOk) parametros.set("accion", accionOk);
    if (usuarioOk) parametros.set("usuario", usuarioOk);
    if (desdeOk) parametros.set("desde", desdeOk);
    if (hastaOk) parametros.set("hasta", hastaOk);
    if (destino > 1) parametros.set("pagina", String(destino));

    const cadena = parametros.toString();

    return cadena
      ? `/configuracion/auditoria?${cadena}`
      : "/configuracion/auditoria";
  };

  return (
    <div className="animate-entrada mx-auto max-w-5xl space-y-6">
      <Button
        asChild
        variant="outline"
        size="sm"
        className="transition-transform hover:-translate-x-0.5"
      >
        <Link href="/configuracion">
          <ArrowLeft className="size-4" />
          {t("back")}
        </Link>
      </Button>

      <EncabezadoPagina titulo={t("title")} />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <CifraAcademica
          valor={resumen.total}
          etiqueta={t("stats.total")}
          icono={ScrollText}
          acento
        />
        <CifraAcademica
          valor={resumen.hoy}
          etiqueta={t("stats.today")}
          icono={Activity}
        />
        <CifraAcademica
          valor={resumen.actores}
          etiqueta={t("stats.actors")}
          icono={Users}
        />
        <CifraAcademica
          valor={resumen.entidades}
          etiqueta={t("stats.entities")}
          icono={ScrollText}
        />
      </div>

      <form method="get" className="flex flex-wrap items-end gap-2">
        <div className="min-w-44 flex-1 space-y-1.5">
          <label htmlFor="q" className="text-muted-foreground text-xs font-medium">
            {t("search")}
          </label>
          <Input
            id="q"
            name="q"
            type="search"
            defaultValue={busqueda}
            placeholder={t("searchPlaceholder")}
            maxLength={80}
          />
        </div>

        <div className="min-w-36 space-y-1.5">
          <label
            htmlFor="entidad"
            className="text-muted-foreground text-xs font-medium"
          >
            {t("field.entity")}
          </label>
          <select
            id="entidad"
            name="entidad"
            defaultValue={entidadOk ?? ""}
            className={SELECT}
          >
            <option value="">{t("allEntities")}</option>
            {vocabulario.entidades.map((valor) => (
              <option key={valor} value={valor}>
                {valor}
              </option>
            ))}
          </select>
        </div>

        <div className="min-w-40 space-y-1.5">
          <label
            htmlFor="accion"
            className="text-muted-foreground text-xs font-medium"
          >
            {t("field.action")}
          </label>
          <select
            id="accion"
            name="accion"
            defaultValue={accionOk ?? ""}
            className={SELECT}
          >
            <option value="">{t("allActions")}</option>
            {vocabulario.acciones.map((valor) => (
              <option key={valor} value={valor}>
                {valor}
              </option>
            ))}
          </select>
        </div>

        <div className="min-w-40 space-y-1.5">
          <label
            htmlFor="usuario"
            className="text-muted-foreground text-xs font-medium"
          >
            {t("field.actor")}
          </label>
          <select
            id="usuario"
            name="usuario"
            defaultValue={usuarioOk ?? ""}
            className={SELECT}
          >
            <option value="">{t("allActors")}</option>
            {actores.map((fila) => (
              <option key={fila.id} value={fila.id}>
                {fila.nombre}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="desde"
            className="text-muted-foreground text-xs font-medium"
          >
            {t("field.from")}
          </label>
          <Input id="desde" name="desde" type="date" defaultValue={desdeOk ?? ""} />
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="hasta"
            className="text-muted-foreground text-xs font-medium"
          >
            {t("field.to")}
          </label>
          <Input id="hasta" name="hasta" type="date" defaultValue={hastaOk ?? ""} />
        </div>

        <Button
          type="submit"
          className="transition-transform duration-150 active:scale-95"
        >
          <Search className="size-4" />
          {t("apply")}
        </Button>

        {hayFiltro && (
          <Button asChild variant="ghost">
            <Link href="/configuracion/auditoria">
              <X className="size-4" />
              {t("clear")}
            </Link>
          </Button>
        )}
      </form>

      {eventos.length === 0 ? (
        <Card>
          <CardContent className={VACIO.contenedor}>
            <span className={VACIO.icono}>
              <ScrollText className="size-6" />
            </span>
            <p className={VACIO.titulo}>
              {hayFiltro ? t("noMatches") : t("empty")}
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className={TARJETA.contenido}>
            <CardContent className="pt-5">
              <ul className="divide-y">
                {eventos.map((evento) => (
                  <li
                    key={evento.id}
                    className="hover:bg-muted/40 flex flex-wrap items-start gap-x-3 gap-y-1 py-2.5 transition-colors first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-sm font-medium">
                        {evento.accion}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        {/* La cuenta borrada deja su rastro con el id en NULL:
                            `usuario_id` es ON DELETE SET NULL, y el evento se
                            queda. Se dice, en vez de dejar el hueco. */}
                        {evento.actor ?? t("unknownActor")}
                        {evento.actor_email ? ` · ${evento.actor_email}` : ""}
                      </p>

                      {evento.datos && (
                        // El detalle en crudo. No se maquilla: son los campos
                        // que decidió anotar cada módulo, y traducirlos aquí
                        // sería inventar un vocabulario paralelo al de la base.
                        <pre className="bg-muted/60 mt-1.5 max-w-full overflow-x-auto rounded-lg px-2 py-1.5 text-[11px] leading-relaxed">
                          {JSON.stringify(evento.datos, null, 1)}
                        </pre>
                      )}

                      {evento.reservado && (
                        <p className="text-muted-foreground mt-1 inline-flex items-center gap-1 text-[11px]">
                          <Lock className="size-3 shrink-0" />
                          {t("reserved")}
                        </p>
                      )}
                    </div>

                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <Badge variant="secondary" className="font-mono text-[10px]">
                        {evento.entidad}
                      </Badge>
                      <span className="text-muted-foreground text-[11px]">
                        {fechaConHora(evento.created_at, null, idioma)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {/* Paginación en dos enlaces: la pantalla no tiene estado. */}
          {ultima > 1 && (
            <div className="flex items-center justify-between gap-2">
              {paginaOk > 1 ? (
                <Button asChild variant="outline" size="sm">
                  <Link href={enlace(paginaOk - 1)}>
                    <ChevronLeft className="size-4" />
                    {t("previous")}
                  </Link>
                </Button>
              ) : (
                <span />
              )}

              <p className="text-muted-foreground text-xs">
                {t("page", { current: paginaOk, last: ultima })}
              </p>

              {paginaOk < ultima ? (
                <Button asChild variant="outline" size="sm">
                  <Link href={enlace(paginaOk + 1)}>
                    {t("next")}
                    <ChevronRight className="size-4" />
                  </Link>
                </Button>
              ) : (
                <span />
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
