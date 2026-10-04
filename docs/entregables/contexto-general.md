
UNIVERSIDAD CATÓLICA DEL CIBAO
UCATECI
Escuela de Ingeniería en Sistemas y Computación

PRIMERA ENTREGA — PROYECTO FINAL DE GRADO

Sistema Web Inteligente para la Gestión Académica y Administrativa de la Fundación Global Effect
SUSTENTANTES
Gabriela García   |   Matrícula: 20230105
Dauris Santana   |   Matrícula: 20230253

La Vega, República Dominicana  —  2026
 
1. Descripción General del Proyecto

El presente proyecto consiste en el análisis, diseño y desarrollo de un ERP institucional denominado Global Effect Nexus: un sistema de gestión con portal del estudiante integrado. Esta plataforma tiene como propósito centralizar, automatizar y optimizar los flujos de trabajo administrativos, académicos y operativos de la Fundación Global Effect, una organización sin fines de lucro dedicada al desarrollo educativo y social en la provincia de La Vega, República Dominicana.

La fundación administra múltiples programas dirigidos a distintos grupos poblacionales: estudiantes universitarios becados, alumnos de formación técnica (Career Institute), participantes de la Academia de Liderazgo y niños de comunidades vulnerables. Cada uno de estos programas genera un alto volumen de información relacionada con expedientes estudiantiles, trámites y solicitudes de estudiantes y personal, control de asistencia alimentaria, asignación de viviendas, gestión de patrocinadores internacionales y organización de misiones comunitarias.

Actualmente, el manejo de estos datos se realiza mediante registros físicos y hojas de cálculo dispersas, lo que dificulta la trazabilidad de la información y la toma de decisiones. El sistema Global Effect Nexus se concibe como una solución integral que agrupará todos estos procesos en un entorno web unificado, seguro y accesible desde cualquier dispositivo con conexión a internet, lo que resulta fundamental dado el carácter nacional e internacional de su personal y patrocinadores.

La plataforma se estructura en cinco portales diferenciados por rol (Administración, Estudiantil integrado, Docente, Contabilidad y la entrada de Habitudes al embudo de expedientes) e integra módulos específicos para cada área funcional —Académico, Expedientes Estudiantiles, Academias y Cursos Técnicos, Patrocinadores y Becas, Contabilidad, Solicitudes y Aprobaciones, Administración de Proyectos y Tareas, Calendario Institucional y Reportes—, permitiendo un seguimiento holístico del ciclo de vida de cada beneficiario y facilitando la rendición de cuentas ante los donantes internacionales.

 
2. Planteamiento del Problema

La Fundación Global Effect ha experimentado un crecimiento sostenido en su matrícula de beneficiarios y en la diversificación de sus programas sociales. Como consecuencia de esta expansión, el volumen de información generada diariamente ha superado la capacidad de gestión de sus herramientas actuales, basadas predominantemente en documentos físicos y hojas de cálculo desvinculadas entre sí.

Esta fragmentación informacional provoca una serie de problemáticas críticas que afectan directamente la eficiencia operativa de la institución:

Dificultad y lentitud para acceder al historial integral —académico, socioeconómico y financiero— de los estudiantes beneficiarios.
Alto riesgo de redundancia, inconsistencia y pérdida de datos sensibles, especialmente en el manejo de los expedientes estudiantiles (salud, vivienda, contexto familiar).
Trámites y aprobaciones (constancias, cartas, becas, gastos) que se piden de palabra o por papel, sin folio, sin responsable claro y sin rastro de quién decidió qué.
Sobrecarga laboral administrativa que resta tiempo valioso al acompañamiento directo de los jóvenes, objetivo misional central de la fundación.
Carencia de herramientas analíticas para generar reportes en tiempo real que sustenten la toma de decisiones gerenciales y la transparencia ante los patrocinadores internacionales.
Ausencia de mecanismos de comunicación automatizados con donantes nacionales e internacionales, lo que debilita el vínculo institucional y el seguimiento de  compromisos financieros.

Ante este panorama, la interrogante fundamental que guía esta investigación es:

¿De qué manera la implementación de un sistema web de gestión institucional centralizado e inteligente puede optimizar la administración de la información, reducir los tiempos operativos y mejorar el seguimiento integral de los beneficiarios en la Fundación Global Effect?

 
3. Alcance del Proyecto

El proyecto abarca desde la fase de levantamiento de requerimientos hasta el despliegue funcional del sistema Global Effect Nexus. Siguiendo el criterio SMART, el alcance se define de la siguiente manera:

