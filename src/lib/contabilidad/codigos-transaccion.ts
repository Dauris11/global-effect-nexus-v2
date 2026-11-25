/**
 * Códigos de transacción: un código por cada proceso contable que genera
 * líneas de asiento (p. ej. «AFP del empleado por pagar» de la nómina).
 *
 * POR QUÉ existen: así un módulo dice «esto es AFP del empleado por pagar»
 * y no «cárgalo a la 2.3.1». La contadora asigna cada código a una cuenta
 * desde Configuración contable y el asiento sale solo, con la cuenta y el
 * lado (débito o crédito) que ella configuró. Los códigos se crean AQUÍ, en
 * código; lo que se configura en pantalla es su naturaleza y su cuenta.
 *
 * ── Cómo agregar un código nuevo ─────────────────────────────────────────
 *  1. Si el módulo es nuevo, añade su clave a `ModuloCodigo` y su etiqueta
 *     (es/en) en `ETIQUETA_MODULO`.
 *  2. Añade UNA entrada a `CODIGOS_TRANSACCION` (copia la de al lado):
 *     `codigo` en MAYÚSCULAS_CON_GUION_BAJO y nunca cambia después, `proceso`
 *     corto, `nombre` y `ayuda` en es/en y la `naturaleza` por defecto.
 *  3. Úsalo donde se arma el asiento: `construirLineasPorCodigo(cliente,
 *     [{ codigo: "MI_CODIGO", monto, descripcion }])`
 *     (src/server/contabilidad/codigos-transaccion/asiento.ts).
 *  4. Corre `npx tsx scripts/probar-codigos-transaccion.ts`. No hace falta
 *     migración ni tocar messages/*.json: el código aparece solo en la
 *     pantalla, sin cuenta, hasta que se la asignen en el Catálogo.
 * ─────────────────────────────────────────────────────────────────────────
 */

export type NaturalezaCodigo = "debito" | "credito";

/** Módulos que tienen códigos. Para sumar uno, añade aquí y en ETIQUETA_MODULO. */
export type ModuloCodigo =
  | "nomina"
  | "bancos"
  | "cajas"
  | "recibos"
  | "proveedores"
  | "donaciones"
  | "fondos"
  | "cierre"
  | "inventario"
  | "activos_fijos"
  | "calculadoras";

export type TextoBilingue = { es: string; en: string };

export type DefinicionCodigo = {
  /** Clave estable: la guarda la base; renombrarla dejaría la configuración huérfana. */
  codigo: string;
  modulo: ModuloCodigo;
  /** Proceso dentro del módulo, en minúsculas (`afp_empleado`). */
  proceso: string;
  nombre: TextoBilingue;
  /** Cuándo se usa; se ve como ayuda en pantalla. */
  ayuda: TextoBilingue;
  /** Lado que usa mientras nadie lo configure en pantalla. */
  naturaleza: NaturalezaCodigo;
};

/** Orden de los módulos en pantalla y su etiqueta. */
export const ETIQUETA_MODULO: Record<ModuloCodigo, TextoBilingue> = {
  nomina: { es: "Nómina", en: "Payroll" },
  bancos: { es: "Bancos", en: "Banks" },
  cajas: { es: "Cajas y arqueos", en: "Cash boxes and counts" },
  recibos: { es: "Recibos", en: "Receipts" },
  proveedores: { es: "Facturas y pagos a proveedores", en: "Supplier invoices and payments" },
  donaciones: { es: "Donaciones", en: "Donations" },
  fondos: { es: "Fondos", en: "Funds" },
  cierre: { es: "Cierres contables", en: "Accounting closings" },
  inventario: { es: "Inventario", en: "Inventory" },
  activos_fijos: { es: "Activos fijos", en: "Fixed assets" },
  calculadoras: { es: "Calculadoras", en: "Calculators" },
};

