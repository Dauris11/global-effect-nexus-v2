"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  AlertCircle,
  AlertTriangle,
  Bus,
  Clock,
  MapPin,
  Navigation,
  Play,
  Receipt,
  Square,
  UserPlus,
  Users,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FormularioPuntual } from "@/components/transporte/formulario-puntual";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type {
  PasajeroViaje,
  TipoIncidenciaTransporte,
  TransporteHorario,
  TransporteParada,
  TransporteViaje,
} from "@/lib/transporte";
import {
  actualizarParadaViaje,
  actualizarPosicionViaje,
  finalizarViaje,
  iniciarViaje,
  cargarPasajerosHorario,
  inscribirPasajeroAsistido,
  reportarIncidencia,
} from "@/server/transporte/acciones";

export function PanelChofer({
  viajeActivoInicial,
  horarioSugerido,
  horariosDisponibles,
  pasajerosIniciales,
  paradasIniciales = [],
  hoy,
}: {
  viajeActivoInicial: TransporteViaje | null;
  horarioSugerido: TransporteHorario | null;
  horariosDisponibles: TransporteHorario[];
  pasajerosIniciales: PasajeroViaje[];
  paradasIniciales?: TransporteParada[];
  hoy: string;
}) {
  const t = useTranslations("transport");

  const [viajeActivo, setViajeActivo] = useState(viajeActivoInicial);
  const [horarioSeleccionadoId, setHorarioSeleccionadoId] = useState<string>(
    viajeActivoInicial?.horario_id ??
      horarioSugerido?.id ??
      horariosDisponibles[0]?.id ??
      "",
  );
  const [pasajeros, setPasajeros] = useState<PasajeroViaje[]>(pasajerosIniciales);
  const [paradas] = useState<TransporteParada[]>(paradasIniciales);
  const [errorGps, setErrorGps] = useState<string | null>(null);

  const [dialogoIncidenciaAbierto, setDialogoIncidenciaAbierto] = useState(false);
  const [dialogoPasajeroAbierto, setDialogoPasajeroAbierto] = useState(false);
  const [tipoIncidencia, setTipoIncidencia] =
    useState<TipoIncidenciaTransporte>("averia_mecanica");
  const [descripcionIncidencia, setDescripcionIncidencia] = useState("");

  const [cargando, iniciarTransicion] = useTransition();
  const [posicionGps, setPosicionGps] = useState<{
    lat: number;
    lng: number;
    rumbo: number;
    velocidad: number;
  } | null>(null);

  const watchIdRef = useRef<number | null>(null);
  const ultimaTransmisionRef = useRef<number>(0);

  // Activación del rastreador GPS mediante Geolocation API
  useEffect(() => {
    if (!viajeActivo || viajeActivo.estado !== "en_curso") {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      return;
    }

    if (!("geolocation" in navigator)) {
      // Sin API de geolocalización el chofer sigue operando con paradas manuales.
      return;
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setErrorGps(null);
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const rumbo = pos.coords.heading ?? 0;
        const velocidad = (pos.coords.speed ?? 0) * 3.6; // m/s a km/h

        setPosicionGps({ lat, lng, rumbo, velocidad });

        // Throttle de transmisión: máximo una vez cada 4 segundos
        const ahora = Date.now();
        if (ahora - ultimaTransmisionRef.current >= 4000) {
          ultimaTransmisionRef.current = ahora;
          actualizarPosicionViaje({
            viajeId: viajeActivo.id,
            lat,
            lng,
            rumbo,
            velocidadKmh: velocidad,
          });
        }
      },
      (error) => {
        console.error("Error al obtener posición GPS del chofer:", error);
        if (error.code === error.PERMISSION_DENIED) {
          setErrorGps(t("gpsErrorDesc"));
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          setErrorGps(t("gpsUnavailableDesc"));
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 2000,
      },
    );

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [viajeActivo, t]);

  // Screen Wake Lock API: Mantiene la pantalla encendida en el soporte del vehículo durante el viaje
  useEffect(() => {
    if (!viajeActivo || viajeActivo.estado !== "en_curso") return;
    if (typeof window === "undefined" || !("wakeLock" in navigator)) return;

    let bloqueo: WakeLockSentinel | null = null;
    let cancelado = false;

    async function solicitarBloqueo() {
      try {
        if (!cancelado && "wakeLock" in navigator && document.visibilityState === "visible") {
          bloqueo = await navigator.wakeLock.request("screen");
        }
      } catch {
        // En navegadores con ahorro de batería activo o permisos restringidos puede fallar sin bloquear la app
      }
    }

    solicitarBloqueo();

    const alCambiarVisibilidad = () => {
      if (document.visibilityState === "visible" && (!bloqueo || bloqueo.released)) {
        solicitarBloqueo();
      }
    };

    document.addEventListener("visibilitychange", alCambiarVisibilidad);

    return () => {
      cancelado = true;
      document.removeEventListener("visibilitychange", alCambiarVisibilidad);
      if (bloqueo && !bloqueo.released) {
        bloqueo.release().catch(() => {});
      }
    };
  }, [viajeActivo]);

  // Acción: Iniciar viaje
  const manejarIniciarViaje = () => {
    if (!horarioSeleccionadoId) return;

    iniciarTransicion(async () => {
      const res = await iniciarViaje({
        horarioId: horarioSeleccionadoId,
        lat: posicionGps?.lat,
        lng: posicionGps?.lng,
      });

      if (res.ok && res.viajeId) {
        setViajeActivo({
          id: res.viajeId,
          horario_id: horarioSeleccionadoId,
          horario_nombre:
            horariosDisponibles.find((h) => h.id === horarioSeleccionadoId)
              ?.nombre ?? "",
          hora_salida:
            horariosDisponibles.find((h) => h.id === horarioSeleccionadoId)
              ?.hora_salida ?? "",
          chofer_id: "",
          chofer_nombre: "",
          fecha: new Date().toISOString().slice(0, 10),
          estado: "en_curso",
          lat_actual: posicionGps?.lat ?? null,
          lng_actual: posicionGps?.lng ?? null,
          rumbo: posicionGps?.rumbo ?? 0,
          velocidad_kmh: posicionGps?.velocidad ?? 0,
          parada_actual_id: null,
          iniciado_en: new Date().toISOString(),
          finalizado_en: null,
        });
      }
    });
  };

  // Acción: Finalizar viaje
  const manejarFinalizarViaje = () => {
    if (!viajeActivo) return;

    iniciarTransicion(async () => {
      const res = await finalizarViaje({ viajeId: viajeActivo.id });
      if (res.ok) {
        setViajeActivo(null);
      }
    });
  };

  // Acción: Reportar avería o incidencia
  const manejarEnviarIncidencia = () => {
    if (!viajeActivo || !descripcionIncidencia.trim()) return;

    iniciarTransicion(async () => {
      const res = await reportarIncidencia({
        viajeId: viajeActivo.id,
        tipo: tipoIncidencia,
        descripcion: descripcionIncidencia,
        lat: posicionGps?.lat,
        lng: posicionGps?.lng,
      });

      if (res.ok) {
        setDialogoIncidenciaAbierto(false);
        setDescripcionIncidencia("");
        if (tipoIncidencia === "averia_mecanica") {
          setViajeActivo((prev) => (prev ? { ...prev, estado: "averiado" } : null));
        }
      }
    });
  };

  const manejarCambioHorario = (id: string) => {
    setHorarioSeleccionadoId(id);
    iniciarTransicion(async () => {
      const res = await cargarPasajerosHorario(id);
      if (res.ok) {
        setPasajeros(res.pasajeros);
      }
    });
  };

  const manejarCambioParadaManual = (paradaId: string) => {
    if (!viajeActivo) return;
    const parada = paradas.find((p) => p.id === paradaId);
    setViajeActivo((prev) =>
      prev
        ? {
            ...prev,
            parada_actual_id: paradaId,
            parada_actual_nombre: parada?.nombre ?? null,
          }
        : null,
    );
    iniciarTransicion(async () => {
      await actualizarParadaViaje({
        viajeId: viajeActivo.id,
        paradaId,
      });
    });
  };

  return (
    <div className="mx-auto max-w-xl space-y-6">
      {/* Alerta de error GPS si aplica */}
      {errorGps && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-card bg-tinta p-4 text-sm text-background"
        >
          <AlertCircle className="mt-0.5 size-5 shrink-0" />
          <div>
            <p className="font-semibold">{t("gpsErrorTitle")}</p>
            <p className="mt-0.5 text-background/80">{errorGps}</p>
          </div>
        </div>
      )}

      {/* Cabecera del Chofer */}
      <Card className="p-5">
        <div className="flex items-center justify-between gap-3 border-b border-linea pb-4">
          <div className="flex items-center gap-2.5">
            <span className="flex size-10 items-center justify-center rounded-control bg-marca-50 text-marca-600">
              <Bus className="size-5" />
            </span>
            <div>
              <h2 className="texto-titulo-tarjeta">{t("driverCockpit")}</h2>
            </div>
          </div>

          <Badge
            variant={
              viajeActivo?.estado === "en_curso"
                ? "marca"
                : viajeActivo?.estado === "averiado"
                  ? "destructive"
                  : "neutra"
            }
          >
            {viajeActivo ? t(`status.${viajeActivo.estado}`) : t("standby")}
          </Badge>
        </div>

        {/* Selector de Viaje o Resumen en curso */}
        <div className="mt-4 space-y-3">
          {!viajeActivo ? (
            <div className="space-y-2">
              <Label>
                {t("selectTrip")}
              </Label>
              <Select
                value={horarioSeleccionadoId}
                onValueChange={manejarCambioHorario}
                disabled={cargando}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t("chooseTripPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {horariosDisponibles.map((h) => (
                    <SelectItem key={h.id} value={h.id}>
                      {h.nombre} ({h.hora_salida})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="rounded-control bg-muted/60 p-3.5 text-sm">
                <p className="font-semibold text-tinta">{viajeActivo.horario_nombre}</p>
                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-tinta-2">
                  <span className="flex items-center gap-1">
                    <Clock className="size-3" /> {t("departure")}: {viajeActivo.hora_salida}
                  </span>
                  {posicionGps && (
                    <span className="flex items-center gap-1 text-marca-600 font-medium">
                      <Navigation className="size-3" />{" "}
                      {Math.round(posicionGps.velocidad)} km/h
                    </span>
                  )}
                </div>
              </div>

              {paradas.length > 0 && (
                <div className="space-y-1.5">
                  <Label>
                    {t("manualStopSelectorLabel")}
                  </Label>
                  <Select
                    value={viajeActivo.parada_actual_id ?? undefined}
                    onValueChange={manejarCambioParadaManual}
                    disabled={cargando}
                  >
                    <SelectTrigger className="w-full text-xs">
                      <SelectValue placeholder={t("selectStopPlaceholder")} />
                    </SelectTrigger>
                    <SelectContent>
                      {paradas.map((p) => (
                        <SelectItem key={p.id} value={p.id} className="text-xs">
                          {p.orden}. {p.nombre} {p.referencia ? `(${p.referencia})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Botones de Mando Táctil */}
        <div className="mt-6 space-y-3">
          {!viajeActivo ? (
            <Button
              size="lg"
              onClick={manejarIniciarViaje}
              disabled={cargando || !horarioSeleccionadoId}
              className="h-16 w-full text-base font-semibold"
            >
              <Play className="mr-2 size-5 fill-current" />
              {t("startTrip")}
            </Button>
          ) : (
            <>
              <Button
                size="lg"
                variant="outline"
                onClick={manejarFinalizarViaje}
                disabled={cargando}
                className="h-14 w-full border-linea text-base font-semibold"
              >
                <Square className="mr-2 size-5 fill-current" />
                {t("finishTrip")}
              </Button>

              <Button
                size="lg"
                variant="destructive"
                onClick={() => setDialogoIncidenciaAbierto(true)}
                disabled={cargando}
                className="h-12 w-full text-sm font-semibold"
              >
                <AlertTriangle className="mr-2 size-4" />
                {t("reportBreakdownButton")}
              </Button>
            </>
          )}
        </div>

        {/* Acceso directo a reportar gasto de mantenimiento o compra de repuesto */}
        <div className="border-t border-linea pt-3 mt-4">
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="w-full justify-center gap-1.5 text-xs text-marca-600 hover:text-marca-700"
          >
            <Link href="/administrativo/solicitudes?tipo=compra">
              <Receipt className="size-3.5" />
              <span>{t("requestMaintenanceOrPurchase")}</span>
            </Link>
          </Button>
        </div>
      </Card>

      {/* Lista de Pasajeros de Hoy */}
      <Card className="p-5">
        <div className="flex items-center justify-between border-b border-linea pb-3">
          <h3 className="flex items-center gap-2 text-sm font-bold text-tinta">
            <Users className="size-4 text-marca-500" />
            {t("expectedPassengers")}
          </h3>
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-tinta-2">
              {t("passengerCount", { count: pasajeros.length })}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDialogoPasajeroAbierto(true)}
            >
              <UserPlus className="size-4" />
              {t("addPassenger")}
            </Button>
          </div>
        </div>

        {pasajeros.length === 0 ? (
          <p className="py-6 text-center text-xs text-tinta-3">
            {t("noPassengersEnrolled")}
          </p>
        ) : (
          <ul className="divide-y divide-linea">
            {pasajeros.map((p) => (
              <li key={p.id} className="flex items-center justify-between py-2.5 text-xs">
                <div>
                  <p className="font-semibold text-tinta">{p.nombre}</p>
                  <p className="text-tinta-2">
                    <MapPin className="inline size-3 mr-0.5 text-marca-500" />
                    {p.parada_abordaje_nombre} → {p.parada_destino_nombre}
                  </p>
                </div>
                <Badge variant={p.tipo === "recurrente" ? "marca" : "neutra"}>
                  {t(p.tipo === "recurrente" ? "recurring" : "singleDay")}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Anotar a quien no tiene internet: lo pidió por teléfono o en persona. */}
      <Dialog open={dialogoPasajeroAbierto} onOpenChange={setDialogoPasajeroAbierto}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("addPassenger")}</DialogTitle>
            <DialogDescription className="sr-only">
              {t("addPassenger")}
            </DialogDescription>
          </DialogHeader>
          <FormularioPuntual
            sinTarjeta
            conFecha
            hoy={hoy}
            horarios={horariosDisponibles}
            paradas={paradas}
            enviar={inscribirPasajeroAsistido}
            alTerminar={() => manejarCambioHorario(horarioSeleccionadoId)}
          />
        </DialogContent>
      </Dialog>

      {/* Diálogo Rápido de Reporte de Avería o Incidencia */}
      <Dialog
        open={dialogoIncidenciaAbierto}
        onOpenChange={setDialogoIncidenciaAbierto}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="size-5" />
              {t("reportIncidentTitle")}
            </DialogTitle>
            <DialogDescription>
              {t("reportIncidentDesc")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  ["averia_mecanica", t("incidentType.mechanical")],
                  ["transito_pesado", t("incidentType.traffic")],
                  ["desvio_ruta", t("incidentType.detour")],
                  ["accidente", t("incidentType.emergency")],
                ] as const
              ).map(([tipo, etiqueta]) => (
                <Button
                  key={tipo}
                  type="button"
                  variant={tipoIncidencia === tipo ? "default" : "outline"}
                  size="sm"
                  onClick={() => setTipoIncidencia(tipo)}
                  className="h-10 text-xs font-semibold"
                >
                  {etiqueta}
                </Button>
              ))}
            </div>

            <div className="space-y-1.5">
              <Label>
                {t("incidentDetailsLabel")}
              </Label>
              <Textarea
                rows={3}
                value={descripcionIncidencia}
                onChange={(e) => setDescripcionIncidencia(e.target.value)}
                placeholder={t("incidentDetailsPlaceholder")}
                className="text-xs"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDialogoIncidenciaAbierto(false)}
            >
              {t("cancel")}
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={manejarEnviarIncidencia}
              disabled={cargando || !descripcionIncidencia.trim()}
            >
              {t("sendIncidentAlert")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
