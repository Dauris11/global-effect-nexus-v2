"use client";

import { useActionState, useState } from "react";
import { AlertCircle, Plus, Save } from "lucide-react";
import { useTranslations } from "next-intl";

import { SidePanelForm } from "@/components/app/side-panel-form";
import { TIPOS_PATROCINADOR } from "@/lib/patrocinadores";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ALERTA_RIESGO } from "@/lib/paleta";
import {
  type EstadoPatrocinador,
  guardarPatrocinador,
} from "@/server/patrocinadores/acciones";
import type { PatrocinadorFila } from "@/server/patrocinadores/consultas";

const SELECT =
  "text-body h-11 w-full rounded-control border border-linea-fuerte bg-background px-3 outline-none focus-visible:ring-2 focus-visible:ring-ring";


/**
 * Alta y edición en panel lateral. Solo lo obligatorio va a la vista (nombre, tipo,
 * estado y aporte); contacto, país, idioma y notas quedan plegados en «Más detalles».
 *
 * `guardarPatrocinador` revalida el permiso en el servidor: este panel solo se monta
 * si la pantalla ya comprobó `patrocinadores.escribir`, pero esconder el botón no es
 * control de acceso.
 */
export function PanelPatrocinador({
  patrocinador,
  abierto,
  alCambiar,
}: {
  patrocinador?: PatrocinadorFila;
  abierto: boolean;
  alCambiar: (abierto: boolean) => void;
}) {
  const t = useTranslations("sponsors");
  const tc = useTranslations("sponsorMail");
  const [estado, enviar, enviando] = useActionState<EstadoPatrocinador, FormData>(
    async (previo, datos) => {
      const resultado = await guardarPatrocinador(previo, datos);

      if (resultado.estado === "ok") alCambiar(false);

      return resultado;
    },
    { estado: "inicial" },
  );
  const clave = patrocinador?.id ?? "nuevo";
  const mensajeError =
    estado.estado === "nombre_vacio"
      ? t("form.nameRequired")
      : estado.estado === "monto_invalido"
        ? t("form.amountInvalid")
        : t("form.error");

  return (
    <SidePanelForm
      open={abierto}
      onOpenChange={alCambiar}
      title={patrocinador ? t("form.editTitle") : t("form.newTitle")}
      description={patrocinador ? t("form.editSubtitle") : t("form.newSubtitle")}
      submitLabel={
        enviando
          ? patrocinador ? t("form.saving") : t("form.creating")
          : patrocinador ? t("form.save") : t("form.create")
      }
      submitIcon={<Save />}
      pending={enviando}
      action={enviar}
      moreDetails={
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor={`p-email-${clave}`}>{t("field.email")}</Label>
              <Input id={`p-email-${clave}`} name="email" type="email" defaultValue={patrocinador?.email ?? ""} maxLength={160} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`p-tel-${clave}`}>{t("field.phone")}</Label>
              <Input id={`p-tel-${clave}`} name="telefono" type="tel" defaultValue={patrocinador?.telefono ?? ""} maxLength={40} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`p-pais-${clave}`}>{t("field.country")}</Label>
              <Input id={`p-pais-${clave}`} name="pais" defaultValue={patrocinador?.pais ?? ""} maxLength={80} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`p-idioma-${clave}`}>{tc("language")}</Label>
              <select id={`p-idioma-${clave}`} name="idioma" defaultValue={patrocinador?.idioma ?? "en"} className={SELECT}>
                <option value="en">{tc("languageEn")}</option>
                <option value="es">{tc("languageEs")}</option>
              </select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`p-notas-${clave}`}>{t("field.notes")}</Label>
            <Textarea id={`p-notas-${clave}`} name="notas" defaultValue={patrocinador?.notas ?? ""} maxLength={900} rows={3} />
          </div>
        </>
      }
    >
      <input type="hidden" name="id" value={patrocinador?.id ?? ""} />

      <div className="space-y-1.5">
        <Label htmlFor={`p-nombre-${clave}`}>{t("field.name")}</Label>
        <Input id={`p-nombre-${clave}`} name="nombre" defaultValue={patrocinador?.nombre} required maxLength={160} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`p-tipo-${clave}`}>{t("field.type")}</Label>
          <select id={`p-tipo-${clave}`} name="tipo" defaultValue={patrocinador?.tipo ?? "persona"} className={SELECT}>
            {TIPOS_PATROCINADOR.map((valor) => (
              <option key={valor} value={valor}>{t(`type.${valor}`)}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`p-estado-${clave}`}>{t("field.state")}</Label>
          <select id={`p-estado-${clave}`} name="estado" defaultValue={patrocinador?.estado ?? "activo"} className={SELECT}>
            {/* `pausado` no se ofrece: la acción solo guarda activo/inactivo y lo demás lo
              convertiría en silencio en «activo». */}
            {(["activo", "inactivo"] as const).map((valor) => (
              <option key={valor} value={valor}>{t(`state.${valor}`)}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`p-monto-${clave}`}>{t("field.monthly")}</Label>
        <Input id={`p-monto-${clave}`} name="monto" type="number" min={0} step="0.01" defaultValue={patrocinador?.monto_mensual ?? 0} />
      </div>

      {estado.estado !== "inicial" && estado.estado !== "ok" && (
        <p role="alert" className={ALERTA_RIESGO.contenedor}>
          <AlertCircle className={ALERTA_RIESGO.icono} />
          <span className={ALERTA_RIESGO.texto}>{mensajeError}</span>
        </p>
      )}
    </SidePanelForm>
  );
}

/** La única acción primaria de la página: abre el panel de alta. */
export function BotonNuevoPatrocinador() {
  const t = useTranslations("sponsors");
  const [abierto, setAbierto] = useState(false);
  // Cada apertura monta un panel nuevo para no arrastrar el error de la anterior.
  const [vez, setVez] = useState(0);

  return (
    <>
      <Button
        type="button"
        onClick={() => {
          setVez((v) => v + 1);
          setAbierto(true);
        }}
      >
        <Plus />
        {t("new")}
      </Button>
      {abierto && <PanelPatrocinador key={vez} abierto={abierto} alCambiar={setAbierto} />}
    </>
  );
}
