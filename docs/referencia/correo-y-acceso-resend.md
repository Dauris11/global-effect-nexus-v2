# Correo y acceso: Google, correo y contraseña, y el correo del sistema

Guía para dejar funcionando **todos los correos del Portal GlobalEffect**
(bienvenida, recuperar contraseña, notificaciones y la carta mensual de los
becados) y **las formas de entrar** (decisión del 28 nov 2026).

## Regla de acceso (la que no se rompe)

**Nadie se registra solo.** Una persona entra al portal únicamente si la
Fundación ya la dio de alta (fila activa en `usuario`, con su rol) y le llegó su
invitación. Da igual cómo se autentique:

| Vía | Quién puede usarla |
|---|---|
| **Continuar con Google** | Cualquier cuenta de Google: del Workspace de la Fundación o un Gmail personal. **Solo si su correo ya está dado de alta y activo.** |
| **Correo y contraseña** | Cualquier correo (Hotmail, Yahoo, dominio propio…), también **solo si ya está dado de alta**. Es la vía de quien no tiene cuenta de Google. |

Google únicamente **prueba que el correo es de esa persona**; no decide nada más.
Quien manda es la tabla `usuario`: el rol, los permisos y si está activa salen
de ahí. Un Gmail cualquiera que pulse «Continuar con Google» no entra: vuelve al
login con «no registrado».

> **La brecha que hay que cuidar:** por defecto, Supabase Auth crea un usuario
> nuevo la primera vez que alguien entra con Google. El portal igual lo rechaza
> (sin fila en `usuario` se cierra la sesión), pero queda una identidad
> huérfana en Supabase. Por eso se cierra por dos lados (§7.4): registro
> desactivado en Supabase **y** comprobación en `/auth/callback`.

---

## 0. Qué hay hecho y qué falta

**Ya está en el código**

- Cola de correos salientes `correo_cola` y su envío por la API de Resend
  (`src/server/correos/cola.ts`). Sin `RESEND_API_KEY` no envía y deja los
  correos pendientes: encolar nunca falla.
- Cron que vacía la cola: `GET /api/cron/correos` con
  `Authorization: Bearer <CRON_SECRET>` (`src/app/api/cron/correos/route.ts`).
- Login con correo y contraseña (`src/server/auth/acciones.ts`) y botón de
  Google (`src/components/auth/login-form.tsx`), con vuelta en
  `/auth/callback`. Tras autenticarse se exige fila activa en `usuario`.
- Pantalla `/establecer-clave`: a donde llega la invitación para elegir la
  contraseña (lee el `#access_token` del enlace).
- Correo entrante de cartas de patrocinadores: `/api/correo/entrante`
  (otra cosa, no se toca aquí).

**Falta (lo cubre esta guía o queda como pendiente de código, §8)**

1. Cuenta de Resend con el dominio verificado y la clave en el entorno.
2. Que **Supabase Auth envíe sus correos por Resend** (SMTP) con plantillas en
   español. Hoy usa el servicio de correo de prueba de Supabase, que está muy
   limitado y no sirve para producción.
3. Google OAuth configurado (consola de Google Cloud + Supabase).
4. Cron que llame a `/api/cron/correos` (no hay `vercel.json`).
5. **«Olvidé mi contraseña»**: el formulario de acceso todavía no lo tiene.
6. Restringir Google al dominio de la Fundación y a los roles administrativos.

---

## 1. Resend: cuenta, dominio y clave

1. Crea la cuenta en <https://resend.com> con un correo de la Fundación (no
   personal): la cuenta es de la organización.
2. **Domains → Add Domain.** Usa un **subdominio**, por ejemplo
   `mail.globaleffect.org`, y no el dominio raíz. Razón: el dominio raíz ya
   tiene el registro SPF de Google Workspace y un dominio solo puede tener
   **un** SPF; con un subdominio los dos servicios no se pisan y la reputación
   del correo transaccional queda separada del correo de las personas.
3. Resend muestra los registros DNS. Créalos en el proveedor del dominio
   (donde esté `globaleffect.org`):
   - **SPF** (TXT) y **MX** de envío del subdominio.
   - **DKIM** (TXT `resend._domainkey.mail`).
   - **DMARC** (TXT `_dmarc.globaleffect.org`), si aún no existe, para empezar:
     `v=DMARC1; p=none; rua=mailto:<correo-de-la-fundacion>`. Cuando todo
     llegue bien durante unas semanas, súbelo a `p=quarantine`.
