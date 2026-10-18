# Plan Maestro de Generación de Entregas — Global Effect Nexus

Este documento sirve como guía y conjunto de instrucciones estructuradas para que **Claude** (o cualquier otro asistente de IA) genere de manera automatizada y precisa los documentos correspondientes a las entregas restantes (**Segunda a Sexta**) del proyecto de grado **Global Effect Nexus**, basándose fielmente en el código de base de datos y la arquitectura técnica ya implementados.

---

## 📋 Mapeo de Entregas y Recursos Existentes

El proyecto cuenta con una base de datos PostgreSQL en producción (Supabase) con más de 70 tablas normalizadas (esquemas `public` y `contabilidad`), 30 módulos funcionales estructurados en 6 portales web y cimientos de código en Next.js. Desde octubre de 2026 el sistema se presenta como un **ERP institucional con portal del estudiante integrado**: el módulo de psicología (portal confidencial, citas, notas, riesgo psicológico) queda **descartado: el departamento de Psicología se eliminó (oct 2026)**, y su lugar lo ocupa **Solicitudes y aprobaciones** y la agenda institucional. Las entregas reflejan además la contabilidad formal DGII (NCF, 606/607, cajas chicas con desglose físico), inventario patrimonial con códigos QR y escáner móvil, Torre de Control de empleados y aula virtual Moodle Global 360. A continuación, se detalla qué requiere cada entrega y de dónde extraer la información dentro del proyecto.

| Entrega | Sección Requerida (según PDF) | Recurso Existente en el Proyecto | Estado / Acción |
| :--- | :--- | :--- | :--- |
| **Primera** | *Ya entregada y aprobada* | [docs/01-vision-y-alcance.md](01-vision-y-alcance.md) | ✅ Completada |
| **Segunda** | 1. Limitaciones del Proyecto | Reglas del negocio y limitaciones de hardware/servicios. | 📝 Generar (Fronteras de la app) |
| | 2. Planificación (Camino Crítico, Costes, etc.) | [docs/05-plan-de-trabajo.md](05-plan-de-trabajo.md) y [docs/05-plan-de-trabajo.md](05-plan-de-trabajo.md) | 📝 Generar (Formato académico) |
| | 3. Visualización o Plan de Marketing | Propuesta de valor en la visión general. | 📝 Generar (Asociación emocional) |
| | 4. Objetivo General | Propósito central del proyecto. | 📝 Redactar (Ver guía abajo) |
| **Tercera** | 1. Objetivos Específicos | Módulos del proyecto. | 📝 Generar (Mapeados a sprints/capas) |
| | 2. Marco Teórico | Conceptos de Next.js, PostgreSQL (sin ORM), RBAC y RAG. | 📝 Generar |
| | 3. Vulnerabilidad del Sistema | Parámetros de seguridad de la BD y la API. | 📝 Generar (Matriz de riesgos de TI) |
| **Cuarta** | 1. Diagrama Entidad-Relación | [docs/04-modelo-de-datos/diagrama-entidad-relacion.md](04-modelo-de-datos/diagrama-entidad-relacion.md) | ✅ Copiar Mermaid / Generar imagen |
| | 2. Diagrama de Flujo de Datos (DFD) | Flujos clave descritos en la Visión. | 📝 Generar (Nivel 0 y Nivel 1 en Mermaid) |
| | 3. Diccionario de Datos | [docs/04-modelo-de-datos/diccionario-de-datos.md](04-modelo-de-datos/diccionario-de-datos.md) | ✅ Copiar diccionario completo |
| **Quinta** | 1. Estándares del Sistema | Convenciones de bases de datos y clean code. | 📝 Generar |
| | 2. Reglas de Negocio | Triggers de PostgreSQL y validaciones de código. | 📝 Generar (Detalle de constraints y flujos) |
| | 3. Diseño de Reportes | Módulo de contabilidad y reportes de la visión. | 📝 Generar (Mockups en Markdown) |
| **Sexta** | 1. Introducción | Contextualización general de la fundación. | 📝 Generar |
| | 2. Conclusión | Evaluación de los objetivos planteados. | 📝 Generar |
| | 3. Bibliografía | Referencias técnicas y metodológicas. | 📝 Generar |

---

## ⚡ Prompts Listos para Claude (Instrucciones de Copiar y Pegar)

A continuación, se presentan los prompts exactos diseñados para que se los envíes a Claude en nuevas conversaciones. Cada prompt contiene el contexto y los requisitos específicos que exige la guía del docente.

