import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";

import {
  FormularioParametros,
  type CampoParametro,
} from "@/components/parametros/formulario-parametros";
import { InterruptorTecnico } from "@/components/parametros/interruptor-tecnico";
import { EncabezadoPagina } from "@/components/ui/encabezado-pagina";
import { mensajesCliente } from "@/i18n/mensajes-cliente";
import { requerirRol } from "@/lib/auth";
import { fechaConHora } from "@/lib/fechas";
import { GRUPOS } from "@/lib/parametros";
import { usuarioTienePermiso } from "@/lib/rbac";
import { CLAVE_IMPERSONATION_WRITE } from "@/lib/suplantacion";
import { parametrosParaEditar } from "@/server/parametros/consultas";
import { impersonationWriteActivo } from "@/server/parametros/tecnicos";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "parametros" });

  return { title: t("title") };
}

/**
 * Parámetros institucionales: lo que antes estaba escrito en el código y ahora
 * cambia coordinación —el horario del comedor, los mínimos de la beca, el correo
 * de contacto—. Cada uno está conectado a algo real: la lista de
 * `src/lib/parametros.ts` es la única que existe.
 *
 * Los parámetros TÉCNICOS (`tecnico.*`) no están en esa lista: solo se pintan, y solo se guardan, con
 * `tecnico.parametros` (developer). Un propietario o administrativo ve esta pantalla sin esa sección.
 */
export default async function PaginaParametros({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const usuario = await requerirRol(["admin", "owner"]);

  const verTecnicos = usuarioTienePermiso(usuario, "tecnico.parametros");
  const [t, filas, mensajes, escritura] = await Promise.all([
    getTranslations({ locale, namespace: "parametros" }),
    parametrosParaEditar(),
    mensajesCliente(["parametros"]),
    verTecnicos ? impersonationWriteActivo() : Promise.resolve(false),
  ]);

  const grupos = GRUPOS.map((grupo) => ({
    clave: grupo,
    campos: filas
      .filter((f) => f.def.grupo === grupo)
      .map<CampoParametro>((f) => ({
        clave: f.def.clave,
        grupo,
        tipo: f.def.tipo,
        valor: f.valor,
        porDefecto: f.porDefecto,
        minimo: f.def.tipo === "numero" ? f.def.minimo : undefined,
        maximo: f.def.tipo === "numero" ? f.def.maximo : undefined,
        decimales: f.def.tipo === "numero" ? f.def.decimales : undefined,
        ultimoCambio: f.ultimoCambio
          ? t("lastChange", {
              quien: f.ultimoCambio.quien ?? t("unknownPerson"),
              cuando: fechaConHora(f.ultimoCambio.cuando, null, usuario.idioma),
            })
          : null,
      })),
  })).filter((g) => g.campos.length > 0);

  return (
    <div className="animate-entrada space-y-8 pb-10">

      <EncabezadoPagina titulo={t("title")} />

      <NextIntlClientProvider messages={mensajes}>
        <FormularioParametros grupos={grupos} />

        {verTecnicos && (
          <section aria-labelledby="parametros-tecnicos" className="space-y-4 rounded-card border border-linea bg-card p-5 shadow-card">
            <div>
              <h2 id="parametros-tecnicos" className="text-section">
                {t("technicalTitle")}
              </h2>
              <p className="text-meta mt-1">{t("technicalHint")}</p>
            </div>
            <InterruptorTecnico
              clave={CLAVE_IMPERSONATION_WRITE}
              inicial={escritura}
              etiqueta={t("impersonationWrite")}
              ayuda={t("impersonationWriteHint")}
              editable
            />
          </section>
        )}
      </NextIntlClientProvider>
    </div>
  );
}