Letra	Criterio	Definición aplicada al proyecto
S	Específico	Desarrollar un ERP institucional web con portal del estudiante integrado y cinco portales diferenciados por rol que integre los módulos de gestión Académica (cursos, materias, calificaciones y GPA, historial y prematrícula), Expedientes Estudiantiles, Academias y Cursos Técnicos, Patrocinadores y Becas, Contabilidad, Solicitudes y Aprobaciones, Administración de Proyectos y Tareas, Servicios Alimentarios, Calendario Institucional, Reportes y Configuración de roles y permisos, complementados con asistentes de inteligencia artificial integrados como herramientas de apoyo en los distintos portales.
M	Medible	Se evidenciará mediante la entrega de los cinco portales y los módulos del sistema en estado funcional, la administración de los seis roles de acceso definidos (Súper Administrador, Administrador, Docente, Estudiante, Contabilidad y Habitudes), la migración de al menos un 30% de los registros actuales durante la fase de prueba y la generación automatizada de los reportes gerenciales y financieros en tiempo real visibles en el panel de control.
A	Alcanzable	El proyecto se desarrollará con Next.js (fullstack) y PostgreSQL como base de datos relacional, tecnologías dominadas por los sustentantes, lo que garantiza la factibilidad técnica dentro del período académico establecido.
R	Realista	La solución se limitará a la gestión de información y procesos internos. Quedan fuera del alcance: pasarelas de pago electrónico, aplicaciones móviles nativas y sistemas de contabilidad financiera externa o gubernamental.
T	Temporal	El desarrollo, pruebas e implementación del sistema se ejecutarán en el período académico estipulado para la culminación del Proyecto Final de Grado correspondiente al año 2027.

 
4. Justificación

El desarrollo del sistema Global Effect Nexus se fundamenta en necesidades operativas de carácter urgente y en razones técnicas, sociales y académicas de peso para la institución.

4.1 Naturaleza y Urgencia del Problema

Cada día que la fundación opera con sistemas fragmentados se incrementa el riesgo de pérdida de información vital de los beneficiarios y se retrasa la generación de informes críticos para los donantes internacionales, poniendo en riesgo el financiamiento sostenido de los programas sociales. La urgencia de la intervención tecnológica es directamente proporcional al crecimiento institucional, que ha superado con creces la capacidad de gestión de las herramientas actuales.

4.2 Razones Técnicas

La adopción de una arquitectura web basada en Next.js y una base de datos relacional PostgreSQL eliminará la redundancia de datos y garantizará la integridad, confidencialidad y disponibilidad inmediata de la información desde cualquier dispositivo conectado a internet. La digitalización de los expedientes físicos, que contienen datos de salud, vivienda y contexto familiar, representará un avance significativo en materia de seguridad y privacidad de datos sensibles. El control de acceso basado en roles garantizará que cada usuario visualice únicamente la información pertinente a sus funciones.

4.3 Razones Sociales e Institucionales

La automatización de tareas burocráticas permitirá al personal de la fundación reorientar sus horas de trabajo hacia el objetivo misional: el acompañamiento y mentoría directa de los jóvenes. Además, un sistema transparente y auditable fortalecerá la credibilidad de la organización frente a sus patrocinadores internacionales, quienes podrán acceder a reportes actualizados y verificar el impacto de su contribución de manera oportuna y confiable, incentivando la continuidad del financiamiento.

4.4 Pertinencia Académica

El proyecto representa una oportunidad para aplicar de manera integrada los conocimientos adquiridos en la carrera de Ingeniería en Sistemas y Computación en áreas como desarrollo web, bases de datos relacionales, seguridad de la información, arquitectura de software y diseño de interfaces de usuario. El hecho de que el sistema resuelva una problemática real en una organización activa le otorga un valor práctico y social que complementa su valor académico, siendo consistente con los objetivos del Proyecto Integrador de Conocimientos de UCATECI.

 
5. Posicionamiento del Proyecto

El sistema Global Effect Nexus se posiciona institucionalmente no como un simple software de base de datos, sino como el motor tecnológico de la transformación social de la fundación. Se asocia directamente con tres conceptos que definen su propuesta de valor: Modernización, Transparencia y Eficiencia Solidaria.

El mensaje central que ancla el posicionamiento del proyecto es:

Menos tiempo administrando papeles, más tiempo transformando vidas.

Esta propuesta se dirige de manera diferenciada a los cuatro actores clave del sistema:

Dirección	Un tablero de control confiable con reportes en tiempo real para la toma de decisiones estratégicas e institucionales.

Personal administrativo	Una herramienta que elimina el trabajo manual repetitivo y libera tiempo para el acompañamiento directo de los beneficiarios.

Estudiantes	Un portal propio, integrado al sistema, donde pueden consultar historial académico, calificaciones y estado de beca, y pedir trámites (constancias, cartas, citas con administración, permisos) con su seguimiento de manera autónoma.

Patrocinadores	Vinculados a los estudiante los estudiantes que financian, generando confianza, trazabilidad y motivación para continuar contribuyendo.

En términos de imagen institucional, la implementación de Global Effect Nexus proyecta a la fundación como una organización moderna, transparente y comprometida con el uso eficiente de sus recursos, lo cual refuerza su credibilidad tanto ante la comunidad local como ante sus aliados internacionales.
 

SEGUNDA ENTREGA — PROYECTO FINAL DE GRADO
Global Effect Nexus
 
1. Limitaciones del Proyecto

El alcance definido en la Primera Entrega delimita lo que el sistema Global Effect Nexus resolverá. A continuación se explicitan los límites del proyecto —entendidos como fronteras de las aspiraciones de la investigación, no como dificultades de ejecución— siempre en referencia a los objetivos planteados.

