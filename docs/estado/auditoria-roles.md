# Auditoría por rol (24 nov 2026)

Lectura de `nav.ts`, `rbac.ts`, páginas y formularios; no se abrió cada pantalla. Es la base del estándar de diseño y de los diagramas de comunicación.

## Hallazgos transversales

- **Sin estándar de diseño:** 3 calendarios (`event-manager`, `calendario-mensual-estudiante`, el del inicio docente), Gantt/línea de tiempo duplicados, gráficos de Recharts sin envoltorio común, filtros con chips en unos sitios y `<select>` nativo en otros, `window.confirm` junto a `Dialog`, estados vacíos sueltos en ~16 archivos.
- **Formularios con exceso:** expediente (~33 campos), factura de proveedor (~17), recibo (14), tarea docente (11–12, duplicada en Materias y Clases 360), universidad (11), proveedor (10–11), activo (10).
- **Documentos desactualizados:** prometen rutas que no existen (`/portal/super-admin`, `/portal/docente`, `/estudiantes/[id]`) y módulos de contabilidad retirados.

## Por rol

| Rol | Sobra | Falta |
|---|---|---|
| super_admin / admin | ~11 ítems contables en solo lectura; 4 vistas de tareas; Habitudes completo para admin; carga de notas en dirección | Bandeja de aprobación de segundo nivel; tablero ejecutivo; ciclo de beca; cumplimiento ASFL |
| docente | Gantt, Torre de control, Solicitudes de compra | Libro de calificaciones en matriz, asistencia de un toque, bandeja de entregas por corregir |
| estudiante | 5 gráficos en el inicio que repiten otras pantallas; icono de llave inglesa | Condiciones de la beca en una vista, perfil, notificaciones; comedor y servicios fuera del menú |
| contabilidad | Libros, asientos manuales, inventario (poco uso); 12 módulos retirados con código vivo | Aprobación por umbral, recordatorios DGII, entrada simple de donaciones |
| habitudes / dir_habitudes | Duplicación con admin | Embudo de candidatos, métricas por liceo |
| chofer | Torre y Calendario casi sin tareas | Solicitud de combustible o mantenimiento, bitácora de kilometraje |
