import type { Metadata } from "next";
import Image from "next/image";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { getTranslations } from "next-intl/server";

import { Monto } from "@/components/contabilidad/comun";
import { BotonImprimir } from "@/components/contabilidad/recibos/boton-imprimir";
import { getPathname } from "@/i18n/navigation";
import { requerirPermiso } from "@/lib/auth";
import { numeroDocumento } from "@/lib/contabilidad/formato";
import { montoEnLetras } from "@/lib/contabilidad/numeros-a-letras";
import { fechaLarga } from "@/lib/fechas";
import { BLANCO, TINTA } from "@/lib/paleta";
import { reciboPorId } from "@/server/contabilidad/recibos/consultas";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const recibo = await reciboPorId(id);
  return { title: recibo ? numeroDocumento(recibo.serie, recibo.numero) : undefined };
}

/**
 * El recibo en papel (§4.3), fuera del armazón del portal para que la
 * impresión sea solo el recibo. "Guardar como PDF" del navegador da el
 * PDF: generar el PDF en el servidor exigiría un motor de render entero
 * para un documento de media página.
 *
 * El QR lleva a la ficha del recibo en el sistema (con sesión). Quien
 * tenga el papel en la mano puede comprobar que el número, el monto y el
 * estado coinciden con lo registrado.
 *
 * Un borrador o un anulado se imprimen con su marca de agua: un papel sin
 * ella se podría presentar como válido.
 */
export default async function ReciboImpreso({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const idioma = locale === "en" ? "en" : "es";
  await requerirPermiso("contabilidad.leer");

  const recibo = await reciboPorId(id);
  if (!recibo) notFound();

  const t = await getTranslations({ locale, namespace: "contab" });
  const cabeceras = await headers();
  const host = cabeceras.get("x-forwarded-host") ?? cabeceras.get("host") ?? "localhost:3000";
  const protocolo = cabeceras.get("x-forwarded-proto") ?? "https";
  const verificacion = `${protocolo}://${host}${getPathname({ href: `/contabilidad/recibos/${recibo.id}`, locale })}`;
  const qr = await QRCode.toString(verificacion, {
    type: "svg",
    margin: 0,
    color: { dark: TINTA, light: BLANCO },
  });

  const numero = numeroDocumento(recibo.serie, recibo.numero);
  const tercero = recibo.tipo === "ingreso" ? recibo.tercero : recibo.beneficiario;
  const marca =
    recibo.estado === "anulado" ? t("impreso.anulado") : recibo.estado === "borrador" ? t("impreso.borrador") : null;

  return (
    <main className="mx-auto max-w-3xl bg-background p-4 text-tinta print:max-w-none print:p-0 md:p-10">
      <div className="mb-6 flex justify-end print:hidden">
        <BotonImprimir etiqueta={t("impreso.imprimir")} />
      </div>

      <article className="relative overflow-hidden rounded-card border border-linea-fuerte p-6 md:p-8 print:rounded-none">
        {marca && (
          <p
            aria-hidden
            className="pointer-events-none absolute inset-0 flex -rotate-12 items-center justify-center text-5xl font-bold tracking-widest text-tinta/10"
          >
            {marca}
          </p>
        )}

        <header className="flex items-start justify-between gap-6 border-b border-linea pb-5">
          <div className="space-y-2">
            <Image src="/logo.webp" alt={t("impreso.fundacion")} width={720} height={157} className="h-9 w-auto" />
            <p className="texto-meta">{t("impreso.lugar")}</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-medium text-tinta-2">{t(`tipo.${recibo.tipo}`)}</p>
            <p className="text-2xl font-semibold">{numero}</p>
            <p className="texto-meta">{fechaLarga(recibo.fecha, idioma)}</p>
          </div>
        </header>

        <dl className="space-y-4 py-6 text-[15px]">
          {tercero && (
            <Fila etiqueta={recibo.tipo === "ingreso" ? t("impreso.recibimos") : t("impreso.pagamos")}>
              {tercero}
            </Fila>
          )}
          <Fila etiqueta={t("impreso.laSuma")}>
            <span className="font-semibold">{montoEnLetras(recibo.monto, recibo.moneda, idioma)}</span>
            <span className="ml-2 text-tinta-2">
              (<Monto valor={recibo.monto} moneda={recibo.moneda} />)
            </span>
            {recibo.moneda === "USD" && recibo.monto_dop && (
              <span className="mt-1 block text-sm text-tinta-2">
                {montoEnLetras(recibo.monto_dop, "DOP", idioma)} · {recibo.tasa}
              </span>
            )}
          </Fila>
          <Fila etiqueta={t("impreso.porConcepto")}>{recibo.concepto}</Fila>
          <div className="grid gap-4 sm:grid-cols-2">
            <Fila etiqueta={t("impreso.forma")}>
              {t(`formaPago.${recibo.forma_pago}`)}
              {recibo.cheque_numero && ` · ${recibo.cheque_numero}`}
            </Fila>
            {recibo.referencia && <Fila etiqueta={t("impreso.referencia")}>{recibo.referencia}</Fila>}
            <Fila etiqueta={t("impreso.cuenta")}>{recibo.cuenta}</Fila>
            <Fila etiqueta={t("impreso.categoria")}>{recibo.categoria}</Fila>
            {recibo.proyecto && <Fila etiqueta={t("impreso.proyecto")}>{recibo.proyecto}</Fila>}
          </div>
        </dl>

        <footer className="grid grid-cols-[1fr_1fr_auto] items-end gap-6 border-t border-linea pt-10">
          <Firma etiqueta={t("impreso.preparado")} nombre={recibo.creado_por} />
          <Firma etiqueta={t("impreso.recibido")} />
          <figure className="w-24 text-center">
            {/* SVG generado por la librería a partir de una URL nuestra: no hay texto del usuario dentro. */}
            <div className="size-24 [&>svg]:size-full" dangerouslySetInnerHTML={{ __html: qr }} />
            <figcaption className="texto-meta mt-1">{t("impreso.verificar")}</figcaption>
          </figure>
        </footer>
      </article>
    </main>
  );
}

function Fila({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="texto-meta">{etiqueta}</dt>
      <dd className="mt-0.5">{children}</dd>
    </div>
  );
}

function Firma({ etiqueta, nombre }: { etiqueta: string; nombre?: string }) {
  return (
    <div className="text-center">
      <p className="min-h-5 text-sm">{nombre}</p>
      <p className="mt-1 border-t border-tinta pt-1.5 text-sm text-tinta-2">{etiqueta}</p>
    </div>
  );
}
