"use client";

import { useActionState, useEffect, useState } from "react";
import { Loader2, Save } from "lucide-react";
import { useTranslations } from "next-intl";

import { EditorLineas, useLineas } from "@/components/contabilidad/asientos/editor-lineas";
import { AvisoError, SELECT } from "@/components/contabilidad/comun";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link, useRouter } from "@/i18n/navigation";
import { TIPOS_ASIENTO_MANUAL } from "@/lib/contabilidad/asientos";
import {
  crearAsiento,
  guardarPlantilla,
  type EstadoAccionAsiento,
} from "@/server/contabilidad/asientos/acciones";
import type { CuentaMovimiento } from "@/server/contabilidad/asientos/consultas";

/**
 * Alta de un asiento manual y de una plantilla recurrente. Comparten el
 * editor y la regla del botón: deshabilitado hasta que el asiento cuadre,
 * con la misma función que el servidor usa para aceptarlo.
 */

const INICIAL: EstadoAccionAsiento = { estado: "inicial" };

function useError(estado: EstadoAccionAsiento): string | null {
  const t = useTranslations("contab.asientos");
  if (estado.estado === "inicial" || estado.estado === "ok") return null;
  const mensaje = t(`error.${estado.estado}`);
  return estado.linea !== undefined ? `${t("editor.linea", { n: estado.linea + 1 })}: ${mensaje}` : mensaje;
}

export function FormularioAsiento({ cuentas, hoy }: { cuentas: CuentaMovimiento[]; hoy: string }) {
  const t = useTranslations("contab.asientos.formulario");
  const tt = useTranslations("contab.asientos.tipo");
  const router = useRouter();
  const [estado, enviar, enviando] = useActionState(crearAsiento, INICIAL);
  const lineas = useLineas();
  const [concepto, setConcepto] = useState("");
  const error = useError(estado);

  useEffect(() => {
    if (estado.estado === "ok" && estado.id) router.push(`/contabilidad/asientos/${estado.id}`);
  }, [estado, router]);

  const listo = lineas.resultado.ok && concepto.trim().length >= 3;

  return (
    <form action={enviar} className="space-y-6">
      <input type="hidden" name="lineas" value={lineas.json} />
      <div className="grid gap-4 md:grid-cols-2">
        <Campo etiqueta={t("fecha")} id="fecha" ayuda={t("fechaAyuda")}>
          <Input id="fecha" name="fecha" type="date" required defaultValue={hoy} />
        </Campo>
        <Campo etiqueta={t("tipo")} id="tipo">
          <select id="tipo" name="tipo" className={SELECT} defaultValue="manual">
            {TIPOS_ASIENTO_MANUAL.map((tipo) => (
              <option key={tipo} value={tipo}>
                {tt(tipo)}
              </option>
            ))}
          </select>
        </Campo>
      </div>
      <Campo etiqueta={t("concepto")} id="concepto">
        <Input
          id="concepto"
          name="concepto"
          required
          minLength={3}
          maxLength={200}
          value={concepto}
          onChange={(e) => setConcepto(e.target.value)}
        />
      </Campo>

      <EditorLineas cuentas={cuentas} lineas={lineas} />

      {error && <AvisoError>{error}</AvisoError>}
      <Acciones enviando={enviando} listo={listo} volver="/contabilidad/asientos" etiqueta={t("guardar")} />
    </form>
  );
}

export function FormularioPlantilla({ cuentas }: { cuentas: CuentaMovimiento[] }) {
  const t = useTranslations("contab.asientos.plantillas.formulario");
  const router = useRouter();
  const [estado, enviar, enviando] = useActionState(guardarPlantilla, INICIAL);
  const lineas = useLineas();
  const [nombre, setNombre] = useState("");
  const [concepto, setConcepto] = useState("");
  const error = useError(estado);

  useEffect(() => {
    if (estado.estado === "ok") router.push("/contabilidad/asientos/recurrentes");
  }, [estado, router]);

  const listo = lineas.resultado.ok && nombre.trim().length >= 3 && concepto.trim().length >= 3;

  return (
    <form action={enviar} className="space-y-6">
      <input type="hidden" name="lineas" value={lineas.json} />
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_10rem]">
        <Campo etiqueta={t("nombre")} id="nombre">
          <Input
            id="nombre"
            name="nombre"
            required
            minLength={3}
            maxLength={120}
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
          />
        </Campo>
        <Campo etiqueta={t("dia")} id="dia_del_mes">
          <Input id="dia_del_mes" name="dia_del_mes" type="number" min={1} max={31} required defaultValue={1} />
        </Campo>
      </div>
      <p className="texto-meta -mt-3">{t("diaAyuda")}</p>
      <Campo etiqueta={t("concepto")} id="concepto">
        <Input
          id="concepto"
          name="concepto"
          required
          minLength={3}
          maxLength={200}
          value={concepto}
          onChange={(e) => setConcepto(e.target.value)}
        />
      </Campo>

      <EditorLineas cuentas={cuentas} lineas={lineas} />

      {error && <AvisoError>{error}</AvisoError>}
      <Acciones
        enviando={enviando}
        listo={listo}
        volver="/contabilidad/asientos/recurrentes"
        etiqueta={t("guardar")}
      />
    </form>
  );
}

function Acciones({
  enviando,
  listo,
  volver,
  etiqueta,
}: {
  enviando: boolean;
  listo: boolean;
  volver: string;
  etiqueta: string;
}) {
  const t = useTranslations("contab.asientos.formulario");
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={!listo || enviando}>
          {enviando ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          {etiqueta}
        </Button>
        <Button asChild variant="ghost">
          <Link href={volver}>{t("cancelar")}</Link>
        </Button>
      </div>
      {!listo && <p className="texto-meta">{t("ayudaEnvio")}</p>}
    </div>
  );
}

function Campo({
  etiqueta,
  id,
  ayuda,
  children,
}: {
  etiqueta: string;
  id: string;
  ayuda?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-sm font-medium">
        {etiqueta}
      </Label>
      {children}
      {ayuda && <p className="texto-meta">{ayuda}</p>}
    </div>
  );
}
