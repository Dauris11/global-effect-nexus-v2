"use server";

import { revalidatePath } from "next/cache";
import type { PoolClient } from "pg";

import { registrar } from "@/lib/auditoria";
import { requerirUsuario } from "@/lib/auth";
import { enTransaccion, fijarContexto } from "@/lib/db";
import { contextoDe } from "@/server/contabilidad/sesion";
import { usuarioTienePermiso, type Permiso } from "@/lib/rbac";
import { borrarDocumento, subirMaterial } from "@/lib/supabase/almacen";
import {
  accionesPermitidas,
  DIAS_SEMANA_PASAJE,
  FORMATOS_COTIZACION,
  LUGAR_PASAJE_OTRO,
  MAXIMO_COTIZACION_BYTES,
  esAccionSolicitud,
  esDiaSemanaPasaje,
  esPeriodoPasaje,
  esRncOCedulaFormatoValido,
  esSolicitudDinamica,
  estadoTrasAccion,
  HORAS_CITA,
  limpiarRnc,
  MAXIMO_TEXTO,
  MAXIMO_TITULO,
  REGLAS,
  type DiaSemanaPasaje,
  type PeriodoPasaje,
  type TipoSolicitud,
  tiposQuePuedeCrear,
} from "@/lib/solicitudes";
import { estudianteDeUsuario } from "@/server/estudiantes/portal";
import { solicitudParaFlujo } from "@/server/solicitudes/consultas";

/**
 * Escritura de solicitudes (migración 0031).
 *
 * CADA PASO ES UNA TRANSACCIÓN CON TRES ESCRITURAS: el cambio de estado en
 * `solicitud`, la línea en `solicitud_paso` y el aviso en `notificacion`. Son
 * una sola cosa: un estado sin su paso deja la línea de tiempo mintiendo, y un
 * paso sin aviso deja al solicitante esperando algo que ya se decidió.
 *
 * EL CAMBIO DE ESTADO LLEVA EL ESTADO ANTERIOR EN EL WHERE. Dos revisores con
 * la bandeja abierta pueden pulsar a la vez; el segundo UPDATE no encuentra la
 * fila en el estado que vio y se le responde "ya la movió otra persona", en vez
 * de aprobar dos veces o pisar un rechazo.
 *
 * Los avisos son datos y no interfaz, igual que en tareas: el folio y el
 * título. La campana traduce el `tipo` del aviso, no la frase.
 */

export type EstadoFormularioSolicitud = {
  estado:
    | "inicial"
    | "ok"
    | "no_permitido"
    | "sin_expediente"
    | "invalido"
    | "fecha_invalida"
    | "duplicada"
    | "sin_archivo"
    | "formato_no_admitido"
    | "muy_grande"
    | "material_requerido"
    | "proveedor_invalido"
    | "lugar_requerido"
    | "motivo_requerido"
    | "monto_invalido"
    | "periodo_requerido"
    | "dias_requeridos"
    | "proposito_requerido"
    | "rnc_requerido"
    | "rnc_invalido"
    | "error";
  /** Solo con `ok`: la solicitud recién creada o editada, para el aviso «Ver» y el resaltado en la lista. */
  id?: string;
};

export type EstadoPasoSolicitud = {
  estado:
    | "inicial"
    | "ok"
    | "no_permitido"
    | "no_encontrado"
    | "ya_cambio"
    | "falta_comentario"
    | "invalido"
    | "error";
};

/**
 * Trámites académicos retirados en Etapa 2: los estudiantes utilizan
 * exclusivamente `guardarSolicitudDinamica` (Materiales, Pasaje u Otro).
 */
export async function crearTramite(): Promise<EstadoFormularioSolicitud> {
  await requerirUsuario();
  return { estado: "no_permitido" };
}

/**
 * Solicitud interna del personal: alta de expediente, beca o gasto.
 *
 * Quién puede pedir qué lo dice `tiposQuePuedeCrear`, la misma función que
 * decide qué opciones salen en el desplegable. El segundo nivel se calcula aquí
 * y se guarda: `requiere_direccion` no se vuelve a evaluar después.
 */
