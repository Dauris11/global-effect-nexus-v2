"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { elegirVoz, idiomaDeVoz, limpiarParaVoz, trocearParaVoz } from "@/lib/voz";

/**
 * Voz de Elly AI en el navegador: dictar (voz → texto) y hablar (texto → voz).
 *
 * Todo va por la Web Speech API, sin clave ni servidor propio. Cada pieza
 * descubre su soporte en un efecto y no al renderizar: en el servidor `window`
 * no existe y un valor distinto en cliente y servidor rompe la hidratación.
 *
 * Aviso para la política de datos: lo que se dicta lo procesa el servicio de
 * voz del navegador (en Chrome, el de Google). El texto resultante entra al chat
 * como cualquier otra pregunta, con las mismas revisiones.
 */

// ── Tipos mínimos de SpeechRecognition (no están en lib.dom de TypeScript) ─────

type ResultadoVoz = { isFinal: boolean; 0: { transcript: string } };

interface EventoReconocimiento extends Event {
  results: { length: number; [i: number]: ResultadoVoz };
}

interface Reconocimiento extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: EventoReconocimiento) => void) | null;
  onerror: ((e: Event & { error?: string }) => void) | null;
  onend: (() => void) | null;
}

type ConstructorReconocimiento = new () => Reconocimiento;

function constructor(): ConstructorReconocimiento | null {
  if (typeof window === "undefined") return null;

  const w = window as unknown as {
    SpeechRecognition?: ConstructorReconocimiento;
    webkitSpeechRecognition?: ConstructorReconocimiento;
  };

  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

// ── Dictado ───────────────────────────────────────────────────────────────────

export type ErrorDictado = "permiso" | "sin_voz" | "otro" | null;

export function useDictado({
  idioma,
  alParcial,
  alFinal,
}: {
  idioma: "es" | "en";
  /** Lo que se va entendiendo mientras la persona habla. */
  alParcial?: (texto: string) => void;
  /** La frase completa, cuando termina. */
  alFinal: (texto: string) => void;
}) {
  const [soporta, setSoporta] = useState(false);
  const [escuchando, setEscuchando] = useState(false);
  const [error, setError] = useState<ErrorDictado>(null);
  const motor = useRef<Reconocimiento | null>(null);

  // Las funciones de quien usa el hook cambian en cada render; el motor guarda
  // la última versión en una referencia para no recrearse con cada una.
  const funciones = useRef({ alParcial, alFinal });

  useEffect(() => {
    funciones.current = { alParcial, alFinal };
  });

  useEffect(() => {
    // Soporte del navegador: solo se puede saber en el cliente.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSoporta(constructor() !== null);

    return () => motor.current?.abort();
  }, []);

  const iniciar = useCallback(() => {
    const Clase = constructor();

    if (!Clase) return;

    setError(null);
    motor.current?.abort();

    const reconocimiento = new Clase();

    reconocimiento.continuous = false;
    reconocimiento.interimResults = true;
    reconocimiento.lang = idiomaDeVoz(idioma);

    reconocimiento.onresult = (e) => {
      let texto = "";
      let final = false;

      for (let i = 0; i < e.results.length; i++) {
        texto += e.results[i][0].transcript;
        final ||= e.results[i].isFinal;
      }

      texto = texto.trim();

      if (!texto) return;

      funciones.current.alParcial?.(texto);

      if (final) funciones.current.alFinal(texto);
    };

    reconocimiento.onerror = (e) => {
      setEscuchando(false);
      setError(
        e.error === "not-allowed" || e.error === "service-not-allowed"
          ? "permiso"
          : e.error === "no-speech"
            ? "sin_voz"
            : "otro",
      );
    };

    reconocimiento.onend = () => setEscuchando(false);

    motor.current = reconocimiento;

    try {
      reconocimiento.start();
      setEscuchando(true);
    } catch {
      setEscuchando(false);
    }
  }, [idioma]);

  const detener = useCallback(() => {
    motor.current?.stop();
    setEscuchando(false);
  }, []);

  return { soporta, escuchando, error, iniciar, detener };
}

// ── Habla ─────────────────────────────────────────────────────────────────────

export function useHabla(idioma: "es" | "en") {
  const [soporta, setSoporta] = useState(false);
  const [hablando, setHablando] = useState(false);
  const voz = useRef<SpeechSynthesisVoice | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

    const sintesis = window.speechSynthesis;
    const elegir = () => {
      voz.current = elegirVoz(sintesis.getVoices(), idioma);
    };

    // Soporte del navegador: solo se puede saber en el cliente.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSoporta(true);
    elegir();
    // Las voces del sistema llegan de forma asíncrona en Chrome.
    sintesis.addEventListener("voiceschanged", elegir);

    return () => {
      sintesis.removeEventListener("voiceschanged", elegir);
      sintesis.cancel();
    };
  }, [idioma]);

  const parar = useCallback(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

    window.speechSynthesis.cancel();
    setHablando(false);
  }, []);

  const hablar = useCallback(
    (texto: string) => {
      if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

      const trozos = trocearParaVoz(limpiarParaVoz(texto));

      // `cancel` antes de encolar: pedir otra lectura corta la anterior, no se apilan.
      window.speechSynthesis.cancel();

      if (trozos.length === 0) {
        setHablando(false);

        return;
      }

      setHablando(true);

      trozos.forEach((trozo, i) => {
        const locucion = new SpeechSynthesisUtterance(trozo);

        locucion.lang = voz.current?.lang ?? idiomaDeVoz(idioma);
        if (voz.current) locucion.voice = voz.current;
        locucion.rate = 1;

        if (i === trozos.length - 1) {
          locucion.onend = () => setHablando(false);
          locucion.onerror = () => setHablando(false);
        }

        window.speechSynthesis.speak(locucion);
      });
    },
    [idioma],
  );

  return { soporta, hablando, hablar, parar };
}

// ── Modo conversación por voz ─────────────────────────────────────────────────

const CLAVE = "elly.modoVoz";

/**
 * «Conversación por voz»: lo que se dicta se envía solo al terminar y la
 * respuesta se lee en voz alta. Se recuerda en el navegador (preferencia de
 * quien lo usa); si el almacenamiento está bloqueado, funciona igual sin recordar.
 */
export function useModoVoz(): [boolean, (valor: boolean) => void] {
  const [activo, setActivo] = useState(false);

  useEffect(() => {
    try {
      // Lectura de una preferencia local: no existe en el servidor.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActivo(window.localStorage.getItem(CLAVE) === "1");
    } catch {
      /* almacenamiento bloqueado: se queda apagado */
    }
  }, []);

  const cambiar = useCallback((valor: boolean) => {
    setActivo(valor);

    try {
      window.localStorage.setItem(CLAVE, valor ? "1" : "0");
    } catch {
      /* sin almacenamiento: no se recuerda */
    }
  }, []);

  return [activo, cambiar];
}
