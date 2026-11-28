# Qué configurar para probar acceso y correo (28 nov 2026)

Lista de lo que hay que hacer **fuera del código**, en orden. Detalle y razones en
[`docs/referencia/correo-y-acceso-resend.md`](../referencia/correo-y-acceso-resend.md).
Los nombres de menú de cada consola cambian con el tiempo: busca el equivalente.

Variables que se usan (en `.env.local` y en Vercel):

| Variable | De dónde sale |
|---|---|
| `RESEND_API_KEY` | Resend → API Keys (permiso de envío **y** lectura de correos recibidos) |
| `RESEND_FROM` | `Global Effect <noreply@mail.globaleffect.org>` |
| `RESEND_WEBHOOK_SECRET` | Resend → Webhooks → Signing secret (`whsec_…`) |
| `CRON_SECRET` | `openssl rand -hex 32` |
| `CORREO_ENTRANTE_SECRET` | `openssl rand -hex 32` (solo si se usa la puerta genérica) |
| `GEMINI_API_KEY` | Elly AI: clasifica y traduce las cartas |

## 1. Resend

- [ ] Cuenta con un correo de la Fundación.
- [ ] **Domains → Add Domain** `mail.globaleffect.org` (subdominio, no el raíz). Crear en el DNS los registros SPF, MX y DKIM que muestre. Esperar **Verified**.
- [ ] DMARC en `_dmarc.globaleffect.org` si no existe: `v=DMARC1; p=none; rua=mailto:<correo>`.
- [ ] **API Key** con envío y lectura de recibidos → `RESEND_API_KEY`.
- [ ] **Recepción (cartas):** activar *Receiving* en un subdominio aparte, p. ej. `cartas.globaleffect.org`, y crear su MX. **No** en el dominio raíz (rompería Google Workspace).
- [ ] **Webhooks → Add:** URL `https://<dominio-del-portal>/api/correo/resend`, evento `email.received`. Copiar el *Signing secret* → `RESEND_WEBHOOK_SECRET`.
- [ ] Mientras el dominio no esté verificado solo se puede enviar a tu propio correo desde `onboarding@resend.dev`: sirve para probar, no para usuarios reales.

## 2. Supabase

- [ ] **Authentication → Sign In / Providers → desactivar «Allow new users to sign up»** (cierra el autoregistro; es la brecha a cuidar).
- [ ] **Providers → Google → Enable:** pegar Client ID y Client secret (paso 3).
- [ ] **Project Settings → Authentication → SMTP → Custom SMTP:** host `smtp.resend.com`, puerto `465`, usuario `resend`, contraseña = `RESEND_API_KEY`, remitente `noreply@mail.globaleffect.org`.
- [ ] **URL Configuration:** Site URL = URL de producción. Redirect URLs: `…/auth/callback` y `…/establecer-clave` (producción y `http://localhost:3000`).
- [ ] **Email Templates:** pegar el HTML en español de la guía (§4) en *Invite user* y *Reset password*.
- [ ] **Rate Limits:** subir el límite de correos por hora si habrá altas masivas.

## 3. Google Cloud (para el botón de Google)

- [ ] Proyecto → **OAuth consent screen**: tipo **External**, publicada («In production»), scopes `openid`, `email`, `profile`.
- [ ] **Credentials → OAuth client ID → Web:** origen `https://<dominio-del-portal>` y `http://localhost:3000`; redirect URI `https://<PROJECT_REF>.supabase.co/auth/v1/callback`. Guardar Client ID y secret.

## 4. Vercel

- [ ] Cargar las variables de la tabla de arriba (Production y Preview).
- [ ] `vercel.json` ya está en el repo con el cron `*/5 * * * *` hacia `/api/cron/correos`. Los crons de cada 5 min **no** funcionan en el plan Hobby (solo diarios): si es Hobby, usar un planificador externo (n8n) que llame con `Authorization: Bearer <CRON_SECRET>`.
- [ ] Redeploy tras cambiar variables.

## 5. Pruebas, en este orden

1. [ ] **Cola saliente:** encolar un correo y `curl -H "Authorization: Bearer $CRON_SECRET" https://<dominio>/api/cron/correos` → `enviados: 1`.
2. [ ] **Invitación:** invitar una cuenta personal, recibir el correo (revisar spam; en «Mostrar original» SPF/DKIM/DMARC en `PASS`), elegir contraseña y entrar.
3. [ ] **Google, registrado:** entrar con Google con ese mismo correo → entra con su rol.
4. [ ] **Google, NO registrado:** entrar con un Gmail que no esté en el sistema → vuelve al login con «no registrado» **y no aparece** en Supabase → Authentication → Users.
5. [ ] **Baja:** desactivar a la persona (`activo = false`) → ya no entra por ninguna vía.
6. [ ] **Carta mensual:** estudiante de prueba **con patrocinador activo** escribe a la dirección de cartas desde su correo registrado → en `/patrocinadores/correos` queda `reenviado` (el patrocinador la recibe traducida) o `retenido` con su motivo.
7. [ ] **Casos de rechazo:** remitente no registrado → `sin_identificar`; estudiante sin patrocinador → `sin_patrocinador`; segunda carta del mes → `duplicado`.

## Pendiente de verificar con un correo real

- Que la API de recepción de Resend devuelva la cabecera `Authentication-Results`. Si no la trae, toda carta llega como «desconocida» y se **retiene** (es la salida segura, pero habría que aprobarlas a mano).
