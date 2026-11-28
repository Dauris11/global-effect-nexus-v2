import { Compass } from "lucide-react";

/**
 * Contenido del 404. Es de servidor y recibe los textos resueltos para servir a
 * las dos entradas: la de dentro del idioma (`[locale]/not-found`) y la global,
 * que Next usa cuando la URL ni siquiera cae en un idioma válido.
 * El estado HTTP 404 lo pone Next al renderizar un `not-found`, no este componente.
 */
export function PaginaNoEncontrada({
  titulo,
  texto,
  volver,
  href,
}: {
  titulo: string;
  texto: string;
  volver: string;
  href: string;
}) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background px-4 text-center">
      <span className="flex size-12 items-center justify-center rounded-control bg-marca-50 text-marca-600">
        <Compass className="size-6" aria-hidden />
      </span>
      <p className="font-mono text-sm text-tinta-3">404</p>
      <h1 className="text-page font-semibold text-tinta">{titulo}</h1>
      <p className="max-w-md text-tinta-2">{texto}</p>
      {/* `<a>` y no `Link` de next-intl: este componente también se usa fuera del proveedor de idioma. */}
      <a
        href={href}
        className="inline-flex h-11 items-center rounded-control bg-marca-500 px-5 text-sm font-semibold text-white hover:bg-marca-600 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        {volver}
      </a>
    </main>
  );
}
