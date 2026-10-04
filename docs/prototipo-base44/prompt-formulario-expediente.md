================================================================
  FORMULARIO "AÑADIR EXPEDIENTE" — DESCRIPCIÓN COMPLETA
  Archivo: src/pages/Expedientes.jsx + subcomponentes
  FormFamiliar.jsx · FormSeguimiento.jsx
  Fecha: 2026-08-08
================================================================

══════════════════════════════════════════════════════════════════
  PARTE 1 — ESTRUCTURA GENERAL DEL FORMULARIO
══════════════════════════════════════════════════════════════════

Modal Dialog (max-w-3xl, max-h-90vh) titulado "Nuevo Expediente
Estudiantil" (o "Editar: {nombre}" si se está editando).

De arriba a abajo:
  1) Zona OCR (caja azul)
  2) Zona de foto del estudiante
  3) Tabs con los 6 grupos de campos (scrollable)
  4) Barra inferior: Cancelar + Guardar

Estado inicial del formulario (FORM_EMPTY): todos los campos
vacíos, excepto:
  • tipo = 'regular' (Curso Técnico)
  • estado = 'activo'
  • envio_correo_patrocinador = 'pendiente'
  • asistio_reunion_mensual = 'no'

Único campo obligatorio: nombre. El botón Guardar se deshabilita
si está vacío o si hay una mutación en curso.

══════════════════════════════════════════════════════════════════
  PARTE 2 — ZONA OCR (escanear documento con IA)
══════════════════════════════════════════════════════════════════

Caja bg-blue-50 border-blue-200 rounded-xl p-4 con icono
ScanLine text-blue-600.

  • Título "Escanear documento con IA (OCR)" text-blue-900.
  • Descripción: "Sube una imagen o PDF del expediente y la IA
    llenará los campos automáticamente".
  • Botón "Subir y escanear documento" bg-blue-600 text-white,
    accept="image/*,.pdf". Muestra Loader2 animate-spin con
    texto "Procesando documento..." mientras trabaja.

CÓMO FUNCIONA EL OCR (handleOcr):
  1) El usuario selecciona un archivo (imagen o PDF).
  2) Se sube el archivo al almacenamiento con:
       base44.integrations.Core.UploadFile({ file })
     → obtiene { file_url }.
  3) Se llama al LLM con:
       base44.integrations.Core.InvokeLLM({
         prompt: "...(instrucciones de extracción)...",
         file_urls: [file_url],
         response_json_schema: { type: 'object', properties: {...} }
       })
  4) El prompt instruye al modelo a actuar como "asistente experto
     en lectura de expedientes estudiantiles de fundaciones en El
     Salvador" y a extraer TODOS los datos disponibles, prestando
     especial atención a:
       - Historia de vida (narrativa personal, contexto familiar,
         experiencias, motivaciones)
       - Situación familiar (dinámica del hogar, con quién vive)
       - Situación económica (ingresos, ocupaciones, necesidades)
       - Metas académicas (aspiraciones profesionales)
       - Datos personales (nombre, cédula, contactos, dirección)
       - Datos familiares (padres, tutor, hermanos, vivienda)
     Indica incluir texto narrativo largo COMPLETO en
     historia_de_vida y situacion_familiar, y solo llenar campos
     que realmente aparecen en el documento.
  5) El JSON schema de respuesta define ~45 propiedades (todas
     type: 'string' salvo habitaciones y camas que son number).
  6) DOS comportamientos según el contexto:
     a) Si NO hay estudiante existente (formulario de creación):
        → setForm(prev => ({ ...prev, ...extracted,
          expediente_url: file_url }))
        → Rellena los campos del formulario + guarda la URL del
          documento escaneado en expediente_url. El usuario puede
          revisar/editar antes de guardar.
     b) Si hay estudianteExistente (escaneo sobre un registro
        ya creado, desde la ficha del expediente en
        administración):
        → Filtra solo campos no vacíos del resultado.
        → base44.entities.Estudiante.update(id, {
            ...camposNoVacios, expediente_url: file_url })
        → Invalida query ['estudiantes'].
        → Actualiza el perfil directamente sin abrir formulario.
  7) Se desactiva ocrLoading al terminar.

