"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { Input } from "@/components/ui/input";

/** Primer y último día del mes `YYYY-MM`, en UTC para no correr un día. */
function rangoDeMes(mes: string): [string, string] | null {
  const m = /^(\d{4})-(\d{2})$/.exec(mes);
  if (!m) return null;
  const ultimo = new Date(Date.UTC(Number(m[1]), Number(m[2]), 0)).getUTCDate();
  return [`${mes}-01`, `${mes}-${String(ultimo).padStart(2, "0")}`];
}

/**
 * Mes y rango en los mismos campos. El selector de mes no se envía: solo
 * rellena "desde" y "hasta", que son lo único que viaja en la URL. Si el
 * mes también viajara, habría dos respuestas a "¿qué fechas?" y una
 * ganaría sin que nadie lo viera.
 */
export function CamposRango({ desde, hasta }: { desde: string; hasta: string }) {
  const t = useTranslations("contab.libros.filtros");
  const [inicio, setInicio] = useState(desde);
  const [fin, setFin] = useState(hasta);
  const mes = rangoDeMes(inicio.slice(0, 7));
  const esMes = mes !== null && mes[0] === inicio && mes[1] === fin;

  return (
    <>
      <label className="block space-y-1.5">
        <span className="text-sm font-medium text-tinta">{t("mes")}</span>
        <Input
          type="month"
          value={esMes ? inicio.slice(0, 7) : ""}
          onChange={(e) => {
            const rango = rangoDeMes(e.target.value);
            if (!rango) return;
            setInicio(rango[0]);
            setFin(rango[1]);
          }}
        />
      </label>
      <label className="block space-y-1.5">
        <span className="text-sm font-medium text-tinta">{t("desde")}</span>
        <Input name="desde" type="date" required value={inicio} onChange={(e) => setInicio(e.target.value)} />
      </label>
      <label className="block space-y-1.5">
        <span className="text-sm font-medium text-tinta">{t("hasta")}</span>
        <Input name="hasta" type="date" required value={fin} onChange={(e) => setFin(e.target.value)} />
      </label>
    </>
  );
}
