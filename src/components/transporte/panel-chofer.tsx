"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { AlertCircle } from "lucide-react";
import { useTranslations } from "next-intl";

import { CabeceraChofer } from "@/components/transporte/cabecera-chofer";
import { DialogoIncidenciaChofer } from "@/components/transporte/dialogo-incidencia-chofer";
import { PasajerosChofer } from "@/components/transporte/pasajeros-chofer";
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
  cargarPasajerosHorario,
  finalizarViaje,
  iniciarViaje,
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
  const [errorAccion, setErrorAccion] = useState<string | null>(null);
  const mensajeError = (codigo?: string) =>
    codigo === "viaje_no_encontrado" ? t("tripNotFoundError") : t("actionError");

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
      return;
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setErrorGps(null);
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const rumbo = pos.coords.heading ?? 0;
        const velocidad = (pos.coords.speed ?? 0) * 3.6;

        setPosicionGps({ lat, lng, rumbo, velocidad });

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

  // Screen Wake Lock API: mantiene la pantalla encendida durante el viaje
  useEffect(() => {
    if (!viajeActivo || viajeActivo.estado !== "en_curso") return;
    if (typeof window === "undefined" || !("wakeLock" in navigator)) return;

    let bloqueo: WakeLockSentinel | null = null;
    let cancelado = false;

    async function solicitarBloqueo() {
      try {
        if (
          !cancelado &&
          "wakeLock" in navigator &&
          document.visibilityState === "visible"
        ) {
          bloqueo = await navigator.wakeLock.request("screen");
        }
      } catch {
        // Ahorro de batería o permisos restringidos no bloquean la cabina
      }
    }

    solicitarBloqueo();

    const alCambiarVisibilidad = () => {
      if (
        document.visibilityState === "visible" &&
        (!bloqueo || bloqueo.released)
      ) {
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

  const manejarCambioHorario = (id: string) => {
    setHorarioSeleccionadoId(id);
    iniciarTransicion(async () => {
      const res = await cargarPasajerosHorario(id);
      if (res.ok) {
        setPasajeros(res.pasajeros);
      }
    });
  };

  const manejarIniciarViaje = () => {
    if (!horarioSeleccionadoId) return;
    setErrorAccion(null);

    iniciarTransicion(async () => {
      const res = await iniciarViaje({
        horarioId: horarioSeleccionadoId,
        lat: posicionGps?.lat,
        lng: posicionGps?.lng,
      });

      if (res.ok && res.viajeId) {
        const horarioViaje = res.horarioId ?? horarioSeleccionadoId;
        const horario = horariosDisponibles.find((h) => h.id === horarioViaje);
        if (horarioViaje !== horarioSeleccionadoId) {
          manejarCambioHorario(horarioViaje);
        }
        setViajeActivo({
          id: res.viajeId,
          horario_id: horarioViaje,
          horario_nombre: horario?.nombre ?? "",
          hora_salida: horario?.hora_salida ?? "",
          chofer_id: "",
          chofer_nombre: "",
          fecha: hoy,
          estado: "en_curso",
          lat_actual: posicionGps?.lat ?? null,
          lng_actual: posicionGps?.lng ?? null,
          rumbo: posicionGps?.rumbo ?? 0,
          velocidad_kmh: posicionGps?.velocidad ?? 0,
          parada_actual_id: null,
          iniciado_en: new Date().toISOString(),
          finalizado_en: null,
        });
      } else {
        setErrorAccion(mensajeError(res.mensaje));
      }
    });
  };

  const manejarFinalizarViaje = () => {
    if (!viajeActivo) return;

    setErrorAccion(null);
    iniciarTransicion(async () => {
      const res = await finalizarViaje({ viajeId: viajeActivo.id });
      if (res.ok || res.mensaje === "viaje_no_encontrado") {
        setViajeActivo(null);
      } else {
        setErrorAccion(mensajeError(res.mensaje));
      }
    });
  };

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
          setViajeActivo((prev) =>
            prev ? { ...prev, estado: "averiado" } : null,
          );
        }
      } else {
        setErrorAccion(mensajeError(res.mensaje));
        setDialogoIncidenciaAbierto(false);
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
      const res = await actualizarParadaViaje({
        viajeId: viajeActivo.id,
        paradaId,
      });
      if (!res.ok) setErrorAccion(mensajeError(res.mensaje));
    });
  };

  return (
    <div className="mx-auto max-w-xl space-y-6">
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

      {errorAccion && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-card bg-tinta p-4 text-sm text-background"
        >
          <AlertCircle className="mt-0.5 size-5 shrink-0" />
          <p>{errorAccion}</p>
        </div>
      )}

      <CabeceraChofer
        viajeActivo={viajeActivo}
        horarioSeleccionadoId={horarioSeleccionadoId}
        horariosDisponibles={horariosDisponibles}
        paradas={paradas}
        posicionGps={posicionGps}
        cargando={cargando}
        alCambiarHorario={manejarCambioHorario}
        alCambiarParadaManual={manejarCambioParadaManual}
        alIniciarViaje={manejarIniciarViaje}
        alFinalizarViaje={manejarFinalizarViaje}
        alAbrirIncidencia={() => setDialogoIncidenciaAbierto(true)}
      />

      <PasajerosChofer
        pasajeros={pasajeros}
        hoy={hoy}
        horariosDisponibles={horariosDisponibles}
        paradas={paradas}
        dialogoAbierto={dialogoPasajeroAbierto}
        alCambiarDialogo={setDialogoPasajeroAbierto}
        alRecargarPasajeros={() => manejarCambioHorario(horarioSeleccionadoId)}
      />

      <DialogoIncidenciaChofer
        abierto={dialogoIncidenciaAbierto}
        tipoIncidencia={tipoIncidencia}
        descripcionIncidencia={descripcionIncidencia}
        cargando={cargando}
        alCambiarAbierto={setDialogoIncidenciaAbierto}
        alCambiarTipo={setTipoIncidencia}
        alCambiarDescripcion={setDescripcionIncidencia}
        alEnviar={manejarEnviarIncidencia}
      />
    </div>
  );
}
