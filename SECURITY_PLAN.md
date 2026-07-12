# Análisis de seguridad y plan de endurecimiento — Luxaris Design

> Auditoría de código realizada en jul 2026 sobre la rama `main`. Este documento resume los
> hallazgos y propone un plan de implementación por fases. **No** contiene secretos ni PINs reales.

---

## Resumen ejecutivo

La app funciona hoy sobre la **clave pública `anon` de Supabase** (`NEXT_PUBLIC_SUPABASE_ANON_KEY`),
que por diseño viaja en el bundle del navegador. Como varias tablas tienen políticas permisivas
(`anon_all FOR ALL`) o RLS sin habilitar, esos datos quedan accesibles para cualquiera que abra las
herramientas de desarrollador. **No es un bug puntual — es el modelo de acceso lo que hay que endurecer.**

La buena noticia: la parte más sensible ya está bien hecha (claves privadas solo en servidor, PIN del
superadmin verificado server-side, tokens de dispositivo con RLS cerrada, cron con secreto). El trabajo
pendiente es principalmente **mover el resto del acceso al mismo estándar**.

Prioridad: **C (crítico) → H (alto) → M (medio)**. Ninguna corrección rompe funcionalidad para el usuario
final; son cambios de backend + políticas SQL.

---

## Controles YA implementados (base sólida)

- ✅ `service_role` y demás secretos (SMTP Yahoo, VAPID, Resend, Replicate, Anthropic) **solo en servidor** — `supabase-admin` se importa exclusivamente bajo `src/app/api/`.
- ✅ PIN del superadmin verificado **server-side** vía `/api/auth/login`; nunca se compara en el navegador.
- ✅ `superadmin_config` y `device_tokens` tienen **RLS cerrada sin política anon** — solo accesibles por `service_role`.
- ✅ Tokens de dispositivo: aleatorios (`crypto.randomBytes(24)`), revocables, revalidados en cada apertura, con expiración.
- ✅ `/api/agenda/remind` protegido con `Bearer CRON_SECRET` — **este es el patrón a replicar** en las demás rutas.
- ✅ Recuperación de PIN no revela si el correo existe; el código expira en 15 min; las rutas mutantes re-verifican el PIN.
- ✅ Sin claves API hardcodeadas en `src/` (todas por `process.env`).

---

## Hallazgos

### 🔴 CRÍTICO

| # | Hallazgo | Evidencia | Impacto |
|---|---|---|---|
| **C1** | Login de colaboradores consulta `app_users` **desde el navegador** con la anon key comparando `pin` en texto plano. Implica que `app_users` es legible por cualquiera → se puede volcar la tabla con los PINs. | `AuthContext.tsx` (login colaborador), `UsersPanel.tsx` (PIN plaintext) | Robo de credenciales de todo el equipo |
| **C2** | Tablas de negocio sin RLS habilitada: `projects, contacts, tasks, materials, payments, expenses, project_notes, budget_items…` | `schema.sql` bloques 1–10 | Cualquier visitante lee/edita/borra finanzas, PII de clientes y **costos/ganancia internos** |
| **C3** | ~~`/api/design-render` sin autenticación~~ **MITIGADO (jul 2026)** | `api/design-render/route.ts` | El endpoint ahora exige un **prospecto válido** con límite `FREE_RENDER_LIMIT` (default 3), o credencial de superadmin para uso interno. Ya no es invocable de forma anónima ilimitada. Pendiente reforzar con rate-limit por IP en Fase 1. |
| **C4** | `/api/estimate/send-email` es un **relay de correo abierto** — cualquiera envía correos desde tu cuenta Yahoo con `to`/`asunto`/`cuerpo`/PDF arbitrarios | `api/estimate/send-email/route.ts` | Spam/abuso desde tu dominio, sin límite de tamaño del PDF |
| **C5** | `/api/voice` sin autenticación | `api/voice/route.ts` | Abuso de facturación del modelo Claude |

### 🟠 ALTO

| # | Hallazgo | Impacto |
|---|---|---|
| **H1** | PIN de superadmin de respaldo **hardcodeado** en el código como fallback si la config no está sembrada | Login admin total si `superadmin_config` queda sin PIN |
| **H2** | Sin rate limiting ni bloqueo por intentos en **ningún** endpoint de auth; el PIN es numérico corto → fuerza bruta | Adivinación del PIN |
| **H3** | Tablas de auditoría (`activity_log`, `voice_actions`) y `push_subscriptions`, `agenda_events` con `anon_all` y campos de identidad de texto libre | El registro de auditoría es falsificable/borrable — no confiable |

### 🟡 MEDIO

