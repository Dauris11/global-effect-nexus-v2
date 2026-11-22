"use server";

import { randomBytes } from "node:crypto";

import { headers } from "next/headers";
import { getLocale } from "next-intl/server";
import { revalidatePath } from "next/cache";

import { redirigir } from "@/i18n/navigation";
import { registrar } from "@/lib/auditoria";
import { consultar, enTransaccion, consultarUna } from "@/lib/db";
import { requerirUsuario } from "@/lib/auth";
import {
  esEstadoEstudiante,
  FAMILIA_FIJA,
  llevaCuenta,
  GENEROS,
} from "@/lib/expedientes";
import {
  usuarioTienePermiso,
} from "@/lib/rbac";
import { crearIdentidad, enlaceParaEstablecerClave } from "@/lib/supabase/admin";
import { borrarDocumento, subirAvatar } from "@/lib/supabase/almacen";
import { encolarCorreo } from "@/server/compartidos/notificaciones";
import { estaEnLaVega } from "@/lib/la-vega-geografia";
import { leerDocumentoDeIdentidad } from "@/server/ia/ocr";
import { resolverCatalogo } from "@/server/universidades/catalogo-estudiante";

/**
 * Guardado del expediente: la escritura de S5, alta y edición.
 *
 * El alta era lo último que le faltaba al módulo y lo que más pesa: **un
 * expediente nuevo escribe en seis tablas** —`estudiante`, sus tres perfiles y
 * los cinco bloques de `familiar`— y todas o ninguna. De ahí que las dos
 * acciones compartan `enTransaccion()` y el mismo lector de campos: la
 * diferencia entre crear y corregir es el INSERT frente al UPDATE, no setenta
 * campos leídos dos veces.
 *
 * Escribe quien tenga `expedientes.escribir`: `admin` y `super_admin` desde
 * la 0030, sobre cualquier estudiante. Hasta entonces el expediente era de
 * psicología con aislamiento por fila (`psicologo_id`); el departamento se
 * cerró, la columna se borró y el filtro con ella. Se comprueba el permiso y
 * no el rol: si mañana otro rol gana la escritura, se le da en la base y aquí
 * no hay que tocar nada.
 */

export type EstadoExpediente = {
  estado:
    | "inicial"
    | "ok"
    | "no_permitido"
    | "no_encontrado"
    | "invalido"
    | "foto_invalida"
    | "foto_grande"
    | "catalogo_invalido"
    | "faltan_datos_universidad"
    | "error";
};

const TIPOS_FOTO = ["image/jpeg", "image/png", "image/webp"];
const MAXIMO_FOTO = 2 * 1024 * 1024;