NOTA: la URL del archivo subido siempre se conserva en
exppediente_url, sea cual sea el camino. El OCR rellena campos
pero NUNCA sobreescribe valores existentes del formulario con
vacíos (en el caso b filtra campos vacíos; en el caso a el
spread de extracted sobreescribe con lo que venga del LLM, que
incluye undefined/null solo si el LLM no lo encontró).

══════════════════════════════════════════════════════════════════
  PARTE 3 — ZONA DE FOTO
══════════════════════════════════════════════════════════════════

Círculo w-16 h-16 rounded-full border-2 border-dashed. Si
form.foto_url → muestra la imagen object-cover; si está
cargando → Loader2; si no → icono Camera.

Link "Subir foto del estudiante" / "Cambiar foto" que dispara
handlePhotoUpload: UploadFile → setForm con foto_url.

══════════════════════════════════════════════════════════════════
  PARTE 4 — LOS DOS TIPOS DE ESTUDIANTE
══════════════════════════════════════════════════════════════════

Campo: tipo (Select en tab Académico). Valores:

  ───────────────────────────────────────────────────────────
  REGULAR — "Curso Técnico (Regular)"
  ───────────────────────────────────────────────────────────
  • Estudiantes del programa de cursos técnicos/formativos.
  • Badge en lista: variant="secondary", texto "Curso Técnico".
  • En el detalle: Badge secondary "Curso Técnico".
  • NO muestra campos de Universidad, Patrocinador ni Motivo de
    Beca en el formulario (esos campos quedan ocultos).
  • Ruta de portal asociado: /portal/estudiante (Portal
    Estudiantil con banner #2096BA → #0a6a8a).
  • Rol en RoleContext: estudiante (GraduationCap, de
    from-blue-500 a blue-700).

  ───────────────────────────────────────────────────────────
  BECADO — "Becado Universitario"
  ───────────────────────────────────────────────────────────
  • Estudiantes con beca universitaria patrocinada.
  • Badge en lista: variant="default", texto "Becado
    Universitario".
  • En el detalle: Badge default "Becado Universitario".
  • SÍ muestra en el formulario campos adicionales:
      - Universidad (Input)
      - Patrocinador (Input, patrocinador_nombre)
      - Motivo de la Beca (Textarea rows=3)
    Estos 3 campos aparecen SOLO cuando form.tipo === 'becado'.
  • En el detalle del expediente, el campo Universidad también se
    muestra solo si tipo === 'becado'.
  • Acceso al Portal Estudiantil también, pero el perfil
    institucional es de becado (aparece patrocinador vinculado,
    aporte mensual en verde emerald).

══════════════════════════════════════════════════════════════════
  PARTE 5 — LOS CUATRO ESTADOS DE ESTUDIANTE
══════════════════════════════════════════════════════════════════

Campo: estado (Select en tab Académico). Valores + colores de
badge en la lista/detalle (estadoColors):

  ┌──────────────┬──────────────────────────────────┬─────────┐
  │ Estado       │ Significado                       │ Badge    │
  ├──────────────┼──────────────────────────────────┼─────────┤
  │ activo       │ Estudiante vigente, cursando      │ emerald  │
  │              │ (default al crear)                │ 100/700  │
  │ inactivo     │ Temporalmente fuera del programa   │ gray     │
  │              │ (no activo, no graduado)           │ 100/700  │
  │ graduado     │ Completó el programa/carrera       │ blue     │
  │              │                                   │ 100/700  │
  │ suspendido   │ Suspendido por amonestaciones o    │ red      │
  │              │ medida disciplinaria              │ 100/700  │
  └──────────────┴──────────────────────────────────┴─────────┘

El estado se muestra como Badge en la cabecera de cada tarjeta
de la lista (junto al nombre) y en el profile strip del
ExpedienteDetalle.

══════════════════════════════════════════════════════════════════
  PARTE 6 — CAMPOS POR PESTAÑA (tabs grid-cols-6)
════════──────────────────────────────────────────────────────

──────────────────────────────────────────────────────────────
TAB 1 — PERSONAL
──────────────────────────────────────────────────────────────
Grid 2 columnas:
  • Nombre Completo * (sm:col-span-2) — Input, obligatorio
  • Cédula / DUI — Input
  • Teléfono — Input
  • Email — Input type=email
  • Fecha de Nacimiento — Input type=date
  • Nacionalidad — Input
  • Sexo — Select (masculino / femenino)
  • Religión — Input
  • Comunidad — Input (sm:col-span-2)
  • Dirección — Input (sm:col-span-2)
  • Ciudad — Input
  • País — Input

──────────────────────────────────────────────────────────────
TAB 2 — ACADÉMICO
──────────────────────────────────────────────────────────────
Grid 2 columnas:
  • Tipo de Estudiante — Select (regular / becado)
  • Estado — Select (activo / inactivo / graduado / suspendido)
  • ¿Qué estudia? — Input (programa)
  • ¿Dónde estudia? — Input (donde_estudia)
  • [SOLO BECADO] Universidad — Input
  • [SOLO BECADO] Patrocinador — Input (patrocinador_nombre)
  • Fecha de Ingreso — Input type=date
  • [SOLO BECADO] Motivo de la Beca — Textarea rows=3
  • Metas Académicas y Profesionales — Textarea rows=3 (full width)

──────────────────────────────────────────────────────────────
TAB 3 — HABITUDES
──────────────────────────────────────────────────────────────
Grid 2 columnas:
  • Facilitador de Habitudes — Input
  • Centro Educativo — Input
  • Director del Centro — Input
  • Breve Historia de Habitudes — Textarea rows=5
  • Imagen de Habitudes — Upload (Camera): preview w-32 h-32
    rounded-xl border + link "Subir/Cambiar imagen"; guarda en
    imagen_habitudes_url vía UploadFile.

──────────────────────────────────────────────────────────────
TAB 4 — FAMILIA (FormFamiliar.jsx)
──────────────────────────────────────────────────────────────
5 bloques PersonaRow (border rounded-xl p-3), cada uno con grid
4 columnas: Nombre (col-span-2) · Edad · Teléfono · Profesión
(col-span-2):
  • Padre (padre_*)
  • Madre (madre_*)
  • Tutor (tutor_*)
  • Madrastra (madrastra_*)
  • Padrastro (padrastro_*)

Bloque "Convivencia en el hogar":
  • ¿Con quién vive en casa? — Input (con_quien_vive)
  • ¿Por qué vive con esa persona? — Input
  • Cuántos hermanos menores — Input (hermanos_cantidad)
  • Hermanos (nombres y edades) — Textarea rows=2
  • Hermanas (nombres y edades) — Textarea rows=2

Bloque "Vivienda":
  • ¿La casa es propia? — Select (sí/Propia · alquilada ·
    prestada · no)
  • Baño — Select (dentro / fuera)
  • Nº habitaciones — Input type=number
  • Nº camas — Input type=number
  • Tipo de casa (describir) — Textarea rows=2
  • ¿Quiénes duermen en cada cama? — Textarea rows=2

──────────────────────────────────────────────────────────────
TAB 5 — HISTORIA
──────────────────────────────────────────────────────────────
  • Historia de Vida — Textarea rows=4 (historia_de_vida)
  • Situación Familiar — Textarea rows=3 (situacion_familiar)
  • Situación Económica — Textarea rows=3 (situacion_economica)

──────────────────────────────────────────────────────────────
TAB 6 — SEGUIMIENTO (FormSeguimiento.jsx)
──────────────────────────────────────────────────────────────
Bloque "Salud":
  • Enfermedades que padece — Textarea rows=2 (enfermedades)
  • Alergias — Textarea rows=2 (alergias)

Bloque "Emergencias":
  • Nombre — en caso de emergencia — Input
  • Teléfono de emergencia — Input

Bloque "Seguimiento del cuatrimestre":
  • ¿Envió correo al patrocinador? — Select (sí / no /
    pendiente) → envio_correo_patrocinador, default 'pendiente'
  • ¿Asistió a reunión mensual? — Select (sí / no / justificado)
    → asistio_reunion_mensual, default 'no'
  • Amonestaciones del cuatrimestre — Textarea rows=2
  • Solicitudes pendientes — Textarea rows=2
  • Notas administrativas adicionales — Textarea rows=2
    (notas_adicionales)

══════════════════════════════════════════════════════════════════
  PARTE 7 — BARRA INFERIOR (acciones)
══════════════════════════════════════════════════════════════════

• Botón "Cancelar" variant=outline flex-1 → cierra, resetea
  form a FORM_EMPTY y editingStudent a null.
• Botón "Crear Expediente" / "Guardar Cambios" bg-primary
  flex-1, disabled si !form.nombre o mutación pendiente.
  Icono Plus (crear) o Pencil (editar) o Loader2 (guardando).
  Llama a handleSave → si editingStudent → updateMutation, si
  no → createMutation.

══════════════════════════════════════════════════════════════════
  PARTE 8 — CAMPOS EXTRA GESTIONADOS POR EL OCR
══════════════════════════════════════════════════════════════════

El OCR puede extraer y rellenar estos campos (esquema JSON):
  nombre · cedula · email · telefono · fecha_nacimiento · sexo ·
  religion · comunidad · nacionalidad · direccion ·
  ciudad_residencia · pais_residencia · programa · donde_estudia
  · universidad · patrocinador_nombre · facilitador_habitudes ·
  centro_educativo · director_centro · breve_historia_habitudes
  · padre_nombre · padre_edad · padre_telefono · padre_profesion
  · madre_nombre · madre_edad · madre_telefono · madre_profesion
  · tutor_nombre · tutor_edad · tutor_telefono · tutor_profesion
  · con_quien_vive · hermanos_cantidad · hermanos_edades ·
  hermanas_edades · casa_propia · tipo_casa · bano_dentro ·
  habitaciones (number) · camas (number) ·
  contacto_emergencia_nombre · contacto_emergencia_telefono ·
  enfermedades · alergias · historia_de_vida ·
  situacion_familiar · situacion_economica · metas_academicas

No extrae (no están en el schema del OCR): género, lugar_
nacimiento, madrastra_*, padrastro_*, por_que_vive_con_esa_
persona, hermanos_cantidad sí, amonestaciones, solicitudes_
pendientes, envio_correo_patrocinador, asistio_reunion_mensual,
notas_adicionales, motivo_beca,
fecha_ingreso, foto_url, imagen_habitudes_url. Estos quedan
para llenado manual.

══════════════════════════════════════════════════════════════════
  RESUMEN
══════════════════════════════════════════════════════════════════

El formulario de Añadir Expediente es un modal con 6 pestañas
que recopila ~70 campos del estudiante, con dos selectores
clave:
  • tipo → 'regular' (Curso Técnico) o 'becado' (Becado
    Universitario); al elegir 'becado' se revelan Universidad,
    Patrocinador y Motivo de la Beca.
  • estado → 'activo', 'inactivo', 'graduado' o 'suspendido',
    cada uno con badge de color distinto.

El OCR sube el documento (imagen/PDF) al storage, lo envía al
LLM con un prompt especializado en expedientes salvadoreños y
un JSON schema de ~45 campos, y rellena el formulario (o
actualiza directamente el perfil si se escanea sobre un
estudiante existente), conservando siempre la URL del documento
en expediente_url. El único campo obligatorio es el nombre.

================================================================
  FIN DEL DOCUMENTO
================================================================