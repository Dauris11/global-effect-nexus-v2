import Image from "next/image";
import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";

/**
 * Logo, titular y una línea de apoyo de todas las pantallas de acceso. El logo lleva a la
 * landing, igual que el «Volver al inicio» del marco, pero sin repetir ese texto.
 */
export function CabeceraAcceso({ titulo, subtitulo }: { titulo: string; subtitulo?: string }) {
  const tComun = useTranslations("common");

  return (
    <header>
      <Link
        href="/"
        aria-label={tComun("foundation")}
        className="block w-fit rounded-control focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <Image src="/logo.webp" alt="" width={720} height={157} priority className="logo-claro h-9 w-auto" />
        <Image src="/logo-dark.webp" alt="" width={720} height={157} priority className="logo-oscuro h-9 w-auto" />
      </Link>

      <h1 className="mt-8 text-[28px] leading-tight font-semibold tracking-tight text-tinta">{titulo}</h1>
      {subtitulo && <p className="mt-1.5 text-body text-tinta-2">{subtitulo}</p>}
    </header>
  );
}
