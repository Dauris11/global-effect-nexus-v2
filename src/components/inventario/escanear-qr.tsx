"use client";

import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import {
  AlertCircle,
  Camera,
  CheckCircle2,
  ChevronRight,
  FlipHorizontal,
  Loader2,
  Package,
  QrCode,
  RefreshCw,
  Search,
  Upload,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import type { ActivoInventario } from "@/lib/inventario";
import {
  buscarActivoPorCodigoAction,
  registrarAuditoriaQrAction,
} from "@/server/inventario/acciones";

export function EscanearQrActivo() {
  const [iniciado, setIniciado] = useState(false);
  const [cargandoCamara, setCargandoCamara] = useState(false);
  const [errorCamara, setErrorCamara] = useState<string | null>(null);
  const [camaraTrasera, setCamaraTrasera] = useState(true);

  // Resultado del escaneo
  const [codigoDetectado, setCodigoDetectado] = useState<string | null>(null);
  const [buscandoActivo, setBuscandoActivo] = useState(false);
  const [activoEncontrado, setActivoEncontrado] = useState<ActivoInventario | null>(null);
  const [auditoriaRegistrada, setAuditoriaRegistrada] = useState(false);
  const [registrandoAuditoria, setRegistrandoAuditoria] = useState(false);

  // Entrada manual de código
  const [codigoManual, setCodigoManual] = useState("");

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const procesarCodigo = async (texto: string) => {
    try {
      // Si el texto es JSON, extraer el campo codigo
      let codigoLimpio = texto.trim();
      if (texto.startsWith("{") && texto.endsWith("}")) {
        try {
          const parsed = JSON.parse(texto);
          if (parsed.codigo) codigoLimpio = parsed.codigo;
        } catch {
          // Mantener texto original
        }
      }

      setCodigoDetectado(codigoLimpio);
      setBuscandoActivo(true);
      setErrorCamara(null);

      // Vibración táctil si el dispositivo lo soporta
      if (typeof window !== "undefined" && "vibrate" in navigator) {
        navigator.vibrate([100, 50, 100]);
      }

      // Detener escáner mientras se procesa
      if (scannerRef.current && scannerRef.current.isScanning) {
        await scannerRef.current.stop();
        setIniciado(false);
      }

      const activo = await buscarActivoPorCodigoAction(codigoLimpio);
      if (activo) {
        setActivoEncontrado(activo);
      } else {
        setErrorCamara(`Código "${codigoLimpio}" no coincide con ningún activo registrado.`);
      }
    } catch (err) {
      console.error("Error al buscar activo:", err);
      setErrorCamara("Error al consultar la base de datos.");
    } finally {
      setBuscandoActivo(false);
    }
  };

  const iniciarCamara = async () => {
    try {
      setErrorCamara(null);
      setCargandoCamara(true);

      const html5QrCode = new Html5Qrcode("lector-qr-camara");
      scannerRef.current = html5QrCode;

      const config = {
        fps: 15,
        qrbox: { width: 260, height: 260 },
        aspectRatio: 1.0,
      };

      await html5QrCode.start(
        { facingMode: camaraTrasera ? "environment" : "user" },
        config,
        (decodedText) => {
          void procesarCodigo(decodedText);
        },
        () => {
          // Ignorar cuadros sin QR
        }
      );

      setIniciado(true);
    } catch (err) {
      console.error("Error al iniciar cámara:", err);
      setErrorCamara(
        "No se pudo acceder a la cámara. Comprueba los permisos o ingresa el código manualmente."
      );
    } finally {
      setCargandoCamara(false);
    }
  };

  const detenerCamara = async () => {
    if (scannerRef.current && scannerRef.current.isScanning) {
      try {
        await scannerRef.current.stop();
        setIniciado(false);
      } catch (err) {
        console.error("Error al detener cámara:", err);
      }
    }
  };

  const alternarCamara = async () => {
    await detenerCamara();
    setCamaraTrasera((prev) => !prev);
  };

  useEffect(() => {
    return () => {
      if (scannerRef.current && scannerRef.current.isScanning) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, []);

  const reiniciarEscaneo = () => {
    setCodigoDetectado(null);
    setActivoEncontrado(null);
    setAuditoriaRegistrada(false);
    setErrorCamara(null);
    void iniciarCamara();
  };

  const confirmarAuditoriaInSitu = async () => {
    if (!activoEncontrado) return;
    try {
      setRegistrandoAuditoria(true);
      await registrarAuditoriaQrAction(
        activoEncontrado.codigo,
        `Auditoría confirmada in situ en ${activoEncontrado.ubicacion}`
      );
      setAuditoriaRegistrada(true);
    } catch (err) {
      console.error("Error al registrar auditoría:", err);
      setErrorCamara("Error al registrar la auditoría in situ.");
    } finally {
      setRegistrandoAuditoria(false);
    }
  };

  const escanearDesdeArchivo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setCargandoCamara(true);
      setErrorCamara(null);
      const html5QrCode = new Html5Qrcode("lector-qr-camara");
      const result = await html5QrCode.scanFile(file, true);
      await procesarCodigo(result);
    } catch (err) {
      console.error("Error al escanear archivo:", err);
      setErrorCamara("No se detectó ningún código QR legible en la imagen seleccionada.");
    } finally {
      setCargandoCamara(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Visor de la cámara / Escáner */}
      <div className="relative mx-auto w-full max-w-md overflow-hidden rounded-2xl border-2 border-linea bg-black shadow-lg">
        {/* Contenedor del video HTML5 */}
        <div id="lector-qr-camara" className="aspect-square w-full" />

        {/* Guía visual sobrepuesta cuando está activo */}
        {iniciado && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="size-64 rounded-2xl border-2 border-dashed border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]">
              <div className="flex h-full items-center justify-center">
                <span className="rounded bg-black/60 px-2 py-1 text-xs font-semibold text-white">
                  Apunta al código QR
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Estado previo a iniciar */}
        {!iniciado && !activoEncontrado && !cargandoCamara && (
          <div className="flex aspect-square w-full flex-col items-center justify-center gap-4 bg-muted/30 p-6 text-center">
            <div className="flex size-16 items-center justify-center rounded-2xl bg-marca-50 text-marca-600">
              <Camera className="size-8" />
            </div>
            <div>
              <p className="font-semibold text-tinta">Escáner de Activos Físicos</p>
              <p className="mt-1 text-xs text-tinta-2">
                Utiliza la cámara trasera para auditar herramientas, computadoras o mobiliario
              </p>
            </div>
            <Button onClick={iniciarCamara} className="flex items-center gap-2">
              <Camera className="size-4" />
              <span>Activar Cámara</span>
            </Button>
          </div>
        )}

        {cargandoCamara && (
          <div className="flex aspect-square w-full flex-col items-center justify-center gap-2 bg-black/70 text-white">
            <Loader2 className="size-8 animate-spin text-marca-400" />
            <p className="text-sm font-medium">Iniciando cámara...</p>
          </div>
        )}

        {/* Controles de cámara flotantes */}
        {iniciado && (
          <div className="absolute right-3 bottom-3 left-3 flex items-center justify-between gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={alternarCamara}
              className="bg-black/60 text-white backdrop-blur hover:bg-black/80 hover:text-white"
            >
              <FlipHorizontal className="size-4" />
              <span className="text-xs">Girar Cámara</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={detenerCamara}
              className="bg-black/60 text-white backdrop-blur hover:bg-black/80 hover:text-white"
            >
              <span className="text-xs">Detener</span>
            </Button>
          </div>
        )}
      </div>

      {/* Botón de subida de imagen de galería alternativa */}
      <div className="mx-auto flex w-full max-w-md items-center justify-center gap-3">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={escanearDesdeArchivo}
        />
        <Button
          type="button"
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          className="flex flex-1 items-center justify-center gap-2 text-xs"
        >
          <Upload className="size-4" />
          <span>Subir Foto de QR</span>
        </Button>
      </div>

      {/* Mensaje de error si ocurre */}
      {errorCamara && (
        <div className="mx-auto flex w-full max-w-md items-center gap-2 rounded-xl border border-linea-fuerte bg-muted p-4 text-xs font-medium text-tinta">
          <AlertCircle className="size-4 shrink-0 text-tinta" />
          <span>{errorCamara}</span>
        </div>
      )}

      {/* Activo Encontrado */}
      {activoEncontrado && (
        <div className="mx-auto w-full max-w-md animate-in fade-in slide-in-from-bottom-4 rounded-2xl border-2 border-marca-500 bg-card p-5 shadow-md">
          <div className="flex items-start justify-between gap-3 border-b border-linea pb-3">
            <div>
              <span className="inline-flex items-center rounded-md bg-marca-50 px-2 py-0.5 text-xs font-bold text-marca-700 uppercase">
                {activoEncontrado.categoria}
              </span>
              <h3 className="mt-1 font-mono text-lg font-extrabold text-tinta">
                {activoEncontrado.codigo}
              </h3>
              <p className="font-semibold text-tinta">{activoEncontrado.nombre}</p>
            </div>
            {activoEncontrado.fotoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={activoEncontrado.fotoUrl}
                alt={activoEncontrado.nombre}
                className="size-16 rounded-xl border border-linea object-cover"
              />
            )}
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-tinta-2">
            <div>
              <p className="font-semibold text-tinta">Ubicación:</p>
              <p>{activoEncontrado.ubicacion}</p>
            </div>
            <div>
              <p className="font-semibold text-tinta">Custodio:</p>
              <p>{activoEncontrado.responsableNombre ?? "Sin asignar"}</p>
            </div>
            <div>
              <p className="font-semibold text-tinta">Estado Físico:</p>
              <span className="font-semibold text-marca-700 capitalize">
                {activoEncontrado.estado}
              </span>
            </div>
            {activoEncontrado.numeroSerie && (
              <div>
                <p className="font-semibold text-tinta">Serie:</p>
                <p>{activoEncontrado.numeroSerie}</p>
              </div>
            )}
          </div>

          {/* Acciones para el activo auditado */}
          <div className="mt-5 flex flex-col gap-2">
            {!auditoriaRegistrada ? (
              <Button
                onClick={confirmarAuditoriaInSitu}
                disabled={registrandoAuditoria}
                className="flex w-full items-center justify-center gap-2 bg-marca-600 hover:bg-marca-700"
              >
                {registrandoAuditoria ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="size-4" />
                )}
                <span>Registrar Auditoría In Situ</span>
              </Button>
            ) : (
              <div className="flex items-center justify-center gap-2 rounded-xl border border-transparent bg-[#1E9E6A]/10 p-3 text-xs font-bold text-[#1E9E6A]">
                <CheckCircle2 className="size-4" />
                <span>¡Auditoría in situ registrada con éxito!</span>
              </div>
            )}

            <div className="flex items-center gap-2">
              <Link
                href={`/administrativo/inventario/${activoEncontrado.id}`}
                className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-linea py-2 text-xs font-semibold text-tinta transition-colors hover:bg-muted"
              >
                <span>Ver Ficha Completa</span>
                <ChevronRight className="size-4" />
              </Link>
              <Button
                variant="outline"
                onClick={reiniciarEscaneo}
                className="flex items-center gap-1 text-xs"
              >
                <RefreshCw className="size-4" />
                <span>Siguiente</span>
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Entrada manual de código como respaldo */}
      <div className="mx-auto w-full max-w-md rounded-2xl border border-linea bg-card p-4">
        <p className="text-xs font-semibold text-tinta-2">¿Problemas con la cámara? Entrada manual:</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (codigoManual.trim()) void procesarCodigo(codigoManual);
          }}
          className="mt-2 flex items-center gap-2"
        >
          <div className="relative flex-1">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-tinta-3" />
            <input
              type="text"
              value={codigoManual}
              onChange={(e) => setCodigoManual(e.target.value)}
              placeholder="Ej: ACT-0001"
              className="w-full rounded-xl border border-linea bg-background py-2 pr-3 pl-9 text-xs font-mono uppercase outline-none focus:border-marca-500"
            />
          </div>
          <Button type="submit" size="sm" disabled={buscandoActivo}>
            {buscandoActivo ? <Loader2 className="size-4 animate-spin" /> : "Buscar"}
          </Button>
        </form>
      </div>
    </div>
  );
}
