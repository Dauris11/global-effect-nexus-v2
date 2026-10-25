# Prompt: Portales por rol como software completo (Global Effect Nexus)

## 1. Objetivo y principio rector

El sistema es de uso mayormente interno (empleados y gestión de la fundación); los estudiantes son un portal más. Cada rol debe sentirse dentro de **su propio software completo**, sin necesitar otra herramienta.

Lee el repo y el documento de portales (24-oct-2026) antes de proponer nada. Respeta el stack existente. Entrega un plan por fases y espera mi aprobación antes de migraciones.

**Regla de arquitectura:** cada portal tiene su propio *workspace* (barra lateral propia, inicio con indicadores, bandejas, búsqueda global tipo paleta de comandos, reportes y atajos), pero todos consumen **servicios compartidos**, construidos una sola vez:

1. Identidad y RBAC (servidor, rutas y RLS en base de datos)
2. Notificaciones (en app, push y correo)
3. Chat interno
4. Documentos y archivos (Storage con URLs firmadas)
5. Proyectos y tareas (con Gantt)
6. Calendario (con sincronización a Google)
7. Bitácora de auditoría (la cadena SHA-256 existente)

**Rol base nuevo:** crea `colaborador` (permisos mínimos: chat, solicitudes, tareas propias, reportar gasto). Choferes, auxiliares y demás personal operativo lo usan sin necesitar un portal propio. Los roles de departamento se suman encima.

## 2. Chat interno con flujo de comprobantes (prioridad alta)

**Caso guía:** a un chofer se le daña un neumático, lo reemplaza, fotografía la factura en el chat y llega **en tiempo real** a Contabilidad.

- Canales: mensajes directos, grupos, un canal por departamento y **hilos por caso** (gasto, solicitud, proyecto, estudiante).
- Tipos de mensaje: texto, imagen, archivo, nota de voz y **tarjetas estructuradas**.
- Acción "Reportar gasto" dentro del chat: abre la cámara, sube la foto, pide monto, categoría, vehículo o proyecto relacionado, y envía.
- La foto va a Storage. El OCR existente extrae proveedor, RNC, NCF, fecha, monto e ITBIS. Se crea un **borrador de gasto** en una nueva **Bandeja de comprobantes recibidos** en el portal de Contabilidad.
- Contabilidad ve el comprobante llegar en vivo, valida o corrige los datos, lo clasifica (cuenta, centro de costo, fondo) y responde en el mismo hilo ("aprobado", "falta NCF", "reembolso en proceso"). El estado se refleja en la tarjeta del chofer.
- Si es reembolso, enlaza con caja chica o cuentas por pagar. Si hay presupuesto del proyecto o del vehículo, alerta de sobregiro.
- Soporte para fotos de baja calidad: validación de legibilidad y solicitud de nueva foto.
- Archivo del comprobante inmutable con hash, conservado 10 años; el mensaje de chat puede archivarse, el comprobante no se borra.
- Móvil primero: PWA con captura de cámara, cola sin conexión que reenvía al recuperar señal, notificaciones push.
- Privacidad: los mensajes directos solo los ven sus participantes; los canales son auditables. Documenta esta política para que el personal la conozca.

## 3. Proyectos, tareas y Gantt (servicio compartido)

- Cualquier empleado puede crear proyectos y tareas; los administradores pueden asignarlas. Los permisos por rol siguen aplicando.
- Entidades: proyecto, fase, tarea, subtarea, hito, dependencias (fin-inicio, inicio-inicio), responsables, fechas, esfuerzo estimado y real, % de avance, etiquetas, adjuntos, comentarios.
- Vistas: lista, tablero Kanban, **Gantt**, calendario y carga de trabajo por persona.
- Gantt: arrastrar para reprogramar, dependencias visibles, **ruta crítica**, línea base vs. real y alertas de retraso. Evalúa Frappe Gantt (licencia MIT) como punto de partida y confirma que esté mantenido.
- Cada tarea con fecha aparece en el calendario personal del responsable (y en Google, ver punto 4).
- Vínculos con el resto: una tarea puede originar una solicitud de compra; un gasto del chat puede imputarse a un proyecto; el costo real de cada proyecto se calcula desde Contabilidad.
- La "Torre de Control" ("Lo que me toca hoy") se alimenta de este módulo.

