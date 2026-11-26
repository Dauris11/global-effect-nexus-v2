# Plan de experiencia de usuario (26 nov 2026)

Objetivo: que el portal se use sin pensar. **Solo cambia la distribución: colores,
paleta y marca no se tocan** (la única excepción de color es el estándar de
estado, ver `docs/09-sistema-visual.md` §2.3b).

Tres referencias, una por zona. No se copia su aspecto, se copia cómo ordenan el
trabajo.

| Zona | Referencia | Qué se toma |
|---|---|---|
| ERP administrativo | Asana | Inicio personal («Mis tareas» + próximo), vistas Lista / Tablero / Línea de tiempo / Calendario sobre los mismos datos, **panel lateral de detalle** (se abre al lado, no un diálogo encima), botón global «+ Crear», bandeja de avisos. |
| Portal del estudiante y aula virtual | Moodle | **Mis cursos** como tarjetas con portada; página de curso con secciones y actividades en lista y un índice del curso a un lado; bloque «Próximas entregas»; calificaciones como tabla por curso. |
| Cómo se usa todo | Airbnb | Una sola acción principal por pantalla, buscador grande arriba, tarjetas con aire, filtros en chips, pestañas abajo en móvil, formularios en pasos, nada de pantallas con diez botones. |

## Fases (en este orden)

1. **Global Effect 360 como módulo único** (decidido, sin construir). Es la base
   de «Mis cursos» con portada del estudiante: grupos por materia con portada,
   horarios, fecha de inicio, estudiantes y prematrícula propia. Una pantalla con
   pestañas Grupos · Prematrícula · Períodos. Migración nueva.
2. **Portal del estudiante (Moodle):** inicio con «Mis cursos» (tarjetas con
   portada, solo los grupos en los que está) y «Próximas entregas»; página de
   curso con secciones; calificaciones por curso. El estudiante entra a un aula
   solo si eligió el grupo en prematrícula y pertenece a él.
3. **Aula virtual del docente:** ya tiene el revisor de entregas con vista
   previa. Falta que la página del curso sea la misma que ve el estudiante, con
   las herramientas del docente al lado.
4. **ERP (Asana):** panel lateral de detalle para tareas, actividades y
   proyectos; selector de vista (Lista / Tablero / Línea de tiempo / Calendario)
   en Proyectos y Mis tareas; «+ Crear» global en la barra superior.
5. **Transporte (Pedidos Ya):** mapa que traza el recorrido desde el chofer y
   línea de estado para el estudiante. Ver `pendientes.md`.
6. **Pasada Airbnb:** buscador global con registros (no solo pantallas),
   formularios en pasos, estados vacíos con una acción, revisión móvil de las
   pantallas más usadas.

## Reglas para cada fase

- Primero se retira lo duplicado o sin objetivo; después se añade.
- Cada pantalla: un título, una acción principal, lo demás secundario.
- Sin subtítulos ni descripciones (decisión de nov 2026).
- Cada fase cierra con `npm run lint && npm run build && npm run i18n:check &&
  npm run audit:ui` y con la pantalla revisada con sesión iniciada en escritorio
  y móvil.
