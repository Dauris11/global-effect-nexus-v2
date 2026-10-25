"use client";

import { useState } from "react";

import { BarraInferior } from "@/components/layout/barra-inferior";
import type { AvisoVisible } from "@/components/layout/campana";
import { Sidebar } from "@/components/layout/sidebar";
import { ProveedorVisibilidad } from "@/components/layout/visibilidad";
import { TopBar } from "@/components/layout/topbar";
import { usePathname } from "@/i18n/navigation";
import type { Rol } from "@/lib/rbac";

/**
 * Armazón de las pantallas internas: barra lateral + barra superior + contenido.
 *
 * Es cliente porque guarda dos estados de interfaz —lateral contraída y cajón
 * móvil abierto— que la barra lateral y el contenido comparten. Los `children`
 * siguen renderizándose en el servidor: aquí solo se pasan a través, así que
 * las páginas pueden consultar la base de datos con normalidad.
 *
 * La lateral es UN panel con todos los módulos del rol: w-64 con los nombres y
 * 72 px con solo los iconos. En el móvil no hay lateral: hay pestañas abajo
 * (`BarraInferior`) y la lateral es la hoja que abre su pestaña "Más". En escritorio es una columna hermana del contenido,
 * así que su ancho no hay que repetirlo aquí como `padding`: era la causa de que
 * pudiera acabar encima de la página en vez de al lado.
 */
export function AppShell({
  rol,
  nombre,
  foto,
  aviso,
  avisos,
  sinLeer,
  ocultos,
  cerrarSesion,
  children,
}: {
  rol: Rol;
  nombre: string;
  /** URL pública de la foto de perfil, o `null` para dibujar la inicial. */
  foto: string | null;
  /** Aviso de la cabecera, ya traducido. `null` cuando no hay nada que anunciar. */
  aviso: { texto: string; href: string } | null;
  /** Últimos avisos de la cuenta, para la campana de la cabecera. */
  avisos: readonly AvisoVisible[];
  sinLeer: number;
  /** Rutas que el administrador maestro ocultó para este rol. */
  ocultos: readonly string[];
  /** Server Action; cierra la sesión de Supabase y redirige al login. */
  cerrarSesion: () => Promise<void>;
  children: React.ReactNode;
}) {
  const [contraida, setContraida] = useState(false);
  const [abiertaEnMovil, setAbiertaEnMovil] = useState(false);
  const ruta = usePathname();

  // Al navegar, la hoja del menú móvil se cierra: si no, taparía la página recién
  // abierta y habría que cerrarlo a mano en cada salto. Se ajusta durante el
  // render y no en un efecto, que es lo que ESLint marcaba: el efecto pintaba
  // primero el cajón abierto sobre la página nueva y lo cerraba después.
  const [rutaAnterior, setRutaAnterior] = useState(ruta);

  if (ruta !== rutaAnterior) {
    setRutaAnterior(ruta);
    setAbiertaEnMovil(false);
  }

  return (
    <ProveedorVisibilidad ocultos={ocultos}>
      {/* Dos columnas: la barra y el resto. El contenido lleva `min-w-0` porque sin
        él una tabla ancha o un titular largo estiran la columna y empujan la
        barra fuera de la pantalla en vez de desbordar dentro de su propio hueco. */}
      <div className="bg-background flex min-h-dvh">
        <Sidebar
          rol={rol}
          nombre={nombre}
          foto={foto}
          contraida={contraida}
          onContraer={() => setContraida((valor) => !valor)}
          abiertaEnMovil={abiertaEnMovil}
          onCerrarMovil={() => setAbiertaEnMovil(false)}
          onCerrarSesion={() => void cerrarSesion()}
        />

        <div className="flex min-h-dvh min-w-0 flex-1 flex-col">
          <TopBar
            rol={rol}
            nombre={nombre}
            foto={foto}
            aviso={aviso}
            avisos={avisos}
            sinLeer={sinLeer}
            onCerrarSesion={() => void cerrarSesion()}
          />

          {/* Contenedor de 1280 px con 16 / 24 / 32 de margen (docs/09 §2.7).
            Abajo, en el móvil, el alto de la barra inferior más el área
            segura: sin él, la barra tapa el último botón de cada página. */}
          <main className="mx-auto w-full max-w-[1280px] flex-1 px-4 pt-6 pb-[calc(6rem+env(safe-area-inset-bottom))] md:px-6 md:pt-8 md:pb-10 lg:px-8">
            {children}
          </main>
        </div>

        <BarraInferior
          rol={rol}
          menuAbierto={abiertaEnMovil}
          onAbrirMenu={() => setAbiertaEnMovil(true)}
        />
      </div>
    </ProveedorVisibilidad>
  );
}
