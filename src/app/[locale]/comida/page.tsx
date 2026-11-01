import type { Metadata } from "next";
import { Clock, UtensilsCrossed } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { FormularioComida } from "@/components/comida/formulario-comida";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { fechaLarga } from "@/lib/fechas";
import { horaLegible } from "@/lib/parametros";
import { parametros } from "@/server/parametros/consultas";
import { estadoComedor } from "@/server/comida/consultas";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "comida" });
  const p = await parametros();

  return {
    title: t("title"),
    description: t("subtitle", { cierre: horaLegible(p["comedor.cierre"]) }),
  };
}

export default async function PaginaComida({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "comida" });
  const tLanding = await getTranslations({ locale, namespace: "landing" });
  const tAuth = await getTranslations({ locale, namespace: "auth" });

  const { abierto, inscritos } = await estadoComedor();
  const p = await parametros();
  const horas = {
    apertura: horaLegible(p["comedor.apertura"]),
    cierre: horaLegible(p["comedor.cierre"]),
  };

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-md space-y-5">
        <Card>
          <CardContent className="space-y-5 pt-5">
            <div className="flex items-start gap-3">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-[#2096BA]/10 text-[#187a99]">
                <UtensilsCrossed className="size-6" />
              </span>

              <div className="min-w-0">
                <h1 className="text-xl font-bold">{t("title")}</h1>
                <p className="text-muted-foreground text-xs">
                  {fechaLarga(new Date(), locale === "en" ? "en" : "es")}
                </p>
              </div>

              <span
                className={
                  abierto
                    ? "ml-auto shrink-0 rounded-full bg-[#2096BA]/15 px-2 py-0.5 text-[10px] font-medium text-[#0a6a8a]"
                    : "ml-auto shrink-0 rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-medium text-slate-600"
                }
              >
                {abierto ? t("open") : t("closed")}
              </span>
            </div>

            <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
              <Clock className="size-3.5 shrink-0" />
              {tLanding("panelMealsWindow", horas)}
            </p>

            <FormularioComida
              abierto={abierto}
              textos={{
                nombre: t("namePlaceholder"),
                enviar: t("submit"),
                ok: t("success"),
                duplicado: t("duplicate"),
                fueraDeHora: t("outOfTime", horas),
                invalido: t("invalid"),
                cerrado: t("closed"),
              }}
            />

            {/* Solo el número: quién come lo gestiona el comedor, y esta
                página la ve cualquiera. */}
            <p className="border-t pt-4 text-center text-xs text-slate-500">
              {t("enrolledToday")}: <strong>{inscritos}</strong>
            </p>
          </CardContent>
        </Card>

        <p className="text-center">
          <Link
            href="/"
            className="inline-block rounded-lg px-3 py-2 text-xs text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          >
            ← {tAuth("backHome")}
          </Link>
        </p>
      </div>
    </div>
  );
}