export async function actualizarExpediente(
  _previo: EstadoExpediente,
  datos: FormData,
): Promise<EstadoExpediente> {
  const usuario = await requerirUsuario();

  if (!usuarioTienePermiso(usuario, "expedientes.escribir")) {
    return { estado: "no_permitido" };
  }

  const id = String(datos.get("id") ?? "");
  if (!esUuid(id)) return { estado: "invalido" };

  const nombre = String(datos.get("nombre") ?? "").trim();
  if (!nombre) return { estado: "invalido" };

  const texto = lectorDeTexto(datos);
  const numero = lectorDeNumero(datos);
  // Grupo (cohorte): entero positivo o vacío. Se valida aquí: un `input number`
  // del navegador se puede manipular.
  const grupoLeido = numero("grupo");
  const grupo = grupoLeido !== null && Number.isInteger(grupoLeido) && grupoLeido > 0 && grupoLeido < 1000 ? grupoLeido : null;

  // Los desplegables se vuelven a comprobar aquí: un `select` del navegador
  // se puede manipular.
  const estado = String(datos.get("estado") ?? "activo");
  const genero = texto("genero");

  if (!esEstadoEstudiante(estado)) {
    return { estado: "invalido" };
  }
  if (genero && !(GENEROS as readonly string[]).includes(genero)) {
    return { estado: "invalido" };
  }

  // La foto es opcional en cada guardado: un `input file` vacío llega como un
  // File de 0 bytes, no como null, así que hace falta comprobar el tamaño.
  let rutaFoto: string | null = null;
  const foto = datos.get("foto");

  if (foto instanceof File && foto.size > 0) {
    if (!TIPOS_FOTO.includes(foto.type)) return { estado: "foto_invalida" };
    if (foto.size > MAXIMO_FOTO) return { estado: "foto_grande" };

    // La ruta lleva el id del estudiante y no el nombre del archivo que se
    // subió, igual que `guardarPerfil`. El prefijo `estudiantes/` es solo para
    // que quien mire el bucket distinga estas fotos de las de `usuario`.
    const extension =
      foto.type === "image/png" ? "png" : foto.type === "image/webp" ? "webp" : "jpg";
    const subida = await subirAvatar(`estudiantes/${id}.${extension}`, foto);

    if (!subida.ok) return { estado: "error" };
    rutaFoto = subida.ruta;
  }

  try {
    await enTransaccion(async (cliente) => {
      // Se lee antes del UPDATE (y se bloquea la fila) para registrar el paso
      // de etapa solo si el estado cambió de verdad.
      const previo = await cliente.query<{ estado: string; universidad_id: string | null; carrera_id: string | null; pensum_id: string | null }>(
        `SELECT estado, universidad_id, carrera_id, pensum_id FROM estudiante WHERE id = $1 FOR UPDATE`,
        [id],
      );

      // Universidad, carrera y pénsum del catálogo (ya no son texto libre).
      const catalogo = await resolverCatalogo(cliente, datos);

      if (!catalogo) throw new Error("CATALOGO_INVALIDO");

      // Solo los activos son parte de la Fundación: para pasar a activo hay que llenar la universidad.
      if (estado === "activo" && previo.rows[0]?.estado !== "activo" && !datosDeActivo(catalogo, texto("matricula"))) {
        throw new Error("FALTAN_DATOS_UNIVERSIDAD");
      }

      const actualizado = await cliente.query(
        `UPDATE estudiante
            SET nombre = $2,
                cedula = $3,
                email = $4,
                telefono = $5,
                fecha_nacimiento = $6::date,
                lugar_nacimiento = $7,
                nacionalidad = $8,
                genero = $9::genero,
                sexo_documento = $10,
                religion = $11,
                estado = $12::estado_estudiante,
                -- Texto espejo: con catálogo elegido se escribe; sin catálogo se
                -- conserva lo antiguo, salvo que antes viniera de un catálogo que
                -- ahora se quitó (entonces queda vacío, no desfasado).
                programa = CASE WHEN $13::text IS NOT NULL THEN $13 WHEN carrera_id IS NOT NULL THEN NULL ELSE programa END,
                donde_estudia = $14,
                universidad = CASE WHEN $15::text IS NOT NULL THEN $15 WHEN universidad_id IS NOT NULL THEN NULL ELSE universidad END,
                fecha_ingreso = $16::date,
                centro_educativo = $17,
                director_centro = $18,
                facilitador_habitudes = $19,
                breve_historia_habitudes = $20,
                amonestaciones = $21,
                solicitudes_pendientes = $22,
                envio_correo_patrocinador = coalesce($23, envio_correo_patrocinador),
                asistio_reunion_mensual = coalesce($24, asistio_reunion_mensual),
                notas_adicionales = $25,
                foto_url = coalesce($26, foto_url),
                -- Solo el estado activo conserva el vínculo a usuario: al
                -- pasar a suspendido, retirado o graduado se suelta la cuenta.
                usuario_id = CASE WHEN $27 THEN usuario_id ELSE NULL END,
                grupo = $28,
                universidad_id = $29::uuid,
                carrera_id = $30::uuid,
                pensum_id = $31::uuid,
                matricula = $32
          WHERE id = $1
          RETURNING id`,
        [
          id,
          nombre,
          texto("cedula"),
          texto("email"),
          texto("telefono"),
          texto("fecha_nacimiento"),
          texto("lugar_nacimiento"),
          texto("nacionalidad"),
          genero,
          texto("sexo_documento"),
          texto("religion"),
          estado,
          catalogo.carrera,
          texto("donde_estudia"),
          catalogo.siglas,
          texto("fecha_ingreso"),
          texto("centro_educativo"),
          texto("director_centro"),
          texto("facilitador_habitudes"),
          texto("breve_historia_habitudes"),
          texto("amonestaciones"),
          texto("solicitudes_pendientes"),
          texto("envio_correo_patrocinador"),
          texto("asistio_reunion_mensual"),
          texto("notas_adicionales"),
          rutaFoto,
          llevaCuenta(estado),
          grupo,
          catalogo.universidadId,
          catalogo.carreraId,
          catalogo.pensumId,
          texto("matricula"),
        ],
      );

      if (actualizado.rowCount === 0) throw new Error("NO_EXISTE");

      // Cambio de universidad, carrera o plan de quien ya tenía uno: queda en su historial.
      const antes = previo.rows[0];

      if (
        antes &&
        (antes.universidad_id || antes.carrera_id || antes.pensum_id) &&
        (antes.universidad_id !== catalogo.universidadId || antes.carrera_id !== catalogo.carreraId || antes.pensum_id !== catalogo.pensumId)
      ) {
        const etiquetas = (uni: string | null, car: string | null, pen: string | null) =>
          cliente.query<{ universidad: string | null; carrera: string | null; plan: string | null }>(
            `SELECT (SELECT siglas FROM universidad WHERE id = $1) AS universidad,
                    (SELECT nombre FROM carrera WHERE id = $2) AS carrera,
                    (SELECT version FROM pensum WHERE id = $3) AS plan`,
            [uni, car, pen],
          );
        const [de, a] = await Promise.all([
          etiquetas(antes.universidad_id, antes.carrera_id, antes.pensum_id),
          etiquetas(catalogo.universidadId, catalogo.carreraId, catalogo.pensumId),
        ]);

        await cliente.query(
          `INSERT INTO estudiante_cambio_plan
             (estudiante_id, de_universidad, de_carrera, de_plan, a_universidad, a_carrera, a_plan, usuario_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [id, de.rows[0]?.universidad, de.rows[0]?.carrera, de.rows[0]?.plan, a.rows[0]?.universidad, a.rows[0]?.carrera, a.rows[0]?.plan, usuario.id],
        );
      }

      if (previo.rows[0]?.estado !== estado) {
        await cliente.query(
          `INSERT INTO estudiante_etapa
             (estudiante_id, estado_anterior, estado_nuevo, usuario_id)
           VALUES ($1, $2::estado_estudiante, $3::estado_estudiante, $4)`,
          [id, previo.rows[0]?.estado ?? null, estado, usuario.id],
        );
      }

      const rawLat = datos.get("latitud");
      const rawLng = datos.get("longitud");
      const latitud = rawLat ? parseFloat(String(rawLat)) : null;
      const longitud = rawLng ? parseFloat(String(rawLng)) : null;

      if (latitud != null && longitud != null && !estaEnLaVega(latitud, longitud)) {
        throw new Error("UBICACION_FUERA_DE_LA_VEGA");
      }

      await cliente.query(
        `INSERT INTO perfil_vivienda (
           estudiante_id, con_quien_vive, por_que_vive_con_esa_persona,
           hermanos_cantidad, casa_propia, tipo_casa, bano_dentro,
           habitaciones, camas, quienes_duermen_cama, direccion, comunidad,
           ciudad_residencia, municipio, distrito_municipal, sector, calle,
           numero_casa, referencia_ubicacion, latitud, longitud
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
         ON CONFLICT (estudiante_id) DO UPDATE SET
           con_quien_vive = EXCLUDED.con_quien_vive,
           por_que_vive_con_esa_persona = EXCLUDED.por_que_vive_con_esa_persona,
           hermanos_cantidad = EXCLUDED.hermanos_cantidad,
           casa_propia = EXCLUDED.casa_propia,
           tipo_casa = EXCLUDED.tipo_casa,
           bano_dentro = EXCLUDED.bano_dentro,
           habitaciones = EXCLUDED.habitaciones,
           camas = EXCLUDED.camas,
           quienes_duermen_cama = EXCLUDED.quienes_duermen_cama,
           direccion = EXCLUDED.direccion,
           comunidad = EXCLUDED.comunidad,
           ciudad_residencia = EXCLUDED.ciudad_residencia,
           municipio = COALESCE(EXCLUDED.municipio, perfil_vivienda.municipio),
           distrito_municipal = EXCLUDED.distrito_municipal,
           sector = EXCLUDED.sector,
           calle = EXCLUDED.calle,
           numero_casa = EXCLUDED.numero_casa,
           referencia_ubicacion = EXCLUDED.referencia_ubicacion,
           latitud = EXCLUDED.latitud,
           longitud = EXCLUDED.longitud`,
        [
          id,
          texto("con_quien_vive"),
          texto("por_que_vive_con_esa_persona"),
          numero("hermanos_cantidad") ?? 0,
          texto("casa_propia"),
          texto("tipo_casa"),
          texto("bano_dentro"),
          numero("habitaciones") ?? 0,
          numero("camas") ?? 0,
          texto("quienes_duermen_cama"),
          texto("direccion"),
          texto("comunidad"),
          texto("ciudad_residencia"),
          texto("municipio") || "Concepción de La Vega",
          texto("distrito_municipal"),
          texto("sector"),
          texto("calle"),
          texto("numero_casa"),
          texto("referencia_ubicacion"),
          latitud,
          longitud,
        ],
      );

      await cliente.query(
        `INSERT INTO perfil_salud (
           estudiante_id, enfermedades, alergias,
           contacto_emergencia_nombre, contacto_emergencia_telefono
         ) VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (estudiante_id) DO UPDATE SET
           enfermedades = EXCLUDED.enfermedades,
           alergias = EXCLUDED.alergias,
           contacto_emergencia_nombre = EXCLUDED.contacto_emergencia_nombre,
           contacto_emergencia_telefono = EXCLUDED.contacto_emergencia_telefono`,
        [
          id,
          texto("enfermedades"),
          texto("alergias"),
          texto("contacto_emergencia_nombre"),
          texto("contacto_emergencia_telefono"),
        ],
      );

      await cliente.query(
        `INSERT INTO perfil_socioeconomico (
           estudiante_id, historia_de_vida, situacion_familiar,
           situacion_economica, motivo_beca, metas_academicas
         ) VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (estudiante_id) DO UPDATE SET
           historia_de_vida = EXCLUDED.historia_de_vida,
           situacion_familiar = EXCLUDED.situacion_familiar,
           situacion_economica = EXCLUDED.situacion_economica,
           motivo_beca = EXCLUDED.motivo_beca,
           metas_academicas = EXCLUDED.metas_academicas`,
        [
          id,
          texto("historia_de_vida"),
          texto("situacion_familiar"),
          texto("situacion_economica"),
          texto("motivo_beca"),
          texto("metas_academicas"),
        ],
      );

      // Los cinco bloques fijos se reemplazan enteros: se borran y, de los que
      // traen nombre, se vuelven a insertar. Así no hace falta una clave única
      // por parentesco para saber cuál `UPDATE` le toca a cuál, y un bloque que
      // se vació en el formulario (por ejemplo, se borró el padrastro) también
      // desaparece de la base. No toca los "hermano", "hermana" u "otro" que
      // pudiera haber, que no gestiona este formulario.
      await cliente.query(
        `DELETE FROM familiar WHERE estudiante_id = $1 AND parentesco = ANY($2::parentesco[])`,
        [id, FAMILIA_FIJA],
      );

      for (const parentesco of FAMILIA_FIJA) {
        const nombreFamiliar = texto(`${parentesco}_nombre`);
        if (!nombreFamiliar) continue;

        await cliente.query(
          `INSERT INTO familiar (estudiante_id, parentesco, nombre, edad, telefono, profesion)
           VALUES ($1, $2::parentesco, $3, $4, $5, $6)`,
          [
            id,
            parentesco,
            nombreFamiliar,
            numero(`${parentesco}_edad`),
            texto(`${parentesco}_telefono`),
            texto(`${parentesco}_profesion`),
          ],
        );
      }
    });
  } catch (error) {
    if (error instanceof Error && error.message === "NO_EXISTE") {
      return { estado: "no_encontrado" };
    }
    if (error instanceof Error && error.message === "CATALOGO_INVALIDO") {
      return { estado: "catalogo_invalido" };
    }
    if (error instanceof Error && error.message === "FALTAN_DATOS_UNIVERSIDAD") {
      return { estado: "faltan_datos_universidad" };
    }
    console.error("[expedientes] no se pudo guardar la edición:", error);
    return { estado: "error" };
  }

  await registrar({
    usuarioId: usuario.id,
    accion: "expediente.editado",
    entidad: "estudiante",
    entidadId: id,
  });

  revalidatePath("/[locale]/expedientes", "page");
  revalidatePath("/[locale]/expedientes/[id]", "page");

  return { estado: "ok" };
}


/**
 * Alta de un expediente completo.
 *
 * SEIS TABLAS Y UNA SOLA COSA, así que todo va en `enTransaccion()`. Sin ella,
 * un fallo a mitad dejaría a un joven con fila en `estudiante` y sin perfiles,
 * es decir un expediente que la ficha pinta medio vacío y que nadie sabe si
 * está incompleto porque falta información o porque falló una escritura.
 *
 * Los tres perfiles se insertan SIEMPRE, aunque vengan vacíos. Es a propósito:
 * la ficha los lee con `LEFT JOIN` y funcionaría igual sin ellos, pero entonces
 * el primer guardado de la edición tendría que crearlos —y su `ON CONFLICT` ya
 * lo hace, sí, pero el estado intermedio es un expediente cuyo `perfil_vivienda`
 * no existe: cualquier consulta futura que los una con `JOIN` en vez de `LEFT
 * JOIN` haría desaparecer al estudiante de su propia lista. Tres filas vacías
 * cuestan nada y quitan esa trampa.
 *
 * QUIÉN PUEDE: quien tenga `expedientes.escribir`, igual que la edición. Un
 * candidato que postula Habitudes no entra por aquí: se pide su alta con una
 * solicitud `alta_expediente` y la aprueba administración.
 *
 * Al terminar se va a la ficha recién creada y no se cierra el diálogo con un
 * "guardado": después de rellenar setenta campos, lo que hace falta es ver el
 * expediente que ha quedado.
 */
export async function crearExpediente(
  _previo: EstadoExpediente,
  datos: FormData,
): Promise<EstadoExpediente> {
  const usuario = await requerirUsuario();

  if (!usuarioTienePermiso(usuario, "expedientes.escribir")) {
    return { estado: "no_permitido" };
  }

  const texto = lectorDeTexto(datos);
  const numero = lectorDeNumero(datos);
  // Grupo (cohorte): entero positivo o vacío. Se valida aquí: un `input number`
  // del navegador se puede manipular.
  const grupoLeido = numero("grupo");
  const grupo = grupoLeido !== null && Number.isInteger(grupoLeido) && grupoLeido > 0 && grupoLeido < 1000 ? grupoLeido : null;

  const nombre = String(datos.get("nombre") ?? "").trim();

  // Lo único obligatorio, como promete el subtítulo del formulario: "solo el
  // nombre es obligatorio, el resto se completa con el tiempo".
  if (!nombre) return { estado: "invalido" };

  const estado = String(datos.get("estado") ?? "activo");
  const genero = texto("genero");

  if (!esEstadoEstudiante(estado)) {
    return { estado: "invalido" };
  }
  if (genero && !(GENEROS as readonly string[]).includes(genero)) {
    return { estado: "invalido" };
  }

  // La foto no se sube aquí: su ruta lleva el id del estudiante y todavía no
  // existe. Se sube desde la ficha, con la edición, que es donde ya hay id.
  // Ofrecerla en el alta obligaría a subir el archivo dos veces o a inventar
  // un nombre temporal que después habría que renombrar.
  let creado: { id: string } | null = null;

  try {
    creado = await enTransaccion(async (cliente) => {
      const catalogo = await resolverCatalogo(cliente, datos);

      if (!catalogo) throw new Error("CATALOGO_INVALIDO");

      if (estado === "activo" && !datosDeActivo(catalogo, texto("matricula"))) throw new Error("FALTAN_DATOS_UNIVERSIDAD");

      const fila = await cliente.query<{ id: string }>(
        `INSERT INTO estudiante (
           nombre, cedula, email, telefono, fecha_nacimiento, lugar_nacimiento,
           nacionalidad, genero, sexo_documento, religion, estado,
           programa, donde_estudia, universidad, fecha_ingreso,
           centro_educativo, director_centro, facilitador_habitudes,
           breve_historia_habitudes, amonestaciones, solicitudes_pendientes,
           envio_correo_patrocinador, asistio_reunion_mensual,
           notas_adicionales, grupo, universidad_id, carrera_id, pensum_id, matricula
         ) VALUES (
           $1, $2, $3, $4, $5::date, $6, $7, $8::genero, $9, $10,
           $11::estado_estudiante, $12, $13, $14,
           $15::date, $16, $17, $18, $19, $20, $21,
           coalesce($22, 'pendiente'), coalesce($23, 'no'), $24, $25,
           $26::uuid, $27::uuid, $28::uuid, $29
         )
         RETURNING id`,
        // Los dos `coalesce` de la sentencia repiten los DEFAULT de la 0005
        // ('pendiente' y 'no'). Un DEFAULT solo se aplica si la columna NO
        // aparece en el INSERT, y aquí aparecen las veinticuatro: sin el
        // `coalesce`, un formulario que no toque esos dos desplegables
        // guardaría NULL y la ficha enseñaría un hueco donde la base prometía
        // un valor.
        //
        // `tipo` no va: desde la 0047 su único valor es `becado` y lo pone el
        // DEFAULT de la columna.
        [
          nombre,
          texto("cedula"),
          texto("email"),
          texto("telefono"),
          texto("fecha_nacimiento"),
          texto("lugar_nacimiento"),
          texto("nacionalidad"),
          genero,
          texto("sexo_documento"),
          texto("religion"),
          estado,
          catalogo.carrera,
          texto("donde_estudia"),
          catalogo.siglas,
          texto("fecha_ingreso"),
          texto("centro_educativo"),
          texto("director_centro"),
          texto("facilitador_habitudes"),
          texto("breve_historia_habitudes"),
          texto("amonestaciones"),
          texto("solicitudes_pendientes"),
          texto("envio_correo_patrocinador"),
          texto("asistio_reunion_mensual"),
          texto("notas_adicionales"),
          grupo,
          catalogo.universidadId,
          catalogo.carreraId,
          catalogo.pensumId,
          texto("matricula"),
        ],
      );

      const id = fila.rows[0]?.id;

      if (!id) throw new Error("el expediente no devolvió id");

      await cliente.query(
        `INSERT INTO estudiante_etapa (estudiante_id, estado_anterior, estado_nuevo, usuario_id)
         VALUES ($1, NULL, $2::estado_estudiante, $3)`,
        [id, estado, usuario.id],
      );

      const rawLat = datos.get("latitud");
      const rawLng = datos.get("longitud");
      const latitud = rawLat ? parseFloat(String(rawLat)) : null;
      const longitud = rawLng ? parseFloat(String(rawLng)) : null;

      if (latitud != null && longitud != null && !estaEnLaVega(latitud, longitud)) {
        throw new Error("UBICACION_FUERA_DE_LA_VEGA");
      }

      await cliente.query(
        `INSERT INTO perfil_vivienda (
           estudiante_id, con_quien_vive, por_que_vive_con_esa_persona,
           hermanos_cantidad, casa_propia, tipo_casa, bano_dentro,
           habitaciones, camas, quienes_duermen_cama, direccion, comunidad,
           ciudad_residencia, municipio, distrito_municipal, sector, calle,
           numero_casa, referencia_ubicacion, latitud, longitud
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)`,
        [
          id,
          texto("con_quien_vive"),
          texto("por_que_vive_con_esa_persona"),
          numero("hermanos_cantidad") ?? 0,
          texto("casa_propia"),
          texto("tipo_casa"),
          texto("bano_dentro"),
          numero("habitaciones") ?? 0,
          numero("camas") ?? 0,
          texto("quienes_duermen_cama"),
          texto("direccion"),
          texto("comunidad"),
          texto("ciudad_residencia"),
          texto("municipio") || "Concepción de La Vega",
          texto("distrito_municipal"),
          texto("sector"),
          texto("calle"),
          texto("numero_casa"),
          texto("referencia_ubicacion"),
          latitud,
          longitud,
        ],
      );

      await cliente.query(
        `INSERT INTO perfil_salud (
           estudiante_id, enfermedades, alergias,
           contacto_emergencia_nombre, contacto_emergencia_telefono
         ) VALUES ($1, $2, $3, $4, $5)`,
        [
          id,
          texto("enfermedades"),
          texto("alergias"),
          texto("contacto_emergencia_nombre"),
          texto("contacto_emergencia_telefono"),
        ],
      );

      await cliente.query(
        `INSERT INTO perfil_socioeconomico (
           estudiante_id, historia_de_vida, situacion_familiar,
           situacion_economica, motivo_beca, metas_academicas
         ) VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          id,
          texto("historia_de_vida"),
          texto("situacion_familiar"),
          texto("situacion_economica"),
          texto("motivo_beca"),
          texto("metas_academicas"),
        ],
      );

      // Solo los bloques que traen nombre. Un familiar sin nombre es una fila
      // que después nadie puede identificar, y el formulario deja los cinco
      // bloques a la vista aunque se rellene uno.
      for (const parentesco of FAMILIA_FIJA) {
        const nombreFamiliar = texto(`${parentesco}_nombre`);
        if (!nombreFamiliar) continue;

        await cliente.query(
          `INSERT INTO familiar (estudiante_id, parentesco, nombre, edad, telefono, profesion)
           VALUES ($1, $2::parentesco, $3, $4, $5, $6)`,
          [
            id,
            parentesco,
            nombreFamiliar,
            numero(`${parentesco}_edad`),
            texto(`${parentesco}_telefono`),
            texto(`${parentesco}_profesion`),
          ],
        );
      }

      return { id };
    });
  } catch (error) {
    if (error instanceof Error && error.message === "CATALOGO_INVALIDO") {
      return { estado: "catalogo_invalido" };
    }
    if (error instanceof Error && error.message === "FALTAN_DATOS_UNIVERSIDAD") {
      return { estado: "faltan_datos_universidad" };
    }
    console.error("[expedientes] no se pudo crear el expediente:", error);
    return { estado: "error" };
  }

  if (!creado) return { estado: "error" };

  await registrar({
    usuarioId: usuario.id,
    accion: "expediente.creado",
    entidad: "estudiante",
    entidadId: creado.id,
    // El nombre y el estado. Nada del contenido: la historia de vida y la
    // situación familiar no se copian al registro de auditoría.
    datos: { nombre, estado },
  });

  revalidatePath("/[locale]/expedientes", "page");
  revalidatePath("/[locale]/dashboard", "page");

  // A la ficha recién creada. `redirigir` lanza, así que nada de lo de abajo
  // se ejecuta —y no hay nada.
  redirigir(`/expedientes/${creado.id}`, await getLocale());
}

/** Las cuatro categorías que se avisan cuando el expediente tiene historial. */
const DEP_CLAVES = [
  "enrollments",
  "history",
  "requests",
  "service",
] as const;

export type DepClave = (typeof DEP_CLAVES)[number];

export type EstadoEliminarExpediente = {
  estado:
    | "inicial"
    | "ok"
    | "no_permitido"
    | "no_encontrado"
    | "en_uso"
    | "invalido"
    | "error";
  /** Solo con `estado: "en_uso"`: cuántas filas hay en cada tabla que lo frena. */
  deps?: Partial<Record<DepClave, number>>;
};

/**
 * Borra un expediente, o avisa de por qué no se puede.
 *
 * No es un DELETE a ciegas: primero se cuentan las filas que otros módulos
 * tienen sobre este estudiante —inscripciones, calificaciones, historial,
 * solicitudes y servicio/reuniones—. Las solicitudes además lo exigen en la
 * base (`ON DELETE RESTRICT`, 0031): llevan folio y no pueden desaparecer con
 * la ficha. Si hay alguna, no se borra
 * nada y se responde qué tablas la tienen, para que la pantalla lo diga en vez
 * de dejar caer un error de clave foránea. La alternativa que se ofrece es
 * cambiar el estado a inactivo, graduado o suspendido: sale del trabajo diario
 * sin perder ese historial.
 *
 * Borra quien tenga `expedientes.eliminar`: `admin` y `super_admin`.
 */
export async function eliminarExpediente(
  _previo: EstadoEliminarExpediente,
  datos: FormData,
): Promise<EstadoEliminarExpediente> {
  const usuario = await requerirUsuario();

  if (!usuarioTienePermiso(usuario, "expedientes.eliminar")) {
    return { estado: "no_permitido" };
  }

  const id = String(datos.get("id") ?? "");
  if (!esUuid(id)) return { estado: "invalido" };

  const fila = await consultarUna<{ nombre: string }>(
    `SELECT nombre FROM estudiante WHERE id = $1`,
    [id],
  );

  if (!fila) return { estado: "no_encontrado" };

  const conteo = await consultarUna<Record<DepClave, string>>(
    `SELECT
       (SELECT count(*) FROM inscripcion WHERE estudiante_id = $1)
         + (SELECT count(*) FROM inscripcion_360 WHERE estudiante_id = $1) AS enrollments,
       (SELECT count(*) FROM historial_calificacion WHERE estudiante_id = $1) AS history,
       (SELECT count(*) FROM solicitud WHERE estudiante_id = $1) AS requests,
       (SELECT count(*) FROM registro_servicio WHERE estudiante_id = $1) AS service`,
    [id],
  );

  const deps: Partial<Record<DepClave, number>> = {};
  for (const clave of DEP_CLAVES) {
    const cantidad = Number(conteo?.[clave] ?? 0);
    if (cantidad > 0) deps[clave] = cantidad;
  }

  if (Object.keys(deps).length > 0) {
    return { estado: "en_uso", deps };
  }

  let borrado: { id: string } | null;
  // Las filas de `archivo_academico` se van con el expediente (CASCADE), pero los
  // PDF viven en el bucket: se anotan antes para borrarlos después.
  const rutasPdf = (
    await consultar<{ ruta: string }>(`SELECT ruta FROM archivo_academico WHERE estudiante_id = $1`, [id])
  ).map((f) => f.ruta);

  try {
    // El propio expediente sí se lleva sus cinco perfiles y sus familiares
    // detrás (`ON DELETE CASCADE` en la migración 0005): eso es la ficha
    // misma, no "otro módulo", así que no entra en la comprobación de arriba.
    borrado = await consultarUna<{ id: string }>(
      `DELETE FROM estudiante WHERE id = $1 RETURNING id`,
      [id],
    );
  } catch (error) {
    console.error("[expedientes] no se pudo eliminar:", error);
    return { estado: "error" };
  }

  if (!borrado) return { estado: "no_encontrado" };

  await Promise.all(rutasPdf.map((ruta) => borrarDocumento(ruta)));

  await registrar({
    usuarioId: usuario.id,
    accion: "expediente.eliminado",
    entidad: "estudiante",
    entidadId: id,
    datos: { nombre: fila.nombre },
  });

  revalidatePath("/[locale]/expedientes", "page");

  redirigir("/expedientes", await getLocale());
}

/** Universidad, carrera, plan de estudios y matrícula: lo que se exige para ser activo. */
function datosDeActivo(catalogo: { universidadId: string | null; carreraId: string | null; pensumId: string | null }, matricula: string | null): boolean {
  return Boolean(catalogo.universidadId && catalogo.carreraId && catalogo.pensumId && matricula);
}

function esUuid(valor: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    valor,
  );
}