### 📌 Prompt 1: Generar la SEGUNDA ENTREGA
> **Contexto:** Copia este prompt tal cual para obtener el documento completo de la Segunda Entrega.

```markdown
Actúa como un Ingeniero de Software experto redactando un documento de tesis de grado. Necesito que generes la "Segunda Entrega" del proyecto "Global Effect Nexus" (plataforma integral de gestión para la Fundación Global Effect) siguiendo estrictamente el estándar de la guía metodológica adjunta.

Para redactarlo, utiliza los siguientes datos del proyecto que ya están implementados:
- Objetivo general del sistema: Diseñar e implementar una plataforma integral que centralice el control de estudiantes, expedientes académicos, patrocinadores, contabilidad, portales de usuario por rol (RBAC), consultas seguras mediante SQL parametrizado a mano sobre PostgreSQL, y asistentes de inteligencia artificial (OCR y RAG).
- El proyecto se divide en 14 sprints de 2 semanas cada uno (iniciando en julio 2026 y culminando en enero 2027), distribuidos en 3 fases: Fase de Base de Datos (S0-S3, ya completada), Fase de Desarrollo de Software (S4-S11) y Fase de Estabilización, QA y Despliegue (S12-S13).
- Las herramientas de planificación son GitHub Project, Git, Supabase PostgreSQL, Next.js con Tailwind CSS y TypeScript.

Por favor, genera un documento estructurado en markdown con las siguientes secciones detalladas:

1. LIMITACIONES DEL PROYECTO:
   - Define claramente qué queda fuera del alcance (por ejemplo: la plataforma no gestiona pasarelas de pago automatizadas sino registro manual de transacciones; no realiza inscripciones escolares estatales, se limita exclusivamente a la administración interna de la Fundación Global Effect; el análisis OCR depende del formato estándar de PDF/Imagen subido).

2. PLANIFICACIÓN DEL PROYECTO:
   - Actividades críticas o camino crítico (diseño de BD -> autenticación central -> lógica de expedientes y portales -> seguridad e integración de IA).
   - Dependencias entre actividades (no se puede desarrollar un portal de rol sin haber implementado primero la tabla de identidad y Auth.js).
   - Recursos necesarios y disponibles (1 desarrollador full stack, 1 diseñador/analista, base de datos en nube Supabase, servidor de hosting Vercel).
   - Consumo equilibrado de recursos y Costes planificados (coste aproximado de hosting, dominios y APIs de inteligencia artificial).
   - Plazos fijos (duración total de 7 meses, sprints quincenales).
   - Gestión de riesgos e incertidumbres (matriz rápida de riesgos: fuga de datos personales de los expedientes, aprobaciones sin control (un gasto aprobado por quien lo pidió), costos elevados de API de IA, desconexión de base de datos y cómo mitigarlos).
   - Herramientas fáciles de usar (Justifica el uso de Next.js y el panel de administración).

3. VISUALIZACIÓN O PLAN DE MARKETING:
   - Redacta el posicionamiento del proyecto. Cómo asocia una emoción o sentimiento de "esperanza, eficiencia y transparencia" para la fundación. Explica la propuesta de valor para directivos, estudiantes y patrocinadores internacionales (enfoque bilingüe e informes claros).

4. OBJETIVO GENERAL:
   - Redacta el objetivo formal de la investigación/proyecto de grado usando verbos taxonómicos de ingeniería (Diseñar, Desarrollar, Implementar).
```

---

### 📌 Prompt 2: Generar la TERCERA ENTREGA
> **Contexto:** Copia este prompt para redactar la Tercera Entrega (Objetivos Específicos, Marco Teórico y Seguridad).

