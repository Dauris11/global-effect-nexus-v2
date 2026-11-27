# Por entregar y por decidir

Lista de lo que **tú tienes que conseguir o decidir** para que el sistema siga. Se
marca cuando se entrega. Lo que ya se decidió está al final, para que no se pierda.

## Documentos que hay que conseguir

- [ ] **Reglamento académico de cada universidad** (UCATECI, UNPHU, UTESA, UASD). De cada uno hace falta:
  - [ ] Cómo se divide el año (cuatrimestres, semestres…) y cuántas rondas hay.
  - [ ] Las letras y cuánto vale cada una, y la letra mínima para aprobar.
  - [ ] Si una materia retirada cuenta o no al calcular el índice, y si se corta o se redondea.
  - [ ] Máximo de créditos por cuatrimestre.
  - [ ] Requisitos de graduación (créditos, servicio comunitario, idioma, tesis…).
  - [ ] Índice mínimo para mantenerse y para la beca, del período y acumulado.
  - [ ] Calendario académico (inicio, fin, fecha para retirar materias, entrega de notas).
- [ ] **Récord de notas del liceo** de los postulados: una muestra real (foto o PDF) para saber cómo viene.
  - Ya definido (25 nov 2026): es un promedio de las notas de bachillerato en **escala de 100**; **no se convierte** a la escala universitaria; con ese récord y otros factores la Fundación decide qué carrera puede tomar el estudiante. Mínimo para aceptar a un candidato: **89**, configurable (`Parámetros → becas.promedio_liceo_minimo`).
  - [ ] **Por entregar:** cuáles son **las cuatro materias principales** con las que se calcula el promedio, y qué años o períodos del bachillerato cuentan. Se calcula sobre esas cuatro; el usuario lo averigua y lo pasa.
  - [ ] **Por entregar:** qué «otros factores» pesan junto al récord para recomendar una carrera.
- [ ] **Parámetros del promedio del liceo por carrera**: qué promedio se pide y cuál se considera bueno para cada carrera (con eso el sistema dirá a quién le conviene una u otra).
- [ ] **Listados reales de notas** de cada universidad (PDF o foto), para afinar la lectura con IA.
- [ ] **Gradua de UNPHU, UTESA y UASD** (una muestra de cada una; hoy solo se lee el de UCATECI).
- [ ] **Plan de estudios (pénsum) en PDF** de UTESA y UASD.
- [ ] **UNPHU Medicina Veterinaria**: confirmar qué significan «/» y «,» en los prerrequisitos (¿«y» o «o»?) o pasar el plan ya transcrito.
- [ ] **UNPHU Ingeniería Agronómica**: aclarar el «Semestre 10» que aparece dos veces en el PDF.
- [ ] **UNPHU Ingeniería en Sistemas Computacionales**: un PDF de menos de 10 MB (el actual pesa 23 MB y no se pudo subir a la base).
- [ ] **Constancia o carta de récord**: texto oficial, quién firma, sellos y logo.

## Decisiones que faltan

- [ ] **Filtros por los que pasa un postulado** antes de la Academia de Liderazgo, y qué se exige al terminar la academia para pasar a activo (para dejarlos como pasos en el sistema).
- [ ] **Promedio de secundaria — truncar o redondear:** el sistema redondea (mitad hacia arriba, 2 decimales), así que el récord de ejemplo da 89,29 general y 88,93 por año. El lápiz del papel trunca (85,666 → 85.66) y por año daría 88,92. Confirmar cuál pide la fundación o la universidad destino; es un cambio de una constante en `src/lib/record-liceo.ts`.
- [ ] **Confirmar las reglas del índice de UCATECI** con su reglamento (hoy están como «por confirmar»).
- [ ] **Mariela Vargas y Yaritza Polanco** figuran con «PUCMM» (no es parte del programa): ¿a qué universidad pasan?
- [ ] **Invitación por correo — hay que configurarlo para que funcione:**
  - [ ] En Supabase → Authentication → URL Configuration, agregar a «Redirect URLs» la dirección `https://TU-DOMINIO/establecer-clave` (y `http://localhost:3000/establecer-clave` para probar).
  - [ ] Definir `NEXT_PUBLIC_SITE_URL` con el dominio real (si no, se toma del servidor).
  - [ ] Confirmar que el envío de correos (`/api/cron/correos`, cola `correo_cola`) está activo y con el remitente correcto.
  - [ ] Revisar el texto del correo que recibe el estudiante (está en `crearCuentaEInvitar`, `src/server/expedientes/acciones.ts`).
- [ ] **OpenAI sin saldo**: recargarlo o quitarlo de `IA_PROVEEDOR` (hoy la lectura de documentos pasa a Gemini).

## Ya decidido (22 nov 2026)

- Cuando un estudiante cae en riesgo académico se **avisa al administrativo**.
- La cuenta nueva del estudiante **se invita por correo**.
- Se agrega el estado **«retirado»** (con motivo y fecha).
- Solo los **activos** son parte de la Fundación. Un **postulado** todavía no lo es: debe pasar los filtros y la Academia de Liderazgo, y para pasar a activo se llena la universidad, la carrera, el plan y la matrícula.
- La **pre-matrícula del estudiante es solo para las clases de la Fundación**, no para las de la universidad.
- Los correos son **mensuales** y solo los envía el estudiante que **tiene patrocinador**: la carta llega al sistema, que la distribuye, traduce, revisa y la manda al patrocinador correspondiente. No hay correos semanales ni correos de alerta académica.