/**
 * Lector de un campo de texto del formulario.
 *
 * Vacío devuelve `null` y no `""`: en la base son cosas distintas —una cadena
 * vacía es un dato que dice "no hay", `NULL` es "no se sabe"— y setenta campos
 * opcionales guardados como cadena vacía llenarían la ficha de datos falsos.
 *
 * Lo comparten el alta y la edición. Estaba escrito dentro de la edición y
 * duplicarlo en el alta era duplicar esa decisión, que es justo la que no puede
 * diferir entre las dos.
 */
function lectorDeTexto(datos: FormData) {
  return (clave: string): string | null => {
    const valor = String(datos.get(clave) ?? "").trim();

    return valor ? valor : null;
  };
}

/** Lo mismo para los enteros. Lo que no sea número cuenta como ausente. */
function lectorDeNumero(datos: FormData) {
  return (clave: string): number | null => {
    const valor = String(datos.get(clave) ?? "").trim();

    if (!valor) return null;

    const numero = Number(valor);

    return Number.isFinite(numero) ? Math.trunc(numero) : null;
  };
}

/**
 * ────────────────────────────────────────────────────────────────────────────
 * LECTURA DEL DOCUMENTO ESCANEADO (OCR).
 *
 * Lee la cédula o la ficha en papel y devuelve tres campos para PRECARGAR el
 * formulario del alta: nombre, cédula y fecha de nacimiento. Nada más, y por
 * una razón: son los tres que aparecen en un documento de identidad y se pueden
 * comprobar de un vistazo contra el papel que se tiene en la mano. Pedirle al
 * modelo que rellene la historia de vida o la situación familiar sería pedirle
 * que invente el contenido más delicado del expediente.
 *
 * **No guarda nada.** Ni el archivo ni el expediente: esta acción solo lee. El
 * alta la hace `crearExpediente` cuando la persona ya ha revisado los campos.
 * El archivo va al modelo y se descarta (ver la cabecera de `leerDocumento` en
 * `lib/ia.ts`); lo que queda es el rastro en `extraccion_ocr`.
 * ────────────────────────────────────────────────────────────────────────────
 */

