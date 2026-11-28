"use client";

import { ExternalLink, Maximize2, Minimize2, PhoneOff, Video } from "lucide-react";
import { useState } from "react";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  esSalaEmbebible,
  generarEnlaceSalaVirtual,
  urlEmbedSala,
} from "@/lib/reuniones-sala";
import { cn } from "@/lib/utils";

/**
 * Visor de videollamada embebida dentro de la misma web.
 * Si la reunión apunta a un proveedor externo que bloquea iframe (ej. Google Meet),
 * ofrece el acceso directo en pestaña aparte.
 */
export function SalaLlamadaEmbebida({
  reunion,
  nombreUsuario,
  alCerrar,
}: {
  reunion: {
    id: string;
    titulo: string;
    lugar_o_enlace: string | null;
  };
  nombreUsuario: string;
  alCerrar: () => void;
}) {
  const t = useTranslations("reuniones.liveRoom");
  const [expandida, setExpandida] = useState(false);

  const enlaceBase =
    reunion.lugar_o_enlace && reunion.lugar_o_enlace.startsWith("http")
      ? reunion.lugar_o_enlace
      : generarEnlaceSalaVirtual(reunion.id);

  const embebible = esSalaEmbebible(enlaceBase);
  const srcIframe = embebible ? urlEmbedSala(enlaceBase, nombreUsuario) : null;

  return (
    <Card className="border-marca-500/40 shadow-card overflow-hidden">
      <div className="bg-marca-50/70 border-linea flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="bg-marca-500 flex size-8 shrink-0 items-center justify-center rounded-full text-white">
            <Video className="size-4" aria-hidden />
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Badge className="bg-marca-600 text-white inline-flex items-center gap-1.5 text-[10px]">
                <span className="size-1.5 animate-pulse rounded-full bg-white" />
                {t("liveBadge")}
              </Badge>
              <h3 className="truncate text-sm font-semibold text-tinta">
                {reunion.titulo}
              </h3>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <a href={enlaceBase} target="_blank" rel="noreferrer">
              <ExternalLink className="size-3.5" />
              {t("openExternal")}
            </a>
          </Button>
          {embebible && (
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              title={expandida ? t("collapse") : t("expand")}
              aria-label={expandida ? t("collapse") : t("expand")}
              onClick={() => setExpandida((v) => !v)}
            >
              {expandida ? (
                <Minimize2 className="size-4" />
              ) : (
                <Maximize2 className="size-4" />
              )}
            </Button>
          )}
          <Button type="button" variant="destructive" size="sm" onClick={alCerrar}>
            <PhoneOff className="size-3.5" />
            {t("leave")}
          </Button>
        </div>
      </div>

      <CardContent className="p-0">
        {srcIframe ? (
          <iframe
            src={srcIframe}
            title={reunion.titulo}
            allow="camera; microphone; fullscreen; display-capture; autoplay; clipboard-write"
            className={cn(
              "w-full border-0 bg-tinta transition-all duration-200",
              expandida ? "h-[78vh]" : "h-[540px]",
            )}
          />
        ) : (
          <div className="space-y-3 p-8 text-center">
            <p className="text-sm font-medium text-tinta">{t("externalOnlyTitle")}</p>
            <Button asChild size="sm">
              <a href={enlaceBase} target="_blank" rel="noreferrer">
                <ExternalLink className="size-4" />
                {t("joinExternalNow")}
              </a>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

