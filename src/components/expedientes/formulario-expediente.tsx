"use client";

import { useActionState, useState } from "react";
import {
  AlertCircle,
  Loader2,
  MapPin,
  Plus,
  Save,
  ScanLine,
  Users,
} from "lucide-react";

import { MapaLaVega } from "@/components/mapa/mapa-la-vega";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  ASISTIO_REUNION,
  BANO,
  CASA_PROPIA,
  ENVIO_CORREO,
  ESTADOS_ESTUDIANTE,
  FAMILIA_FIJA,
  GENEROS,
  TIPOS_ESTUDIANTE,
} from "@/lib/expedientes";
import { ALERTA_RIESGO } from "@/lib/paleta";
import { cn } from "@/lib/utils";
import {
  crearExpediente,
  leerFichaEscaneada,
  type EstadoExpediente,
  type EstadoLectura,
} from "@/server/expedientes/acciones";
import type { ExpedienteCompleto } from "@/server/expedientes/consultas";

/**
 * Formulario de expediente: seis secciones y unos setenta campos.
 *
 * Las seis pestañas son las seis tablas del expediente —`estudiante` y los cinco
 * perfiles de las migraciones 0005 y 0008—, no las seis del prototipo. Es la
 * división que ya usaban las claves de `messages` (`records.tab.*`) y la que
 * hace que guardar sea una escritura por pestaña en vez de un `UPDATE` de setenta
 * columnas.
 *
 * `CamposExpediente` es el cuerpo —OCR más las seis pestañas— y lo comparten dos
 * pantallas: este diálogo de alta y la de edición
 * (`formulario-edicion-expediente.tsx`). Ninguna de las dos repite la rejilla de
 * campos; solo cambian el contenedor (diálogo o página completa) y si `valores`
 * trae algo que precargar.
 *
 * GUARDAR YA FUNCIONA. Escribe en las seis tablas dentro de una transacción
 * (`crearExpediente`) y, al terminar, lleva a la ficha recién creada: después
 * de rellenar setenta campos, lo que hace falta es ver el expediente que ha
 * quedado, no un cartel de "guardado" sobre el formulario en blanco.
 */

export const SECCIONES = [
  "identity",
  "academic",
  "family",
  "housing",
  "health",
  "social",
] as const;

/** Valores con los que precargar el formulario. `undefined` en cada campo = vacío. */
export type ValoresExpediente = Partial<ExpedienteCompleto>;

export type TextosFormulario = {
  nuevo: string;
  titulo: string;
  subtitulo: string;
  guardar: string;
  guardando: string;
  error: string;
  faltaNombre: string;
  cancelar: string;
  /**
   * Ya resuelto en el servidor, una cadena por sección. Se pasa la lista y no
   * una función porque entre un componente de servidor y uno de cliente solo
   * viajan datos, no funciones.
   */
  progreso: readonly string[];
  siguiente: string;
  anterior: string;
  opcional: string;
  pestanas: Record<string, string>;
  campos: Record<string, string>;
  familia: Record<string, string>;
  parentescos: Record<string, string>;
  tipos: Record<string, string>;
  estados: Record<string, string>;
  generos: Record<string, string>;
  casa: Record<string, string>;
  bano: Record<string, string>;
  seguimiento: Record<string, string>;
  /**
   * Textos del lector de documento.
   *
   * Opcional porque solo el ALTA lo tiene: en la edición no se ofrece: el
   * expediente ya está relleno y precargar campos leídos de un papel encima de
   * lo que hay escrito no es una ayuda, es una forma de perder datos. Antes
   * había ahí un botón permanentemente desactivado, que es peor: una pantalla
   * que promete algo que no hace.
   */
  ocr?: Record<string, string>;
};