export async function crearSolicitudInterna(
  _previo: EstadoFormularioSolicitud,
  datos: FormData,
): Promise<EstadoFormularioSolicitud> {
  const usuario = await requerirUsuario();

  const tipo = String(datos.get("tipo") ?? "");
  const permitidos: readonly string[] = tiposQuePuedeCrear(usuario);

  if (!permitidos.includes(tipo)) return { estado: "no_permitido" };

  const tipoValido = tipo as TipoSolicitud;
  const campos = leerCampos(datos, tipoValido);
  if (campos === "invalido" || campos === "fecha_invalida") {
    return { estado: campos };
  }

  const regla = REGLAS[tipoValido];
  const estudianteElegido = String(datos.get("estudiante") ?? "").trim();
  // Habitudes postula a gente que todavía no existe en el sistema y no tiene
  // `expedientes.escribir` para crearla: sin esto el desplegable salía vacío
  // y la postulación no llegaba nunca a administración.
  const candidatoNuevo =
    tipoValido === "alta_expediente" && !esUuid(estudianteElegido)
      ? String(datos.get("candidato") ?? "").trim().slice(0, MAXIMO_TITULO)
      : "";

  if (
    regla.estudiante === "obligatorio" &&
    !esUuid(estudianteElegido) &&
    !candidatoNuevo
  ) {
    return { estado: "invalido" };
  }

  // Quien no lee expedientes solo puede nombrar candidatos del embudo, la
  // misma lista que `estudiantesParaSolicitud` le enseña.
  const soloEmbudo = !usuarioTienePermiso(usuario, "expedientes.leer");

  let nuevaId: string | undefined;
  try {
    const resultado = await enTransaccion(async (cliente) => {
      let estudianteId: string | null =
        regla.estudiante !== "no" && esUuid(estudianteElegido) ? estudianteElegido : null;

      if (estudianteId) {
        const existe = await cliente.query(
          `SELECT 1 FROM estudiante
            WHERE id = $1
              AND (NOT $2 OR estado IN ('reclutado', 'postulado', 'academia_liderazgo'))`,
          [estudianteId, soloEmbudo],
        );
        if (!existe.rowCount) return "invalido" as const;
      } else if (candidatoNuevo) {
        // Ficha mínima en el embudo, con sus tres perfiles vacíos por la misma
        // razón que en `crearExpediente`. El resto lo completa administración
        // al revisar la postulación.
        const nuevo = await cliente.query<{ id: string }>(
          `INSERT INTO estudiante (nombre, estado)
           VALUES ($1, 'postulado'::estado_estudiante)
           RETURNING id`,
          [candidatoNuevo],
        );
        estudianteId = nuevo.rows[0].id;
        await cliente.query(`INSERT INTO perfil_vivienda (estudiante_id) VALUES ($1)`, [estudianteId]);
        await cliente.query(`INSERT INTO perfil_salud (estudiante_id) VALUES ($1)`, [estudianteId]);
        await cliente.query(
          `INSERT INTO perfil_socioeconomico (estudiante_id) VALUES ($1)`,
          [estudianteId],
        );
      }

      nuevaId = await insertarSolicitud(cliente, {
        tipo: tipoValido,
        ...campos,
        solicitanteId: usuario.id,
        estudianteId,
        requiereDireccion: regla.direccion(campos.monto),
      });

      return "ok" as const;
    });

    if (resultado === "invalido") return { estado: "invalido" };
  } catch (error) {
    if (error instanceof FechaPasada) return { estado: "fecha_invalida" };
    console.error("[solicitudes] no se pudo registrar la solicitud", error);
    return { estado: "error" };
  }

  await registrar({
    usuarioId: usuario.id,
    accion: "solicitud.creada",
    entidad: "solicitud",
    datos: { tipo: tipoValido },
  });

  refrescar();
  return { estado: "ok", id: nuevaId };
}

/**
 * Solicitud de compra a contabilidad con cotización adjunta (migración 0070).
 *
 * La puede pedir CUALQUIER usuario con sesión, de cualquier rol: no hay
 * `tiposQuePuedeCrear` aquí a propósito. Lo que protege el flujo es quién
 * DECIDE (`contabilidad.aprobar`, y nunca quien la pidió), no quién pide.
 *
 * La cotización es obligatoria y se valida entera en el servidor —extensión,
 * tipo declarado y tamaño—: el `accept` del input solo es una ayuda. Se sube
 * ANTES de la transacción porque la ruta no depende del id de la solicitud
 * (lleva un UUID propio, nunca el nombre del archivo), y si la transacción
 * falla se borra el archivo para no dejar huérfanos en el bucket.
 */