export const CODIGOS_TRANSACCION: readonly DefinicionCodigo[] = [
  // ── Nómina: gasto de sueldos por programa (centro de costo) ──
  {
    codigo: "NOM_SUELDO_HABITUDES",
    modulo: "nomina",
    proceso: "sueldo_habitudes",
    nombre: { es: "Sueldos del programa Habitudes", en: "Habitudes program salaries" },
    ayuda: { es: "Sueldo devengado del personal del programa Habitudes.", en: "Salary earned by Habitudes program staff." },
    naturaleza: "debito",
  },
  {
    codigo: "NOM_SUELDO_ALOJAMIENTO",
    modulo: "nomina",
    proceso: "sueldo_alojamiento",
    nombre: { es: "Sueldos de alojamiento y comedor", en: "Housing and dining salaries" },
    ayuda: { es: "Sueldo devengado del personal de alojamiento y comedor.", en: "Salary earned by housing and dining staff." },
    naturaleza: "debito",
  },
  {
    codigo: "NOM_SUELDO_FORMACION_360",
    modulo: "nomina",
    proceso: "sueldo_formacion_360",
    nombre: { es: "Sueldos de Formación 360", en: "Formation 360 salaries" },
    ayuda: { es: "Sueldo devengado del personal de Global Effect 360.", en: "Salary earned by Global Effect 360 staff." },
    naturaleza: "debito",
  },
  {
    codigo: "NOM_SUELDO_BECAS",
    modulo: "nomina",
    proceso: "sueldo_becas",
    nombre: { es: "Sueldos del programa de becas", en: "Scholarship program salaries" },
    ayuda: { es: "Sueldo devengado del personal del programa de becas.", en: "Salary earned by scholarship program staff." },
    naturaleza: "debito",
  },
  {
    codigo: "NOM_SUELDO_ADMINISTRATIVO",
    modulo: "nomina",
    proceso: "sueldo_administrativo",
    nombre: { es: "Sueldos administrativos e institucionales", en: "Administrative and institutional salaries" },
    ayuda: {
      es: "Sueldo del personal administrativo, institucional y de cualquier centro de costo sin programa propio.",
      en: "Salary of administrative and institutional staff and of any cost center without its own program.",
    },
    naturaleza: "debito",
  },
  // ── Nómina: aportes patronales como gasto ──
  {
    codigo: "NOM_AFP_EMPLEADOR_GASTO",
    modulo: "nomina",
    proceso: "afp_empleador_gasto",
    nombre: { es: "AFP empleador (gasto)", en: "Employer AFP (expense)" },
    ayuda: { es: "Aporte patronal a la AFP, como gasto de la Fundación.", en: "Employer pension (AFP) contribution, as an expense." },
    naturaleza: "debito",
  },
  {
    codigo: "NOM_SFS_EMPLEADOR_GASTO",
    modulo: "nomina",
    proceso: "sfs_empleador_gasto",
    nombre: { es: "SFS empleador (gasto)", en: "Employer SFS (expense)" },
    ayuda: { es: "Aporte patronal al Seguro Familiar de Salud, como gasto.", en: "Employer health insurance (SFS) contribution, as an expense." },
    naturaleza: "debito",
  },
  {
    codigo: "NOM_SRL_EMPLEADOR_GASTO",
    modulo: "nomina",
    proceso: "srl_empleador_gasto",
    nombre: { es: "Riesgo laboral empleador (gasto)", en: "Employer occupational risk (expense)" },
    ayuda: { es: "Aporte patronal al seguro de riesgos laborales, como gasto.", en: "Employer occupational risk insurance contribution, as an expense." },
    naturaleza: "debito",
  },
  {
    codigo: "NOM_INFOTEP_EMPLEADOR_GASTO",
    modulo: "nomina",
    proceso: "infotep_empleador_gasto",
    nombre: { es: "INFOTEP empleador (gasto)", en: "Employer INFOTEP (expense)" },
    ayuda: { es: "Aporte patronal a INFOTEP, como gasto.", en: "Employer INFOTEP contribution, as an expense." },
    naturaleza: "debito",
  },
  // ── Nómina: lo que queda por pagar a la TSS y a la DGII ──
  {
    codigo: "NOM_AFP_EMPLEADO_X_PAGAR",
    modulo: "nomina",
    proceso: "afp_empleado",
    nombre: { es: "AFP empleados por pagar", en: "Employee AFP payable" },
    ayuda: { es: "AFP retenida a los empleados que se debe pagar a la TSS.", en: "AFP withheld from employees, owed to the TSS." },
    naturaleza: "credito",
  },
  {
    codigo: "NOM_SFS_EMPLEADO_X_PAGAR",
    modulo: "nomina",
    proceso: "sfs_empleado",
    nombre: { es: "SFS empleados por pagar", en: "Employee SFS payable" },
    ayuda: { es: "SFS retenida a los empleados que se debe pagar a la TSS.", en: "SFS withheld from employees, owed to the TSS." },
    naturaleza: "credito",
  },
  {
    codigo: "NOM_AFP_EMPLEADOR_X_PAGAR",
    modulo: "nomina",
    proceso: "afp_empleador",
    nombre: { es: "AFP empleador por pagar", en: "Employer AFP payable" },
    ayuda: { es: "Aporte patronal a la AFP pendiente de pago a la TSS.", en: "Employer AFP contribution owed to the TSS." },
    naturaleza: "credito",
  },
  {
    codigo: "NOM_SFS_EMPLEADOR_X_PAGAR",
    modulo: "nomina",
    proceso: "sfs_empleador",
    nombre: { es: "SFS empleador por pagar", en: "Employer SFS payable" },
    ayuda: { es: "Aporte patronal al SFS pendiente de pago a la TSS.", en: "Employer SFS contribution owed to the TSS." },
    naturaleza: "credito",
  },
  {
    codigo: "NOM_SRL_EMPLEADOR_X_PAGAR",
    modulo: "nomina",
    proceso: "srl_empleador",
    nombre: { es: "Riesgo laboral empleador por pagar", en: "Employer occupational risk payable" },
    ayuda: { es: "Aporte patronal de riesgos laborales pendiente de pago a la TSS.", en: "Employer occupational risk contribution owed to the TSS." },
    naturaleza: "credito",
  },
  {
    codigo: "NOM_INFOTEP_EMPLEADOR_X_PAGAR",
    modulo: "nomina",
    proceso: "infotep_empleador",
    nombre: { es: "INFOTEP empleador por pagar", en: "Employer INFOTEP payable" },
    ayuda: { es: "Aporte patronal a INFOTEP pendiente de pago.", en: "Employer INFOTEP contribution owed." },
    naturaleza: "credito",
  },
  {
    codigo: "NOM_ISR_X_PAGAR",
    modulo: "nomina",
    proceso: "isr_empleado",
    nombre: { es: "ISR retenido por pagar", en: "Withheld income tax payable" },
    ayuda: { es: "ISR retenido a los empleados que se debe pagar a la DGII.", en: "Income tax (ISR) withheld from employees, owed to the DGII." },
    naturaleza: "credito",
  },
];

/** `true` si el texto tiene la forma de un código (lo usan las acciones y la prueba). */
export const FORMATO_CODIGO = /^[A-Z][A-Z0-9]*(_[A-Z0-9]+)*$/;

const POR_CODIGO = new Map(CODIGOS_TRANSACCION.map((d) => [d.codigo, d]));

export function definicionDe(codigo: string): DefinicionCodigo | undefined {
  return POR_CODIGO.get(codigo);
}

export function codigosDeModulo(modulo: ModuloCodigo): DefinicionCodigo[] {
  return CODIGOS_TRANSACCION.filter((d) => d.modulo === modulo);
}

/** Módulos en el orden en que se muestran (el de `ETIQUETA_MODULO`). */
export function modulosConCodigos(): ModuloCodigo[] {
  return (Object.keys(ETIQUETA_MODULO) as ModuloCodigo[]).filter((m) => codigosDeModulo(m).length > 0);
}

/** El idioma de la interfaz; cualquier otro cae en español. */
export function textoEn(texto: TextoBilingue, locale: string): string {
  return locale === "en" ? texto.en : texto.es;
}
