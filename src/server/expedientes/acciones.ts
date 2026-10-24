"use server";

import { getLocale } from "next-intl/server";
import { revalidatePath } from "next/cache";

import { redirigir } from "@/i18n/navigation";
import { registrar } from "@/lib/auditoria";
import { enTransaccion, consultarUna } from "@/lib/db";
import { requerirUsuario } from "@/lib/auth";
import {
  esEstadoEstudiante,
  FAMILIA_FIJA,
  GENEROS,
} from "@/lib/expedientes";
import { tienePermiso } from "@/lib/rbac";
import { subirAvatar } from "@/lib/supabase/almacen";
import { estaEnLaVega } from "@/lib/la-vega-geografia";
import { leerDocumentoDeIdentidad } from "@/server/ia/ocr";

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
    | "error";
};

const TIPOS_FOTO = ["image/jpeg", "image/png", "image/webp"];
const MAXIMO_FOTO = 2 * 1024 * 1024;

export async function actualizarExpediente(
  _previo: EstadoExpediente,
  datos: FormData,
): Promise<EstadoExpediente> {
  const usuario = await requerirUsuario();

  if (!tienePermiso(usuario.rol, "expedientes.escribir")) {
    return { estado: "no_permitido" };
  }

  const id = String(datos.get("id") ?? "");
  if (!esUuid(id)) return { estado: "invalido" };

  const nombre = String(datos.get("nombre") ?? "").trim();
  if (!nombre) return { estado: "invalido" };

  const texto = lectorDeTexto(datos);
  const numero = lectorDeNumero(datos);

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
                programa = $13,
                donde_estudia = $14,
                universidad = $15,
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
                foto_url = coalesce($26, foto_url)
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
          texto("programa"),
          texto("donde_estudia"),
          texto("universidad"),
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
        ],
      );

      if (actualizado.rowCount === 0) throw new Error("NO_EXISTE");

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
    console.error("[expedientes] no se pudo guardar la edición:", error);
    return { estado: "error" };
  }

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

  if (!tienePermiso(usuario.rol, "expedientes.escribir")) {
    return { estado: "no_permitido" };
  }

  const texto = lectorDeTexto(datos);
  const numero = lectorDeNumero(datos);

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
      const fila = await cliente.query<{ id: string }>(
        `INSERT INTO estudiante (
           nombre, cedula, email, telefono, fecha_nacimiento, lugar_nacimiento,
           nacionalidad, genero, sexo_documento, religion, estado,
           programa, donde_estudia, universidad, fecha_ingreso,
           centro_educativo, director_centro, facilitador_habitudes,
           breve_historia_habitudes, amonestaciones, solicitudes_pendientes,
           envio_correo_patrocinador, asistio_reunion_mensual,
           notas_adicionales
         ) VALUES (
           $1, $2, $3, $4, $5::date, $6, $7, $8::genero, $9, $10,
           $11::estado_estudiante, $12, $13, $14,
           $15::date, $16, $17, $18, $19, $20, $21,
           coalesce($22, 'pendiente'), coalesce($23, 'no'), $24
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
          texto("programa"),
          texto("donde_estudia"),
          texto("universidad"),
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
        ],
      );

      const id = fila.rows[0]?.id;

      if (!id) throw new Error("el expediente no devolvió id");

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

  if (!tienePermiso(usuario.rol, "expedientes.eliminar")) {
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

  if (!tienePermiso(usuario.rol, "expedientes.escribir")) {
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