No incluye pasarela de pagos electrónicos ni conciliación bancaria automática con entidades financieras; el módulo de Contabilidad gestiona ingresos y egresos internos de forma manual/asistida.
No contempla el desarrollo de una aplicación móvil nativa (iOS/Android); el acceso se realiza mediante navegador web con diseño responsivo (Next.js App Router).
No sustituye los sistemas de contabilidad fiscal o gubernamental oficiales de la República Dominicana; el módulo financiero es de uso gerencial interno.
La migración de registros históricos en papel y hojas de cálculo cubre un mínimo del 30% de los datos actuales durante la fase de prueba (Sprint 12); no se garantiza la digitalización retroactiva del 100% del archivo físico.
Los asistentes de inteligencia artificial (chat interno, chat estudiantil, OCR y búsqueda semántica RAG) consumen modelos de terceros mediante un servicio propio de integración; el proyecto no incluye el entrenamiento o ajuste fino (fine-tuning) de modelos de lenguaje.
El sistema se diseña como una solución de un solo inquilino (single-tenant) para la Fundación Global Effect; no es una plataforma multi-institucional.
El acceso de los patrocinadores se limita a la consulta de reportes; el proyecto no incluye un portal transaccional de donaciones en línea.
El control de acceso se circunscribe a los seis roles institucionales definidos (súper administrador, administrador, docente, estudiante, contabilidad y habitudes); la incorporación de nuevos roles queda como trabajo futuro.
El sistema no incluye atención psicológica ni expedientes clínicos: el departamento de Psicología de la fundación se eliminó (octubre 2026) y el expediente del estudiante quedó a cargo de administración (admin y super_admin).
El módulo de Solicitudes y Aprobaciones registra decisiones, pero no ejecuta efectos por su cuenta: una solicitud aprobada se completa cuando el módulo dueño (contabilidad, expedientes, patrocinio) la ejecuta. Las notificaciones son internas; no se envía correo.

 
2. Planificación del Proyecto

La planificación del proyecto sigue una metodología de sprints quincenales (14 sprints, aproximadamente 7 meses, de julio 2026 a enero 2027), gestionados en ClickUp mediante una jerarquía de tres niveles (sprint → módulo/tabla → columna/paso) con 527 filas de seguimiento. El equipo de trabajo está compuesto por dos sustentantes (Gabriela García y Dauris Santana), quienes asumen de forma conjunta el diseño, desarrollo y documentación del sistema.

El camino crítico del proyecto sigue una dependencia secuencial de cuatro bloques: (1) diseño y base de datos (S0–S3), que debe completarse antes de iniciar (2) el backend núcleo de autenticación y control de acceso (S4); a partir de este punto se habilitan (3) los sprints de implementación funcional por módulo (S5–S11), que pueden desarrollarse con cierto grado de paralelismo entre módulos independientes; y finalmente (4) los sprints de estabilización, migración de datos, pruebas de seguridad y despliegue (S12–S13). Los recursos disponibles son los dos sustentantes y el entorno Supabase/PostgreSQL ya provisionado; el consumo de tiempo se equilibra dedicando mayor estimación (en días) a los módulos con más tablas y reglas de negocio (Expedientes, Académico, Operaciones).

Sprint	Foco	Fechas	Estado
S0	Planeamiento y diseño (ERD, diccionario, entorno)	06–17 jul 2026	Completado
S1	BD: Identidad, RBAC y transversales + seed	20–31 jul 2026	Completado
S2	BD: Estudiante (normalizado) y Académico	03–14 ago 2026	Completado
S3	BD: dominios restantes	17–28 ago 2026	Completado
S4	Backend núcleo: Auth.js, RBAC, i18n	31 ago–11 sep 2026	Siguiente
S5	Expedientes (+ OCR) y Dashboard	14–25 sep 2026	Pendiente
S6	Académico (módulos) y portales	28 sep–09 oct 2026	Pendiente
S7	Patrocinio y Finanzas	12–23 oct 2026	Pendiente
S8	Solicitudes y aprobaciones (sustituye a Psicología, descartada — el departamento de Psicología se eliminó, oct 2026)	26 oct–06 nov 2026	Completado (migraciones 0030 y 0031)
S9	Administrativo y Calendario	09–20 nov 2026	Pendiente
S10	Módulos restantes y páginas públicas	23 nov–04 dic 2026	Pendiente
S11	IA y Reportes	07–18 dic 2026	Pendiente
S12	Migración, QA y Seguridad	21 dic 2026–01 ene 2027	Pendiente
S13	Despliegue y Tesis	04–15 ene 2027	Pendiente

Al cierre de esta entrega, la capa de base de datos (S0–S3) está completada y verificada en Supabase, lo que adelanta el cronograma respecto al plan original y reduce el riesgo del camino crítico para los sprints de backend e implementación.

 
3. Visualización o Plan de Marketing

El plan de visualización institucional de Global Effect Nexus se apoya en canales ya contemplados dentro del propio alcance funcional del sistema, de manera que la comunicación con cada actor ocurre a través de la misma plataforma que se está construyendo:

