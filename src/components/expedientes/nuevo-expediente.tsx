"use client";

import { FileScan, Loader2, Plus, Save } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";

import { CampoFormulario } from "@/components/app/campo-formulario";
import { SidePanelForm } from "@/components/app/side-panel-form";
import { useToast } from "@/components/app/toaster";
import { Button } from "@/components/ui/button";
import { CLASE_SELECT } from "@/components/universidades/formularios";
import { useRouter } from "@/i18n/navigation";
import { ESTADOS_ESTUDIANTE } from "@/lib/expedientes";
import { crearExpediente, leerFichaEscaneada, type EstadoLectura } from "@/server/expedientes/acciones";

const ESTADO_INICIAL = "postulado";

/**
 * Alta de expediente en 30 segundos (docs/ux-rules.md §6–7): panel lateral con SOLO lo
 * mínimo —nombre, cédula, correo, teléfono, universidad y estado inicial— y nada de modos
 * «rápido/completo» ni «guiado». Lo demás (familia, vivienda, salud, situación) se completa
 * en la ficha, que es donde ya existe el expediente y su id.
 *
 * «Llenar desde documento» lee una cédula o una ficha con la IA y rellena lo que encuentre;
 * la persona revisa antes de guardar. Al guardar NO se cambia de página: aviso «Expediente
 * creado» con «Ver» y la fila nueva resaltada en la lista.
 */
export function NuevoExpediente({ universidades }: { universidades: readonly { id: string; siglas: string }[] }) {
  const t = useTranslations("listas.expedientes");
  const te = useTranslations("estados");
  const avisar = useToast();
  const router = useRouter();
  const entrada = useRef<HTMLInputElement>(null);
  const [abierto, setAbierto] = useState(false);
  const [nombre, setNombre] = useState("");
  const [cedula, setCedula] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [guardando, guardar] = useTransition();
  const [leyendo, leer] = useTransition();

  const reiniciar = () => {
    setNombre("");
    setCedula("");
    setError(null);
    setAviso(null);
  };

  function llenarDesdeDocumento(archivo: File | undefined) {
    if (!archivo) return;
    setError(null);
    setAviso(null);
    leer(async () => {
      const datos = new FormData();

      datos.set("documento", archivo);

      const r: EstadoLectura = await leerFichaEscaneada({ estado: "inicial" }, datos);

      if (r.estado === "ok") {
        if (r.nombre) setNombre(r.nombre);
        if (r.cedula) setCedula(r.cedula);
        setAviso(t("revisaLeido"));
      } else {
        setError(t(`lectura.${r.estado}` as never));
      }
      if (entrada.current) entrada.current.value = "";
    });
  }

  function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const datos = new FormData(e.currentTarget);

    datos.set("sin_redirigir", "1");
    setError(null);
    guardar(async () => {
      const r = await crearExpediente({ estado: "inicial" }, datos);

      if (r.estado !== "ok" || !r.id) {
        setError(t(`errores.${r.estado}` as never));

        return;
      }
      setAbierto(false);
      reiniciar();
      avisar({ titulo: t("creado"), accion: { etiqueta: t("ver"), href: `/expedientes/${r.id}` } });
      // Navegación suave a la lista sin filtros, con la fila nueva resaltada: no se recarga la página.
      router.replace(`/expedientes?nuevo=${r.id}`);
    });
  }

  return (
    <>
      <Button onClick={() => setAbierto(true)}>
        <Plus className="size-4" />
        {t("nuevo")}
      </Button>

      <SidePanelForm
        open={abierto}
        onOpenChange={(v) => {
          setAbierto(v);
          if (!v) reiniciar();
        }}
        title={t("titulo")}
        submitLabel={t("guardar")}
        submitIcon={<Save className="size-4" />}
        pending={guardando}
        onSubmit={enviar}
      >
        <div className="space-y-2">
          <input ref={entrada} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" hidden onChange={(e) => llenarDesdeDocumento(e.target.files?.[0])} />
          <Button type="button" variant="outline" size="sm" onClick={() => entrada.current?.click()} disabled={leyendo}>
            {leyendo ? <Loader2 className="animate-spin" /> : <FileScan />}
            {leyendo ? t("leyendo") : t("llenarDesdeDocumento")}
          </Button>
          {aviso && <p className="text-meta" role="status">{aviso}</p>}
        </div>

        <CampoFormulario etiqueta={t("nombre")} name="nombre" placeholder={t("ejNombre")} requerido value={nombre} onChange={setNombre} validar={(v) => (v ? null : t("validacion.nombre"))} />
        <CampoFormulario
          etiqueta={t("cedula")}
          name="cedula"
          placeholder="000-0000000-0"
          inputMode="numeric"
          mono
          value={cedula}
          onChange={setCedula}
          validar={(v) => (!v || v.replace(/\D/g, "").length === 11 ? null : t("validacion.cedula"))}
        />
        <CampoFormulario etiqueta={t("correo")} name="email" type="email" inputMode="email" placeholder="nombre@correo.com" validar={(v) => (!v || /^\S+@\S+\.\S+$/.test(v) ? null : t("validacion.correo"))} />
        <CampoFormulario etiqueta={t("telefono")} name="telefono" type="tel" inputMode="tel" placeholder="809-555-0000" />

        <div className="space-y-1.5">
          <label htmlFor="nuevo-universidad" className="text-label text-tinta">{t("universidad")}</label>
          <select id="nuevo-universidad" name="universidad_id" defaultValue="" className={CLASE_SELECT}>
            <option value="">{t("sinUniversidad")}</option>
            {universidades.map((u) => (
              <option key={u.id} value={u.id}>{u.siglas}</option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="nuevo-estado" className="text-label text-tinta">{t("estadoInicial")}</label>
          <select id="nuevo-estado" name="estado" defaultValue={ESTADO_INICIAL} className={CLASE_SELECT}>
            {ESTADOS_ESTUDIANTE.map((e) => (
              <option key={e} value={e}>{te(e)}</option>
            ))}
          </select>
        </div>

        {error && (
          <p role="alert" className="text-label rounded-control border border-status-danger-border bg-status-danger-bg px-3 py-2 text-status-danger-fg">
            {error}
          </p>
        )}
      </SidePanelForm>
    </>
  );
}
