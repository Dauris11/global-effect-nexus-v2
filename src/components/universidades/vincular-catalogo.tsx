"use client";

import { useActionState, useState } from "react";
import { Loader2, Save } from "lucide-react";
import { useTranslations } from "next-intl";

import { CLASE_SELECT, MensajeEstado } from "@/components/universidades/formularios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "@/i18n/navigation";
import { vincularCatalogo, type EstadoCatalogo } from "@/server/universidades/acciones";
import type { ArbolCatalogo } from "@/server/universidades/consultas";

/**
 * Elegir universidad → carrera → pénsum de un estudiante. Los selectores se
 * filtran en cascada para guiar, pero la regla real la comprueba el servidor.
 * Al cambiar un nivel se limpian los de abajo: un pénsum de otra carrera no
 * puede quedar elegido por descuido.
 */
export function VincularCatalogo({
  estudianteId,
  arbol,
  inicial,
  puedeAdministrar,
}: {
  estudianteId: string;
  arbol: ArbolCatalogo;
  inicial: { universidadId: string; carreraId: string; pensumId: string; matricula: string };
  puedeAdministrar: boolean;
}) {
  const t = useTranslations("catalog");
  const [uni, setUni] = useState(inicial.universidadId);
  const [carrera, setCarrera] = useState(inicial.carreraId);
  const [pensum, setPensum] = useState(inicial.pensumId);
  const [estado, enviar, enviando] = useActionState<EstadoCatalogo, FormData>(vincularCatalogo, { estado: "inicial" });

  const carreras = arbol.carreras.filter((c) => c.universidad_id === uni);
  const pensums = arbol.pensums.filter((p) => p.carrera_id === carrera);

  return (
    <form action={enviar} className="space-y-4">
      <input type="hidden" name="estudiante" value={estudianteId} />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="v-uni">{t("link.university")}</Label>
          <select id="v-uni" name="universidad" value={uni} className={CLASE_SELECT} onChange={(e) => { setUni(e.target.value); setCarrera(""); setPensum(""); }}>
            <option value="">{t("link.none")}</option>
            {arbol.universidades.map((u) => <option key={u.id} value={u.id}>{u.siglas}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="v-carrera">{t("link.career")}</Label>
          <select id="v-carrera" name="carrera" value={carrera} disabled={!uni} className={CLASE_SELECT} onChange={(e) => { setCarrera(e.target.value); setPensum(""); }}>
            <option value="">{t("link.none")}</option>
            {carreras.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="v-pensum">{t("link.pensum")}</Label>
          <select id="v-pensum" name="pensum" value={pensum} disabled={!carrera} className={CLASE_SELECT} onChange={(e) => setPensum(e.target.value)}>
            <option value="">{t("link.none")}</option>
            {pensums.map((p) => (
              <option key={p.id} value={p.id}>
                {t("pensum.versionLabel", { version: p.version })}{p.vigente ? "" : ` · ${t("pensum.old")}`}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="v-matricula">{t("link.matricula")}</Label>
          <Input id="v-matricula" name="matricula" defaultValue={inicial.matricula} maxLength={40} />
        </div>
      </div>

      <MensajeEstado estado={estado} />
      {estado.estado === "ok" && <p role="status" className="text-sm text-tinta">{t("link.saved")}</p>}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="sm" disabled={enviando}>
          {enviando ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          {t("link.save")}
        </Button>
        {puedeAdministrar && (
          <Link href="/academico/universidades" className="text-sm font-medium text-marca-700 hover:underline">
            {t("link.manage")}
          </Link>
        )}
      </div>
    </form>
  );
}