export type EstadoLectura = {
  estado:
    | "inicial"
    | "ok"
    | "no_permitido"
    | "sin_archivo"
    | "tipo_no_admitido"
    | "demasiado_grande"
    | "sin_clave"
    | "ilegible"
    | "error";
  nombre?: string;
  cedula?: string | null;
  fechaNacimiento?: string | null;
  /** 0–100, la certeza declarada por el modelo. La pantalla la enseña. */
  confianza?: number;
};

export async function leerFichaEscaneada(
  _previo: EstadoLectura,
  datos: FormData,
): Promise<EstadoLectura> {
  const usuario = await requerirUsuario();

  if (!usuarioTienePermiso(usuario, "expedientes.escribir")) {
    return { estado: "no_permitido" };
  }

  const archivo = datos.get("documento");

  if (!(archivo instanceof File) || archivo.size === 0) {
    return { estado: "sin_archivo" };
  }

  const lectura = await leerDocumentoDeIdentidad(archivo, usuario.id);

  if (lectura.estado !== "ok") return { estado: lectura.estado };

  return {
    estado: "ok",
    nombre: lectura.datos.nombre ?? undefined,
    cedula: lectura.datos.cedula,
    fechaNacimiento: lectura.datos.fechaNacimiento,
    confianza: lectura.datos.confianza,
  };
}

