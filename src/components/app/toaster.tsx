"use client";

import { CheckCircle2, X } from "lucide-react";
import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

/**
 * Avisos breves (docs/ux-rules.md): «Expediente creado» con una acción «Ver», sin recargar
 * la página. Un proveedor en el layout raíz y `useToast()` donde se necesite. Se cierran
 * solos a los 6 s; el contenedor es `role="status"` para que un lector de pantalla los lea.
 */
type Aviso = {
  id: number;
  titulo: string;
  /** Un enlace («Ver») o una acción en el sitio («Deshacer»). */
  accion?: { etiqueta: string; href: string } | { etiqueta: string; alPulsar: () => void };
  /** Cuánto dura en pantalla; por defecto 6 s. «Deshacer» usa 5 s. */
  duracionMs?: number;
};

const Contexto = createContext<{ avisar: (a: Omit<Aviso, "id">) => void } | null>(null);

const DURACION_MS = 6000;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const t = useTranslations("appUi");
  const [avisos, setAvisos] = useState<Aviso[]>([]);

  const quitar = useCallback((id: number) => setAvisos((lista) => lista.filter((a) => a.id !== id)), []);
  const avisar = useCallback(
    (a: Omit<Aviso, "id">) => {
      const id = Date.now() + Math.random();

      setAvisos((lista) => [...lista.slice(-2), { ...a, id }]);
      setTimeout(() => quitar(id), a.duracionMs ?? DURACION_MS);
    },
    [quitar],
  );
  const valor = useMemo(() => ({ avisar }), [avisar]);

  return (
    <Contexto.Provider value={valor}>
      {children}
      <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4">
        {avisos.map((a) => (
          <div key={a.id} className="animate-escala-entrada pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-card border border-linea bg-tinta px-4 py-3 text-background shadow-elevada">
            <CheckCircle2 aria-hidden className="size-5 shrink-0" />
            <p className="text-label min-w-0 flex-1">{a.titulo}</p>
            {a.accion &&
              ("href" in a.accion ? (
                <Link href={a.accion.href} onClick={() => quitar(a.id)} className="text-label shrink-0 underline underline-offset-4 hover:no-underline">
                  {a.accion.etiqueta}
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    a.accion && "alPulsar" in a.accion && a.accion.alPulsar();
                    quitar(a.id);
                  }}
                  className="text-label shrink-0 underline underline-offset-4 hover:no-underline"
                >
                  {a.accion.etiqueta}
                </button>
              ))}
            <button type="button" aria-label={t("panel.close")} onClick={() => quitar(a.id)} className={cn("shrink-0 rounded-full p-1 transition-colors hover:bg-background/15 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none")}>
              <X className="size-4" />
            </button>
          </div>
        ))}
      </div>
    </Contexto.Provider>
  );
}

export function useToast() {
  const contexto = useContext(Contexto);

  if (!contexto) throw new Error("useToast necesita <ToastProvider> (está en el layout raíz).");

  return contexto.avisar;
}