```markdown
Actúa como un experto en ciberseguridad y arquitectura de software. Genera la "Tercera Entrega" para el proyecto "Global Effect Nexus" siguiendo los lineamientos académicos correspondientes.

Para el contenido técnico, apóyate en estas decisiones reales del proyecto:
- Arquitectura: Next.js (App Router) + PostgreSQL (Supabase). No usamos ORM (como Prisma o Drizzle) para garantizar el control total de la base de datos y optimizar consultas, escribiendo SQL parametrizado de forma manual para mitigar riesgos de Inyección SQL.
- Autenticación: Auth.js (NextAuth v5) con sesiones JWT cifradas, control de acceso basado en roles (RBAC) con 6 roles configurados (super_admin, admin, docente, estudiante, contabilidad, habitudes).
- IA: pgvector para almacenamiento de fragmentos de conocimiento en embeddings y RAG para consultas contextuales.

Escribe las siguientes secciones:

1. OBJETIVOS ESPECÍFICOS:
   - Redacta al menos 5 objetivos específicos detallados y medibles alineados con la construcción del sistema (E1: Base de datos normalizada; E2: Sistema de Autenticación RBAC; E3: Automatización de carga de expedientes con OCR; E4: Módulo de solicitudes y aprobaciones con flujo por pasos, segundo nivel de dirección y trazabilidad; E5: Módulo de reportes y balances contables).

2. MARCO TEÓRICO:
   - Describe y justifica conceptualmente las tecnologías clave seleccionadas:
     * Next.js y Server Actions frente a arquitecturas SPA tradicionales.
     * PostgreSQL como motor relacional frente a NoSQL para consistencia académica y financiera.
     * El dilema: Consultas SQL parametrizadas manuales frente a ORMs (Control vs. Abstracción).
     * Concepto de Control de Acceso Basado en Roles (RBAC) y cómo previene accesos no autorizados.
     * Recuperación Aumentada por Generación (RAG) y bases de datos vectoriales (pgvector).

3. VULNERABILIDAD DEL SISTEMA:
   - Realiza un análisis de vulnerabilidades y amenazas de TI para este sistema.
   - Crea una Matriz de Riesgos (Amenaza | Impacto | Probabilidad | Medida de Corrección). Incluye amenazas como: Inyección SQL, Secuestro de Sesión (Session Hijacking), Fuga de Datos Personales (Expedientes Estudiantiles), Aprobación indebida (separación de funciones en solicitudes), Denegación de Servicio (DoS).
   - Detalla las medidas de mitigación que ya tiene el proyecto (uso de `$1`, `$2` en consultas SQL; cookies HttpOnly y JWT firmados; permisos por acción exigidos en la capa de datos (`requirePermission`); nadie aprueba su propia solicitud y cada paso queda en `solicitud_paso` y `audit_log`; cifrado de datos sensibles).
```

---

### 📌 Prompt 3: Generar la CUARTA ENTREGA
> **Contexto:** Esta entrega es de diagramación. Los diccionarios y diagramas relacionales ya existen en la carpeta `docs/04-modelo-de-datos/`. Este prompt le pide a Claude generar los diagramas de flujo de datos (DFD) faltantes y estructurar la entrega.

```markdown
Actúa como un Analista de Sistemas de Software. Genera la "Cuarta Entrega" del proyecto "Global Effect Nexus".

Esta entrega consta de tres partes:
1. Diagrama Entidad Relación (ERD).
2. Diagrama de Flujo de Datos (DFD).
3. Diccionario de Datos.

Para realizarla:
- Toma como entrada el código Mermaid y las relaciones descritas en los archivos 'docs/04-modelo-de-datos/diagrama-entidad-relacion.md' y el diccionario en 'docs/04-modelo-de-datos/diccionario-de-datos.md'.
- Tu tarea principal es:
  1. Diseñar el Diagrama de Flujo de Datos (DFD) en dos niveles usando notación Mermaid:
     - DFD Nivel 0 (Diagrama de Contexto): Muestra la interacción de los actores externos (Estudiante, Docente, Patrocinador, Contabilidad, Administrador / Dirección) con el sistema central "Global Effect Nexus".
     - DFD Nivel 1: Muestra los procesos principales del sistema: (1.0 Autenticación y RBAC, 2.0 Gestión de Expedientes con OCR, 3.0 Control Académico, 4.0 Solicitudes y Aprobaciones, 5.0 Registro Financiero y Contable, 6.0 Procesamiento de Consultas de IA).
  2. Redactar una explicación teórica clara de cada nivel y flujo de datos representados en los diagramas.
  3. Estructurar el documento final para que el usuario pueda insertar el ERD y el Diccionario de Datos existentes de forma integrada.
```

---

### 📌 Prompt 4: Generar la QUINTA ENTREGA
> **Contexto:** Genera los estándares, reglas de negocio detalladas y el diseño lógico de reportes.