Landing pública institucional: vitrina de acceso sin necesidad de autenticación, punto de entrada para la inscripción diaria de comida y el acceso al portal del estudiante, y primera impresión digital de la fundación ante visitantes y aliados.
Reportes exportables en PDF (servicios mensuales, balances de contabilidad): material de comunicación formal hacia patrocinadores y junta directiva, con datos verificables y trazables.
Tablero de control (Dashboard) con métricas en tiempo real: recurso de presentación periódica ante la dirección de la fundación para sustentar decisiones estratégicas.
Portal de patrocinadores (módulo Patrocinio): mecanismo de transparencia que permite a cada patrocinador visualizar el impacto de su aporte, reforzando la confianza y la continuidad del financiamiento.
Divulgación académica: defensa del Proyecto Final de Grado ante UCATECI y publicación de la documentación técnica (arquitectura, modelo entidad-relación, diccionario de datos) como evidencia de rigor metodológico.
Notificaciones internas del sistema: canal de "marketing interno" que acompaña la adopción de la herramienta por parte del personal administrativo, docente y de contabilidad durante la fase de implementación.

 
4. Objetivo General

A partir del planteamiento del problema y del alcance SMART definidos en la Primera Entrega, el objetivo general que orienta la totalidad del proyecto es el siguiente:

Diseñar, desarrollar e implementar el sistema web Global Effect Nexus, un ERP institucional de gestión académica y administrativa con portal del estudiante integrado para la Fundación Global Effect, sustentada en una arquitectura Next.js/PostgreSQL con control de acceso basado en roles, base de datos relacional normalizada y asistentes de inteligencia artificial, con el fin de centralizar la información institucional, optimizar los procesos administrativos y fortalecer la transparencia ante patrocinadores y beneficiarios.

 

TERCERA ENTREGA — PROYECTO FINAL DE GRADO
Global Effect Nexus
 
1. Objetivos Específicos

Para alcanzar el objetivo general, se plantean los siguientes objetivos específicos, alineados con el plan de sprints presentado en la Segunda Entrega:

Diseñar y normalizar el modelo de datos relacional (36 tablas, formas normales 1NF–3NF) que soporte los 27 módulos funcionales de la fundación.
Implementar la capa de autenticación y control de acceso basado en roles (RBAC) mediante Auth.js con sesiones JWT.
Desarrollar el módulo de Expedientes Estudiantiles, incluyendo el formulario multi-pestaña y la extracción asistida de datos mediante OCR con inteligencia artificial.
Desarrollar el módulo Académico (materias, cursos técnicos, calificaciones, historial y prematrícula) y los portales de Estudiante y Profesor.
Desarrollar los módulos de Patrocinio, Asignación de Becas y Contabilidad, con sus respectivos reportes financieros.
Implementar el módulo de Solicitudes y Aprobaciones (trámites del estudiante y aprobaciones internas de alta de expediente, beca y gasto) con flujo por estados, segundo nivel de dirección, separación de funciones, folio, línea de tiempo y notificaciones.
Implementar el módulo de Operaciones (tareas Kanban, proyectos, calendario institucional) con automatizaciones de notificación y generación de eventos.
Integrar asistentes de inteligencia artificial (chat interno con contexto institucional, chat estudiantil y búsqueda semántica mediante pgvector/RAG).
Desplegar el sistema en un entorno de producción y validar su funcionamiento mediante pruebas de aceptación de usuario (UAT) junto con la fundación.

 
2. Marco Teórico

El desarrollo de Global Effect Nexus se apoya en un conjunto de fundamentos conceptuales provenientes de la ingeniería de software y las bases de datos, que se describen a continuación para situar las decisiones técnicas del proyecto dentro de un marco de referencia reconocido.

2.1 Gestión institucional y transformación digital

La transformación digital de organizaciones sin fines de lucro consiste en sustituir procesos manuales y fragmentados —registros físicos, hojas de cálculo aisladas— por sistemas de información centralizados que preservan la trazabilidad de los datos a lo largo del tiempo. En el caso de fundaciones que dependen de patrocinadores externos, esta transformación adquiere una dimensión adicional de rendición de cuentas: la información debe poder auditarse y comunicarse de forma verificable a terceros que no participan directamente en la operación diaria.

2.2 Arquitectura web con Next.js App Router

Next.js es un framework de React que permite construir aplicaciones full-stack combinando renderizado en el servidor y en el cliente dentro de un mismo proyecto. Su convención App Router organiza las rutas como carpetas y permite ejecutar lógica de servidor —Server Actions y Route Handlers— sin necesidad de exponer una API REST independiente. En Global Effect Nexus, esta capa de servidor concentra la autenticación, la validación de permisos y el acceso a la base de datos, mientras que el cliente se limita a la interfaz de usuario construida con React, shadcn/ui y TanStack React Query.

2.3 Bases de datos relacionales y normalización

Un modelo relacional organiza la información en tablas vinculadas mediante claves foráneas, evitando la duplicación de datos y garantizando su consistencia. El proceso de normalización aplica un conjunto de reglas —primera, segunda y tercera forma normal— para eliminar grupos repetitivos, dependencias parciales y dependencias transitivas dentro de las tablas. En este proyecto, el expediente del estudiante se descompuso en una tabla núcleo y varias tablas satélite de relación 1:1 (vivienda, salud, contexto socioeconómico), siguiendo precisamente este principio de normalización.

2.4 Control de acceso basado en roles (RBAC)

El modelo RBAC (Role-Based Access Control) asigna permisos a roles y roles a usuarios, en lugar de asignar permisos directamente a cada persona. Esto centraliza la gestión de la seguridad: modificar lo que puede hacer un rol afecta automáticamente a todos los usuarios que lo poseen. El diseño de Global Effect Nexus lleva este principio a nivel granular, evaluando cada acción mediante una función can(usuario, permiso) que consulta la relación entre las tablas rol, permiso y rol_permiso, y que se combina con la separación de funciones del módulo de Solicitudes: nadie aprueba su propia solicitud.

