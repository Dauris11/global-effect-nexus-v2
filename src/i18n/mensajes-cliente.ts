import { getMessages } from "next-intl/server";

/**
 * Recorta los mensajes que viajan al navegador.
 *
 * `NextIntlClientProvider` sin `messages` explícitos serializa TODOS los
 * mensajes en el HTML: son 45 KB en español y crecen con cada módulo, en cada
 * página, aunque la mitad de los espacios no los use ningún componente cliente.
 *
 * Los componentes de servidor no dependen de esto: `getTranslations` y
 * `useTranslations` leen los mensajes en el servidor y no necesitan proveedor.
 * Así que aquí solo hace falta lo que consumen los componentes cliente.
 */

/**
 * Lo que necesita el armazón: barra lateral, barra superior y formularios de
 * acceso. `roles` va aquí porque la insignia de la barra superior es cliente.
 */
const ESPACIOS_BASE = [
  "common",
  "nav",
  "auth",
  "portal",
  "roles",
  // La campana de avisos está en la barra superior, así que su espacio es del
  // armazón y no de ninguna página.
  "notifications",
  // El widget flotante de IA vive en el armazón y está presente en todas las vistas
  "widgetIA",
  // Espacio del módulo de contabilidad para filtros, pestañas y estados
  "contab",
] as const;

/**
 * Mensajes base más los espacios extra que pida quien llama.
 *
 * Los proveedores anidados REEMPLAZAN los mensajes de su subárbol, no los
 * mezclan: si una pantalla necesita su propio espacio, tiene que pedirlo aquí
 * junto a los base, no montar un proveedor con el espacio suelto.
 */
export async function mensajesCliente(extra: readonly string[] = []) {
  const todos = await getMessages();
  const permitidos = new Set<string>([...ESPACIOS_BASE, ...extra]);

  return Object.fromEntries(
    Object.entries(todos).filter(([espacio]) => permitidos.has(espacio)),
  );
}
