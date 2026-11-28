import { ShieldAlert } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { EmptyState } from "@/components/app/empty-state";
import { PageContainer } from "@/components/app/page-container";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

/**
 * Lo que ve alguien sin `tecnico.dev_panel` (un propietario, por ejemplo) al abrir `/dev`: una explicación y la
 * salida a su Inicio, no un error técnico ni una redirección muda. Next la sirve con estado 403 cuando la
 * respuesta aún no empezó a enviarse; con la carga en streaming del portal puede salir 200, y de todos modos
 * la protección real está en el servidor.
 */
export default async function ProhibidoDev() {
  const t = await getTranslations("dev");

  return (
    <PageContainer className="py-8">
      <EmptyState
        icon={ShieldAlert}
        title={t("forbiddenTitle")}
        description={t("forbiddenBody")}
        action={
          <Button asChild>
            <Link href="/inicio">{t("goHome")}</Link>
          </Button>
        }
      />
    </PageContainer>
  );
}