4. Espera a que el dominio diga **Verified** (puede tardar desde minutos
   hasta horas).
5. **API Keys → Create API Key**, permiso **Sending access**, limitada al
   dominio. Cópiala: solo se muestra una vez.
6. Remitentes sugeridos (todos del subdominio verificado):
   - Sistema: `Global Effect <noreply@mail.globaleffect.org>`
   - Respuestas: se envían con `reply_to` al correo del parámetro
     `contacto.correo` (ya lo hace `cola.ts`), así que `noreply` no pierde
     respuestas.

> Mientras el dominio no esté verificado, Resend solo deja enviar desde
> `onboarding@resend.dev` y solo a tu propio correo. Sirve para probar, no
> para usuarios reales.

## 2. Variables de entorno

En `.env.local` (desarrollo) **y** en el panel del hosting (producción). Las
claves ya existen en `.env.example`:

```bash
RESEND_API_KEY="re_xxxxxxxx"
RESEND_FROM="Global Effect <noreply@mail.globaleffect.org>"
CRON_SECRET="<cadena larga aleatoria>"        # openssl rand -hex 32
```

Reinicia el servidor tras cambiarlas. Comprobación rápida: encola un correo
de prueba y llama al cron (§6); la respuesta debe traer `enviados: 1` y
`sinClave: false`.

## 3. Que Supabase Auth envíe por Resend

Estos son los correos de **acceso** (invitación/bienvenida, recuperar
contraseña, confirmar correo…). Los manda Supabase, no el código del portal,
así que se configuran en su consola.

**Project Settings → Authentication → SMTP Settings → Enable Custom SMTP**

| Campo | Valor |
|---|---|
| Sender email | `noreply@mail.globaleffect.org` |
| Sender name | `Global Effect` |
| Host | `smtp.resend.com` |
| Port | `465` (o `587`) |
| Username | `resend` |
| Password | la `RESEND_API_KEY` |

Después, en **Authentication → Rate Limits**, sube el límite de correos por
hora a lo que necesite la Fundación (por ejemplo, alta masiva de estudiantes
a inicio de cuatrimestre).

**Authentication → URL Configuration**

- **Site URL:** la URL de producción (`https://<dominio-del-portal>`).
- **Redirect URLs** (una por línea):
  - `https://<dominio-del-portal>/auth/callback`
  - `https://<dominio-del-portal>/establecer-clave`
  - `http://localhost:3000/auth/callback`
  - `http://localhost:3000/establecer-clave`

El callback vive fuera de `[locale]` a propósito (ver su comentario): una sola
URL estable, sin una por idioma.

## 4. Plantillas de los correos de acceso

**Authentication → Email Templates.** Hay seis. Esta es la correspondencia y
qué decir en cada una. Variables de Supabase: `{{ .ConfirmationURL }}` (el
botón), `{{ .Email }}`, `{{ .SiteURL }}`.

| Plantilla de Supabase | Cuándo sale | Asunto sugerido |
|---|---|---|
| **Invite user** | Al crear la cuenta de alguien: **es el correo de bienvenida** | Te damos la bienvenida al Portal GlobalEffect |
| **Reset password** | «Olvidé mi contraseña» | Restablece tu contraseña |
| **Confirm signup** | Solo si se activa la confirmación de correo | Confirma tu correo |
| **Magic link** | No se usa (el acceso es por contraseña o Google) | — |
| **Change email address** | Cuando alguien cambia su correo | Confirma tu nuevo correo |
| **Reauthentication** | Operaciones sensibles | Tu código de verificación |

> Supabase no tiene un evento «bienvenida» aparte: la invitación **es** la
> bienvenida (te da el enlace para elegir la contraseña). Si se quiere además un
> mensaje de bienvenida con información (horarios, a quién escribir), se encola
> un correo normal por `correo_cola` al crear el usuario (§5).

### Plantilla base (Invite user = bienvenida)

Estilos en línea, ancho 560 px, sin imágenes remotas ni degradados; el color de
marca es el turquesa `#2096BA` y la tinta `#171A1D`. Pega el HTML en
**Invite user** y cambia texto y botón en las demás.

