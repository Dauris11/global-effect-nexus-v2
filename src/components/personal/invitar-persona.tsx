"use client";

import { UserPlus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { FormularioAlta } from "@/components/personal/gestion-cuentas";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import type { Rol } from "@/lib/rbac";

/** El único botón primario de Personal: abre el alta (correo, nombre y rol) en un panel lateral. */
export function InvitarPersona({ roles }: { roles: readonly Rol[] }) {
  const t = useTranslations("staff");
  const [abierto, setAbierto] = useState(false);

  return (
    <>
      <Button onClick={() => setAbierto(true)}>
        <UserPlus aria-hidden />
        {t("invite")}
      </Button>
      <Sheet open={abierto} onOpenChange={setAbierto}>
        <SheetContent>
          <div className="space-y-1 border-b border-linea px-6 pt-6 pb-4 pr-16">
            <SheetTitle className="text-section">{t("invite")}</SheetTitle>
            <SheetDescription className="text-meta">{t("newAccountHint")}</SheetDescription>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
            <FormularioAlta roles={roles} alCerrar={() => setAbierto(false)} />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