export function FormularioExpediente({ textos }: { textos: TextosFormulario }) {
  const [seccion, setSeccion] = useState<string>(SECCIONES[0]);
  const [tipo, setTipo] = useState<string>("regular");

  /**
   * Lo que leyó el documento, para precargar los campos.
   *
   * Se guarda aparte del formulario y se aplica REMONTANDO la rejilla con una
   * `key` distinta. Los campos son no controlados —setenta `defaultValue`, que
   * es lo que evita setenta `useState` y un re-render por cada tecla—, y un
   * `defaultValue` que cambia no mueve un campo ya montado.
   *
   * Por eso el lector va ARRIBA y se usa ANTES de escribir: remontar descarta
   * lo que hubiera puesto a mano. El aviso de la pantalla lo dice.
   */
  const [leido, setLeido] = useState<ValoresExpediente | null>(null);
  const [version, setVersion] = useState(0);

  const [alta, enviarAlta, guardando] = useActionState<
    EstadoExpediente,
    FormData
  >(crearExpediente, { estado: "inicial" });

  const indice = SECCIONES.indexOf(seccion as (typeof SECCIONES)[number]);

  const ir = (paso: number) => {
    const siguiente = SECCIONES[indice + paso];
    if (siguiente) setSeccion(siguiente);
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" />
          {textos.nuevo}
        </Button>
      </DialogTrigger>

      {/* Sin `max-h` propio: el de `DialogContent` ya es
          `max-h-[calc(100dvh-4rem)]`, y `dvh` descuenta la barra de direcciones
          del navegador móvil. El `92vh` que había aquí la ignoraba, así que en
          iOS el diálogo medía más que la pantalla visible y la fila de
          Anterior/Siguiente/Guardar quedaba por debajo del borde. */}
      <DialogContent className="overflow-y-auto sm:max-w-5xl lg:max-w-6xl">
        <DialogHeader>
          <DialogTitle>{textos.titulo}</DialogTitle>
          <DialogDescription>{textos.subtitulo}</DialogDescription>
        </DialogHeader>

        {/* El lector va FUERA del `<form>` del alta: son dos envíos distintos y
            uno anidado en el otro no es HTML válido —además de que subir un
            documento no puede enviar un expediente a medio rellenar—. */}
        {textos.ocr && (
          <LectorFicha
            textos={textos.ocr}
            alLeer={(valores) => {
              setLeido(valores);
              setVersion((n) => n + 1);
              setSeccion(SECCIONES[0]);
            }}
          />
        )}

        <form action={enviarAlta} className="space-y-4">
          <CamposExpediente
            key={version}
            textos={textos}
            seccion={seccion}
            onSeccionChange={setSeccion}
            tipo={tipo}
            onTipoChange={setTipo}
            valores={leido ?? undefined}
          />

          {/* El único error que la acción distingue por campo es el nombre
              vacío, y es el que se puede arreglar sin salir de aquí: se dice en
              qué pestaña está. */}
          {alta.estado !== "inicial" && alta.estado !== "ok" && (
            <p role="alert" className={ALERTA_RIESGO.contenedor}>
              <AlertCircle className={ALERTA_RIESGO.icono} />
              <span className={ALERTA_RIESGO.texto}>
                {alta.estado === "invalido"
                  ? textos.faltaNombre
                  : textos.error}
              </span>
            </p>
          )}

          <div className="flex flex-wrap items-center gap-3 border-t pt-4">
            <p className="text-muted-foreground text-xs">
              {textos.progreso[indice]}
            </p>

            {/* `flex-wrap` también aquí dentro: el contenedor de fuera lo
                tenía, pero este no, así que los tres botones se comprimían en
                una sola fila a 360px en vez de bajar a la siguiente. */}
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => ir(-1)}
                disabled={indice === 0}
              >
                {textos.anterior}
              </Button>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => ir(1)}
                disabled={indice === SECCIONES.length - 1}
              >
                {textos.siguiente}
              </Button>

              <Button type="submit" size="sm" disabled={guardando}>
                {guardando ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Save className="size-3.5" />
                )}
                {guardando ? textos.guardando : textos.guardar}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}


