import { headers } from "next/headers";
import { getLocale, getTranslations } from "next-intl/server";

import { AplicadorApariencia } from "@/components/apariencia/aplicador-apariencia";
import { WidgetFlotanteIA } from "@/components/ia/widget-flotante-ia";
import { AppShell } from "@/components/layout/app-shell";
import { redirigir } from "@/i18n/navigation";
import { requerirUsuario } from "@/lib/auth";
import { FUNCION_ASISTENTE, rutasProtegidas } from "@/lib/nav";
import { PORTAL_POR_ROL } from "@/lib/rbac";
import { SCRIPT_APARIENCIA } from "@/lib/apariencia";
import { fechaConHora } from "@/lib/fechas";
import { urlDeAvatar } from "@/lib/supabase/almacen";
import { marcarPresencia } from "@/server/auditoria/actividad";
import { cerrarSesion } from "@/server/auth/acciones";
import { estudianteDeUsuario } from "@/server/estudiantes/portal";
import { ventanaVigente } from "@/server/global360/consultas";
import { misNotificaciones } from "@/server/notificaciones/consultas";
import { rutaBloqueada, visibilidadDeRol } from "@/server/visibilidad/consultas";

/**
 * Puerta de todas las pantallas internas.
 *
 * Aquí es donde se decide quién entra, no en el proxy: `requerirUsuario`
 * comprueba la sesión de Supabase contra la tabla `usuario` en cada petición,
 * así que una cuenta desactivada pierde el acceso al instante y no cuando
 * caduque su token.
 *
 * Cada portal restringe además su propio rol con `requerirRol`.
 */
export default async function LayoutPortal({
  children,
}: {
  children: React.ReactNode;
}) {
  const usuario = await requerirUsuario();

  // Presencia: «última vez que estuvo» para la pantalla de actividad. Escribe
  // como mucho cada cinco minutos por persona, y no espera: no hay por qué
  // retrasar una pantalla por anotar que alguien la abrió.
  void marcarPresencia(usuario.id);

  /*
   * Visibilidad por rol (`/configuracion/visibilidad`). `super_admin` siempre lo
   * ve todo. Para el resto: lo OCULTO sale de los menús (pasa por `ocultos`) y lo
   * BLOQUEADO además cierra la dirección directa. La ruta llega en `x-ruta`,
   * que anota el proxy; sin ella (no debería pasar) no se bloquea nada, que es
   * el fallo menos dañino: el RBAC de cada pantalla sigue en pie.
   *
   * El inicio del rol y el perfil nunca se bloquean, aunque alguien lo pidiera.
   */
  const visibilidad =
    usuario.rol === "super_admin"
      ? { ocultas: new Set<string>(), bloqueadas: new Set<string>(), fueraDelMenu: [] as string[] }
      : await visibilidadDeRol(usuario.rol);

  if (visibilidad.bloqueadas.size > 0) {
    const ruta = ((await headers()).get("x-ruta") ?? "").replace(/^\/(es|en)(?=\/|$)/, "") || "/";
    const protegida = rutasProtegidas(usuario.rol).some((p) => ruta === p || ruta.startsWith(`${p}/`));

    if (!protegida && rutaBloqueada(ruta, visibilidad.bloqueadas)) {
      redirigir(PORTAL_POR_ROL[usuario.rol], await getLocale());
    }
  }

  const asistenteVisible = !visibilidad.fueraDelMenu.includes(FUNCION_ASISTENTE);

  /*
   * Si el estudiante tiene expediente detrás. Sin él (usuario aún no enlazado)
   * no hay a quién ofrecerle la prematrícula. Solo se consulta para ese rol; a
   * los demás no les afecta y sería una consulta a la base por página sin
   * motivo.
   *
   * `estudianteDeUsuario` está memoizada por petición, así que esto no repite
   * la consulta que la propia pantalla va a hacer después.
   */
  const conExpediente =
    usuario.rol === "estudiante" &&
    (await estudianteDeUsuario(usuario.id)) !== null;

  /*
   * Aviso de prematrícula en la cabecera, a todo estudiante con expediente:
   * todos cursan Global Effect 360.
   *
   * Se resuelve aquí, en el servidor, y viaja como una cadena ya formada: la
   * cabecera es cliente y así no se le manda ni el diccionario ni la lógica de
   * fechas. Si no hay ventana vigente no se consulta nada más y el aviso no sale.
   */
  let aviso: { texto: string; href: string } | null = null;

  if (conExpediente) {
    const ventana = await ventanaVigente();

    if (ventana) {
      const t = await getTranslations("global360");
      const corta = (iso: string) =>
        `${iso.slice(8, 10)}/${iso.slice(5, 7)} ${iso.slice(11, 16)}`;

      aviso = {
        texto: `${ventana.abierta ? t("windowOpen") : t("windowSoon")} · ${t(
          "windowFrom",
          {
            abre: corta(ventana.abre),
            cierra: corta(ventana.cierra),
          },
        )}`,
        href: "/portal/estudiante/global-360",
      };
    }
  }

  /*
   * Los avisos de la campana. Una sola consulta para la lista y el contador
   * (ver su cabecera), y se pide aquí porque la campana vive en el armazón: en
   * la página no serviría, habría que repetirla en las cuarenta y cuatro.
   *
   * La hora se formatea en el servidor y viaja como cadena, igual que el aviso
   * de prematrícula: así el navegador no recibe `date-fns` ni el diccionario de
   * fechas por una campana.
   */
  const avisos = await misNotificaciones(usuario.id, 8);

  return (
    <>
      {/* Antes de pintar: sin esto la página sale clara un instante y luego se
          oscurece. El aplicador de abajo lo retira al salir del portal. */}
      <script dangerouslySetInnerHTML={{ __html: SCRIPT_APARIENCIA }} />
      <AplicadorApariencia />
      <AppShell
        rol={usuario.rol}
        nombre={usuario.nombre}
        // La URL se firma aquí, en el servidor: el armazón es cliente y no tiene
        // por qué saber en qué bucket vive la foto.
        foto={urlDeAvatar(usuario.fotoUrl)}
        aviso={aviso}
        avisos={avisos.map((fila) => ({
          id: fila.id,
          titulo: fila.titulo,
          mensaje: fila.mensaje,
          tipo: fila.tipo,
          leida: fila.leida,
          enlace: fila.enlace,
          cuando: fechaConHora(fila.created_at, null, usuario.idioma),
        }))}
        sinLeer={avisos[0]?.sin_leer ?? 0}
        ocultos={visibilidad.fueraDelMenu}
        cerrarSesion={cerrarSesion}
      >
        {children}
        {asistenteVisible && (
          <WidgetFlotanteIA
            usuario={{
              id: usuario.id,
              nombre: usuario.nombre,
              rol: usuario.rol,
              idioma: usuario.idioma,
            }}
          />
        )}
      </AppShell>
    </>
  );
}
