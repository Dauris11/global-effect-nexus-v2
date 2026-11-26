/**
 * Catálogo oficial de retenciones de ISR y de ITBIS (DGII, República Dominicana),
 * basado en el folleto `Retenciones-ISR-ITBIS.pdf` (Impuestos Internos, jul 2025).
 *
 * Cómo se calculan los montos (aritmética exacta en centavos, sin float):
 *   · Retenciones de ISR: porcentaje directo sobre el monto facturado (ej. 10%, 2%).
 *   · Retenciones de ITBIS: al ser una entidad sin fines de lucro (ASFL) que no
 *     desglosa ITBIS aparte en el formulario de factura, las tasas sobre el ITBIS
 *     general del 18% se expresan por su tasa efectiva sobre el monto:
 *       - 100% del ITBIS (18%) → 0.18 del monto
 *       -  30% del ITBIS (18%) → 0.054 del monto (30% × 18%)
 *       -   2% del monto (tarjetas de crédito/débito, Norma 06-23) → 0.02 del monto
 */

export type ImpuestoRetencion = "isr" | "itbis";
export type AplicaProveedor = "fisica" | "juridica" | "ambos";

export type ReglaRetencion = {
  codigo: string;
  impuesto: ImpuestoRetencion;
  /** Tasa efectiva sobre el monto de la factura (ej. 0.10 = 10%, 0.054 = 30% del 18%). */
  tasa: number;
  /** Texto breve del porcentaje mostrado al usuario (ej. "10%", "30% del ITBIS (5.4%)"). */
  etiquetaTasa: string;
  nombre: { es: string; en: string };
  baseLegal: string;
  aplicaA: AplicaProveedor;
};

export const RETENCIONES_ISR: readonly ReglaRetencion[] = [
  {
    codigo: "isr_servicios_profesionales_10",
    impuesto: "isr",
    tasa: 0.1,
    etiquetaTasa: "10%",
    nombre: {
      es: "Honorarios por servicios profesionales y comisiones (Persona Física)",
      en: "Professional service fees & commissions (Individual)",
    },
    baseLegal: "Ley 11-92, Art. 309",
    aplicaA: "fisica",
  },
  {
    codigo: "isr_alquileres_10",
    impuesto: "isr",
    tasa: 0.1,
    etiquetaTasa: "10%",
    nombre: {
      es: "Alquileres y arrendamientos (Persona Física)",
      en: "Rentals & leases (Individual)",
    },
    baseLegal: "Ley 11-92, Art. 309",
    aplicaA: "fisica",
  },
  {
    codigo: "isr_servicios_tecnicos_2",
    impuesto: "isr",
    tasa: 0.02,
    etiquetaTasa: "2%",
    nombre: {
      es: "Servicios técnicos / no personales (albañilería, limpieza, plomería, mecánica, etc.)",
      en: "Technical / non-personal services (masonry, cleaning, plumbing, etc.)",
    },
    baseLegal: "Norma 07-07 / Art. 70 Dto. 139-98",
    aplicaA: "fisica",
  },
  {
    codigo: "isr_rst_persona_fisica_10",
    impuesto: "isr",
    tasa: 0.1,
    etiquetaTasa: "10%",
    nombre: {
      es: "Persona Física acogida al RST o Contribuyente no registrado",
      en: "Individual under RST or Unregistered taxpayer",
    },
    baseLegal: "Reglamento RST",
    aplicaA: "fisica",
  },
  {
    codigo: "isr_otras_rentas_10",
    impuesto: "isr",
    tasa: 0.1,
    etiquetaTasa: "10%",
    nombre: {
      es: "Otras rentas (Art. 309, Lit. f)",
      en: "Other income (Art. 309, Lit. f)",
    },
    baseLegal: "Ley 11-92, Art. 309, Lit. f",
    aplicaA: "ambos",
  },
  {
    codigo: "isr_otras_rentas_2",
    impuesto: "isr",
    tasa: 0.02,
    etiquetaTasa: "2%",
    nombre: {
      es: "Otras rentas / Otras retenciones (2%)",
      en: "Other income / Other withholdings (2%)",
    },
    baseLegal: "Decreto 139-98 Art. 70 / Norma 07-2007",
    aplicaA: "ambos",
  },
  {
    codigo: "isr_transferencia_bienes_2",
    impuesto: "isr",
    tasa: 0.02,
    etiquetaTasa: "2%",
    nombre: {
      es: "Transferencia de título y propiedades",
      en: "Transfer of title and real property",
    },
    baseLegal: "Ley 11-92",
    aplicaA: "ambos",
  },
  {
    codigo: "isr_dividendos_10",
    impuesto: "isr",
    tasa: 0.1,
    etiquetaTasa: "10%",
    nombre: {
      es: "Dividendos pagados o acreditados",
      en: "Dividends paid or credited",
    },
    baseLegal: "Ley 253-12",
    aplicaA: "ambos",
  },
  {
    codigo: "isr_intereses_no_residentes_5",
    impuesto: "isr",
    tasa: 0.05,
    etiquetaTasa: "5%",
    nombre: {
      es: "Intereses a no residentes",
      en: "Interest paid to non-residents",
    },
    baseLegal: "Ley 253-12",
    aplicaA: "ambos",
  },
  {
    codigo: "isr_remesas_exterior_27",
    impuesto: "isr",
    tasa: 0.27,
    etiquetaTasa: "27%",
    nombre: {
      es: "Remesas al exterior",
      en: "Remittances abroad",
    },
    baseLegal: "Ley 253-12",
    aplicaA: "ambos",
  },
  {
    codigo: "isr_premios_25",
    impuesto: "isr",
    tasa: 0.25,
    etiquetaTasa: "25%",
    nombre: {
      es: "Premios o ganancias promocionales / loterías",
      en: "Prizes or promotional winnings / lotteries",
    },
    baseLegal: "Ley 253-12",
    aplicaA: "ambos",
  },
  {
    codigo: "isr_ganancia_capital_1",
    impuesto: "isr",
    tasa: 0.01,
    etiquetaTasa: "1%",
    nombre: {
      es: "Ganancia de capital",
      en: "Capital gains",
    },
    baseLegal: "Norma 07-2011",
    aplicaA: "ambos",
  },
  {
    codigo: "isr_productos_carnicos_1",
    impuesto: "isr",
    tasa: 0.01,
    etiquetaTasa: "1%",
    nombre: {
      es: "Bienes o productos cárnicos (ganadería bovina)",
      en: "Beef / livestock meat products",
    },
    baseLegal: "Norma 04-2025",
    aplicaA: "ambos",
  },
];