2.5 Inteligencia artificial aplicada: OCR y RAG

El reconocimiento óptico de caracteres (OCR) asistido por inteligencia artificial permite extraer datos estructurados a partir de imágenes de documentos, reduciendo la digitación manual. La búsqueda semántica mediante RAG (Retrieval-Augmented Generation) complementa a un modelo de lenguaje con fragmentos de información recuperados de una base de conocimiento propia, en este caso indexada con la extensión pgvector de PostgreSQL, lo que permite que los asistentes de chat respondan con contexto real de la institución en lugar de depender únicamente del conocimiento general del modelo.

 
3. Vulnerabilidad del Sistema

Siguiendo la metodología de cinco pasos para determinar la vulnerabilidad de un sistema, se realizó el siguiente análisis aplicado al diseño de Global Effect Nexus.

3.1 Levantamiento de amenazas

Inyección SQL a través de formularios o parámetros de consulta.
Acceso no autorizado a expedientes estudiantiles (datos de salud, vivienda y familia).
Pérdida de disponibilidad por interrupción del proveedor cloud (Supabase) o de la conexión a internet de la fundación.
Filtración o robo de credenciales de usuario (contraseñas, tokens de sesión).
Error humano en la carga o modificación de datos sensibles (expedientes, calificaciones, transacciones).
Dependencia de servicios externos de inteligencia artificial para OCR, chat y embeddings.

3.2 Matriz de riesgo

Amenaza	Probabilidad	Impacto	Nivel de riesgo
Inyección SQL	Baja	Gravísimo	Alto
Acceso no autorizado a expedientes	Baja	Gravísimo	Alto
Aprobación indebida (autoaprobación de becas o gastos)	Media	Grave	Alto
Caída del proveedor cloud	Rara	Grave	Medio
Robo de credenciales	Media	Grave	Alto
Error humano en carga de datos	Alta	Medio	Medio
Falla de servicios externos de IA	Media	Leve	Bajo

3.3 Ranking de importancia

1º — Acceso no autorizado a expedientes estudiantiles (impacto ético/legal máximo).
2º — Inyección SQL (compromete la integridad de toda la base de datos).
3º — Robo de credenciales (puerta de entrada a cualquier otro riesgo).
4º — Aprobación indebida de becas o gastos (afecta el uso de fondos de patrocinadores).
5º — Error humano en carga de datos (afecta la confiabilidad de reportes a patrocinadores).
6º — Caída del proveedor cloud (mitigable con respaldo y recuperación).
7º — Falla de servicios externos de IA (afecta funciones de apoyo, no procesos críticos).
3.4 Medidas de corrección

Inyección SQL: acceso a datos exclusivamente mediante consultas parametrizadas ($1, $2…) con el cliente pg; no se concatena entrada del usuario en cadenas SQL.
Acceso a expedientes: solo administración (admin y super_admin) tiene expedientes.leer / .escribir / .eliminar; habitudes solo postula candidatos (expedientes.postular) y el estudiante ve únicamente lo suyo desde su portal.
Aprobación indebida: separación de funciones (nadie aprueba su propia solicitud), segundo nivel de dirección (solicitudes.direccion) fijado al crear la solicitud para becas y gastos desde 1,000 USD, y registro de cada paso en solicitud_paso y de cada aprobación, rechazo y completado en audit_log.
Robo de credenciales: contraseñas cifradas (bcrypt/argon2), sesiones JWT firmadas con expiración, e invitación de usuarios (sin auto-registro público).
Error humano: validación de esquema con Zod en cada formulario, restricciones CHECK a nivel de base de datos y bitácora de auditoría (audit_log) con snapshot de antes/después.
Disponibilidad: uso de Supabase (PostgreSQL administrado) con respaldos automáticos y posibilidad de recuperación a un punto en el tiempo.
Servicios de IA: degradación elegante de las funciones de chat/OCR ante fallas del proveedor, sin afectar los módulos operativos núcleo del sistema.
3.5 Evaluación continua de las vulnerabilidades

La evaluación continua se sostiene en tres mecanismos ya contemplados en el diseño: la bitácora de auditoría (audit_log) para trazar acciones sensibles, la revisión periódica de la matriz de roles y permisos conforme evoluciona el sistema, y el sprint dedicado explícitamente a migración, control de calidad y seguridad (S12) antes del despliegue final a producción.
 

CUARTA ENTREGA — PROYECTO FINAL DE GRADO
Global Effect Nexus
 
1. Diagrama Entidad-Relación

El diagrama entidad-relación (ERD) de Global Effect Nexus refleja el esquema desplegado y verificado en PostgreSQL 17 (Supabase) mediante las migraciones db/migrations/0001–0012, y comprende 36 tablas, 7 tipos ENUM y la extensión pgvector para los dominios de inteligencia artificial. El modelo se agrupa en 11 dominios funcionales:

