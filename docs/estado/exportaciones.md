# Qué se puede imprimir o exportar

Análisis de lo que la Fundación necesita sacar en papel o en archivo, y cómo está resuelto.
No es imprimir la pantalla: cada documento se genera ordenado, con el logo y la fecha, en el
formato que sirva a quien lo recibe. Se pide desde el botón **Exportar** de cada pantalla
(`MenuExportar`); los documentos viven en `src/server/exportar/`, la ruta es
`/api/exportar/[tipo]?formato=pdf|docx|xlsx|csv` (con `&ver=1` el PDF se abre para imprimir) y cada
descarga queda en la bitácora (`exportacion.generada`).

## Hecho

| Documento | Dónde se pide | Formatos | Quién |
|---|---|---|---|
| Ficha completa con foto | Expediente | PDF, Word | expedientes.leer |
| Récord de notas | Expediente · portal del estudiante | PDF, Word, Excel, CSV | expedientes.leer · el propio estudiante |
| Avance en el plan de estudios | Expediente · portal del estudiante | PDF, Word, Excel, CSV | expedientes.leer · el propio estudiante |
| Lista de expedientes (con los filtros puestos) | Expedientes | PDF, Word, Excel, CSV | expedientes.leer |
| Estudiantes en riesgo | Expedientes · Estudiantes en riesgo | PDF, Word, Excel, CSV | expedientes.leer |
| Estudiantes de una universidad | Universidad | PDF, Word, Excel, CSV | expedientes.leer |
| Calificaciones de una universidad | Universidad | PDF, Excel, CSV | expedientes.leer |
| Plan de estudios de una carrera | Carrera | PDF, Word, Excel, CSV | catalogo.leer |
| Estudiantes de una clase de Global 360 | Clases de 360 | PDF, Word, Excel, CSV | expedientes.leer o docencia.impartir |
| Hoja de asistencia (cuadrícula para firmar) | Clases de 360 | PDF, Word, Excel | expedientes.leer o docencia.impartir |
| Estudiantes de un patrocinador | Patrocinador | PDF, Word, Excel, CSV | patrocinadores.leer |

Ya existían, aparte: libros y formatos DGII 606/607/608/609, balanza, diario, mayor, banco y cuentas
por pagar (Excel/TXT, `/api/contabilidad/exportar`), recibos y comprobantes (imprimibles), listas de
comida y servicios mensuales (imprimibles).

## Por hacer (candidatos, de más a menos útil)

1. **Constancia / carta de récord** con firma y sello: espera el texto oficial (ver `por-entregar.md`).
2. **Informe mensual al patrocinador**: carta del estudiante, asistencia y avance en un solo PDF.
3. **Lista de estudiantes por carrera, por grupo (cohorte) y por situación** (postulados, retirados, graduados).
4. **Carnet o credencial del estudiante** (foto, matrícula, universidad).
5. **Cartas mensuales recibidas** (bandeja de correos): lista del mes con quién cumplió y quién no.
6. **Visitas a liceos de Habitudes**: informe de evidencias por liceo o por facilitador, con fotos.
7. **Materiales del Hub de Habitudes**: catálogo imprimible con portada y vistazo.
8. **Calendario y Gantt** (calendario, tareas, cuentas por pagar): PDF del mes.
9. **Planilla de operaciones** (servicios mensuales, comida) como Excel además de papel.
10. **Reportes** (`/reportes`): botón de Excel y PDF en cada vista.
11. **Rendiciones de gastos y solicitudes**: PDF de una solicitud aprobada con su historial.
12. **Bitácora de auditoría y actividad**: CSV filtrado, para revisiones.
13. **Todo el expediente en un paquete** (ficha + récord + avance) en un solo PDF o ZIP.

Cómo agregar uno: armar el `Documento` en `src/server/exportar/documentos/`, darlo de alta en
`src/lib/exportar.ts` (formatos) y en `catalogo.ts` (permiso), y poner un `MenuExportar` en la pantalla.