export type EstadoVinculoCuenta = {
  estado:
    | "inicial"
    | "ok"
    | "no_permitido"
    | "invalido"
    | "no_activo"
    | "ocupada"
    | "error";
};

/**
 * Ata (o suelta) la cuenta del portal de un estudiante a su expediente.
 *
 * Es escritura del expediente, así que pide `expedientes.escribir`. La cuenta
 * se comprueba DENTRO del UPDATE —rol `estudiante` y libre— y no antes en un
 * `if`: entre leer y escribir otra persona podría haberla vinculado, y el
 * UNIQUE de `usuario_id` lo convertiría en un error de base sin explicación.
 * Solo un expediente ACTIVO lleva cuenta (`ESTADO_CON_CUENTA`): postulados y
 * suspendidos no entran al portal. Soltar sí se permite en cualquier estado,
 * para poder corregir un vínculo que quedó de cuando estaba activo.
 *
 * `accion=desvincular` suelta el vínculo, para corregir una cuenta mal
 * elegida: va en otro nombre que el select porque los dos viajan en el mismo
 * envío y `get` devolvería el primero.
 */
export async function vincularCuenta(
  _previo: EstadoVinculoCuenta,
  datos: FormData,
): Promise<EstadoVinculoCuenta> {
  const usuario = await requerirUsuario();

  if (!usuarioTienePermiso(usuario, "expedientes.escribir")) {
    return { estado: "no_permitido" };
  }

  const estudianteId = String(datos.get("estudiante") ?? "");
  const cuentaId =
    datos.get("accion") === "desvincular" ? "" : String(datos.get("usuario") ?? "");

  if (!esUuid(estudianteId) || (cuentaId !== "" && !esUuid(cuentaId))) {
    return { estado: "invalido" };
  }

  if (cuentaId !== "") {
    const estudiante = await consultarUna<{ estado: string }>(
      `SELECT estado::text AS estado FROM estudiante WHERE id = $1`,
      [estudianteId],
    );
    if (!estudiante) return { estado: "invalido" };
    if (!llevaCuenta(estudiante.estado)) return { estado: "no_activo" };
  }

  try {
    const fila = await consultarUna<{ id: string }>(
      cuentaId === ""
        ? `UPDATE estudiante SET usuario_id = NULL WHERE id = $1 RETURNING id`
        : `UPDATE estudiante e
              SET usuario_id = $2
             FROM usuario u
             JOIN rol r ON r.id = u.rol_id
            WHERE e.id = $1
              AND u.id = $2
              AND r.nombre = 'estudiante'
              AND e.estado = 'activo'
              AND NOT EXISTS (
                SELECT 1 FROM estudiante otro
                 WHERE otro.usuario_id = $2 AND otro.id <> $1
              )
          RETURNING e.id`,
      cuentaId === "" ? [estudianteId] : [estudianteId, cuentaId],
    );

    if (!fila) return { estado: cuentaId === "" ? "invalido" : "ocupada" };

    await registrar({
      usuarioId: usuario.id,
      accion: cuentaId === "" ? "expediente.cuenta_desvinculada" : "expediente.cuenta_vinculada",
      entidad: "estudiante",
      entidadId: estudianteId,
      datos: { usuario_id: cuentaId || null },
    });
  } catch (error) {
    console.error("[expedientes] no se pudo vincular la cuenta", error);
    return { estado: "error" };
  }

  revalidatePath("/[locale]/expedientes/[id]", "page");

  return { estado: "ok" };
}