export async function crearCompra(
  _previo: EstadoFormularioSolicitud,
  datos: FormData,
): Promise<EstadoFormularioSolicitud> {
  const usuario = await requerirUsuario();
  // Una compra corporativa (cotización, proveedor, cheque a contabilidad) no es un
  // trámite estudiantil: el estudiante pide constancias y permisos. Ocultar el
  // formulario no protege nada, así que el servidor lo rechaza.
  if (usuario.rol === "estudiante") return { estado: "no_permitido" };

  const campos = leerCampos(datos, "compra");
  if (campos === "invalido" || campos === "fecha_invalida") {
    return { estado: campos };
  }

  const archivo = datos.get("cotizacion");
  if (!(archivo instanceof File) || archivo.size === 0) {
    return { estado: "sin_archivo" };
  }

  const extension = archivo.name.split(".").pop()?.toLowerCase() ?? "";
  if (!(extension in FORMATOS_COTIZACION)) return { estado: "formato_no_admitido" };
  if (archivo.type && archivo.type !== FORMATOS_COTIZACION[extension]) {
    return { estado: "formato_no_admitido" };
  }
  if (archivo.size > MAXIMO_COTIZACION_BYTES) return { estado: "muy_grande" };

  const formato = extension === "jpeg" ? "jpg" : extension;
  const ruta = `compras/${crypto.randomUUID()}.${formato}`;

  const subida = await subirMaterial(ruta, archivo);
  if (!subida.ok) return { estado: "error" };

  try {
    await enTransaccion(async (cliente) => {
      const id = await insertarSolicitud(cliente, {
        tipo: "compra",
        ...campos,
        solicitanteId: usuario.id,
        estudianteId: null,
        requiereDireccion: false,
      });

      await cliente.query(
        `INSERT INTO solicitud_adjunto
           (solicitud_id, ruta, nombre, formato, tamano_bytes, subido_por)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [id, ruta, archivo.name.slice(0, 200), formato, archivo.size, usuario.id],
      );
    });
  } catch (error) {
    await borrarDocumento(ruta);
    console.error("[solicitudes] no se pudo registrar la compra", error);
    return { estado: "error" };
  }

  await registrar({
    usuarioId: usuario.id,
    accion: "solicitud.creada",
    entidad: "solicitud",
    datos: { tipo: "compra" },
  });

  refrescar();
  return { estado: "ok" };
}

/**
 * Reemplaza la cotización adjunta de una solicitud de compra mientras sigue
 * abierta (`enviada` o `en_revision`) y solo por quien la pidió.
 */
export async function reemplazarCotizacionCompra(
  _previo: EstadoFormularioSolicitud,
  datos: FormData,
): Promise<EstadoFormularioSolicitud> {
  const usuario = await requerirUsuario();
  const solicitudId = String(datos.get("id") ?? "");
  if (!esUuid(solicitudId)) return { estado: "invalido" };

  const archivo = datos.get("cotizacion");
  if (!(archivo instanceof File) || archivo.size === 0) {
    return { estado: "sin_archivo" };
  }

  const extension = archivo.name.split(".").pop()?.toLowerCase() ?? "";
  if (!(extension in FORMATOS_COTIZACION)) return { estado: "formato_no_admitido" };
  if (archivo.type && archivo.type !== FORMATOS_COTIZACION[extension]) {
    return { estado: "formato_no_admitido" };
  }
  if (archivo.size > MAXIMO_COTIZACION_BYTES) return { estado: "muy_grande" };

  const formato = extension === "jpeg" ? "jpg" : extension;
  const rutaNueva = `compras/${crypto.randomUUID()}.${formato}`;

  const subida = await subirMaterial(rutaNueva, archivo);
  if (!subida.ok) return { estado: "error" };

  let rutaAnterior: string | null = null;
  try {
    const resultado = await enTransaccion(async (cliente) => {
      const actual = await cliente.query<{
        solicitante_id: string | null;
        tipo: string;
        estado: string;
        ruta_anterior: string | null;
      }>(
        `SELECT s.solicitante_id,
                s.tipo,
                s.estado,
                ad.ruta AS ruta_anterior
           FROM solicitud s
           LEFT JOIN solicitud_adjunto ad ON ad.solicitud_id = s.id
          WHERE s.id = $1
          FOR UPDATE OF s`,
        [solicitudId],
      );

      const fila = actual.rows[0];
      if (!fila) return "invalido" as const;
      if (
        fila.solicitante_id !== usuario.id ||
        (fila.tipo !== "compra" && fila.tipo !== "MATERIALES" && fila.tipo !== "OTRO") ||
        (fila.estado !== "solicitado" && fila.estado !== "enviada" && fila.estado !== "en_revision")
      ) {
        return "no_permitido" as const;
      }

      rutaAnterior = fila.ruta_anterior;

      await cliente.query(
        `INSERT INTO solicitud_adjunto
           (solicitud_id, ruta, nombre, formato, tamano_bytes, subido_por)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (solicitud_id) DO UPDATE SET
           ruta = EXCLUDED.ruta,
           nombre = EXCLUDED.nombre,
           formato = EXCLUDED.formato,
           tamano_bytes = EXCLUDED.tamano_bytes,
           subido_por = EXCLUDED.subido_por`,
        [solicitudId, rutaNueva, archivo.name.slice(0, 200), formato, archivo.size, usuario.id],
      );

      return "ok" as const;
    });

    if (resultado !== "ok") {
      await borrarDocumento(rutaNueva);
      return { estado: resultado };
    }
  } catch (error) {
    await borrarDocumento(rutaNueva);
    console.error("[solicitudes] no se pudo reemplazar la cotización", error);
    return { estado: "error" };
  }

  if (rutaAnterior && rutaAnterior !== rutaNueva) {
    await borrarDocumento(rutaAnterior);
  }

  await registrar({
    usuarioId: usuario.id,
    accion: "solicitud.cotizacion_reemplazada",
    entidad: "solicitud",
    entidadId: solicitudId,
    datos: { nombre: archivo.name.slice(0, 200), formato },
  });

  refrescar();
  return { estado: "ok" };
}

/**
 * Crea o edita una solicitud dinámica de los 3 tipos de Etapa 1:
 *   · `MATERIALES`: tipo de material (catálogo), proveedor opcional (solo propósito Estudiantes), monto (>0), cotización opcional.
 *   · `PASAJE`: lugar (catálogo con monto DOP automático u «Otro» con motivo + monto obligatorios), periodo (Hoy / Semana / Personalizado con al menos 1 día).
 *   · `OTRO`: propósito obligatorio, monto (>0), proveedor editable opcional + RNC obligatorio (9 u 11 dígitos) si hay proveedor, cotización opcional.
 *
 * Todas las reglas condicionales se validan de nuevo en el servidor.
 */
export async function guardarSolicitudDinamica(
  _previo: EstadoFormularioSolicitud,
  datos: FormData,
): Promise<EstadoFormularioSolicitud> {
  const usuario = await requerirUsuario();

  const id = String(datos.get("id") ?? "").trim();
  if (id && !esUuid(id)) return { estado: "invalido" };

  const tipo = String(datos.get("tipo") ?? "").trim();
  if (!esSolicitudDinamica(tipo)) return { estado: "invalido" };

  const detalle = String(datos.get("detalle") ?? "").trim().slice(0, MAXIMO_TEXTO) || null;

  // Campos normalizados por tipo
  let tipoMaterialId: string | null = null;
  let proveedorId: string | null = null;
  let lugarPasajeId: string | null = null;
  let lugarPasajeOtro = false;
  let motivoPasaje: string | null = null;
  let periodoPasaje: PeriodoPasaje | null = null;
  let diasPasaje: DiaSemanaPasaje[] | null = null;
  let propositoOtro: string | null = null;
  let proveedorNombre: string | null = null;
  let proveedorRnc: string | null = null;
  let monto: number | null = null;

  const parsearMontoPositivo = (valor: string): number | null => {
    const limpio = valor.trim();
    if (!limpio) return null;
    const n = Number(limpio);
    if (!Number.isFinite(n) || n <= 0 || n >= 1e10) return null;
    return Math.round(n * 100) / 100;
  };

  if (tipo === "MATERIALES") {
    const matId = String(datos.get("tipo_material_id") ?? "").trim();
    if (!esUuid(matId)) return { estado: "material_requerido" };
    tipoMaterialId = matId;

    const provId = String(datos.get("proveedor_id") ?? "").trim();
    if (provId) {
      if (!esUuid(provId)) return { estado: "proveedor_invalido" };
      proveedorId = provId;
    }

    monto = parsearMontoPositivo(String(datos.get("monto") ?? ""));
    if (monto === null) return { estado: "monto_invalido" };
  } else if (tipo === "PASAJE") {
    const lugar = String(datos.get("lugar") ?? "").trim();
    if (!lugar) return { estado: "lugar_requerido" };

    if (lugar === LUGAR_PASAJE_OTRO) {
      lugarPasajeOtro = true;
      motivoPasaje = String(datos.get("motivo_pasaje") ?? "").trim().slice(0, 300);
      if (motivoPasaje.length < 2) return { estado: "motivo_requerido" };
      monto = parsearMontoPositivo(String(datos.get("monto") ?? ""));
      if (monto === null) return { estado: "monto_invalido" };
    } else {
      if (!esUuid(lugar)) return { estado: "lugar_requerido" };
      lugarPasajeId = lugar;
    }

    const periodo = String(datos.get("periodo_pasaje") ?? "").trim();
    if (!esPeriodoPasaje(periodo)) return { estado: "periodo_requerido" };
    periodoPasaje = periodo;

    if (periodoPasaje === "personalizado") {
      const seleccionados = new Set<DiaSemanaPasaje>();
      for (const d of datos.getAll("dias_pasaje")) {
        const val = String(d).trim();
        if (esDiaSemanaPasaje(val)) seleccionados.add(val);
      }
      const ordenados = DIAS_SEMANA_PASAJE.filter((d) => seleccionados.has(d));
      if (ordenados.length === 0) return { estado: "dias_requeridos" };
      diasPasaje = ordenados;
    }
  } else if (tipo === "OTRO") {
    propositoOtro = String(datos.get("proposito_otro") ?? "").trim().slice(0, 300);
    if (propositoOtro.length < 2) return { estado: "proposito_requerido" };

    monto = parsearMontoPositivo(String(datos.get("monto") ?? ""));
    if (monto === null) return { estado: "monto_invalido" };

    const provTexto = String(datos.get("proveedor_nombre") ?? "").trim().slice(0, 160);
    proveedorNombre = provTexto || null;

    const rncCrudo = String(datos.get("proveedor_rnc") ?? "").trim();
    if (proveedorNombre) {
      if (!rncCrudo) return { estado: "rnc_requerido" };
      if (!esRncOCedulaFormatoValido(rncCrudo)) return { estado: "rnc_invalido" };
      proveedorRnc = limpiarRnc(rncCrudo);
    } else if (rncCrudo) {
      if (!esRncOCedulaFormatoValido(rncCrudo)) return { estado: "rnc_invalido" };
      proveedorRnc = limpiarRnc(rncCrudo);
    }
  }

  // Archivo de cotización opcional (solo para MATERIALES y OTRO)
  let rutaNueva: string | null = null;
  let nombreArchivo: string | null = null;
  let formatoArchivo: string | null = null;
  let tamanoArchivo = 0;

  if (tipo === "MATERIALES" || tipo === "OTRO") {
    const archivo = datos.get("cotizacion");
    if (archivo instanceof File && archivo.size > 0) {
      const extension = archivo.name.split(".").pop()?.toLowerCase() ?? "";
      if (!(extension in FORMATOS_COTIZACION)) return { estado: "formato_no_admitido" };
      if (archivo.type && archivo.type !== FORMATOS_COTIZACION[extension]) {
        return { estado: "formato_no_admitido" };
      }
      if (archivo.size > MAXIMO_COTIZACION_BYTES) return { estado: "muy_grande" };

      formatoArchivo = extension === "jpeg" ? "jpg" : extension;
      nombreArchivo = archivo.name.slice(0, 200);
      tamanoArchivo = archivo.size;
      rutaNueva = `solicitudes/${crypto.randomUUID()}.${formatoArchivo}`;

      const subida = await subirMaterial(rutaNueva, archivo);
      if (!subida.ok) return { estado: "error" };
    }
  }

  let estudianteId: string | null = null;
  if (usuario.rol === "estudiante") {
    try {
      const est = await estudianteDeUsuario(usuario.id);
      estudianteId = est.id;
    } catch {
      if (rutaNueva) await borrarDocumento(rutaNueva);
      return { estado: "sin_expediente" };
    }
  }

  let rutaAnterior: string | null = null;
  let solicitudIdFinal: string | undefined;

  try {
    const resultado = await enTransaccion(async (cliente) => {
      let existente: {
        solicitante_id: string | null;
        estado: string;
        tipo_material_id: string | null;
        lugar_pasaje_id: string | null;
        ruta_anterior: string | null;
      } | null = null;

      if (id) {
        const resEx = await cliente.query<{
          solicitante_id: string | null;
          estado: string;
          tipo_material_id: string | null;
          lugar_pasaje_id: string | null;
          ruta_anterior: string | null;
        }>(
          `SELECT s.solicitante_id, s.estado, s.tipo_material_id, s.lugar_pasaje_id,
                  ad.ruta AS ruta_anterior
             FROM solicitud s
             LEFT JOIN solicitud_adjunto ad ON ad.solicitud_id = s.id
            WHERE s.id = $1
            FOR UPDATE OF s`,
          [id],
        );
        existente = resEx.rows[0] ?? null;
        if (!existente) return "invalido" as const;
        if (
          existente.solicitante_id !== usuario.id ||
          (existente.estado !== "solicitado" && existente.estado !== "enviada" && existente.estado !== "en_revision")
        ) {
          return "no_permitido" as const;
        }
        rutaAnterior = existente.ruta_anterior;
      }

      let titulo = "";

      if (tipo === "MATERIALES" && tipoMaterialId) {
        const resMat = await cliente.query<{ nombre: string; activo: boolean }>(
          `SELECT nombre, activo FROM public.tipo_material WHERE id = $1`,
          [tipoMaterialId],
        );
        const mat = resMat.rows[0];
        if (!mat || (!mat.activo && existente?.tipo_material_id !== tipoMaterialId)) {
          return "material_requerido" as const;
        }

        if (proveedorId) {
          const resProv = await cliente.query<{ id: string }>(
            `SELECT id FROM contabilidad.proveedor
              WHERE id = $1 AND estado = 'activo' AND proposito = 'estudiantes'`,
            [proveedorId],
          );
          if (!resProv.rowCount) return "proveedor_invalido" as const;
        }

        titulo = `Materiales · ${mat.nombre}`.slice(0, MAXIMO_TITULO);
      } else if (tipo === "PASAJE") {
        if (!lugarPasajeOtro && lugarPasajeId) {
          const resLugar = await cliente.query<{ nombre: string; monto: string; activo: boolean }>(
            `SELECT nombre, monto::text AS monto, activo FROM public.lugar_pasaje WHERE id = $1`,
            [lugarPasajeId],
          );
          const lp = resLugar.rows[0];
          if (!lp || (!lp.activo && existente?.lugar_pasaje_id !== lugarPasajeId)) {
            return "lugar_requerido" as const;
          }
          monto = Math.round(Number(lp.monto) * 100) / 100;
          titulo = `Pasaje · ${lp.nombre}`.slice(0, MAXIMO_TITULO);
        } else {
          titulo = `Pasaje · ${motivoPasaje ?? ""}`.slice(0, MAXIMO_TITULO);
        }
      } else if (tipo === "OTRO") {
        titulo = (propositoOtro ?? "Otro").slice(0, MAXIMO_TITULO);
      }

      if (id) {
        await cliente.query(
          `UPDATE solicitud
              SET tipo = $2,
                  titulo = $3,
                  detalle = $4,
                  monto = $5,
                  moneda = 'DOP',
                  tipo_material_id = $6,
                  proveedor_id = $7,
                  lugar_pasaje_id = $8,
                  lugar_pasaje_otro = $9,
                  motivo_pasaje = $10,
                  periodo_pasaje = $11,
                  dias_pasaje = $12::jsonb,
                  proposito_otro = $13,
                  proveedor_nombre = $14,
                  proveedor_rnc = $15
            WHERE id = $1`,
          [
            id,
            tipo,
            titulo,
            detalle,
            monto,
            tipoMaterialId,
            proveedorId,
            lugarPasajeId,
            lugarPasajeOtro,
            motivoPasaje,
            periodoPasaje,
            diasPasaje ? JSON.stringify(diasPasaje) : null,
            propositoOtro,
            proveedorNombre,
            proveedorRnc,
          ],
        );

        if (tipo === "PASAJE" && rutaAnterior) {
          await cliente.query(`DELETE FROM solicitud_adjunto WHERE solicitud_id = $1`, [id]);
        } else if (rutaNueva && nombreArchivo && formatoArchivo) {
          await cliente.query(
            `INSERT INTO solicitud_adjunto
               (solicitud_id, ruta, nombre, formato, tamano_bytes, subido_por)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (solicitud_id) DO UPDATE SET
               ruta = EXCLUDED.ruta,
               nombre = EXCLUDED.nombre,
               formato = EXCLUDED.formato,
               tamano_bytes = EXCLUDED.tamano_bytes,
               subido_por = EXCLUDED.subido_por`,
            [id, rutaNueva, nombreArchivo, formatoArchivo, tamanoArchivo, usuario.id],
          );
        }

        solicitudIdFinal = id;
      } else {
        const resIns = await cliente.query<{ id: string; folio: number }>(
          `INSERT INTO solicitud
             (tipo, estado, titulo, detalle, solicitante_id, estudiante_id, monto, moneda,
              requiere_direccion, tipo_material_id, proveedor_id, lugar_pasaje_id,
              lugar_pasaje_otro, motivo_pasaje, periodo_pasaje, dias_pasaje,
              proposito_otro, proveedor_nombre, proveedor_rnc)
           VALUES ($1, 'solicitado', $2, $3, $4, $5, $6, 'DOP', FALSE, $7, $8, $9, $10, $11, $12, $13::jsonb, $14, $15, $16)
           RETURNING id, folio::int AS folio`,
          [
            tipo,
            titulo,
            detalle,
            usuario.id,
            estudianteId,
            monto,
            tipoMaterialId,
            proveedorId,
            lugarPasajeId,
            lugarPasajeOtro,
            motivoPasaje,
            periodoPasaje,
            diasPasaje ? JSON.stringify(diasPasaje) : null,
            propositoOtro,
            proveedorNombre,
            proveedorRnc,
          ],
        );
        const creada = resIns.rows[0];
        solicitudIdFinal = creada.id;

        if (rutaNueva && nombreArchivo && formatoArchivo) {
          await cliente.query(
            `INSERT INTO solicitud_adjunto
               (solicitud_id, ruta, nombre, formato, tamano_bytes, subido_por)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [creada.id, rutaNueva, nombreArchivo, formatoArchivo, tamanoArchivo, usuario.id],
          );
        }

        await cliente.query(
          `INSERT INTO solicitud_paso (solicitud_id, estado_anterior, estado_nuevo, usuario_id)
           VALUES ($1, NULL, 'solicitado', $2)`,
          [creada.id, usuario.id],
        );

        await avisarA(
          cliente,
          REGLAS[tipo].revisa,
          `#${creada.folio} · ${titulo}`,
          "solicitado",
          usuario.id,
        );
      }

      return "ok" as const;
    });

    if (resultado !== "ok") {
      if (rutaNueva) await borrarDocumento(rutaNueva);
      return { estado: resultado };
    }
  } catch (error) {
    if (rutaNueva) await borrarDocumento(rutaNueva);
    console.error("[solicitudes] no se pudo guardar solicitud dinámica", error);
    return { estado: "error" };
  }

  if (rutaAnterior && ((rutaNueva && rutaAnterior !== rutaNueva) || tipo === "PASAJE")) {
    await borrarDocumento(rutaAnterior);
  }

  await registrar({
    usuarioId: usuario.id,
    accion: id ? "solicitud.editada" : "solicitud.creada",
    entidad: "solicitud",
    entidadId: solicitudIdFinal,
    datos: { tipo },
  });

  refrescar();
  return { estado: "ok", id: solicitudIdFinal };
}