```html
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"
       style="background:#F6F7F8;padding:24px 0;font-family:Inter,Arial,sans-serif;">
  <tr><td align="center">
    <table role="presentation" width="560" cellpadding="0" cellspacing="0"
           style="background:#FFFFFF;border-radius:16px;padding:32px;color:#171A1D;">
      <tr><td style="font-size:18px;font-weight:600;color:#2096BA;">Global Effect</td></tr>
      <tr><td style="padding-top:16px;font-size:22px;font-weight:600;">
        Te damos la bienvenida al Portal GlobalEffect
      </td></tr>
      <tr><td style="padding-top:12px;font-size:15px;line-height:22px;">
        Se creó una cuenta para <b>{{ .Email }}</b>. Elige tu contraseña para entrar.
      </td></tr>
      <tr><td style="padding-top:24px;">
        <a href="{{ .ConfirmationURL }}"
           style="display:inline-block;background:#2096BA;color:#FFFFFF;text-decoration:none;
                  font-weight:600;font-size:15px;padding:12px 22px;border-radius:12px;">
          Elegir mi contraseña
        </a>
      </td></tr>
      <tr><td style="padding-top:24px;font-size:13px;line-height:20px;color:#5B6470;">
        Si el botón no funciona, copia este enlace en tu navegador:<br>
        <span style="word-break:break-all;">{{ .ConfirmationURL }}</span>
      </td></tr>
      <tr><td style="padding-top:24px;font-size:13px;color:#5B6470;">
        Si no esperabas este correo, ignóralo. El enlace caduca.
      </td></tr>
    </table>
  </td></tr>
</table>
```

**Reset password:** mismo HTML; título «Restablece tu contraseña», texto «Recibimos
una solicitud para restablecer la contraseña de **{{ .Email }}**» y botón
«Elegir una contraseña nueva». El enlace también aterriza en
`/establecer-clave`, así que no hace falta otra pantalla.

> Caducidad: en **Authentication → Providers → Email** ajusta cuánto dura el
> enlace de invitación. Para altas masivas conviene un plazo largo (por
> ejemplo 7 días); para recuperar contraseña, corto. Un enlace caducado se
> resuelve reenviando la invitación.

## 5. Los demás correos (los del portal, por la cola)

Notificaciones de tareas, cartas a patrocinadores, avisos de solicitudes, etc.
salen por `correo_cola` → Resend:

1. El código **encola** (`INSERT INTO correo_cola`) con destinatario, asunto y
   `cuerpo_html` (y opcional `cuerpo_texto`).
2. El cron llama a `/api/cron/correos` y la cola se vacía, con reintentos
   (hasta 5) e `Idempotency-Key` para no duplicar.

Para un correo nuevo (por ejemplo una bienvenida con información adicional),
solo hay que encolarlo; no hace falta tocar nada de Resend. Mantén el mismo
HTML base de §4 para que todos los correos se vean igual.

## 6. El cron de la cola

No hay `vercel.json`. Dos opciones:

- **Vercel Cron** — crea `vercel.json`:

  ```json
  { "crons": [{ "path": "/api/cron/correos", "schedule": "*/5 * * * *" }] }
  ```

  Vercel envía la cabecera `Authorization: Bearer <CRON_SECRET>` si la
  variable `CRON_SECRET` existe en el proyecto, que es justo lo que valida la
  ruta.
- **n8n u otro planificador** — una petición `GET` cada 5 minutos a
  `https://<dominio-del-portal>/api/cron/correos` con la cabecera
  `Authorization: Bearer <CRON_SECRET>`.

Prueba manual:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://<dominio-del-portal>/api/cron/correos
# → {"enviados":N,"fallidos":0,"sinClave":false}
```

## 7. Entrar con Google (todos, si ya están registrados)

### 7.1 Consola de Google Cloud

1. <https://console.cloud.google.com> con una cuenta **del Workspace de la
   Fundación** (administrador). Crea un proyecto (p. ej. «Portal GlobalEffect»).
2. **APIs & Services → OAuth consent screen.**
   - **User type: External** y publicada («In production»). Con «Internal»
     solo entrarían cuentas del Workspace y los estudiantes con Gmail
     quedarían fuera. Quien controla el acceso es la tabla `usuario` (§7.4),
     no el tipo de pantalla. Sin publicar, Google solo deja entrar a usuarios
     de prueba.
   - Nombre de la app, correo de soporte, logo y dominio autorizado
     (`globaleffect.org`).
   - Alcances (scopes): `openid`, `email`, `profile`. Nada más.
3. **Credentials → Create credentials → OAuth client ID → Web application.**
   - **Authorized JavaScript origins:** `https://<dominio-del-portal>` y
     `http://localhost:3000`.
   - **Authorized redirect URIs:**
     `https://<PROJECT_REF>.supabase.co/auth/v1/callback`
     (el `PROJECT_REF` está en la URL de Supabase y en `.env.local`).
   - Guarda el **Client ID** y el **Client secret**.

