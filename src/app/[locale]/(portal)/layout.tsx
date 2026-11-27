import Script from "next/script";
import { getTranslations } from "next-intl/server";

import { AplicadorApariencia } from "@/components/apariencia/aplicador-apariencia";
import { WidgetFlotanteIA } from "@/components/ia/widget-flotante-ia";
import { AppShell } from "@/components/layout/app-shell";
import { requerirUsuario } from "@/lib/auth";
import { usuarioTienePermiso } from "@/lib/rbac";
import { SCRIPT_APARIENCIA } from "@/lib/apariencia";
import { fechaConHora } from "@/lib/fechas";
import { urlDeAvatar } from "@/lib/supabase/almacen";
import { marcarPresencia } from "@/server/auditoria/actividad";
import { cerrarSesion } from "@/server/auth/acciones";
import { estudianteDeUsuario } from "@/server/estudiantes/portal";
import { ventanaVigente } from "@/server/global360/consultas";
import { misNotificaciones } from "@/server/notificaciones/consultas";
import { prioridadesDe } from "@/server/prioridades/motor";
import { cuantasPorAtender } from "@/server/solicitudes/consultas";

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

  // El menú ya no se configura aparte: sale de los permisos que declara cada
  // entrada de `nav.ts`. El botón del asistente sigue la misma regla: sin
  // `ia.usar` el servidor rechaza cada mensaje, y ofrecerlo sería ofrecer algo
  // que no funciona.
  const asistenteVisible = usuarioTienePermiso(usuario, "ia.usar");

  // Distintivos del menú: lo vencido de mi lista (Inicio) y las solicitudes que me tocan. Una falla aquí no
  // debe tumbar la página: sin número, el menú sale igual.
  const [vencidas, porAtender] = await Promise.all([
    prioridadesDe(usuario).then((l) => l.grupos.vencido.length).catch(() => 0),
    cuantasPorAtender(usuario).catch(() => 0),
  ]);

  // Mostrar aviso de prematrícula a todo rol estudiante (incluido «Ver como»).
  let aviso: { texto: string; href: string } | null = null;

  if (usuario.rol === "estudiante") {
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
        href: "/portal/estudiante/prematricula",
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
      <Script id="apariencia-portal" strategy="afterInteractive">
        {SCRIPT_APARIENCIA}
      </Script>
      <AplicadorApariencia />
      <AppShell
        rol={usuario.rol}
        rolReal={usuario.rolReal}
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
        permisos={usuario.permisos}
        insignias={{ vencidos: vencidas, solicitudes: porAtender }}
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
