# Mapas, transporte en tiempo real y Google Workspace

Recomendación para todo el portal: liceos de Habitudes, ubicación de la vivienda
en el expediente, y el transporte en vivo. Es una decisión de arquitectura, no
una instalación: lo que ya está hecho se marca **(ya está)**.

> Los precios y cuotas de Google y de los demás proveedores cambian. Antes de
> contratar nada, verifica la tarifa vigente en su página oficial.

## 1. Un solo mapa para todo el portal

**Leaflet con teselas CARTO sobre datos de OpenStreetMap — (ya está).**
Sin llave de API, sin factura, con modo claro y oscuro, y ya lo usan el mapa de
La Vega (`components/mapa`) y el transporte. Recomiendo mantenerlo como único
lienzo y no mezclar proveedores: la misma pieza (`components/mapa`) sirve para
liceos, vivienda del estudiante y la guagua.

Cuándo cambiar: si algún día se necesitan mapas vectoriales, rotación o 3D
reales, el siguiente paso es **MapLibre GL** (mismo ecosistema abierto, mismas
teselas). No hace falta antes.

## 2. Vivienda del estudiante (geocodificación)

En República Dominicana muchas direcciones no están normalizadas, así que un
cuadro de texto "dirección" geocodificado falla con frecuencia.

- **Recomendado:** que quien llena el expediente **marque un punto en el mapa**
  (o use la ubicación del teléfono) y guardar `lat`/`lng`. Es exacto y gratis.
- **Opcional:** autocompletado de direcciones con **Google Places** si se quiere
  buscar por nombre de sector o negocio. Es de pago por uso y solo aporta si la
  gente busca por texto.
- Evitar el servidor público de Nominatim para uso masivo: su política limita
  las consultas y exige cachear.

## 3. Transporte en tiempo real

No hace falta una API de mapas para saber dónde está la guagua: la posición ya
sale del teléfono del chofer (`watchPosition`) y se guarda en Postgres **(ya
está)**. Lo que sigue depende de la escala:

| Necesidad | Recomendación |
|---|---|
| Ver la guagua en vivo, 1 a pocas unidades | Lo actual: sondeo de 4 s. Suficiente. |
| Muchos pasajeros mirando a la vez | **Supabase Realtime** (ya forma parte de Supabase): empuja los cambios en vez de que cada pantalla pregunte cada 4 s. |
| Hora estimada de llegada por la carretera | **OSRM u OpenRouteService** (abiertos, sin costo por consulta si se autoalojan o dentro de su cuota). Calculan ruta y tiempo sobre OSM. |
| ETA con tráfico en vivo | **Google Routes API**: es la única de esta lista que conoce el tráfico real. De pago; solo si el ETA preciso es crítico. |

Dos límites prácticos que conviene conocer:

- Los navegadores **suspenden la geolocalización en segundo plano**. Con la
  pantalla del chofer apagada, el seguimiento se corta. Mitigación barata: la
  *Screen Wake Lock API* (mantener la pantalla encendida durante el viaje).
  Si eso no basta, la solución real es una app nativa o un servicio en primer
  plano, que es un proyecto aparte.
- Hay que **acotar la frecuencia de la API pública** de rastreo (`/api/transporte/posicion`
  no tiene límite por IP): es pública a propósito, pero no debería poder
  hacerse una avalancha de peticiones contra ella.

## 4. Google Workspace: personal sí, estudiantes no

Los empleados tienen correo institucional de Workspace; los estudiantes usarán
su correo personal. Son dos poblaciones distintas y conviene tratarlas así.

**Personal — inicio de sesión con Google (SSO):**
- Activar el proveedor Google en Supabase Auth y restringirlo al **dominio de
  la Fundación** (parámetro `hd`), **más** una comprobación en el servidor del
  dominio del correo: `hd` solo orienta al selector de cuentas, no es seguridad.
- El modelo actual se mantiene: los usuarios **se invitan desde administración**
  y el trigger solo *enlaza* una cuenta a una fila de `usuario`. Entrar con
  Google no crea acceso: quien no esté invitado queda fuera.
- Beneficio: sin contraseñas que gestionar para el personal, y alta/baja
  coherente con Workspace (suspender la cuenta de Google corta el acceso).

**Estudiantes — correo personal:**
- Correo y contraseña o **enlace mágico** por correo; opcionalmente "Continuar
  con Google" con su cuenta personal (sin `hd`). Es el flujo que ya existe.
- Los estudiantes **no entran a Workspace** ni consumen licencias.

**Integraciones de Workspace que sí valen la pena (solo personal, más adelante):**
- *Google Calendar*: espejar reuniones institucionales a los calendarios del personal.
- *Directory API*: alta y baja automática de personal. Requiere una cuenta de
  servicio con delegación a nivel de dominio, autorizada por un administrador
  de Workspace. No arrancar por aquí.

## Orden sugerido

1. Marcar la vivienda en el mapa (expediente) y mostrar liceos con el mismo componente.
2. Inicio de sesión con Google para el personal, restringido al dominio.
3. Límite de frecuencia en la API pública de transporte y *Wake Lock* en la cabina.
4. Supabase Realtime y ETA con OSRM, solo si el uso lo pide.