### 7.2 Supabase

**Authentication → Providers → Google → Enable.** Pega el Client ID y el
Client secret. Confirma que las **Redirect URLs** de §3 están cargadas.

### 7.3 Cómo entra la persona

1. En el login toca **Continuar con Google** y elige su cuenta (Workspace o personal).
2. Supabase la devuelve a `/auth/callback`, que canjea el código por la sesión.
3. El callback exige fila activa en `usuario` con ese correo. **El rol lo manda
   la tabla `usuario`**, no Google: crear la cuenta de un administrativo es dar
   de alta su fila con el mismo correo con el que va a entrar.
4. Una cuenta de Google que no esté en `usuario` (o esté inactiva) vuelve al
   login con el aviso «no registrado» y se le cierra la sesión.

### 7.4 Cerrar el autoregistro

1. **Supabase → Authentication → Sign In / Providers → desactivar «Allow new
   users to sign up».** Sin esto, cualquier Gmail crea una identidad en
   Supabase al pulsar el botón de Google. Con esto apagado, Supabase solo deja
   entrar a identidades que **ya existen** (creadas por la invitación).
2. **Al invitar, crear el usuario de Supabase con el mismo correo** que tendrá
   en Google. Supabase vincula la identidad de Google con esa cuenta por correo
   verificado, así que la persona puede usar luego tanto Google como su
   contraseña.
3. `/auth/callback` y el login por contraseña exigen siempre fila **activa** en
   `usuario` (`obtenerUsuarioActual`): es la segunda barrera, por si la primera
   se desconfigura.
4. Dar de baja = `usuario.activo = false`. Se rechaza en la siguiente petición,
   con cualquiera de las dos vías.
5. Prueba obligatoria antes de abrirlo: entrar con un Gmail **no registrado** y
   comprobar que (a) no entra y (b) no aparece una identidad nueva en
   Supabase → Authentication → Users.

## 8. Entrar con correo y contraseña (estudiantes y el resto)

Flujo de alta:

1. Coordinación crea la cuenta (fila en `usuario` + usuario en Supabase Auth)
   con el correo personal de la persona.
2. Le llega el correo **Invite user** (bienvenida, §4) con el botón «Elegir mi
   contraseña».
3. Aterriza en `/establecer-clave`, elige una contraseña de al menos 8
   caracteres y entra.
4. De ahí en adelante entra con correo y contraseña.

> Hoy las cuentas se crean con `scripts/crear-admin-maestro.mjs` /
> `seed-usuarios.mjs`, que usan `generate_link` (devuelven el enlace en vez de
> mandarlo, para no depender del SMTP). Cuando el SMTP de §3 esté activo, el
> alta desde el portal puede usar la invitación normal de Supabase
> (`auth.admin.inviteUserByEmail`) y el correo saldrá solo.

Recuperar contraseña:

1. La persona toca **¿Olvidaste tu contraseña?** (ver pendiente de código).
2. Recibe el correo **Reset password**, toca el botón y elige una nueva en
   `/establecer-clave`.

## 9. Pendiente de código

Estas piezas **no están hechas** y conviene pedirlas como tarea aparte:

- [ ] **«¿Olvidaste tu contraseña?»** en el login: llama a
      `supabase.auth.resetPasswordForEmail(email, { redirectTo: <origen>/establecer-clave })`
      y responde **siempre** igual, exista o no el correo (para no revelar qué
      correos están registrados, igual que el login actual).
- [ ] **Quitar la restricción por dominio/rol que se había propuesto:** la
      decisión es que Google sirve a todos los registrados. Lo que sí hay que
      hacer es el cierre del autoregistro de §7.4 (consola de Supabase) y la
      prueba con un Gmail no registrado.
- [ ] **Ocultar el botón de Google a quien no lo necesita:** no hace falta; los
      dos métodos se muestran a todos.
- [ ] **Alta de usuarios desde el portal con invitación real** (§8).
- [ ] **`vercel.json` con el cron** (§6).

## 9b. Proveedor de correo: Mailgun (decisión) y lo que hay hoy

