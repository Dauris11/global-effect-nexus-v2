/**
 * Los cinco tipos de cuenta del catálogo. Viven aquí y no en
 * `server/…/consultas` porque un componente cliente solo importa tipos de
 * esa capa; el valor lo necesita el desplegable del diálogo.
 */
export const TIPOS_CUENTA = ["activo", "pasivo", "patrimonio", "ingreso", "gasto"] as const;
export type TipoCuenta = (typeof TIPOS_CUENTA)[number];