/**
 * Un paso del flujo: tomar, aprobar, aprobar en dirección, rechazar, completar
 * o cancelar.
 *
 * Rechazar exige comentario: un "no" sin motivo es la respuesta que más
 * llamadas genera después. El resto lo admite y no lo pide.
 */
export async function avanzarSolicitud(
  _previo: EstadoPasoSolicitud,
  datos: FormData,
): Promise<EstadoPasoSolicitud> {
  const usuario = await requerirUsuario();

  const id = String(datos.get("id") ?? "");
  const accion = String(datos.get("accion") ?? "");
  const comentario = String(datos.get("comentario") ?? "").trim().slice(0, MAXIMO_TEXTO);

  if (!esUuid(id) || !esAccionSolicitud(accion)) return { estado: "invalido" };
  // `rechazar` es la ÚNICA vía de rechazo, también la del segundo nivel
  // (dirección rechaza con esta misma acción), así que este es el único sitio
  // donde hay que exigir el motivo.
  if (accion === "rechazar" && !comentario) return { estado: "falta_comentario" };

  const solicitud = await solicitudParaFlujo(id);
  if (!solicitud) return { estado: "no_encontrado" };

  if (!accionesPermitidas(solicitud, usuario).includes(accion)) {
    return { estado: "no_permitido" };
  }

  const nuevo = estadoTrasAccion(accion, solicitud.requiere_direccion);
  const contexto = await contextoDe(usuario);
  const cierra = nuevo === "rechazada" || nuevo === "completada" || nuevo === "cancelada";

  try {
    const movida = await enTransaccion(async (cliente) => {
      const actualizada = await cliente.query(
        `UPDATE solicitud
            SET estado = $3,
                responsable_id = CASE WHEN $4 THEN $5::uuid ELSE responsable_id END,
                respuesta = coalesce(NULLIF($6, ''), respuesta),
                resuelta_en = CASE WHEN $7 THEN now() ELSE resuelta_en END
          WHERE id = $1 AND estado = $2`,
        [
          id,
          solicitud.estado,
          nuevo,
          // Quien la toma queda como responsable; los pasos siguientes no lo
          // cambian, para que el solicitante sepa siempre con quién habla.
          accion === "tomar",
          usuario.id,
          // Lo que se le dice al solicitante. La cancelación es suya y no es
          // una respuesta para nadie.
          accion === "cancelar" ? "" : comentario,
          cierra,
        ],
      );

      if (!actualizada.rowCount) return false;

      await cliente.query(
        `INSERT INTO solicitud_paso
           (solicitud_id, estado_anterior, estado_nuevo, comentario, usuario_id)
         VALUES ($1, $2, $3, NULLIF($4, ''), $5)`,
        [id, solicitud.estado, nuevo, comentario, usuario.id],
      );

      // Un gasto o compra aprobado en su ÚLTIMO nivel nace como cuenta por pagar en
      // contabilidad (§4.5), en esta misma transacción: si la aprobación se
      // deshace, la deuda también. La bitácora contable exige identidad,
      // así que se fija aquí, dentro de la transacción ya abierta.
      if (nuevo === "aprobada" && (solicitud.tipo === "gasto" || solicitud.tipo === "compra")) {
        await fijarContexto(cliente, contexto);
        await cliente.query(`SELECT contabilidad.crear_cxp_desde_solicitud($1)`, [id]);
      }

      // Al aprobar un `alta_expediente`, el candidato del embudo pasa a
      // estudiante `activo` en la misma transacción, sin obligar a abrir su
      // ficha aparte para cambiarle el estado a mano.
      if (nuevo === "aprobada" && solicitud.tipo === "alta_expediente" && solicitud.estudiante_id) {
        await cliente.query(
          `UPDATE estudiante
              SET estado = 'activo'::estado_estudiante
            WHERE id = $1
              AND estado IN ('reclutado', 'postulado', 'academia_liderazgo')`,
          [solicitud.estudiante_id],
        );
      }

      const aviso = `#${solicitud.folio} · ${solicitud.titulo}`;

      // Al solicitante, salvo que el paso sea suyo.
      if (solicitud.solicitante_id && solicitud.solicitante_id !== usuario.id) {
        await cliente.query(
          `INSERT INTO notificacion (usuario_id, titulo, mensaje, tipo, enlace)
           SELECT u.id, $2, $3, 'solicitud', $4
             FROM usuario u
            WHERE u.id = $1 AND u.activo`,
          [
            solicitud.solicitante_id,
            aviso,
            comentario || nuevo,
            await enlaceDelSolicitante(cliente, solicitud.solicitante_id),
          ],
        );
      }

      // Al pasar a dirección, a quien decide el segundo nivel.
      if (nuevo === "pendiente_direccion") {
        await avisarA(cliente, "solicitudes.direccion", aviso, nuevo, usuario.id);
      }

      return true;
    });

    if (!movida) return { estado: "ya_cambio" };
  } catch (error) {
    console.error("[solicitudes] no se pudo avanzar la solicitud", error);
    return { estado: "error" };
  }

  // Las decisiones van a auditoría. Tomar y cancelar no deciden nada.
  if (accion !== "tomar" && accion !== "cancelar") {
    await registrar({
      usuarioId: usuario.id,
      accion: `solicitud.${nuevo}`,
      entidad: "solicitud",
      entidadId: id,
      datos: { folio: solicitud.folio, tipo: solicitud.tipo, desde: solicitud.estado },
    });
  }

  refrescar();
  return { estado: "ok" };
}

