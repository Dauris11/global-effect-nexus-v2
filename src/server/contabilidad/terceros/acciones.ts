"use server";

import { revalidatePath } from "next/cache";
import { requerirUsuario } from "@/lib/auth";
import { cedulaValida, rncValido } from "@/lib/contabilidad/identificacion";
import { enTransaccionComo } from "@/lib/db";
import { fijarAccion } from "@/server/contabilidad/bitacora";
import { contextoDe } from "@/server/contabilidad/sesion";

export type EstadoAccionTercero = {
  ok: boolean;
  error?: string;
  id?: string;
};

export async function crearTercero(datos: {
  tipoPersona: "fisica" | "juridica" | "gubernamental";
  tipoId: "rnc" | "cedula" | "pasaporte";
  identificacion: string;
  nombreRazonSocial: string;
  nombreComercial?: string;
  contactoPrincipal?: string;
  telefono?: string;
  email?: string;
  direccion?: string;
  pais?: string;
  esDonante?: boolean;
  esProveedor?: boolean;
  esEmpleado?: boolean;
}): Promise<EstadoAccionTercero> {
  const usuario = await requerirUsuario();
  const idLimpio = datos.identificacion.replace(/\D/g, "");

  if (datos.tipoId === "rnc") {
    if (!rncValido(idLimpio)) {
      return { ok: false, error: "RNC inválido según algoritmo DGII" };
    }
  } else if (datos.tipoId === "cedula") {
    if (!cedulaValida(idLimpio)) {
      return { ok: false, error: "Cédula inválida según algoritmo de verificación" };
    }
  } else if (!datos.identificacion.trim()) {
    return { ok: false, error: "Identificación requerida" };
  }

  if (!datos.nombreRazonSocial.trim()) {
    return { ok: false, error: "El nombre o razón social es obligatorio" };
  }

  const idFinal = datos.tipoId === "pasaporte" ? datos.identificacion.trim() : idLimpio;

  try {
    const res = await enTransaccionComo<string>(await contextoDe(usuario), async (cliente) => {
      await fijarAccion(cliente, "crear_tercero");

      const insertSql = `
        INSERT INTO contabilidad.tercero (
          tipo_persona, tipo_id, identificacion, nombre_razon_social,
          nombre_comercial, contacto_principal, telefono, email,
          direccion, pais, es_donante, es_proveedor, es_empleado,
          creado_por
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        RETURNING id
      `;

      const { rows } = await cliente.query<{ id: string }>(insertSql, [
        datos.tipoPersona,
        datos.tipoId,
        idFinal,
        datos.nombreRazonSocial.trim(),
        datos.nombreComercial?.trim() || null,
        datos.contactoPrincipal?.trim() || null,
        datos.telefono?.trim() || null,
        datos.email?.trim() || null,
        datos.direccion?.trim() || null,
        datos.pais?.trim() || "DO",
        Boolean(datos.esDonante),
        Boolean(datos.esProveedor),
        Boolean(datos.esEmpleado),
        usuario.id,
      ]);

      return rows[0].id;
    });

    revalidatePath("/contabilidad/terceros");
    revalidatePath("/contabilidad/proveedores");
    return { ok: true, id: res };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("uq_tercero_identificacion")) {
      return { ok: false, error: "Ya existe un tercero con esta identificación" };
    }
    return { ok: false, error: "Error al registrar tercero" };
  }
}

export async function registrarDebidaDiligencia(datos: {
  terceroId: string;
  origenFondosDeclarado: string;
  verificacionPep: boolean;
  verificacionListas: boolean;
  resultado: "aprobado" | "observado" | "rechazado";
  observaciones?: string;
  soporteUrl?: string;
}): Promise<EstadoAccionTercero> {
  const usuario = await requerirUsuario();

  if (!datos.origenFondosDeclarado.trim()) {
    return { ok: false, error: "El origen de fondos es obligatorio (Ley 155-17)" };
  }

  try {
    const res = await enTransaccionComo<string>(await contextoDe(usuario), async (cliente) => {
      await fijarAccion(cliente, "registrar_debida_diligencia");

      const insertSql = `
        INSERT INTO contabilidad.debida_diligencia (
          tercero_id, origen_fondos_declarado, verificacion_pep,
          verificacion_listas, resultado, oficial_cumplimiento_id,
          observaciones, soporte_url
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id
      `;

      const { rows } = await cliente.query<{ id: string }>(insertSql, [
        datos.terceroId,
        datos.origenFondosDeclarado.trim(),
        Boolean(datos.verificacionPep),
        Boolean(datos.verificacionListas),
        datos.resultado,
        usuario.id,
        datos.observaciones?.trim() || null,
        datos.soporteUrl?.trim() || null,
      ]);

      return rows[0].id;
    });

    revalidatePath(`/contabilidad/terceros`);
    return { ok: true, id: res };
  } catch {
    return { ok: false, error: "Error al registrar debida diligencia" };
  }
}
