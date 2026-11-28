import { consultar } from "@/lib/db";

export type TipoMaterial = {
  id: string;
  nombre: string;
  activo: boolean;
};

export type LugarPasaje = {
  id: string;
  nombre: string;
  /** Monto configurado en DOP. */
  monto: number;
  /** Si el período Personalizado multiplica el monto por los días seleccionados. */
  multiplicar_por_dias: boolean;
  activo: boolean;
};

export async function listarTiposMaterial(soloActivos = false): Promise<TipoMaterial[]> {
  return consultar<TipoMaterial>(
    `SELECT id, nombre, activo
       FROM public.tipo_material
      WHERE ($1::boolean IS NOT TRUE OR activo = true)
      ORDER BY activo DESC, nombre ASC`,
    [soloActivos],
  );
}

export async function listarLugaresPasaje(soloActivos = false): Promise<LugarPasaje[]> {
  return consultar<LugarPasaje>(
    `SELECT id, nombre, monto::float8 AS monto,
            COALESCE(multiplicar_por_dias, true) AS multiplicar_por_dias,
            activo
       FROM public.lugar_pasaje
      WHERE ($1::boolean IS NOT TRUE OR activo = true)
      ORDER BY activo DESC, nombre ASC`,
    [soloActivos],
  );
}
