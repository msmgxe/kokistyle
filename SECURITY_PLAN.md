# Seguridad — estado y plan · Luxaris Design

> Documento vivo. Última actualización: **22 ago 2026**.
> Sustituye al análisis interno de jul 2026, cuyos hallazgos están resueltos o incorporados aquí.
> Base: auditoría externa del 21 ago 2026 (`architecture-review-2026-08-21.html`), verificada
> hallazgo por hallazgo contra el código antes de actuar.

---

## Dónde estábamos y dónde estamos

El problema no eran los secretos —esos siempre estuvieron del lado servidor— sino que **la
autorización vivía en la interfaz**: la clave pública de Supabase, que viaja en el JavaScript de la
web, abría la base entera. Cualquiera podía leer proyectos, clientes, costos, márgenes, pagos y
facturas sin ninguna credencial.

Comprobado desde fuera, con sólo la clave pública:

| | Antes | Ahora |
|---|---|---|
| `GET /rest/v1/projects` | 11 proyectos con cliente, dirección y presupuesto | `[]` |
| `GET /rest/v1/payments`, `contacts`, `app_users`, `invoices` | todo | `[]` |
| `POST /rest/v1/projects` | creaba filas | **401** |
| Listar el bucket de archivos | catálogo completo, carpeta por carpeta | cerrado |
| Descargar una foto de obra sin credenciales | 147 KB, HTTP 200 | bucket privado, enlace firmado de 1 h |

---

## Fase 0 · Contención — ✅ completada

- Eliminado el PIN de respaldo del código. Estaba en `login`, `change-pin` **y** `set-email`: sin
  fila de configuración daba superadmin y permitía cambiar el PIN real y el correo de recuperación.
- `/api/estimate/send-email` era un relay abierto: cualquiera enviaba correo con adjuntos desde la
  cuenta de la empresa. Ahora exige sesión, valida destinatario y limita el adjunto a 8 MB.
- `/api/voice`, `/api/voice/transcribe` y `/api/design-scope` eran rutas facturables sin ninguna
  verificación. Cerradas.
- Límite por IP en login, cambio y recuperación de PIN, tokens de dispositivo, correo, IA,
  prospectos y renders (`src/lib/rate-limit.ts`).
- `resolveSession()` es el único punto que valida revocación **y** expiración de un token de
  dispositivo. Antes, tres rutas aceptaban tokens caducados.

## Fase 1 · Identidad — ✅ completada

- **Sesión de servidor firmada** (HMAC-SHA256, cookie `httpOnly`) en `src/lib/session.ts`. El PIN se
  canjea al entrar; las rutas dejaron de creerle al cliente.
- **PINes con scrypt** (`src/lib/pin.ts`, ~35 ms por verificación, sin dependencias nuevas). La
  migración es transparente: el PIN en claro se acepta una última vez y se convierte en ese login.
- El navegador dejó de consultar `app_users`: el login de colaborador se resuelve en el servidor y
  el alta/edición pasa por `/api/auth/users`, que hashea.
- **Mínimo de 6 dígitos** para todo PIN nuevo. Cuatro dígitos son 10.000 combinaciones: al ritmo que
  permite el límite por IP se recorren en unas 17 horas. Seis son un millón — más de dos meses.
  Los PINes existentes siguen funcionando; la regla aplica al fijar uno nuevo.

## Fase 2 · RLS y Storage — ✅ completada

La pieza que faltaba era **identidad en el navegador**: RLS decide mirando quién pregunta, y la anon
key no dice quién es nadie. Solución: el servidor firma un JWT que PostgREST entiende
(`src/lib/supabase-jwt.ts`) con `lux_role` y `lux_projects`, y el cliente lo usa con la opción
`accessToken`. **Las ~150 consultas del navegador siguieron funcionando sin tocarlas.**

Scripts por lotes en `sql/fase2-paso*.sql`, cada uno con comprobación y marcha atrás:

| Lote | Qué cierra |
|---|---|
| 1, 1B, 1C | espejo de las políticas para `authenticated` (sin cambiar permisos) |
| 3A | egresos, presupuesto legacy, facturas, órdenes de cambio y agenda → sólo superadmin |
| 3B | pagos que el cliente lee pero no toca; `project_contacts` cerrado, con vista sin montos para el Day Planner |
| 3C | `projects` y sus hijos por `lux_can_see(project_id)` |
| 3D | materiales, contactos y el estimado: lectura de los del proyecto, escritura sólo del superadmin |
| 3E | identidad, auditoría append-only, suscripciones push y reservas |
| 4 | **retirada de las políticas `anon`** — la clave pública deja de abrir la base |
| 5A | fin de la enumeración del bucket de archivos |

`sql/fase2-verificar.sql` impersona los claims de cada rol dentro de una transacción con `ROLLBACK`
y prueba también las escrituras: es la forma de comprobar el aislamiento sin crear usuarios y sin
tocar datos en vivo.

### Reglas que dejó esta fase

1. **Nunca `FOR ALL` con un `USING` permisivo.** `USING` gobierna también el `DELETE`: quien puede
   ver, podría borrar. Una política por comando.
