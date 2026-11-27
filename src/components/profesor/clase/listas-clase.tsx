"use client";

import { useState, useTransition } from "react";
import { Check, ClipboardCheck, FileText, Paperclip, X } from "lucide-react";
import { useTranslations } from "next-intl";

import { StatusBadge } from "@/components/app/status-badge";
import { useToast } from "@/components/app/toaster";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link, useRouter } from "@/i18n/navigation";
import type { EstudianteDeClase, PublicacionDeClase, SesionDeClase } from "@/lib/clase-docente";
import type { OrigenClase } from "@/lib/clases";
import { NOTA_APROBADA } from "@/lib/notas";
import { calificarInscripcion360, calificarInscripcionMateria } from "@/server/profesor/acciones";

const CAJA = "divide-y divide-linea overflow-hidden rounded-card border border-linea bg-card";

export function ListaEstudiantes({ estudiantes }: { estudiantes: readonly EstudianteDeClase[] }) {
  const t = useTranslations("teacherClasses");

  return (
    <ul className={CAJA}>
      {estudiantes.map((e) => (
        <li key={e.inscripcionId} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
          <span className="text-body min-w-0 truncate font-medium">{e.nombre}</span>
          <span className="text-meta flex items-center gap-3 tabular-nums">
            {e.tareas > 0 && <span>{t("students.delivered", { n: e.entregadas, total: e.tareas })}</span>}
            {e.asistencia !== null && <span>{t("students.attendance", { n: e.asistencia })}</span>}
            <StatusBadge status={e.estado === "aprobada" || e.estado === "reprobada" ? e.estado : "activa"} />
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Tareas (con su contador de pendientes y el salto a calificar) o material y anuncios. */
export function ListaPublicaciones({
  publicaciones,
  evaluables,
}: {
  publicaciones: readonly PublicacionDeClase[];
  evaluables: boolean;
}) {
  const t = useTranslations("teacherClasses");
  const lista = publicaciones.filter((p) => (p.tipo === "tarea" || p.tipo === "examen") === evaluables);

  return (
    <ul className={CAJA}>
      {lista.map((p) => (
        <li key={p.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
          {evaluables ? (
            <ClipboardCheck aria-hidden className="size-5 shrink-0 text-tinta-2" />
          ) : p.tipo === "material" ? (
            <Paperclip aria-hidden className="size-5 shrink-0 text-tinta-2" />
          ) : (
            <FileText aria-hidden className="size-5 shrink-0 text-tinta-2" />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-body truncate font-medium">{p.titulo}</p>
            {evaluables && (
              <p className="text-meta">
                {[p.vence ? t("tasks.dueOn", { fecha: p.vence }) : t("tasks.noDue"), t("tasks.deliveries", { n: p.entregas })].join(" · ")}
              </p>
            )}
          </div>
          {evaluables && p.sinCalificar > 0 && (
            <>
              <StatusBadge status="pendiente" label={t("tasks.toGrade", { n: p.sinCalificar })} />
              <Button asChild size="sm">
                <Link href={`/portal/profesor/entregas?tarea=${p.id}`}>{t("tasks.grade")}</Link>
              </Button>
            </>
          )}
          {p.enlace && (
            <a href={p.enlace} target="_blank" rel="noreferrer" className="text-label inline-flex min-h-11 items-center text-marca-600 hover:underline">
              {t("material.open")}
            </a>
          )}
        </li>
      ))}
    </ul>
  );
}

export function ListaSesiones({ sesiones }: { sesiones: readonly SesionDeClase[] }) {
  const t = useTranslations("teacherClasses");

  return (
    <ul className={CAJA}>
      {sesiones.map((s) => (
        <li key={s.id} className="flex items-center justify-between gap-3 px-4 py-3">
          <span className="text-body font-medium">{s.fecha}</span>
          <span className="text-meta tabular-nums">
            {t("attendance.summary", { presentes: s.presentes, tardes: s.tardes, ausentes: s.ausentes, total: s.total })}
          </span>
        </li>
      ))}
    </ul>
  );
}

/**
 * Notas finales: la nota (con la sugerencia del promedio ya escrita) y dos
 * botones, Aprobar o Reprobar. La nota sugiere, el docente decide: por eso la
 * decisión es un clic explícito y no se deduce del umbral.
 */
export function NotasFinales({
  origen,
  estudiantes,
}: {
  origen: OrigenClase;
  estudiantes: readonly EstudianteDeClase[];
}) {
  return (
    <ul className={CAJA}>
      {estudiantes.map((e) => (
        <FilaNota key={e.inscripcionId} origen={origen} e={e} />
      ))}
    </ul>
  );
}

function FilaNota({ origen, e }: { origen: OrigenClase; e: EstudianteDeClase }) {
  const t = useTranslations("teacherClasses");
  const router = useRouter();
  const avisar = useToast();
  const [nota, setNota] = useState(e.nota !== null ? String(e.nota) : e.propuesta !== null ? String(e.propuesta) : "");
  const [error, setError] = useState(false);
  const [pendiente, iniciar] = useTransition();
  const cerrada = e.estado === "aprobada" || e.estado === "reprobada";

  const guardar = (decision: "aprobada" | "reprobada") => {
    setError(false);
    const datos = new FormData();

    datos.set(origen === "g360" ? "id" : "inscripcion", e.inscripcionId);
    datos.set("nota", nota);
    datos.set("decision", decision);
    iniciar(async () => {
      const res = await (origen === "g360" ? calificarInscripcion360 : calificarInscripcionMateria)({ estado: "inicial" }, datos);

      if (res.estado === "ok") {
        avisar({ titulo: t("finals.saved", { nombre: e.nombre }) });
        router.refresh();
      } else {
        setError(true);
      }
    });
  };

  const sugerida = nota.trim() !== "" && Number(nota) >= NOTA_APROBADA ? "aprobada" : "reprobada";

  return (
    <li className="flex flex-wrap items-center gap-3 px-4 py-3">
      <div className="min-w-0 flex-1 basis-40">
        <p className="text-body truncate font-medium">{e.nombre}</p>
        <p className="text-meta">
          {e.propuesta !== null ? t("finals.suggested", { n: e.propuesta }) : t("finals.noSuggestion")}
        </p>
      </div>
      {cerrada && <StatusBadge status={e.estado} />}
      <Input
        aria-label={t("finals.grade", { nombre: e.nombre })}
        type="number"
        min={0}
        max={100}
        step="0.5"
        value={nota}
        onChange={(ev) => setNota(ev.target.value)}
        className="w-24"
      />
      <Button type="button" size="sm" variant={sugerida === "aprobada" ? "default" : "secondary"} disabled={nota.trim() === "" || pendiente} onClick={() => guardar("aprobada")}>
        <Check aria-hidden />
        {t("finals.approve")}
      </Button>
      <Button type="button" size="sm" variant={sugerida === "reprobada" ? "default" : "secondary"} disabled={nota.trim() === "" || pendiente} onClick={() => guardar("reprobada")}>
        <X aria-hidden />
        {t("finals.fail")}
      </Button>
      {error && <p role="alert" className="text-meta w-full">{t("finals.error")}</p>}
    </li>
  );
}