## 4. Integración con Google

**Decisión previa que cambia todo:** ¿la fundación tiene (o puede tener) un dominio de **Google Workspace**?

- Con dominio propio: configura la aplicación OAuth como tipo **Internal**. Esto evita la verificación de Google y el límite de 100 usuarios.
- Sin dominio (cuentas personales): la app es External y los alcances sensibles de Calendar exigen **verificación de Google** (formulario, justificación y video).

Si la fundación es elegible, **Google Workspace for Nonprofits es gratuito**; hay que verificar disponibilidad en República Dominicana en la página oficial de elegibilidad y que la fundación esté validada como organización sin fines de lucro.

**Integraciones a construir, en este orden:**

1. **Inicio de sesión con Google (OIDC)** para el personal, restringido al dominio de la fundación. Los estudiantes pueden mantener su autenticación actual.
2. **Google Calendar, sincronización bidireccional.**
   - Alcance mínimo: `calendar.events` (todos los alcances de Calendar son sensibles). Evalúa `calendar.app.created` para crear un calendario secundario por proyecto o por programa, que limita lo que la app puede tocar.
   - Cambios desde Google hacia el portal: **notificaciones push con canales `watch`** y **sincronización incremental con `syncToken`**. Los canales **expiran**: crea un trabajo programado que los renueve y maneje el reinicio completo cuando el token caduca. Verifica el token del canal en cada notificación.
   - Cambios desde el portal hacia Google: tareas con fecha, reuniones de la agenda institucional, clases de Global Effect 360, tutorías, talleres de Habitudes y vencimientos fiscales.
   - Enlaces de **Google Meet** automáticos en reuniones virtuales.
   - Minutas y compromisos de la agenda institucional se convierten en tareas.
3. **Google Drive para documentos colaborativos.** Usa el alcance mínimo `drive.file` y el selector de archivos de Google (Picker). Regla: **evidencia contable y expedientes** viven en Storage propio (inmutables, con hash, 10 años); **diapositivas y documentos de trabajo** (Habitudes, Docentes) pueden vivir en Drive y enlazarse.
4. **Ingreso de facturas por correo.** Buzón dedicado (por ejemplo, facturas@dominio) que reenvía a un servicio de correo entrante con webhook; los adjuntos entran a la Bandeja de comprobantes. Evita el alcance de lectura de Gmail: es restringido y exige evaluación de seguridad.
5. **Directorio de Workspace** (opcional): al suspender a un empleado en Google, se revoca su acceso al portal automáticamente.
6. **Google Maps Platform** para el mapa de liceos y la geolocalización de evidencias de Habitudes. Revisa los créditos para organizaciones sin fines de lucro.
7. **Hojas de cálculo:** exportaciones a Excel ya existen; añade "abrir en Google Sheets" solo si el equipo lo pide.

**Seguridad de las integraciones:** tokens de actualización cifrados en reposo, consentimiento por usuario, botón de desconectar, registro en la bitácora de cada autorización y sincronización, y mínimo privilegio en todos los alcances.

## 5. Mejoras por portal

### 5.1 Dirección General (`super_admin`)
- Tablero ejecutivo único: ejecución presupuestaria por programa, becados activos, donaciones del mes, flujo de caja proyectado, riesgos y vencimientos.
- Aprobaciones con umbrales configurables, firma y comentarios; delegación temporal cuando el director viaja.
- Cuadro de mando por proyecto (avance real vs. plan) desde el módulo de proyectos.
- Informes de junta con un clic (PDF), y alertas de anomalías de auditoría.

### 5.2 Administración (`admin`) como ERP completo
- **RR. HH. completo:** expediente del empleado, contratos, organigrama, vacaciones y permisos con flujo de aprobación, asistencia, evaluaciones de desempeño, documentos vencibles. Enlaza con Nómina de Contabilidad.
- **Flota y vehículos:** ficha por vehículo, bitácora de uso, combustible, mantenimientos programados, seguros y marbetes con alertas, y costo por vehículo desde los gastos del chat. Conecta con Activos Fijos.
- **Compras:** solicitud → cotización → orden de compra → recepción → cuenta por pagar, con aprobación por monto.
- **Inventario y mantenimiento:** existente con QR; añade órdenes de mantenimiento y responsables.
- **CRM de patrocinadores:** seguimiento de compromisos, comunicaciones y agradecimientos.
- **Eventos y reuniones**, **gestión documental** (contratos y políticas con versionado y vencimiento).
- Comunicados internos y chat (punto 2).

