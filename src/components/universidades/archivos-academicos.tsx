"use client";

import { useActionState } from "react";
import { AlertCircle, CheckCircle2, FileText, Loader2, Trash2, Upload } from "lucide-react";
import { useTranslations } from "next-intl";

import { CLASE_SELECT } from "@/components/universidades/formularios";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ALERTA_RIESGO } from "@/lib/paleta";
import {
  quitarArchivoAcademico,
  subirArchivoAcademico,
  type EstadoArchivo,
} from "@/server/universidades/archivos";
import type { ArchivoAcademico } from "@/server/universidades/consultas";

const INICIAL: EstadoArchivo = { estado: "inicial" };

/**
 * Lista de PDF de un estudiante («gradua», récord de notas) o de un pénsum, con
 * descarga y, si se puede, subida y borrado. Los permisos los vuelve a comprobar
 * el servidor; `puedeEscribir` solo decide si se pintan los controles.
 */
export function ArchivosAcademicos({
  destino,
  id,
  archivos,
  tipos,
  puedeEscribir,
}: {
  destino: "estudiante" | "pensum";
  id: string;
  archivos: ArchivoAcademico[];
  /** Tipos que se pueden subir aquí. */
  tipos: readonly ArchivoAcademico["tipo"][];
  puedeEscribir: boolean;
}) {
  const t = useTranslations("catalog");
  const [estado, enviar, enviando] = useActionState<EstadoArchivo, FormData>(subirArchivoAcademico, INICIAL);

  return (
    <div className="space-y-4">
      {archivos.length === 0 ? (
        <p className="texto-meta">{t("files.none")}</p>
      ) : (
        <ul className="divide-y divide-linea rounded-card border border-linea">
          {archivos.map((a) => (
            <li key={a.id} className="flex items-center gap-3 p-3">
              <FileText className="size-5 shrink-0 text-tinta-3" />
              <div className="min-w-0 flex-1">
                <a href={`/api/archivos-academicos/${a.id}`} target="_blank" rel="noopener noreferrer"
                  className="block truncate text-sm font-medium text-marca-700 hover:underline">
                  {t(`files.type.${a.tipo}`)} · {a.nombre}
                </a>
                <p className="texto-meta">
                  {t("files.uploaded", { name: a.subido_por_nombre ?? "—", date: a.created_at.slice(0, 10) })}
                </p>
              </div>
              {puedeEscribir && <BotonQuitar id={a.id} />}
            </li>
          ))}
        </ul>
      )}

      {puedeEscribir && (
        <form action={enviar} className="space-y-3 rounded-card border border-linea bg-card p-4">
          <input type="hidden" name="destino" value={destino} />
          <input type="hidden" name="id" value={id} />
          {destino === "estudiante" && (
            <div className="space-y-1.5">
              <Label htmlFor={`arch-tipo-${id}`}>{t("files.typeLabel")}</Label>
              <select id={`arch-tipo-${id}`} name="tipo" className={CLASE_SELECT} defaultValue={tipos[0]}>
                {tipos.map((x) => <option key={x} value={x}>{t(`files.type.${x}`)}</option>)}
              </select>
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor={`arch-file-${id}`}>{t("files.file")}</Label>
            <input id={`arch-file-${id}`} name="archivo" type="file" accept="application/pdf" required
              className="block w-full text-sm file:mr-3 file:rounded-control file:border file:border-linea-fuerte file:bg-background file:px-3 file:py-2 file:text-sm file:font-medium" />
            <p className="texto-meta">{t("files.help")}</p>
          </div>
          {estado.estado !== "inicial" && estado.estado !== "ok" && (
            <p role="alert" className={ALERTA_RIESGO.contenedor}>
              <AlertCircle className={ALERTA_RIESGO.icono} />
              <span className={ALERTA_RIESGO.texto}>{t(`files.errors.${estado.estado}`, { university: estado.universidad ?? "" })}</span>
            </p>
          )}
          {estado.estado === "ok" && (
            <p role="status" className="flex items-start gap-2 text-sm font-medium">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-marca-700" />
              {estado.lectura
                ? t("files.read", {
                    rows: estado.lectura.filas,
                    pending: estado.lectura.noCursadas,
                    index: estado.lectura.indiceReportado != null ? ` · ${estado.lectura.indiceReportado.toFixed(2)}` : "",
                  })
                : t("files.done")}
            </p>
          )}
          {estado.estado === "ok" && estado.lectura && estado.lectura.avisos.length > 0 && (
            <ul className="space-y-1 text-sm">
              {estado.lectura.avisos.map((a) => (
                <li key={a} className="flex items-start gap-2">
                  <AlertCircle className="mt-0.5 size-4 shrink-0 text-tinta-3" />
                  {t(`files.warnings.${a}`)}
                </li>
              ))}
            </ul>
          )}
          <Button type="submit" size="sm" cargando={enviando}>
            {enviando ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
            {t("files.upload")}
          </Button>
        </form>
      )}
    </div>
  );
}

function BotonQuitar({ id }: { id: string }) {
  const t = useTranslations("catalog");
  const [, enviar, enviando] = useActionState<EstadoArchivo, FormData>(quitarArchivoAcademico, INICIAL);

  return (
    <form action={enviar}>
      <input type="hidden" name="id" value={id} />
      <Button type="submit" variant="ghost" size="sm" cargando={enviando} aria-label={t("files.remove")}>
        {enviando ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
      </Button>
    </form>
  );
}
