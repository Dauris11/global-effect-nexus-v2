"use client";

import { Link2 } from "lucide-react";
import { useTranslations } from "next-intl";

import { useToast } from "@/components/app/toaster";
import { Button } from "@/components/ui/button";

/** Copia el enlace público de inscripción (`/comida`) para pegarlo en el grupo o mandarlo. */
export function CompartirEnlace() {
  const t = useTranslations("comida");
  const avisar = useToast();

  return (
    <Button
      variant="secondary"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(`${window.location.origin}/comida`);
          avisar({ titulo: t("linkCopied") });
        } catch {
          avisar({ titulo: `${window.location.origin}/comida` });
        }
      }}
    >
      <Link2 aria-hidden />
      {t("shareLink")}
    </Button>
  );
}