### 5.3 Estudiante
- Inicio con "lo que me toca hoy" (tareas, clases, comedor, trámites) y calendario sincronizable a su Google.
- Seguimiento de beca: requisitos, índice mínimo, alertas tempranas y documentos pendientes.
- Notificaciones de entregas y mensajes con docentes y coordinación.
- Reglas claras de privacidad: el estudiante ve solo lo suyo.

### 5.4 Docente
- Planificación por tanda y cuatrimestre, rúbricas, banco de recursos reutilizables.
- Calificación con rúbrica y comentarios en línea, y alertas de estudiantes en riesgo.
- Asistencia por QR, reportes por grupo y por estudiante.
- Calendario sincronizado con Google y enlaces de Meet para clases virtuales.

### 5.5 Contabilidad (completar lo ya integrado)
- Añadir la **Bandeja de comprobantes recibidos** (desde chat y correo) con estados: recibido, validado, observado, contabilizado.
- Presupuesto y costo real por proyecto y por vehículo; reembolsos con trazabilidad.
- Conciliación de caja chica con los gastos reportados por chat.
- **Puntos del documento a verificar con el contador:**
  - "Comprobantes de retención (NCF B14/E31)": B14 y E44 corresponden a regímenes especiales, y E31 es crédito fiscal; un certificado de retención no es un NCF. Aclara qué documento se quiso decir.
  - Depreciación: la categoría 3 figura al 20 %; tengo entendido que es 15 %. Confirma contra el Código Tributario antes de producción.
  - Recibos de ingreso con NCF B02: para donantes que son contribuyentes de ISR corresponde un comprobante de crédito fiscal. Verifica el tipo según el donante.

### 5.6 Habitudes
- **Biblioteca pedagógica** con versionado: diapositivas, dinámicas, guías, imágenes y videos, organizados por valor, grado, duración y materia; búsqueda por etiquetas; descarga sin conexión para liceos con mala señal.
- **Plan de clase** con plantillas, calendario de talleres por liceo y recordatorios.
- **Asistencia** por lista o QR, evaluaciones antes y después del taller, y reportes de impacto por centro educativo.
- **Evidencias en terreno** con geolocalización. **Protección de menores:** exige autorización de la escuela y del tutor antes de publicar o almacenar fotos de estudiantes, con permiso registrado por evento y acceso restringido; confirma los requisitos con asesoría legal (Ley 172-13 de protección de datos y Ley 136-03 del Código de Protección de Niños, Niñas y Adolescentes).
- Embudo de becas con puntuación, seguimiento de postulantes y paso directo al expediente estudiantil.
- Mapa de liceos con historial de visitas.

## 6. Plan de entrega

1. Servicios compartidos: rol `colaborador`, notificaciones, documentos.
2. Chat interno y flujo de comprobantes hacia Contabilidad.
3. Proyectos, tareas y Gantt.
4. Inicio de sesión con Google y sincronización con Calendar.
5. Mejoras por portal, en este orden: Contabilidad, Administración, Habitudes, Docente, Estudiante, Dirección.
6. Drive, correo de facturas, directorio y Maps.
7. Pruebas, accesibilidad y documentación.

Al terminar cada fase: archivos modificados, pruebas ejecutadas y pendientes. Pruebas obligatorias para permisos (RLS), sincronización de calendario y flujo del comprobante.

## 7. Primer paso

Lee el repo y responde con: (a) estado actual de cada servicio compartido, (b) plan por fases ajustado al stack, (c) esquema de datos de chat, proyectos e integraciones, (d) dudas. No escribas código de producción hasta que apruebe el plan.

---

**Fuentes consultadas (Google):**
- https://developers.google.com/workspace/calendar/api/guides/push
- https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification
- https://developers.google.com/identity/protocols/oauth2/production-readiness/overview
- https://knowledge.workspace.google.com/admin/getting-started/editions/google-workspace-for-nonprofits-edition
- https://www.google.com/intl/es/nonprofits/eligibility/