export type EstadoSituacion = {
  estado: "inicial" | "ok" | "no_permitido" | "no_encontrado" | "invalido" | "faltan_datos_universidad" | "error";
};

/** Estados que exigen explicar por qué: salen de la vida activa de la Fundación. */
const SITUACIONES_CON_MOTIVO = ["inactivo", "graduado", "suspendido", "retirado"];

/**
 * Cambiar la situación de un estudiante con su motivo y su fecha. Es el camino guiado
 * para pasar de etapa: queda en el historial de etapas con quién, por qué y desde cuándo.
 *
 * Dos reglas de fondo: solo los ACTIVOS son parte de la Fundación, así que para pasar a
 * activo el expediente ya debe tener universidad, carrera, plan de estudios y matrícula;
 * y todo estado que no sea activo suelta la cuenta del portal.
 */
export async function cambiarSituacionExpediente(_previo: EstadoSituacion, datos: FormData): Promise<EstadoSituacion> {
  const usuario = await requerirUsuario();

  if (!usuarioTienePermiso(usuario, "expedientes.escribir")) return { estado: "no_permitido" };

  const id = String(datos.get("estudiante") ?? "");
  const nuevo = String(datos.get("nuevo_estado") ?? "");
  const motivo = String(datos.get("motivo") ?? "").trim().slice(0, 500);
  const fechaTexto = String(datos.get("fecha") ?? "");
  const fecha = /^\d{4}-\d{2}-\d{2}$/.test(fechaTexto) ? fechaTexto : new Date().toISOString().slice(0, 10);

  if (!esUuid(id) || !esEstadoEstudiante(nuevo)) return { estado: "invalido" };
  if (SITUACIONES_CON_MOTIVO.includes(nuevo) && !motivo) return { estado: "invalido" };

  try {
    const r = await enTransaccion(async (cliente) => {
      const fila = await cliente.query<{ estado: string; universidad_id: string | null; carrera_id: string | null; pensum_id: string | null; matricula: string | null }>(
        `SELECT estado, universidad_id, carrera_id, pensum_id, matricula FROM estudiante WHERE id = $1 FOR UPDATE`,
        [id],
      );
      const actual = fila.rows[0];

      if (!actual) return "no_encontrado" as const;
      if (actual.estado === nuevo) return "invalido" as const;
      if (nuevo === "activo" && !(actual.universidad_id && actual.carrera_id && actual.pensum_id && actual.matricula)) return "faltan_datos_universidad" as const;

      await cliente.query(
        `UPDATE estudiante SET estado = $2::estado_estudiante, usuario_id = CASE WHEN $3 THEN usuario_id ELSE NULL END WHERE id = $1`,
        [id, nuevo, llevaCuenta(nuevo)],
      );
      await cliente.query(
        `INSERT INTO estudiante_etapa (estudiante_id, estado_anterior, estado_nuevo, usuario_id, motivo, fecha_efectiva)
         VALUES ($1, $2::estado_estudiante, $3::estado_estudiante, $4, $5, $6::date)`,
        [id, actual.estado, nuevo, usuario.id, motivo || null, fecha],
      );

      return "ok" as const;
    });

    if (r !== "ok") return { estado: r };
  } catch (error) {
    console.error("[expedientes] no se pudo cambiar la situación", error);

    return { estado: "error" };
  }

  await registrar({ usuarioId: usuario.id, accion: "expediente.situacion_cambiada", entidad: "estudiante", entidadId: id, datos: { nuevo, fecha } });
  revalidatePath("/[locale]/expedientes/[id]", "page");
  revalidatePath("/[locale]/expedientes", "page");

  return { estado: "ok" };
}