Dominio	Tablas
Identidad / RBAC	rol, permiso, rol_permiso, usuario
Transversal	documento, notificacion, audit_log
Patrocinio	patrocinador
Estudiantes	estudiante, familiar, perfil_vivienda, perfil_salud, perfil_socioeconomico, asignacion_beca
Académico	periodo, materia, curso, inscripcion, calificacion, historial_calificacion
Academias	academia, material
Solicitudes	solicitud, solicitud_paso
Operaciones	proyecto, tarea, tarea_asignado, evento, registro_servicio
Bienestar	inscripcion_comida
Finanzas	transaccion
Inteligencia Artificial	conversacion_ia, mensaje_ia, extraccion_ocr, fragmento_conocimiento

El dominio de Psicología (cita_psicologia, nota_psicologica, perfil_psicologico) existió en el diseño original y se eliminó con la migración 0030, cuando la fundación cerró el departamento de Psicología (octubre 2026); la migración 0031 añadió el dominio de Solicitudes. Los conteos de esta sección corresponden al esquema original de las migraciones 0001–0012.

En total, el esquema define 44 relaciones físicas mediante claves foráneas, verificadas directamente contra information_schema de la base de datos desplegada. El detalle completo de tabla padre, tabla hija, columna FK, cardinalidad y regla ON DELETE se presenta en el Anexo A (Diccionario de Datos y documentación técnica adjunta).

E spacio para diagrama — Diagrama entidad-relación (ERD) completo de las 36 tablas, en sintaxis Mermaid — insertar aquí.

 
2. Diagrama de Flujo de Datos

El diagrama de flujo de datos (DFD) representa cómo se intercambia información entre las entidades externas (usuarios por rol), los procesos del sistema y los almacenes de datos (tablas). Se presenta en dos niveles:

Nivel 0 (diagrama de contexto): vista panorámica de los seis roles internos, el público general y el servicio de IA/OCR interactuando con el sistema como una única caja negra.
Nivel 1 (procesos y almacenes): descomposición del sistema en nueve procesos principales (autenticación, expedientes, académico, patrocinio, solicitudes y aprobaciones, operaciones, finanzas, bienestar, asistentes de IA) y los almacenes de datos que cada uno lee o escribe.

La correspondencia entre cada proceso, sus almacenes de datos y el permiso RBAC requerido para ejecutarlo se resume en la siguiente tabla:

Proceso	Almacenes (tablas)	Permiso requerido
1. Autenticación y control de acceso	usuario, rol, permiso, rol_permiso	usuarios.administrar
2. Expedientes	estudiante, perfil_*, familiar, documento	expedientes.leer / .escribir
3. Académico	periodo, materia, curso, inscripcion, calificacion, historial	academico.*
4. Patrocinio y becas	patrocinador, asignacion_beca	patrocinadores.*
5. Solicitudes y aprobaciones	solicitud, solicitud_paso, notificacion, audit_log	solicitudes.gestionar / .direccion (y finanzas.escribir para gastos)
6. Operaciones	proyecto, tarea, tarea_asignado, evento, registro_servicio	operaciones.*
7. Finanzas	transaccion	finanzas.leer / .escribir
8. Bienestar (comida)	inscripcion_comida	(público)
9. Asistentes de IA	conversacion_ia, mensaje_ia, extraccion_ocr, fragmento_conocimiento	ia.usar / ia.administrar

El proceso 1 es transversal: todo acceso a los procesos 2 al 7 y 9 pasa primero por la autenticación y la verificación de permisos RBAC.

Espacio para diagrama —  Diagrama de flujo de datos Nivel 0 (contexto) — insertar aquí.

Espacio para diagrama  — Diagrama de flujo de datos Nivel 1 (procesos y almacenes) — insertar aquí.

Espacio para diagrama  — Diagramas de detalle de los flujos automatizados: OCR Expediente, Tarea→Notificación→Calendario, y Chat IA con contexto (RAG) — insertar aquí (opcional, como anexo de la Cuarta Entrega).

 
3. Diccionario de Datos

El diccionario de datos se generó a partir de la base de datos en vivo (PostgreSQL 17, Supabase) y refleja exactamente el estado desplegado por las migraciones db/migrations/0001–0013. Cubre 36 tablas, 333 columnas, 7 tipos ENUM y 4 extensiones de PostgreSQL. Cada tabla documenta sus columnas (tipo, nulabilidad, valor por defecto y claves), sus restricciones CHECK y sus índices, siguiendo la convención PK = clave primaria, FK = clave foránea, UK = único.

Índice de dominios documentados: (1) Identidad y control de acceso, (2) Transversal, (3) Patrocinio, (4) Estudiantes, (5) Académico, (6) Academias, (7) Solicitudes, (8) Operaciones, (9) Bienestar, (10) Finanzas, (11) Inteligencia Artificial; más los apéndices de tipos ENUM y extensiones de PostgreSQL.

A modo ilustrativo, se presenta a continuación el detalle de dos tablas representativas del núcleo del sistema. El diccionario de datos completo de las 36 tablas se presenta en el documento técnico anexo (Documentación Global Effect Nexus).

Tabla: usuario

Usuarios con credenciales de acceso a la plataforma. Clave primaria: id.
Columna	Tipo	Nulo	Descripción
id	uuid	No (PK)	Identificador único del registro.
email	citext	No (UK)	Correo institucional y usuario de acceso (sin distinción de mayúsculas).
password_hash	text	No	Contraseña cifrada (bcrypt / argon2).
nombre	text	No	Nombre completo del usuario.
rol_id	uuid	No (FK)	Referencia a la tabla rol.
activo	boolean	No	Indica si el usuario puede acceder al sistema.
ultimo_acceso	timestamptz	Sí	Marca del último inicio de sesión.