export const RETENCIONES_ITBIS: readonly ReglaRetencion[] = [
  {
    codigo: "itbis_pf_servicios_100",
    impuesto: "itbis",
    tasa: 0.18,
    etiquetaTasa: "100% del ITBIS (18%)",
    nombre: {
      es: "Servicios gravados prestados por Persona Física",
      en: "Taxable services provided by an Individual",
    },
    baseLegal: "IT-1 Sección A (100% ITBIS)",
    aplicaA: "fisica",
  },
  {
    codigo: "itbis_comprobante_compras_100",
    impuesto: "itbis",
    tasa: 0.18,
    etiquetaTasa: "100% del ITBIS (18%)",
    nombre: {
      es: "Comprobante de Compras (Persona Física no registrada)",
      en: "Purchase Receipt (Unregistered Individual)",
    },
    baseLegal: "Norma General 05-19",
    aplicaA: "fisica",
  },
  {
    codigo: "itbis_construccion_pf_100",
    impuesto: "itbis",
    tasa: 0.18,
    etiquetaTasa: "100% del ITBIS (18%)",
    nombre: {
      es: "Servicios de construcción por Persona Física",
      en: "Construction services by an Individual",
    },
    baseLegal: "Norma 07-07, Art. 3 P. IV",
    aplicaA: "fisica",
  },
  {
    codigo: "itbis_rst_100",
    impuesto: "itbis",
    tasa: 0.18,
    etiquetaTasa: "100% del ITBIS (18%)",
    nombre: {
      es: "Proveedor acogido al Régimen Simplificado (RST)",
      en: "Supplier under Simplified Tax Regime (RST)",
    },
    baseLegal: "Reglamento RST",
    aplicaA: "ambos",
  },
  {
    codigo: "itbis_sociedades_profesionales_30",
    impuesto: "itbis",
    tasa: 0.054,
    etiquetaTasa: "30% del ITBIS (5.4%)",
    nombre: {
      es: "Servicios profesionales liberales prestados por Sociedades",
      en: "Liberal professional services by Companies",
    },
    baseLegal: "Norma 02-05 (Casilla 43 IT-1)",
    aplicaA: "juridica",
  },
  {
    codigo: "itbis_sociedades_alquiler_muebles_30",
    impuesto: "itbis",
    tasa: 0.054,
    etiquetaTasa: "30% del ITBIS (5.4%)",
    nombre: {
      es: "Alquiler de bienes muebles prestado por Sociedades",
      en: "Movable property rental by Companies",
    },
    baseLegal: "Norma 02-05 (Casilla 43 IT-1)",
    aplicaA: "juridica",
  },
  {
    codigo: "itbis_construccion_pj_30",
    impuesto: "itbis",
    tasa: 0.054,
    etiquetaTasa: "30% del ITBIS (5.4%)",
    nombre: {
      es: "Servicios de construcción por Entidad Jurídica",
      en: "Construction services by a Legal Entity",
    },
    baseLegal: "Norma 07-07, Art. 3 P. IV",
    aplicaA: "juridica",
  },
  {
    codigo: "itbis_seguridad_vigilancia_100",
    impuesto: "itbis",
    tasa: 0.18,
    etiquetaTasa: "100% del ITBIS (18%)",
    nombre: {
      es: "Servicios de seguridad o vigilancia por Sociedades",
      en: "Security or surveillance services by Companies",
    },
    baseLegal: "Norma 07-09 (Casilla 42 IT-1)",
    aplicaA: "juridica",
  },
  {
    codigo: "itbis_entidades_no_lucrativas_100",
    impuesto: "itbis",
    tasa: 0.18,
    etiquetaTasa: "100% del ITBIS (18%)",
    nombre: {
      es: "Publicidad u otros servicios gravados a Entidades No Lucrativas",
      en: "Advertising or taxable services to Non-Profit Entities",
    },
    baseLegal: "Norma 01-11 (Casilla 40 IT-1)",
    aplicaA: "juridica",
  },
  {
    codigo: "itbis_tarjetas_2",
    impuesto: "itbis",
    tasa: 0.02,
    etiquetaTasa: "2% del monto",
    nombre: {
      es: "Pagos con tarjetas de crédito o débito (Adquirencia)",
      en: "Credit or debit card payments (Acquiring)",
    },
    baseLegal: "Norma 06-23",
    aplicaA: "ambos",
  },
];