La Fundación usará **Mailgun** para el correo saliente y el entrante. El código
actual está hecho con **Resend** (`src/server/correos/cola.ts`), así que el
cambio de proveedor es **trabajo de código pendiente**; hasta entonces todo lo
de las secciones 1–6 aplica tal cual a Resend. Lo que cambia con Mailgun:

- **Saliente:** reemplazar la llamada a Resend de `cola.ts` por la API de
  Mailgun (dominio verificado con SPF y DKIM, mismo subdominio
  `mail.globaleffect.org`). La cola, los reintentos y el cron no cambian.
- **Auth de Supabase:** el SMTP de §3 pasa a `smtp.mailgun.org`, con usuario y
  contraseña SMTP del dominio.
- **Entrante:** una **Route** de Mailgun reenvía cada correo recibido a nuestra
  puerta. Ver §9c.

## 9c. La carta mensual del estudiante a su patrocinador

Es el único correo recurrente del sistema. Ya está construido
(`src/server/correos/*`, puerta `/api/correo/entrante`). Recorrido:

1. **El estudiante escribe desde su correo** (Gmail u otro; el mismo que está
   en su expediente) al buzón de la Fundación. Es la razón por la que el
   correo del estudiante debe estar registrado y ser el que usa de verdad.
2. **El sistema la recibe y la guarda primero** (los proveedores reintentan y
   no se debe perder nada). Queda auditada: remitente, fecha, resultado de
   SPF/DKIM/DMARC y cada decisión.
3. **Identifica al estudiante por el remitente.** Como un remitente se puede
   falsificar, si SPF/DKIM/DMARC no están en `pass` la carta se **retiene**.
   Sin estudiante activo con ese correo → `sin_identificar`.
4. **Busca su patrocinador en la base** (asignación activa → correo del
   patrocinador). El destinatario **nunca** sale del texto de la carta. Sin
   patrocinador asignado → `sin_patrocinador`: no se envía nada.
5. **Elly revisa y traduce** al idioma del patrocinador. Una carta por
   estudiante y mes (la segunda queda `duplicado`).
6. **Comprobaciones propias** sobre el texto traducido (enlaces, cifras,
   contenido ajeno). Si algo no cuadra queda `retenido` y lo decide una
   persona.
7. **Si todo pasa, se envía sola** al patrocinador por la cola de correo y la
   carta queda marcada `reenviado`, con su traducción y quién (o qué) la
   aprobó.

Estados de una carta: `sin_identificar`, `sin_patrocinador`, `retenido`,
`duplicado`, `reenviado`. Ante cualquier duda se retiene: nunca se envía por
defecto.

**Para conectar Mailgun (pendiente):** la puerta espera un JSON con
`Authorization: Bearer <CORREO_ENTRANTE_SECRET>`, y la Route de Mailgun envía
un formulario firmado. Hace falta un adaptador (una ruta nueva o un flujo de
n8n) que (a) verifique la firma de Mailgun, (b) convierta los campos
(`sender`, `subject`, `body-plain`, `body-html`, `Message-Id`; verifica los
nombres en la documentación de Mailgun) al JSON de la puerta y (c) traduzca los
resultados SPF/DKIM de Mailgun a `authentication: "pass" | "fail"`. Sin eso, la
autenticación llega como `desconocida` y toda carta se retiene.

## 10. Lista de comprobación

- [ ] Dominio `mail.globaleffect.org` en **Verified** en Resend.
- [ ] `RESEND_API_KEY`, `RESEND_FROM`, `CRON_SECRET` en `.env.local` y en
      producción.
- [ ] SMTP de Resend activo en Supabase Auth.
- [ ] Site URL y Redirect URLs cargadas.
- [ ] Plantillas **Invite user** y **Reset password** en español.
- [ ] Google OAuth: pantalla **External** publicada, cliente creado, proveedor
      activo en Supabase y **registro de usuarios nuevos desactivado** (§7.4).
- [ ] Prueba real: un Gmail **no registrado** no entra ni crea identidad.
- [ ] Prueba real: invitar a una cuenta personal, recibir el correo (revisa
      spam), elegir contraseña, entrar.
- [ ] Prueba real: entrar con una cuenta de Workspace por Google.
- [ ] Prueba real: encolar un correo y ver `enviados: 1` en el cron.
- [ ] Probar que un correo de Resend **no** cae en spam (abre «Mostrar original»
      en Gmail: SPF, DKIM y DMARC en `PASS`).