Tabla: estudiante

Tabla núcleo del expediente estudiantil (datos personales e institucionales). Clave primaria: id.
Columna	Tipo	Nulo	Descripción
id	uuid	No (PK)	Identificador único del registro.
nombre	text	No	Nombre completo del estudiante.
cedula	text	Sí (UK)	Documento de identidad (único).
estado	estado_estudiante	No	Estado en el pipeline y situación escolar (enum).
tipo	tipo_estudiante	No	Tipo de estudiante: becado o regular (enum).
patrocinador_id	uuid	Sí (FK)	Patrocinador actual asignado.
usuario_id	uuid	Sí (FK, UK)	Cuenta de acceso vinculada (único).

Apéndice de tipos ENUM (7 en total): estado_estudiante, genero, parentesco, tipo_estudiante, tipo_evaluacion, tipo_patrocinador y tipo_transaccion. Apéndice de extensiones de PostgreSQL utilizadas: pgcrypto (generación de UUID), citext (correos sin distinción de mayúsculas), pg_trgm (búsqueda difusa por similitud) y vector/pgvector (embeddings e índice HNSW para búsqueda semántica).
 

QUINTA ENTREGA — PROYECTO FINAL DE GRADO
Global Effect Nexus
 
1. Estándares del Sistema

Con el fin de garantizar consistencia, mantenibilidad y seguridad a lo largo de los 27 módulos del sistema, se establecen los siguientes estándares técnicos, ya aplicados desde la fase de diseño de base de datos:

Nomenclatura de base de datos: nombres de tablas y columnas en snake_case, en español, y en singular (estudiante, no estudiantes); claves primarias uniformes con columna id de tipo uuid.
Acceso a datos sin ORM: todas las consultas se escriben a mano con el cliente pg (node-postgres) y parámetros posicionales ($1, $2…), nunca concatenación de cadenas.
Tipado: interfaces TypeScript por entidad en types.ts y validación de formularios/API con esquemas Zod en schema.ts, como frontera entre la capa de dominio y la interfaz.
Migraciones versionadas: cada cambio de esquema es un archivo .sql numerado secuencialmente (0001, 0002…), reproducible y aplicado mediante un runner integrado al repositorio.
Internacionalización: cadenas de interfaz en diccionarios messages/es.json y messages/en.json bajo el segmento de ruta /[locale]; los valores de estado se almacenan como código en la base de datos y se traducen únicamente en la interfaz.
Componentes de interfaz: shadcn/ui sobre Tailwind CSS, con tokens de diseño consistentes entre los cinco portales por rol.
Control de versiones y seguridad: variables sensibles (cadenas de conexión, claves) únicamente en variables de entorno (.env), nunca en el repositorio.
Auditoría: toda tabla con updated_at incorpora un disparador (trigger) set_updated_at(); las acciones sensibles quedan registradas en audit_log con snapshot de antes/después.

 
2. Reglas de Negocio

Las siguientes reglas de negocio están implementadas como restricciones físicas (CHECK, UNIQUE, claves foráneas con regla ON DELETE) directamente en el esquema de base de datos, además de validarse en la capa de aplicación con Zod:

Una calificación (calificacion.nota) debe estar entre 0 y 100; el GPA (historial_calificacion.gpa) debe estar entre 0.00 y 4.00.
El progreso de un proyecto (proyecto.progreso) es un porcentaje entre 0 y 100.
Los montos financieros (patrocinador.monto_mensual, asignacion_beca.monto, transaccion.monto) no pueden ser negativos; el monto de una transacción debe ser estrictamente mayor que cero.
Un estudiante no puede matricularse dos veces en la misma materia dentro del mismo período: restricción única sobre (estudiante_id, materia_id, periodo_id) en la tabla inscripcion.
Solo puede existir un registro de servicio comunitario por estudiante y mes: restricción única sobre (estudiante_id, mes) en registro_servicio.
Solo puede existir una inscripción de comida por persona y día: restricción única sobre (nombre, fecha) en inscripcion_comida; la inscripción pública debe registrarse antes de las 8:30 a. m.
El idioma preferido de un usuario solo admite los valores es o en.
La fecha de fin de un período académico no puede ser anterior a su fecha de inicio (fecha_fin >= fecha_inicio).
Al eliminar un estudiante, se eliminan en cascada (ON DELETE CASCADE) sus perfiles asociados (vivienda, salud, socioeconómico), familiares, inscripciones y calificaciones, preservando la integridad referencial.
El expediente del estudiante solo es editable por administración (admin y super_admin, permisos expedientes.leer / .escribir / .eliminar); habitudes solo postula candidatos y el estudiante consulta lo suyo desde su portal.
Una solicitud sigue el flujo enviada → en_revision → [pendiente_direccion] → aprobada → completada; puede rechazarse (con comentario obligatorio) desde enviada, en_revision o pendiente_direccion, y el solicitante puede cancelarla mientras esté en enviada o en_revision. Nadie aprueba su propia solicitud; las becas siempre requieren segundo nivel de dirección y los gastos lo requieren desde 1,000 USD.
Toda acción sobre entidades sensibles (expedientes, transacciones, usuarios) queda registrada en audit_log con el identificador del usuario, la acción realizada y un snapshot de los datos antes y después del cambio.

 
3. Diseño de Reportes