/**
 * Lector del documento escaneado: sube, lee y precarga.
 *
 * Una línea y no un panel: es el paso previo, no el protagonista, y cada píxel
 * que ocupa aquí es scroll en el formulario más largo del sistema.
 *
 * LO QUE ENSEÑA SIEMPRE ES LA CONFIANZA. Un nombre leído al 61% y otro al 99%
 * no se revisan igual, y esconder ese número convierte una sugerencia en un
 * hecho. El aviso de "la IA propone, la persona confirma" (`ocr.reviewHint`)
 * lleva escrito en `messages` desde antes de que existiera esta pantalla.
 *
 * Y avisa de que precargar REEMPLAZA lo escrito: los campos son no controlados
 * y la precarga los remonta, así que el orden natural —leer primero, corregir
 * después— es también el único que no pierde trabajo.
 */
function LectorFicha({
  textos,
  alLeer,
}: {
  textos: Record<string, string>;
  alLeer: (valores: ValoresExpediente) => void;
}) {
  const [lectura, leer, leyendo] = useActionState<EstadoLectura, FormData>(
    async (previo, datos) => {
      const resultado = await leerFichaEscaneada(previo, datos);

      if (resultado.estado === "ok") {
        alLeer({
          nombre: resultado.nombre,
          cedula: resultado.cedula ?? undefined,
          fecha_nacimiento: resultado.fechaNacimiento ?? undefined,
        });
      }

      return resultado;
    },
    { estado: "inicial" },
  );

  const fallo =
    lectura.estado !== "inicial" && lectura.estado !== "ok"
      ? lectura.estado === "ilegible" || lectura.estado === "sin_archivo"
        ? textos.notFound
        : lectura.estado === "tipo_no_admitido"
          ? textos.unsupported
          : lectura.estado === "demasiado_grande"
            ? textos.fileTooLarge
            : lectura.estado === "sin_clave"
              ? textos.noKey
              : textos.error
      : null;

  return (
    <form
      action={leer}
      className="space-y-2 rounded-xl border border-[#2096BA]/30 bg-[#2096BA]/10 p-3"
    >
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#2096BA]/15 text-[#187a99]">
          <ScanLine className="size-4" />
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{textos.title}</p>
          <p className="text-muted-foreground text-xs">{textos.subtitle}</p>
        </div>

        <Input
          type="file"
          name="documento"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          aria-label={textos.upload}
          className="h-9 w-full cursor-pointer sm:w-64"
        />

        <Button type="submit" size="sm" disabled={leyendo} className="shrink-0">
          {leyendo ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <ScanLine className="size-3.5" />
          )}
          {leyendo ? textos.processing : textos.upload}
        </Button>
      </div>

      {lectura.estado === "ok" && (
        <p className="text-xs text-[#0a6a8a]">
          {textos.extracted}: <b>{lectura.nombre}</b>
          {lectura.cedula ? ` · ${lectura.cedula}` : ""}
          {lectura.fechaNacimiento ? ` · ${lectura.fechaNacimiento}` : ""}
          {" · "}
          {textos.confidence}: {lectura.confianza ?? 0}%
        </p>
      )}

      {fallo && (
        <p role="alert" className="flex items-start gap-1.5">
          <AlertCircle className="mt-0.5 size-3.5 shrink-0 text-[#171A1D]" />
          <span className="text-xs text-[#171A1D]">{fallo}</span>
        </p>
      )}

      <p className="text-muted-foreground text-[11px] leading-relaxed">
        {textos.reviewHint} {textos.replaceHint}
      </p>
    </form>
  );
}

/**
 * El cuerpo del formulario: banner de OCR más las seis pestañas de campos.
 *
 * Sin `<form>` ni botones propios —eso lo pone quien lo use, porque el diálogo
 * de alta y la página de edición envían a sitios distintos (ninguno, todavía, y
 * una Server Action, respectivamente).
 *
 * `valores` precarga cada campo con `defaultValue`; sin él, todo nace vacío,
 * que es el caso del alta. `soloLectura` deshabilita cada control, para cuando
 * quien mira el expediente no tiene `expedientes.escribir` y solo puede
 * consultarlo.
 * `campoFoto` es un hueco al principio de la pestaña de identidad: la foto solo
 * la pinta la página de edición, que es la única que la puede subir.
 *
 * El lector de documento NO está aquí, aunque antes sí: lo monta el alta, que
 * es la única pantalla donde precargar campos tiene sentido. Ver la nota de
 * `ocr` en `TextosFormulario`.
 */
