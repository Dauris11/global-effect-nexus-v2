"use client";

import { useTranslations } from "next-intl";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

/** El detalle de una persona del equipo: «Cuenta» (rol, activar, reiniciar acceso) y «Qué atiende». */
export function DetallePersona({ cuenta, queAtiende }: { cuenta: React.ReactNode; queAtiende: React.ReactNode }) {
  const t = useTranslations("staff");

  return (
    <Tabs defaultValue="cuenta">
      <TabsList>
        <TabsTrigger value="cuenta">{t("tabs.account")}</TabsTrigger>
        <TabsTrigger value="atiende">{t("tabs.handles")}</TabsTrigger>
      </TabsList>
      <TabsContent value="cuenta">{cuenta}</TabsContent>
      <TabsContent value="atiende">{queAtiende}</TabsContent>
    </Tabs>
  );
}