```markdown
Actúa como un Diseñador de Software y Administrador de Bases de Datos Senior. Genera la "Quinta Entrega" del proyecto "Global Effect Nexus" de acuerdo con los siguientes requerimientos:

1. ESTÁNDARES DEL SISTEMA:
   - Define las directrices técnicas del proyecto:
     * Estándares de Codificación: Uso de TypeScript, tipado estricto, nomenclatura camelCase para código y snake_case para base de datos.
     * Estándares de Interfaz: Uso de Tailwind CSS, diseño responsivo, tokens de color consistentes (modo oscuro/claro con shadcn/ui), cumplimiento de accesibilidad básica.
     * Estándares de Base de Datos: Nombres de tabla en singular, llaves primarias UUID autopublicadas, constraints explícitos, campos de auditoría estándar (`created_at`, `updated_at` gestionados mediante triggers).

2. REGLAS DE NEGOCIO (Mínimo 6 reglas detalladas):
   - Redacta de forma formal las reglas lógicas del negocio que el sistema impone. Utiliza las reglas del proyecto real:
     * RN1: Restricción de Horario de Comida (Inscripciones permitidas únicamente antes de las 8:30 AM del día actual).
     * RN2: Separación de Funciones en Aprobaciones (Nadie aprueba su propia solicitud; las becas y los gastos de 1,000 USD o más requieren un segundo nivel de dirección, fijado al crear la solicitud).
     * RN3: Asociación de Patrocinador (Un estudiante solo puede recibir patrocinio de patrocinadores registrados y activos).
     * RN4: Control de Acceso RBAC (Un usuario no puede realizar acciones de escritura en el módulo de contabilidad si no cuenta con el rol de 'contabilidad' o 'super_admin').
     * RN5: Consistencia de Calificaciones (Las calificaciones de un estudiante deben estar asociadas a una materia, un período académico activo y un facilitador responsable).
     * RN6: Notificación de Tareas (Cualquier creación de tarea en el módulo Kanban debe disparar un correo y registrarse en el calendario de los usuarios asignados).

3. DISEÑO DE REPORTES:
   - Diseña el formato conceptual (mockups de texto o tablas Markdown) de los reportes clave que el sistema genera:
     * Reporte Académico Semestral (GPA, aprobadas/reprobadas, asistencia).
     * Reporte Contable Mensual (Ingresos por patrocinio, Egresos por becas y servicios, balance neto).
     * Reporte de Solicitudes y Aprobaciones (Solicitudes por tipo y estado, tiempo medio de resolución y pendientes de dirección).
```

---

### 📌 Prompt 5: Generar la SEXTA ENTREGA (Documento Final)
> **Contexto:** Cierre formal del proyecto integrador (Introducción, Conclusiones y Bibliografía).

```markdown
Actúa como un Académico de Ciencias de la Computación. Genera la "Sexta Entrega" y cierre metodológico de la tesis "Global Effect Nexus" que contiene:

1. INTRODUCCIÓN:
   - Redacta una introducción formal de 3 a 4 párrafos que contextualice el problema de la Fundación Global Effect en la República Dominicana (el crecimiento de sus operaciones académicas, la necesidad de digitalización y seguridad de datos, y cómo "Global Effect Nexus" actúa como solución integral bajo arquitectura moderna).

2. CONCLUSIÓN:
   - Escribe las conclusiones del proyecto divididas por áreas:
     * Enfoque Técnico: Éxito del uso de PostgreSQL con SQL puro frente a las limitaciones de rendimiento e inseguridad de los ORM genéricos.
     * Enfoque Operativo: Reducción del tiempo de carga manual de expedientes gracias a la IA y OCR.
     * Enfoque de Seguridad: Robustez del sistema de protección RBAC y aislamiento de registros confidenciales.

3. BIBLIOGRAFÍA / REFERENCIAS:
   - Genera una lista de referencias en formato APA séptima edición que incluya fuentes formales sobre:
     * Framework Next.js y arquitectura React.
     * Bases de datos relacionales y optimización en PostgreSQL.
     * Sistemas de Control de Acceso Basado en Roles (RBAC).
     * Inteligencia artificial RAG y pgvector.
     * Normativas de protección de datos (relevante para expedientes de estudiantes).
```

---

## 🚀 Cómo ejecutar la generación secuencial

Para que tu experiencia con Claude sea óptima y no excedas los límites de contexto, sigue estos pasos:

1. **Mantén una única conversación de Claude** para generar los documentos si quieres que retenga el estilo técnico, o abre una nueva para cada entrega utilizando los prompts anteriores.
2. Si utilizas una herramienta interactiva, puedes pasarle como contexto adicional los archivos de documentación actuales (`docs/01-vision-y-alcance.md` y `docs/04-modelo-de-datos/diagrama-entidad-relacion.md`) para asegurar que el contenido teórico coincida exactamente con lo programado.
3. Guarda cada entrega generada en archivos de Markdown dentro de `docs/entregas/` (ej. `docs/entregas/segunda-entrega.md`, etc.) antes de compilarlas a PDF para su entrega a la universidad.
