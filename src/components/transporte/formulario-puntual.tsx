"use client";

import { useState, useTransition } from "react";
import { AlertCircle, Check, Send } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  AccionesFormulario,
  FormularioGuiado,
  PasoFormulario,
} from "@/components/ui/formulario-guiado";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { TransporteHorario, TransporteParada } from "@/lib/transporte";

type Datos = {
  horarioId: string;
  nombre: string;
  matriculaOTelefono?: string;
  paradaAbordajeId: string;
  paradaDestinoId: string;
  fecha?: string;
};

/**
 * Inscribir a una persona en un viaje. Lo usan tres sitios y solo cambia la
 * acción que se le pasa: la puerta pública (sin sesión), el estudiante que
 * anota a un invitado, y el chofer o administración que anota a quien no tiene
 * internet. `conFecha` ofrece elegir otro día; sin él es siempre hoy.
 */
export function FormularioPuntual({
  horarios,
  paradas,
  enviar,
  conFecha = false,
  hoy,
  sinTarjeta = false,
  alTerminar,
}: {
  horarios: TransporteHorario[];
  paradas: TransporteParada[];
  enviar: (datos: Datos) => Promise<{ ok: boolean; mensaje?: string }>;
  conFecha?: boolean;
  /** Día de hoy en La Vega (YYYY-MM-DD), mínimo del selector de fecha. */
  hoy?: string;
  /** Dentro de un diálogo no hace falta la tarjeta. */
  sinTarjeta?: boolean;
  alTerminar?: () => void;
}) {
  const t = useTranslations("transport");
  const [cargando, iniciar] = useTransition();

  const [nombre, setNombre] = useState("");
  const [contacto, setContacto] = useState("");
  const [fecha, setFecha] = useState(hoy ?? "");
  const [horarioId, setHorarioId] = useState(horarios[0]?.id ?? "");
  const [origenId, setOrigenId] = useState(paradas[0]?.id ?? "");
  const [destinoId, setDestinoId] = useState(paradas[paradas.length - 1]?.id ?? "");
  const [hecho, setHecho] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mismasParadas = origenId !== "" && origenId === destinoId;

  const mensajeDe = (codigo?: string) =>
    codigo === "paradas_iguales"
      ? t("sameStopError")
      : codigo === "tope_invitados"
        ? t("guestLimitError")
        : t("enrollError");

  const manejarEnvio = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim() || !horarioId || mismasParadas) return;
    setError(null);

    iniciar(async () => {
      const res = await enviar({
        nombre,
        matriculaOTelefono: contacto,
        horarioId,
        paradaAbordajeId: origenId,
        paradaDestinoId: destinoId,
        fecha: conFecha ? fecha : undefined,
      });

      if (!res.ok) {
        setError(mensajeDe(res.mensaje));
        return;
      }
      setHecho(true);
      setNombre("");
      setContacto("");
      alTerminar?.();
    });
  };

  const selector = (
    id: string,
    etiqueta: string,
    valor: string,
    cambiar: (v: string) => void,
    opciones: { id: string; texto: string }[],
  ) => (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{etiqueta}</Label>
      <Select value={valor} onValueChange={cambiar}>
        <SelectTrigger id={id}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {opciones.map((o) => (
            <SelectItem key={o.id} value={o.id}>
              {o.texto}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  const contenido = hecho ? (
    <div className="space-y-3 py-6 text-center">
      <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-marca-50 text-marca-600">
        <Check className="size-6" />
      </div>
      <p className="text-sm font-semibold text-tinta">{t("enrollmentSuccess")}</p>
      <Button variant="outline" size="sm" onClick={() => setHecho(false)}>
        {t("enrollAnother")}
      </Button>
    </div>
  ) : (
    <form onSubmit={manejarEnvio} className="space-y-4 text-sm">
      <FormularioGuiado>
        <PasoFormulario titulo={t("pasos.pasajero")}>
          <div className="space-y-1.5">
            <Label htmlFor="nombre-pasajero">{t("fullNameLabel")}</Label>
            <Input
              id="nombre-pasajero"
              required
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder={t("fullNamePlaceholder")}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="contacto-pasajero">{t("idOrPhoneLabel")}</Label>
            <Input
              id="contacto-pasajero"
              value={contacto}
              onChange={(e) => setContacto(e.target.value)}
              placeholder={t("idOrPhonePlaceholder")}
            />
          </div>
        </PasoFormulario>

        <PasoFormulario titulo={t("pasos.viaje")}>
          <div className="grid gap-4 sm:grid-cols-2">
            {selector(
              "viaje-pasajero",
              t("tripShift"),
              horarioId,
              setHorarioId,
              horarios.map((h) => ({ id: h.id, texto: `${h.nombre} · ${h.hora_salida}` })),
            )}
            {conFecha && (
              <div className="space-y-1.5">
                <Label htmlFor="fecha-pasajero">{t("dateLabel")}</Label>
                <Input
                  id="fecha-pasajero"
                  type="date"
                  min={hoy}
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                />
              </div>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {selector(
              "origen-pasajero",
              t("pickupStop"),
              origenId,
              setOrigenId,
              paradas.map((p) => ({ id: p.id, texto: `${p.orden}. ${p.nombre}` })),
            )}
            {selector(
              "destino-pasajero",
              t("dropoffStop"),
              destinoId,
              setDestinoId,
              paradas.map((p) => ({ id: p.id, texto: `${p.orden}. ${p.nombre}` })),
            )}
          </div>

          {(mismasParadas || error) && (
            <p
              role="alert"
              className="flex items-center gap-3 rounded-card bg-tinta p-3 text-sm text-background"
            >
              <AlertCircle className="size-4 shrink-0" />
              {error ?? t("sameStopError")}
            </p>
          )}
        </PasoFormulario>

        <AccionesFormulario>
          <Button
            type="submit"
            disabled={cargando || !nombre.trim() || mismasParadas}
            className="w-full gap-2 font-semibold"
          >
            <Send className="size-4" />
            {t("submitQuickEnroll")}
          </Button>
        </AccionesFormulario>
      </FormularioGuiado>
    </form>
  );

  if (sinTarjeta) return contenido;

  return (
    <Card className="p-5">
      <h3 className="texto-titulo-tarjeta mb-4 border-b border-linea pb-3">
        {t("quickEnrollTitle")}
      </h3>
      {contenido}
    </Card>
  );
}