| # | Hallazgo | Impacto |
|---|---|---|
| **M1** | Bucket `kokistyle-files` público con subida anónima, sin políticas de storage | Cualquiera sube/lee objetos (fotos, adjuntos) por URL |
| **M2** | Ruta de subida usa la extensión del archivo del cliente sin validar | Content-type arbitrario |
| **M3** | Rutas API sin verificación de origen (CORS/método) | Sumado a C3/C4/C5, invocables desde cualquier origen |

### ⚪ BAJO
- **L1** El objeto de sesión (con `pin` del superadmin) se guarda en `sessionStorage`/`localStorage` → legible por XSS.
- **L2** Algunas rutas devuelven el texto de error del proveedor upstream al cliente.

---

## Plan de implementación por fases

### Fase 1 — Cerrar el abuso de APIs de costo *(1 día · sin cambios de datos)*
Ataca C3, C4, C5, M3. Es lo más barato y detiene sangría de facturación/spam de inmediato.
1. Crear un helper `requireSession(req)` server-side que exija el mismo patrón que el cron: un header
   `Authorization: Bearer <token de sesión>` o el token de dispositivo validado contra `device_tokens`.
2. Aplicarlo al inicio de `/api/voice`, `/api/design-render`, `/api/estimate/send-email`.
3. En `send-email`: validar tamaño de `pdfBase64` (p.ej. ≤ 8 MB), formato de `to`, y sanitizar el `subject`.
4. Devolver errores genéricos al cliente (L2).

### Fase 2 — Autenticación real de Supabase + RLS *(3–5 días · el cambio estructural)*
Ataca C1, C2, H3, M1. Es el corazón del endurecimiento.
1. **Adoptar Supabase Auth** (email mágico o usuario/clave server-side) para emitir JWTs por usuario, en
   lugar de operar todo con la anon key. El PIN sigue siendo la UX de entrada, pero detrás se canjea por una sesión real.
2. **Habilitar RLS en todas las tablas de negocio** con políticas por rol: el superadmin ve todo; el
   colaborador solo sus proyectos asignados (`user_project_access`); el cliente solo lectura de su proyecto sin finanzas.
3. Mover el login de colaboradores a una **API route server-side** (como ya está el del superadmin) — el navegador nunca vuelve a leer `app_users`.
4. `activity_log`/`voice_actions`: política **solo INSERT** para anon, sin UPDATE/DELETE; el `user_id` lo pone el servidor, no el cliente.

### Fase 3 — Credenciales robustas *(1–2 días)*
Ataca C1 (parte 2), H1, H2, L1.
1. **Hash de PINs con bcrypt** en `app_users` y `superadmin_config`; comparación con `bcrypt.compare` server-side.
2. Eliminar el **PIN de respaldo hardcodeado**; si la config no existe, forzar un flujo de siembra seguro.
3. **Rate limiting** por IP en los endpoints de auth (p.ej. Upstash Redis o un contador en Postgres): backoff progresivo + bloqueo temporal tras N intentos.
4. Sacar el `pin` del objeto de sesión que se guarda en web storage.

### Fase 4 — Storage y detalles *(1 día)*
Ataca M1, M2.
1. Convertir `kokistyle-files` en **bucket privado** con **URLs firmadas** de vida corta para lectura.
2. Políticas de storage: subida solo para usuarios autenticados; validar extensión/content-type contra una allowlist.

---

## Nota sobre módulos nuevos (Equipo / Asignaciones — jul 2026)

El módulo **Equipo** (`/proyectos/equipo`, matriz de asignación + reportes) escribe montos por co-worker en
`project_contacts`. Mitigaciones aplicadas dentro del modelo actual: la página está **gateada a superadmin**
(`isSuperAdmin`) y las asignaciones se **auditan** en `activity_log`. Sin embargo, `project_contacts` sigue
operando con la anon key como el resto del negocio, por lo que hereda **C2** — su endurecimiento definitivo
(RLS por rol para que los montos internos no sean legibles con la clave pública) forma parte de la **Fase 2**.
No se introdujo ninguna vulnerabilidad nueva; sí un dato financiero más que la Fase 2 debe cubrir.

## Cómo priorizar si el tiempo es limitado

- **Esta semana:** Fase 1 completa (detiene abuso de facturación y el relay de correo — el riesgo más "explotable hoy").
- **Este mes:** Fase 2 (RLS + auth real — cierra la exposición de datos, que es la más grave a largo plazo).
- **Siguiente iteración:** Fases 3 y 4.

Ninguna fase cambia lo que ve el usuario final; son capas de protección por debajo. Cuando quieras arrancar,
empezamos por la Fase 1 que es la de mayor impacto por menor esfuerzo.

---

## Nota sobre el conector de Supabase

El conector de Supabase en claude.ai requiere autorización en los ajustes de conectores para que yo pueda
inspeccionar/aplicar políticas RLS directamente. Sin eso, entrego el SQL para que lo ejecutes tú en el editor de Supabase.