2. **Las vistas no heredan el RLS de la tabla base** — corren con los permisos de su dueño. La
   autorización va explícita en su `WHERE`. Es el patrón para tapar columnas, que RLS no filtra.
3. **`schema.sql` no es la fuente de verdad de las políticas.** Varias se crearon en el dashboard.
   Consultar siempre `pg_policies` y `pg_class` antes de diseñar.
4. **Verificar la función, no el endpoint.** Un PIN de 6 dígitos no entraba en el diálogo de notas
   porque el input capaba a 4; la API respondía perfecto. La prueba tiene que recorrer el camino
   completo.

---

## Lo que queda

### 5B · Storage privado con URLs firmadas — ✅ migrado, falta borrar los originales

Bucket `luxaris-privado` (sin acceso público) para `project-photos/` y `notes/`. En la base se
guardan referencias `priv:<ruta>` y se sirven con enlaces firmados de una hora, pedidos en lote por
galería. Las URLs públicas antiguas se resuelven igual: **conviven**, y por eso la migración pudo
hacerse sin apagar nada.

Tres correcciones en el camino, todas por verificar de menos: las portadas no siempre están en la
galería (hay que copiar el archivo, no sólo reescribir la referencia) y se guardan con `?v=<ts>`
para saltarse la caché del CDN, query que acabó dentro de la ruta. `resolveFileUrls` cae ahora a la
copia pública si un archivo no se puede firmar, para que un fallo de migración no deje la app sin
imágenes.

**Falta el último paso**: `POST /api/storage/migrate?borrar=1` retira los originales del bucket
público. Hasta entonces, quien tenga una URL vieja sigue pudiendo abrirla.

### El margen fuera de la vista del cliente — ✅ hecho, falta la limpieza

`cost` y `profit` vivían junto al precio del cliente en `estimate_items`, y RLS no filtra columnas.
Ahora están en `estimate_item_costs`, con RLS de sólo superadmin (`sql/fase2-costos.sql`). Las
columnas viejas siguen ahí de respaldo hasta correr `sql/fase2-costos-limpieza.sql`; **hasta
entonces el margen sigue siendo legible** por quien vea el estimado.

### Fase 3 · Calidad — ✅ la red; falta la deuda

- **44 pruebas** con el runner de Node y *type stripping*: cero dependencias nuevas. Cubren el
  calendario de pagos, `pdfSafe`, los overrides de la orden de cambio, la generación real del PDF y
  la sesión firmada frente a manipulación, expiración y escalada de rol.
- **Trinquete de lint** (`scripts/lint-ratchet.mjs`): la deuda vieja se tolera, la nueva bloquea.
  Ya se ganó el sueldo — cazó un `useFileUrls` llamado después de un `return` condicional.
- **CI** (`.github/workflows/ci.yml`): tipos, pruebas, trinquete y build en cada push.
- Pendiente: los **47 errores de lint** (mayoría `setState` dentro de efectos) y dividir el detalle
  de proyecto en hooks por dominio.

### Fase 4 · Operación — en curso

- ✅ **La auditoría la escribe el servidor.** `logActivity()` va por `POST /api/activity`, que
  deriva el actor de la sesión firmada; lo que mande el cliente sobre quién actúa se ignora. Con
  `sql/fase4-auditoria.sql` se le retira al navegador el permiso de escribir directo.
- ✅ **Índices por proyecto** (`sql/fase4-indices.sql`): Postgres no indexa las claves foráneas solo,
  y ahora cada consulta filtra por proyecto — las políticas evalúan `lux_can_see(project_id)` fila a
  fila.
- Pendiente: mover también `voice_actions` (el registro de Katy) a una ruta de servidor.
- Trazas y alertas de error y de gasto de IA.
- Índices según las consultas reales; caché/ISR en la landing.
- Migrar de las API keys legacy (`anon`/`service_role`) a las nuevas (`sb_publishable_`/`sb_secret_`).
  **Hasta entonces no se puede revocar la llave HS256 legacy**: de ella dependen las keys actuales.

---

## Pendientes del lado de Marco

Los tres primeros son los que todavía dejan una puerta abierta:

- [ ] **`POST /api/storage/migrate?borrar=1`** — retira las copias públicas de las fotos y adjuntos.
      Hasta hacerlo, quien tenga una URL vieja sigue abriéndola.
- [ ] **`sql/fase2-costos-limpieza.sql`** — borra `cost` y `profit` de `estimate_items`. Hasta
      entonces el margen sigue legible para quien vea el estimado.
- [ ] **`sql/fase4-auditoria.sql`** — quita al navegador el permiso de escribir en el registro.
      Correr después de que el despliegue de hoy esté arriba.
- [ ] `sql/fase4-indices.sql` — índices por proyecto (rendimiento, no seguridad).
- [ ] Rotar la App Password de Yahoo — el relay de correo estuvo abierto.
- [ ] `SESSION_SECRET` en Vercel (opcional; hoy la firma usa material de la service role).
      Ojo: al añadirla se cierran las sesiones abiertas.
- [ ] **No revocar** la llave `360D2684…` (Legacy HS256) hasta migrar a las API keys nuevas
      (`sb_publishable_` / `sb_secret_`): de ella dependen las claves `anon` y `service_role`
      actuales, y también el token que firma el panel.