export const TODAS_RETENCIONES: readonly ReglaRetencion[] = [
  ...RETENCIONES_ISR,
  ...RETENCIONES_ITBIS,
];

const POR_CODIGO = new Map(TODAS_RETENCIONES.map((r) => [r.codigo, r]));

export function retencionPorCodigo(codigo: string | null | undefined): ReglaRetencion | null {
  if (!codigo) return null;
  return POR_CODIGO.get(codigo) ?? null;
}

/**
 * Ordena las retenciones poniendo primero las recomendadas para el tipo de
 * proveedor (`fisica` = informal/profesional independiente, `juridica` = formal/jurídico).
 */
export function retencionesParaProveedor(
  impuesto: ImpuestoRetencion,
  tipoProveedor?: "fisica" | "juridica",
): ReglaRetencion[] {
  const lista = impuesto === "isr" ? RETENCIONES_ISR : RETENCIONES_ITBIS;
  if (!tipoProveedor) return [...lista];
  const recomendadas = lista.filter((r) => r.aplicaA === tipoProveedor || r.aplicaA === "ambos");
  const otras = lista.filter((r) => r.aplicaA !== tipoProveedor && r.aplicaA !== "ambos");
  return [...recomendadas, ...otras];
}

/**
 * Calcula la retención en centavos exactos a partir de un monto decimal (string)
 * y el código de retención elegido. Devuelve "0.00" si no hay monto o regla.
 */
export function calcularMontoRetencion(
  montoStr: string,
  codigoRetencion: string | null | undefined,
): string {
  const regla = retencionPorCodigo(codigoRetencion);
  if (!regla) return "0.00";
  const limpio = montoStr.replace(/,/g, "").trim();
  const num = Number(limpio);
  if (!Number.isFinite(num) || num <= 0) return "0.00";
  const centavosBase = Math.round(num * 100);
  const centavosRet = Math.round(centavosBase * regla.tasa);
  return (centavosRet / 100).toFixed(2);
}

/** Calcula el ITBIS general (18%) en centavos exactos sobre el monto base. */
export function calcularItbis(montoStr: string): string {
  const limpio = montoStr.replace(/,/g, "").trim();
  const num = Number(limpio);
  if (!Number.isFinite(num) || num <= 0) return "0.00";
  const centavosBase = Math.round(num * 100);
  const centavosItbis = Math.round(centavosBase * 0.18);
  return (centavosItbis / 100).toFixed(2);
}
