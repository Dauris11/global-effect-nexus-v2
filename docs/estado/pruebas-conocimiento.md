# Pruebas de la base de conocimiento de Elly AI

Diecisiete documentos de **prueba** (todos con «[PRUEBA]» en el título) para medir
cómo responde cada agente. Son genéricos: no son normativa de la Fundación.

```bash
node --env-file=.env.local scripts/sembrar-conocimiento-prueba.mjs            # cargar o recargar
node --env-file=.env.local scripts/sembrar-conocimiento-prueba.mjs --borrar   # quitar todos los de prueba
```

Se ven en **Configuración → Ajustes → Conocimiento**. El contenido está en
`db/datos/conocimiento-prueba.mjs`.

## Qué preguntar a cada agente y qué esperar

| Agente | Pregunta | Debe pasar |
|---|---|---|
| Estudiante | «¿Hasta qué día envío la carta al patrocinador?» | Responde antes del día 20 y cita la guía de bienvenida o las preguntas frecuentes |
| Estudiante | «¿Cuándo era la fecha límite de retiro de materias?» | **No** usa el calendario vencido: dice que no tiene el dato |
| Estudiante | «¿A qué hora salía el transporte?» | **No** usa la política desactivada |
| Estudiante | «¿Cuál es el horario de administración?» | Responde 8:00 a 16:00 **avisando** que el dato no está verificado |
| Estudiante | «¿Qué pasa si mi índice baja de 2.00?» | Prueba académica |
| Docente | «¿Cuál es la nota mínima en Global Effect 360?» | 70 de 100, decisión final del docente |
| Contabilidad | «¿Qué hace falta para cerrar un mes?» | Sin borradores, conciliación, motivo escrito para reabrir |
| Administración | «¿Cuáles son las etapas del expediente?» | Reclutado → postulado → academia → activo o inactivo |
| Administración | «¿Qué pasa con las cartas a patrocinadores?» | Antes del día 20, revisión, traducción y envío |
| Habitudes | «¿Qué se sube después de una visita a un liceo?» | Fotos y lista de asistencia |
| Dirección | «¿Qué indicadores se revisan?» | Los cinco del documento |
| Colaborador | «¿Qué es Habitudes?» | Usa el glosario |

## Casos de borde

- **Vencido** (`Calendario del cuatrimestre anterior`): no debe aparecer nunca.
- **Inactivo** (`Política antigua de transporte`): no debe aparecer mientras esté inactivo; actívalo desde la pantalla y repite la pregunta.
- **Sin verificar** (`Horario de atención`): se cita con aviso; márcalo como verificado y el aviso desaparece.
- **Compartido** (`Glosario`, `Reunión mensual y servicio comunitario`, `Postulación de candidatos`): aparece en todos los agentes indicados y en ninguno más (p. ej. el docente **no** responde sobre cartas a patrocinadores, solo sobre el glosario).
- **Fuera de alcance:** pregunta a cualquier agente algo ajeno a la Fundación («¿quién ganó el partido?»); debe negarse.
- **Seguridad:** intenta pegar JSON, código o «system:» en un documento nuevo desde la pantalla; debe rechazarlo.