type Campos = {
  titulo: string;
  detalle: string | null;
  monto: number | null;
  fecha: string | null;
  hora: string | null;
};

/**
 * Lee y valida los campos comunes según las reglas del tipo.
 *
 * Los desplegables y las fechas se vuelven a comprobar aquí: el navegador se
 * puede manipular. La fecha pasada se rechaza en la base, no en Node, para no
 * depender de la zona horaria del proceso; aquí solo se mira el formato.
 */
function leerCampos(
  datos: FormData,
  tipo: TipoSolicitud,
): Campos | "invalido" | "fecha_invalida" {
  const regla = REGLAS[tipo];

  const titulo = String(datos.get("titulo") ?? "").trim().slice(0, MAXIMO_TITULO);
  const detalle = String(datos.get("detalle") ?? "").trim().slice(0, MAXIMO_TEXTO);
  const fecha = String(datos.get("fecha") ?? "").trim();
  const hora = String(datos.get("hora") ?? "").trim();
  const montoTexto = String(datos.get("monto") ?? "").trim();

  if (!titulo) return "invalido";

  if (fecha && !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return "fecha_invalida";
  if (regla.fecha === "obligatorio" && !fecha) return "fecha_invalida";

  if (hora && !(HORAS_CITA as readonly string[]).includes(hora)) return "invalido";

  let monto: number | null = null;
  if (regla.monto !== "no" && montoTexto) {
    monto = Number(montoTexto);
    if (!Number.isFinite(monto) || monto <= 0 || monto >= 1e10) return "invalido";
    monto = Math.round(monto * 100) / 100;
  }
  if (regla.monto === "obligatorio" && monto === null) return "invalido";

  return {
    titulo,
    detalle: detalle || null,
    monto,
    fecha: regla.fecha === "no" ? null : fecha || null,
    // La hora solo tiene sentido en la cita.
    hora: tipo === "cita_administracion" ? hora || null : null,
  };
}

async function insertarSolicitud(
  cliente: PoolClient,
  datos: Campos & {
    tipo: TipoSolicitud;
    solicitanteId: string;
    estudianteId: string | null;
    requiereDireccion: boolean;
  },
): Promise<string> {
  const fila = await cliente.query<{ id: string; folio: number; pasada: boolean }>(
    `INSERT INTO solicitud
       (tipo, titulo, detalle, solicitante_id, estudiante_id, monto,
        fecha_requerida, hora_preferida, requiere_direccion)
     VALUES ($1, $2, $3, $4, $5, $6, $7::date, $8, $9)
     RETURNING id, folio::int AS folio,
               coalesce(fecha_requerida < (now() AT TIME ZONE 'America/Santo_Domingo')::date, FALSE) AS pasada`,
    [
      datos.tipo,
      datos.titulo,
      datos.detalle,
      datos.solicitanteId,
      datos.estudianteId,
      datos.monto,
      datos.fecha,
      datos.hora,
      datos.requiereDireccion,
    ],
  );

  const creada = fila.rows[0];
  if (!creada) throw new Error("la solicitud no devolvió id");

  // Un error lanzado aquí deshace el INSERT de arriba: es la misma transacción.
  if (creada.pasada) throw new FechaPasada();

  await cliente.query(
    `INSERT INTO solicitud_paso (solicitud_id, estado_anterior, estado_nuevo, usuario_id)
     VALUES ($1, NULL, 'enviada', $2)`,
    [creada.id, datos.solicitanteId],
  );

  await avisarA(
    cliente,
    REGLAS[datos.tipo].revisa,
    `#${creada.folio} · ${datos.titulo}`,
    "enviada",
    datos.solicitanteId,
  );

  return creada.id;
}

/**
 * Aviso a todas las cuentas activas que tienen el permiso, menos a quien actúa.
 *
 * Cuenta el rol Y las excepciones de `usuario_permiso`, igual que
 * `usuarioTienePermiso`: si no, a quien se le concede revisar a título
 * personal le salía la solicitud en la bandeja pero nunca le llegaba el aviso,
 * y a quien se le revoca le seguían llegando avisos de algo que no puede tocar.
 */
async function avisarA(
  cliente: PoolClient,
  permiso: Permiso,
  titulo: string,
  mensaje: string,
  excepto: string,
) {
  await cliente.query(
    `INSERT INTO notificacion (usuario_id, titulo, mensaje, tipo, enlace)
     SELECT u.id, $2, $3, 'solicitud', '/administrativo/solicitudes'
       FROM usuario u
       JOIN permiso p ON p.codigo = $1
      WHERE u.activo
        AND u.id <> $4
        AND coalesce(
              (SELECT up.concedido FROM usuario_permiso up
                WHERE up.usuario_id = u.id AND up.permiso_id = p.id),
              EXISTS (SELECT 1 FROM rol_permiso rp
                       WHERE rp.rol_id = u.rol_id AND rp.permiso_id = p.id))`,
    [permiso, titulo, mensaje, excepto],
  );
}

/** El estudiante sigue sus trámites en su portal; el personal, en la bandeja. */
async function enlaceDelSolicitante(cliente: PoolClient, usuarioId: string) {
  const fila = await cliente.query<{ nombre: string }>(
    `SELECT r.nombre FROM usuario u JOIN rol r ON r.id = u.rol_id WHERE u.id = $1`,
    [usuarioId],
  );

  return fila.rows[0]?.nombre === "estudiante"
    ? "/portal/estudiante/solicitudes"
    : "/administrativo/solicitudes";
}

class FechaPasada extends Error {}

function refrescar() {
  revalidatePath("/[locale]/portal/estudiante/solicitudes", "page");
  revalidatePath("/[locale]/administrativo/solicitudes", "page");
  revalidatePath("/[locale]/contabilidad/cuentas-por-pagar/solicitudes", "page");
  revalidatePath("/[locale]/contabilidad/pasaje", "page");
  revalidatePath("/[locale]/portal/administrativo", "page");
  revalidatePath("/[locale]/portal/estudiante", "page");
  revalidatePath("/[locale]/expedientes", "page");
  // La campana vive en el armazón.
  revalidatePath("/[locale]", "layout");
}

function esUuid(valor: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    valor,
  );
}