export function CamposExpediente({
  textos,
  seccion,
  onSeccionChange,
  tipo,
  onTipoChange,
  valores,
  soloLectura = false,
  campoFoto,
}: {
  textos: TextosFormulario;
  seccion: string;
  onSeccionChange: (seccion: string) => void;
  tipo: string;
  onTipoChange: (tipo: string) => void;
  valores?: ValoresExpediente;
  soloLectura?: boolean;
  campoFoto?: React.ReactNode;
}) {
  const becado = tipo === "becado";
  const familiares = valores?.familiares;

  const [latitud, setLatitud] = useState<number | null>(valores?.latitud ?? null);
  const [longitud, setLongitud] = useState<number | null>(valores?.longitud ?? null);
  const [municipio, setMunicipio] = useState<string>(valores?.municipio ?? "Concepción de La Vega");

  return (
    <>
      <Tabs value={seccion} onValueChange={onSeccionChange}>
        {/* `h-auto` en móvil. `TabsList` trae `h-9` fija en el primitivo, y en
            móvil estas seis pestañas caen en dos filas de tres: la segunda
            quedaba recortada dentro de los 36px del contenedor, así que la
            mitad de la navegación del formulario más largo del sistema no se
            veía. Desde `sm` vuelven a una fila y la altura fija es correcta.
            `truncate` en el disparador porque `TabsTrigger` trae
            `whitespace-nowrap`: con una etiqueta larga o una traducción más
            larga, el texto se salía del pill en vez de recortarse. */}
        <TabsList className="grid h-auto w-full grid-cols-3 sm:h-9 sm:grid-cols-6">
          {SECCIONES.map((clave) => (
            <TabsTrigger key={clave} value={clave} className="truncate text-xs">
              {textos.pestanas[clave]}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* ── Identidad: tabla `estudiante` ───────────────────── */}
        <TabsContent value="identity" className="mt-4 space-y-4">
          {campoFoto}

          <Rejilla>
            <Campo
              nombre="nombre"
              etiqueta={textos.campos.name}
              requerido
              ancho
              valorPredeterminado={valores?.nombre}
              soloLectura={soloLectura}
            />
            <Campo
              nombre="cedula"
              etiqueta={textos.campos.idCard}
              valorPredeterminado={valores?.cedula}
              soloLectura={soloLectura}
            />
            <Campo
              nombre="email"
              etiqueta={textos.campos.email}
              tipo="email"
              valorPredeterminado={valores?.email}
              soloLectura={soloLectura}
            />
            <Campo
              nombre="telefono"
              etiqueta={textos.campos.phone}
              valorPredeterminado={valores?.telefono}
              soloLectura={soloLectura}
            />
            <Campo
              nombre="fecha_nacimiento"
              etiqueta={textos.campos.birthDate}
              tipo="date"
              valorPredeterminado={valores?.fecha_nacimiento}
              soloLectura={soloLectura}
            />
            <Campo
              nombre="lugar_nacimiento"
              etiqueta={textos.campos.birthPlace}
              valorPredeterminado={valores?.lugar_nacimiento}
              soloLectura={soloLectura}
            />
            <Campo
              nombre="nacionalidad"
              etiqueta={textos.campos.nationality}
              valorPredeterminado={valores?.nacionalidad}
              soloLectura={soloLectura}
            />
            <Selector
              nombre="genero"
              etiqueta={textos.campos.gender}
              opciones={GENEROS.map((v) => ({ valor: v, texto: textos.generos[v] }))}
              vacio={textos.opcional}
              predeterminado={valores?.genero ?? undefined}
              disabled={soloLectura}
            />
            <Campo
              nombre="sexo_documento"
              etiqueta={textos.campos.sexDocument}
              valorPredeterminado={valores?.sexo_documento}
              soloLectura={soloLectura}
            />
            <Campo
              nombre="religion"
              etiqueta={textos.campos.religion}
              valorPredeterminado={valores?.religion}
              soloLectura={soloLectura}
            />
          </Rejilla>
        </TabsContent>

        {/* ── Académico: tabla `estudiante` ───────────────────── */}
        <TabsContent value="academic" className="mt-4">
          <Rejilla>
            <Selector
              nombre="tipo"
              etiqueta={textos.campos.type}
              valor={tipo}
              onChange={onTipoChange}
              opciones={TIPOS_ESTUDIANTE.map((v) => ({ valor: v, texto: textos.tipos[v] }))}
              disabled={soloLectura}
            />
            <Selector
              nombre="estado"
              etiqueta={textos.campos.status}
              predeterminado={valores?.estado ?? "activo"}
              opciones={ESTADOS_ESTUDIANTE.map((v) => ({ valor: v, texto: textos.estados[v] }))}
              disabled={soloLectura}
            />
            <Campo
              nombre="programa"
              etiqueta={textos.campos.program}
              valorPredeterminado={valores?.programa}
              soloLectura={soloLectura}
            />
            <Campo
              nombre="donde_estudia"
              etiqueta={textos.campos.whereStudies}
              valorPredeterminado={valores?.donde_estudia}
              soloLectura={soloLectura}
            />

            {/* Los tres campos de becado solo existen si lo es. Ocultarlos
                en vez de deshabilitarlos: en un expediente de curso técnico
                la universidad no está vacía, es que no aplica. */}
            {becado && (
              <Campo
                nombre="universidad"
                etiqueta={textos.campos.university}
                valorPredeterminado={valores?.universidad}
                soloLectura={soloLectura}
              />
            )}

            <Campo
              nombre="fecha_ingreso"
              etiqueta={textos.campos.entryDate}
              tipo="date"
              valorPredeterminado={valores?.fecha_ingreso}
              soloLectura={soloLectura}
            />
            <Campo
              nombre="centro_educativo"
              etiqueta={textos.campos.school}
              valorPredeterminado={valores?.centro_educativo}
              soloLectura={soloLectura}
            />
            <Campo
              nombre="director_centro"
              etiqueta={textos.campos.schoolDirector}
              valorPredeterminado={valores?.director_centro}
              soloLectura={soloLectura}
            />
            <Campo
              nombre="facilitador_habitudes"
              etiqueta={textos.campos.facilitator}
              valorPredeterminado={valores?.facilitador_habitudes}
              soloLectura={soloLectura}
            />
            <Area
              nombre="breve_historia_habitudes"
              etiqueta={textos.campos.habitudesStory}
              filas={4}
              valorPredeterminado={valores?.breve_historia_habitudes}
              soloLectura={soloLectura}
            />
          </Rejilla>
        </TabsContent>

        {/* ── Familia: tabla `familiar` (una fila por bloque) ─── */}
        <TabsContent value="family" className="mt-4 space-y-3">
          <p className="text-muted-foreground flex items-center gap-2 text-xs">
            <Users className="size-3.5 shrink-0" />
            {textos.familia.emptyHint}
          </p>

          {FAMILIA_FIJA.map((parentesco) => (
            <fieldset
              key={parentesco}
              className="rounded-xl border p-3"
              name={`familiar_${parentesco}`}
            >
              <legend className="px-1 text-xs font-semibold">
                {textos.parentescos[parentesco]}
              </legend>

              <div className="grid gap-3 sm:grid-cols-4">
                <Campo
                  nombre={`${parentesco}_nombre`}
                  etiqueta={textos.familia.name}
                  ancho
                  valorPredeterminado={familiares?.[parentesco]?.nombre}
                  soloLectura={soloLectura}
                />
                <Campo
                  nombre={`${parentesco}_edad`}
                  etiqueta={textos.familia.age}
                  tipo="number"
                  valorPredeterminado={familiares?.[parentesco]?.edad ?? undefined}
                  soloLectura={soloLectura}
                />
                <Campo
                  nombre={`${parentesco}_telefono`}
                  etiqueta={textos.familia.phone}
                  valorPredeterminado={familiares?.[parentesco]?.telefono}
                  soloLectura={soloLectura}
                />
                <Campo
                  nombre={`${parentesco}_profesion`}
                  etiqueta={textos.familia.occupation}
                  ancho
                  valorPredeterminado={familiares?.[parentesco]?.profesion}
                  soloLectura={soloLectura}
                />
              </div>
            </fieldset>
          ))}

          <Rejilla>
            <Campo
              nombre="con_quien_vive"
              etiqueta={textos.campos.livesWith}
              valorPredeterminado={valores?.con_quien_vive}
              soloLectura={soloLectura}
            />
            <Campo
              nombre="por_que_vive_con_esa_persona"
              etiqueta={textos.campos.whyLivesWith}
              valorPredeterminado={valores?.por_que_vive_con_esa_persona}
              soloLectura={soloLectura}
            />
            <Campo
              nombre="hermanos_cantidad"
              etiqueta={textos.campos.siblings}
              tipo="number"
              valorPredeterminado={valores?.hermanos_cantidad ?? undefined}
              soloLectura={soloLectura}
            />
          </Rejilla>
        </TabsContent>

        {/* ── Vivienda: tabla `perfil_vivienda` ───────────────── */}
        <TabsContent value="housing" className="mt-4">
          <Rejilla>
            <Selector
              nombre="casa_propia"
              etiqueta={textos.campos.ownHouse}
              opciones={CASA_PROPIA.map((v) => ({ valor: v, texto: textos.casa[v] }))}
              vacio={textos.opcional}
              predeterminado={valores?.casa_propia ?? undefined}
              disabled={soloLectura}
            />
            <Selector
              nombre="bano_dentro"
              etiqueta={textos.campos.bathroom}
              opciones={BANO.map((v) => ({ valor: v, texto: textos.bano[v] }))}
              vacio={textos.opcional}
              predeterminado={valores?.bano_dentro ?? undefined}
              disabled={soloLectura}
            />
            <Campo
              nombre="habitaciones"
              etiqueta={textos.campos.rooms}
              tipo="number"
              valorPredeterminado={valores?.habitaciones ?? undefined}
              soloLectura={soloLectura}
            />
            <Campo
              nombre="camas"
              etiqueta={textos.campos.beds}
              tipo="number"
              valorPredeterminado={valores?.camas ?? undefined}
              soloLectura={soloLectura}
            />
            <Area
              nombre="tipo_casa"
              etiqueta={textos.campos.houseType}
              filas={2}
              valorPredeterminado={valores?.tipo_casa}
              soloLectura={soloLectura}
            />
            <Area
              nombre="quienes_duermen_cama"
              etiqueta={textos.campos.whoSleeps}
              filas={2}
              valorPredeterminado={valores?.quienes_duermen_cama}
              soloLectura={soloLectura}
            />
            <Campo
              nombre="direccion"
              etiqueta={textos.campos.address}
              ancho
              valorPredeterminado={valores?.direccion}
              soloLectura={soloLectura}
            />
            <Campo
              nombre="comunidad"
              etiqueta={textos.campos.community}
              valorPredeterminado={valores?.comunidad}
              soloLectura={soloLectura}
            />
            <Campo
              nombre="ciudad_residencia"
              etiqueta={textos.campos.city}
              valorPredeterminado={valores?.ciudad_residencia}
              soloLectura={soloLectura}
            />

            <input type="hidden" name="latitud" value={latitud != null ? String(latitud) : ""} />
            <input type="hidden" name="longitud" value={longitud != null ? String(longitud) : ""} />
            <input type="hidden" name="municipio" value={municipio} />

            <div className="col-span-1 md:col-span-2 space-y-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <MapPin className="size-3.5 text-[#2096BA]" />
                  Ubicación de Vivienda en la Provincia de La Vega
                </span>
                <span className="text-[11px] text-slate-500 italic">
                  {soloLectura
                    ? "Coordenadas fijadas en La Vega"
                    : "Haz clic o arrastra el pin para georreferenciar el hogar del estudiante"}
                </span>
              </div>
              <MapaLaVega
                modo={soloLectura ? "vista_vivienda" : "seleccion"}
                lat={latitud}
                lng={longitud}
                alCambiarCoordenadas={(newLat, newLng, meta) => {
                  setLatitud(newLat);
                  setLongitud(newLng);
                  if (meta?.municipio) setMunicipio(meta.municipio);
                }}
                altura="320px"
                soloLectura={soloLectura}
              />
            </div>
          </Rejilla>
        </TabsContent>

        {/* ── Salud: tabla `perfil_salud` ─────────────────────── */}
        <TabsContent value="health" className="mt-4">
          <Rejilla>
            <Area
              nombre="enfermedades"
              etiqueta={textos.campos.illnesses}
              filas={2}
              valorPredeterminado={valores?.enfermedades}
              soloLectura={soloLectura}
            />
            <Area
              nombre="alergias"
              etiqueta={textos.campos.allergies}
              filas={2}
              valorPredeterminado={valores?.alergias}
              soloLectura={soloLectura}
            />
            <Campo
              nombre="contacto_emergencia_nombre"
              etiqueta={textos.campos.emergencyName}
              valorPredeterminado={valores?.contacto_emergencia_nombre}
              soloLectura={soloLectura}
            />
            <Campo
              nombre="contacto_emergencia_telefono"
              etiqueta={textos.campos.emergencyPhone}
              valorPredeterminado={valores?.contacto_emergencia_telefono}
              soloLectura={soloLectura}
            />
          </Rejilla>
        </TabsContent>

        {/* ── Situación: `perfil_socioeconomico` + seguimiento ─ */}
        <TabsContent value="social" className="mt-4">
          <Rejilla>
            <Area
              nombre="historia_de_vida"
              etiqueta={textos.campos.lifeStory}
              filas={4}
              ancho
              valorPredeterminado={valores?.historia_de_vida}
              soloLectura={soloLectura}
            />
            <Area
              nombre="situacion_familiar"
              etiqueta={textos.campos.familySituation}
              filas={3}
              valorPredeterminado={valores?.situacion_familiar}
              soloLectura={soloLectura}
            />
            <Area
              nombre="situacion_economica"
              etiqueta={textos.campos.economicSituation}
              filas={3}
              valorPredeterminado={valores?.situacion_economica}
              soloLectura={soloLectura}
            />

            {becado && (
              <Area
                nombre="motivo_beca"
                etiqueta={textos.campos.scholarshipReason}
                filas={3}
                ancho
                valorPredeterminado={valores?.motivo_beca}
                soloLectura={soloLectura}
              />
            )}

            <Area
              nombre="metas_academicas"
              etiqueta={textos.campos.academicGoals}
              filas={3}
              ancho
              valorPredeterminado={valores?.metas_academicas}
              soloLectura={soloLectura}
            />

            <Selector
              nombre="envio_correo_patrocinador"
              etiqueta={textos.campos.sponsorEmail}
              predeterminado={valores?.envio_correo_patrocinador ?? "pendiente"}
              opciones={ENVIO_CORREO.map((v) => ({ valor: v, texto: textos.seguimiento[v] ?? v }))}
              disabled={soloLectura}
            />
            <Selector
              nombre="asistio_reunion_mensual"
              etiqueta={textos.campos.monthlyMeeting}
              predeterminado={valores?.asistio_reunion_mensual ?? "no"}
              opciones={ASISTIO_REUNION.map((v) => ({ valor: v, texto: textos.seguimiento[v] ?? v }))}
              disabled={soloLectura}
            />
            <Area
              nombre="amonestaciones"
              etiqueta={textos.campos.warnings}
              filas={2}
              valorPredeterminado={valores?.amonestaciones}
              soloLectura={soloLectura}
            />
            <Area
              nombre="solicitudes_pendientes"
              etiqueta={textos.campos.pendingRequests}
              filas={2}
              valorPredeterminado={valores?.solicitudes_pendientes}
              soloLectura={soloLectura}
            />
            <Area
              nombre="notas_adicionales"
              etiqueta={textos.campos.notes}
              filas={2}
              ancho
              valorPredeterminado={valores?.notas_adicionales}
              soloLectura={soloLectura}
            />
          </Rejilla>
        </TabsContent>
      </Tabs>
    </>
  );
}

/**
 * La rejilla de campos de una sección.
 *
 * Tres columnas en pantalla ancha y no dos. Con dos, la sección de identidad
 * —quince campos— medía más de una pantalla y había que hacer scroll dentro del
 * diálogo para llegar a los botones; con tres cabe entera. Un campo marcado como
 * `ancho` ocupa toda la fila, que es lo que necesitan el nombre y las direcciones.
 */
function Rejilla({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
  );
}

function Campo({
  nombre,
  etiqueta,
  tipo = "text",
  requerido = false,
  ancho = false,
  valorPredeterminado,
  soloLectura = false,
}: {
  nombre: string;
  etiqueta: string;
  tipo?: string;
  requerido?: boolean;
  /** Ocupa las dos columnas de la rejilla. */
  ancho?: boolean;
  valorPredeterminado?: string | number | null;
  soloLectura?: boolean;
}) {
  return (
    <div className={cn("space-y-1.5", ancho && "sm:col-span-2")}>
      <Label htmlFor={nombre} className="text-xs">
        {etiqueta}
        {requerido && <span className="text-destructive ml-0.5">*</span>}
      </Label>
      <Input
        id={nombre}
        name={nombre}
        type={tipo}
        required={requerido}
        defaultValue={valorPredeterminado ?? undefined}
        disabled={soloLectura}
      />
    </div>
  );
}

function Area({
  nombre,
  etiqueta,
  filas,
  ancho = false,
  valorPredeterminado,
  soloLectura = false,
}: {
  nombre: string;
  etiqueta: string;
  filas: number;
  ancho?: boolean;
  valorPredeterminado?: string | null;
  soloLectura?: boolean;
}) {
  return (
    <div className={cn("space-y-1.5", ancho && "sm:col-span-2")}>
      <Label htmlFor={nombre} className="text-xs">
        {etiqueta}
      </Label>
      <Textarea
        id={nombre}
        name={nombre}
        rows={filas}
        defaultValue={valorPredeterminado ?? undefined}
        disabled={soloLectura}
      />
    </div>
  );
}

/**
 * Desplegable nativo, no el de Radix: este formulario se enviará a una Server
 * Action y el valor tiene que viajar en el `FormData` sin JavaScript de por
 * medio. Es la misma razón por la que lo hace el formulario de cita.
 */
function Selector({
  nombre,
  etiqueta,
  opciones,
  vacio,
  predeterminado,
  valor,
  onChange,
  disabled = false,
}: {
  nombre: string;
  etiqueta: string;
  opciones: readonly { valor: string; texto: string }[];
  /** Texto de la opción en blanco. Sin él, el campo es obligatorio de hecho. */
  vacio?: string;
  predeterminado?: string;
  /** Solo para el tipo de estudiante, del que dependen otros campos. */
  valor?: string;
  onChange?: (valor: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={nombre} className="text-xs">
        {etiqueta}
      </Label>
      <select
        id={nombre}
        name={nombre}
        value={valor}
        defaultValue={valor === undefined ? (predeterminado ?? "") : undefined}
        onChange={onChange ? (evento) => onChange(evento.target.value) : undefined}
        disabled={disabled}
        className="border-input focus-visible:border-ring focus-visible:ring-ring/50 h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {vacio && <option value="">{vacio}</option>}
        {opciones.map((opcion) => (
          <option key={opcion.valor} value={opcion.valor}>
            {opcion.texto}
          </option>
        ))}
      </select>
    </div>
  );
}
