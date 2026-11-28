import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { PageContainer } from "@/components/app/page-container";
import { RolBadge } from "@/components/app/rol-badge";
import { PageHeader } from "@/components/app/page-header";
import { DetallePersona as PestanasPersona } from "@/components/personal/detalle-persona";
import { FilaCuenta } from "@/components/personal/gestion-cuentas";
import { QueAtiende } from "@/components/prioridades/que-atiende";
import { mensajesCliente } from "@/i18n/mensajes-cliente";
import { requerirPermiso } from "@/lib/auth";
import { consultar, consultarUna } from "@/lib/db";
import { MODULOS, tiposDelModulo } from "@/lib/prioridades/catalogo";
import { MARCADOR_CONFIGURADO, UNIVERSALES } from "@/lib/prioridades/defaults";
import { esRol } from "@/lib/rbac";
import { rolesAsignablesPor } from "@/lib/roles";
import { equipo } from "@/server/personal/consultas";
import { responsabilidadesDe } from "@/server/prioridades/motor";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "staff" });

  return { title: t("title") };
}

/** Detalle de una persona del equipo: por ahora, «Qué atiende» (qué pendientes le llegan al Inicio). */
export default async function DetallePersona({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  const yo = await requerirPermiso("usuarios.administrar");

  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const persona = await consultarUna<{ id: string; nombre: string; rol: string }>(
    `SELECT u.id, u.nombre, r.nombre AS rol FROM usuario u JOIN rol r ON r.id = u.rol_id WHERE u.id = $1`,
    [id],
  );
  if (!persona || !esRol(persona.rol)) notFound();

  const [tStaff, marcados, filas, mensajes, gente] = await Promise.all([
    getTranslations({ locale, namespace: "staff" }),
    responsabilidadesDe(persona.id, persona.rol),
    consultar<{ tipo_prioridad: string }>(`SELECT tipo_prioridad FROM responsabilidades_personal WHERE user_id = $1`, [persona.id]),
    mensajesCliente(["priorities", "staff"]),
    equipo({ incluirDesarrolladores: true }),
  ]);
  const fila = gente.find((p) => p.id === persona.id);
  // Lo propio de cada persona (sus tareas, la respuesta a lo que pidió) llega siempre: no se marca.
  const grupos = MODULOS.map((modulo) => ({
    modulo,
    tipos: tiposDelModulo(modulo).filter((tipo) => !UNIVERSALES.includes(tipo) || tipo === "proyecto_atrasado"),
  })).filter((g) => g.tipos.length > 0 && (g.modulo !== "tecnico" || persona.rol === "developer"));

  return (
    <PageContainer className="space-y-6">
      <PageHeader
        title={persona.nombre}
        subtitle={<RolBadge rol={persona.rol} />}
        breadcrumb={[{ etiqueta: tStaff("title"), href: "/administrativo/personal" }, { etiqueta: persona.nombre }]}
      />
      <NextIntlClientProvider messages={mensajes}>
        <PestanasPersona
          cuenta={fila ? <FilaCuenta persona={fila} roles={rolesAsignablesPor(yo.rolReal)} esYo={yo.id === persona.id} /> : null}
          queAtiende={
            <QueAtiende
              userId={persona.id}
              grupos={grupos}
              marcados={[...marcados]}
              personalizado={filas.some((f) => f.tipo_prioridad === MARCADOR_CONFIGURADO)}
            />
          }
        />
      </NextIntlClientProvider>
    </PageContainer>
  );
}