export type EstadoInvitacion = {
  estado: "inicial" | "ok" | "no_permitido" | "invalido" | "no_activo" | "sin_correo" | "ya_tiene_cuenta" | "correo_repetido" | "error";
  correo?: string;
};

/**
 * Crear la cuenta del estudiante desde su expediente y invitarlo por correo. Nadie conoce
 * ni teclea una contraseña: la cuenta nace con una al azar que no se muestra, y el estudiante
 * recibe un enlace para elegir la suya. Solo para activos, con el correo del expediente.
 */
export async function crearCuentaEInvitar(_previo: EstadoInvitacion, datos: FormData): Promise<EstadoInvitacion> {
  const usuario = await requerirUsuario();

  // Crear una cuenta es administrar usuarios; vincularla es escribir el expediente: hacen falta las dos.
  if (!usuarioTienePermiso(usuario, "expedientes.escribir") || !usuarioTienePermiso(usuario, "usuarios.administrar")) {
    return { estado: "no_permitido" };
  }

  const id = String(datos.get("estudiante") ?? "");

  if (!esUuid(id)) return { estado: "invalido" };

  const e = await consultarUna<{ nombre: string; email: string | null; estado: string; usuario_id: string | null }>(
    `SELECT nombre, email::text AS email, estado::text AS estado, usuario_id FROM estudiante WHERE id = $1`,
    [id],
  );

  if (!e) return { estado: "invalido" };
  if (!llevaCuenta(e.estado)) return { estado: "no_activo" };
  if (e.usuario_id) return { estado: "ya_tiene_cuenta" };
  if (!e.email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e.email)) return { estado: "sin_correo" };

  const correo = e.email.trim().toLowerCase();
  const cabeceras = await headers();
  const origen = process.env.NEXT_PUBLIC_SITE_URL ?? `${cabeceras.get("x-forwarded-proto") ?? "https"}://${cabeceras.get("host")}`;

  try {
    const creado = await consultarUna<{ id: string }>(
      `INSERT INTO usuario (email, nombre, idioma, activo, rol_id)
       VALUES ($1, $2, 'es', TRUE, (SELECT id FROM rol WHERE nombre = 'estudiante'))
       ON CONFLICT (email) DO NOTHING RETURNING id`,
      [correo, e.nombre],
    );

    if (!creado) return { estado: "correo_repetido" };

    const identidad = await crearIdentidad(correo, e.nombre, randomBytes(24).toString("base64url"));

    if (!identidad.ok) {
      await consultarUna(`DELETE FROM usuario WHERE id = $1 RETURNING id`, [creado.id]);

      return { estado: identidad.motivo === "existe" ? "correo_repetido" : "error" };
    }

    await consultarUna(`UPDATE usuario SET auth_user_id = $2 WHERE id = $1 RETURNING id`, [creado.id, identidad.id]);
    await consultarUna(`UPDATE estudiante SET usuario_id = $2 WHERE id = $1 RETURNING id`, [id, creado.id]);

    const enlace = await enlaceParaEstablecerClave(correo, `${origen}/establecer-clave`);

    if (!enlace) return { estado: "error" };

    await encolarCorreo({
      destinatario: correo,
      asunto: "Te damos la bienvenida al Portal GlobalEffect",
      cuerpoHtml: `<p>Hola ${e.nombre.replace(/[<>&]/g, "")},</p><p>La Fundación Global Effect creó tu acceso al portal del estudiante. Para entrar, elige tu contraseña con este botón:</p><p><a href="${enlace}" style="background:#2096BA;color:#fff;padding:12px 20px;border-radius:12px;text-decoration:none;display:inline-block">Elegir mi contraseña</a></p><p>Si el botón no funciona, copia este enlace en tu navegador:<br>${enlace}</p><p>Si no esperabas este correo, puedes ignorarlo.</p>`,
      cuerpoTexto: `Hola ${e.nombre}, la Fundación Global Effect creó tu acceso al portal del estudiante. Elige tu contraseña aquí: ${enlace}`,
    });

    await registrar({ usuarioId: usuario.id, accion: "cuenta.invitada", entidad: "estudiante", entidadId: id, datos: { correo } });
  } catch (error) {
    console.error("[expedientes] no se pudo crear la cuenta e invitar", error);

    return { estado: "error" };
  }

  revalidatePath("/[locale]/expedientes/[id]", "page");

  return { estado: "ok", correo };
}