El sistema centraliza la generación de reportes en un módulo dedicado, con visualizaciones construidas mediante la librería Recharts y datos consultados directamente de los almacenes normalizados descritos en la Cuarta Entrega:

Reporte	Módulo origen	Audiencia	Formato
Dashboard principal	Transversal (todas las tablas)	Administración, dirección	Panel interactivo (tiempo real)
Reporte de Proyectos	Operaciones (proyecto, tarea)	Administración	Panel interactivo
Reporte Académico	Académico (calificacion, historial)	Docentes, administración	Panel interactivo
Reporte de Contabilidad	Finanzas (transaccion)	Contabilidad, dirección	Panel interactivo + balance
Servicios mensuales	Operaciones (registro_servicio)	Administración, patrocinadores	Exportación PDF
Reporte de Patrocinadores	Patrocinio (patrocinador, asignacion_beca)	Dirección, patrocinadores	Panel + exportación

Cada reporte respeta el control de acceso basado en roles: un docente solo visualiza indicadores académicos de sus propios cursos, mientras que el súper administrador accede a la vista consolidada de todos los dominios. Los reportes financieros y de patrocinadores están pensados como el principal insumo de la estrategia de transparencia descrita en el Plan de Marketing de la Segunda Entrega.
 

SEXTA ENTREGA — PROYECTO FINAL DE GRADO
Global Effect Nexus
 
1. Introducción

El presente documento consolida las seis entregas del Proyecto Final de Grado correspondiente al sistema Global Effect Nexus, desarrollado para la Fundación Global Effect por los sustentantes Gabriela García y Dauris Santana, en el marco de la Escuela de Ingeniería en Sistemas y Computación de la Universidad Católica del Cibao (UCATECI). A lo largo del documento se presentó el planteamiento del problema, el alcance SMART, la justificación y el posicionamiento del proyecto (Primera Entrega); las limitaciones, la planificación por sprints y los objetivos (Segunda y Tercera Entrega); el modelo de datos y su documentación técnica (Cuarta Entrega); los estándares, reglas de negocio y diseño de reportes (Quinta Entrega); y finalmente las conclusiones y referencias que cierran el trabajo (Sexta Entrega).

 
2. Conclusión

Al cierre de esta fase del Proyecto Integrador de Conocimientos, el diseño conceptual y físico de la base de datos de Global Effect Nexus se encuentra completo, normalizado (1NF–3NF) y desplegado en un entorno real de Supabase, con 36 tablas, 7 tipos ENUM, 44 relaciones verificadas y soporte nativo para inteligencia artificial mediante pgvector. Esta fundación de datos —adelantada respecto al cronograma original— reduce significativamente el riesgo técnico de los sprints siguientes, centrados en el backend (Auth.js, RBAC, i18n) y en la implementación funcional de los 27 módulos y cinco portales por rol.

El proyecto demuestra que es posible sustituir la gestión fragmentada en papel y hojas de cálculo por una plataforma centralizada, auditable y segura, sin recurrir a un ORM y manteniendo el control total sobre las consultas SQL, lo cual constituye tanto una decisión de ingeniería defendible académicamente como una garantía de seguridad ante la inyección de código. El módulo de Solicitudes y Aprobaciones, en particular, evidencia que los controles de un ERP —separación de funciones, segundo nivel de aprobación y rastro de cada decisión— pueden traducirse directamente en restricciones físicas del modelo de datos. Del mismo modo, cuando la fundación eliminó su departamento de Psicología, el cambio de alcance se resolvió con una migración versionada (0030) sin reescribir la historia del esquema.

Como trabajo futuro, se identifican tres frentes: (1) completar la implementación funcional de los sprints S4 a S13 conforme al plan de trabajo presentado; (2) migrar progresivamente el archivo histórico de la fundación, priorizando los expedientes activos; y (3) evaluar, una vez estabilizado el sistema, la incorporación de nuevos roles o de un modelo multi-institucional si la fundación decide extender la plataforma a programas hermanos.

 
3. Bibliografía

Vercel Inc. (2026). Next.js Documentation — App Router. https://nextjs.org/docs
PostgreSQL Global Development Group. (2026). PostgreSQL 17 Documentation. https://www.postgresql.org/docs/17/
node-postgres. (2026). pg — PostgreSQL client for Node.js, documentación oficial. https://node-postgres.com/
Auth.js. (2026). Auth.js Documentation (NextAuth v5). https://authjs.dev/
pgvector. (2026). pgvector — Open-source vector similarity search for Postgres. https://github.com/pgvector/pgvector
OWASP Foundation. (2026). OWASP Top Ten — A03:2021 Injection. https://owasp.org/www-project-top-ten/
Significados.com. (s.f.). Planteamiento del problema. https://www.significados.com/planteamiento-del-problema/
Universidad Católica del Cibao (UCATECI). (2024). Guía metodológica del Proyecto Integrador de Conocimientos I (ISC 109). Plataforma Virtual UCATECI.
c