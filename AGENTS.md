# Luxaris Design — Documentación de implementación y guía para agentes IA

> **Empresa:** Luxaris Design LLC  
> **Mercado:** Florida, USA (South Florida · Miami · Boca Raton)  
> **URL producción:** kokistyle.vercel.app  
> **Repo:** github.com/msmgxe/kokistyle  

---

## Descripción del proyecto

Plataforma premium de gestión de proyectos de remodelación y construcción. Tiene dos capas:

1. **Landing pública** (`/`) — marketing, servicios, before/after, tours virtuales
2. **Panel privado** (`/proyectos/...`) — gestión de proyectos por PIN, acceso con roles

---

## Tech Stack

| Tecnología | Versión | Uso |
|---|---|---|
| Next.js | 15 (App Router) | Framework principal |
| TypeScript | 5.x | Tipado estático en todo el proyecto |
| TailwindCSS | v4 | Único sistema de estilos — sin CSS externo |
| Framer Motion | — | Animaciones en landing |
| Supabase | Postgres + Storage | Base de datos y archivos adjuntos |
| Resend | — | Envío de correos (recuperación de PIN) |
| Vercel | — | Despliegue, variables de entorno, CI/CD |
| pnpm | — | Gestor de paquetes |
| @dnd-kit | — | Drag & drop en Kanban y Day Planner |
| jsPDF | — | Generación de PDF del estimado (`src/lib/pdf.ts`) |
| lucide-react | — | Íconos SVG |

---

## Comandos

```bash
pnpm install        # Instalar dependencias
pnpm dev            # Servidor de desarrollo (localhost:3000)
pnpm build          # Build de producción
pnpm tsc --noEmit   # Verificar tipos sin compilar
```

---

## Variables de entorno

```env
# .env.local — nunca en git
NEXT_PUBLIC_SUPABASE_URL=       # Supabase → Settings → API → Project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=  # Supabase → Settings → API → anon/public
SUPABASE_SERVICE_ROLE_KEY=      # Supabase → Settings → API → service_role (SOLO server)
RESEND_API_KEY=                 # resend.com → API Keys
ANTHROPIC_API_KEY=              # console.anthropic.com → API Keys (asistente de voz)
REPLICATE_API_TOKEN=            # replicate.com → Account → API Tokens (Design tab img2img)
NEXT_PUBLIC_VAPID_PUBLIC_KEY=   # npx web-push generate-vapid-keys (avisos push de Agenda)
VAPID_PRIVATE_KEY=              # par privado de la anterior (SOLO server)
CRON_SECRET=                    # secreto del cron /api/agenda/remind (Vercel lo envía como Bearer)
```

---

## Estructura de carpetas

```
src/
├── app/
│   ├── page.tsx                      # Landing pública (Hero · Services · Before/After · Tours)
│   ├── proyectos/
│   │   ├── layout.tsx                # Layout del panel: nav top, logout, VoiceFAB, LangSwitch
│   │   ├── page.tsx                  # Dashboard de proyectos (lista + KPIs + eliminar proyecto)
│   │   ├── [id]/page.tsx             # Detalle de proyecto — tabs: Estimate · Cash Flow · Day Planner · Workflow · Gantt · Materials · Contacts · Notes · Design
│   │   ├── agenda/page.tsx           # Agenda personal del admin — citas/tasks/reuniones + captura por voz + .ics (solo superadmin)
│   │   ├── contactos/page.tsx        # Lista global de contactos (todos los proyectos)
│   │   ├── plan/page.tsx             # Gantt G global (todas las tareas, orden por start_date asc)
│   │   ├── activity/page.tsx         # Registro de actividad — solo superadmin (login, create, update, delete)
│   │   ├── reservas/page.tsx         # Admin de reservas online (tabla bookings) — solo superadmin
│   │   └── help/page.tsx             # Página de ayuda — guía paso a paso bilingüe (EN/ES)
│   ├── acceso/[token]/page.tsx       # Login automático por token de dispositivo → redirige a /proyectos
│   └── api/
│       ├── voice/route.ts            # Asistente de voz Katy (Claude API → intención → acción)
│       ├── agenda/remind/route.ts    # Motor de avisos push (cron cada 15 min, Bearer CRON_SECRET)
│       └── auth/
│           ├── login/route.ts        # Verificar PIN superadmin (server-side, no expone PIN) — retorna name
│           ├── change-pin/route.ts   # Cambiar PIN superadmin
│           ├── recover/route.ts      # Enviar código 6 dígitos al correo (Resend)
│           ├── reset-pin/route.ts    # Verificar código y actualizar PIN
│           ├── set-email/route.ts    # Guardar correo de recuperación del superadmin
│           ├── set-name/route.ts     # Actualizar nombre de display del superadmin (verifica PIN, server-side)
│           ├── device-tokens/route.ts # Crear/listar/revocar tokens de dispositivo (op: create|list|revoke, verifica PIN)
│           └── device-login/route.ts # Validar token de dispositivo y retornar la sesión (server-side)
│
├── components/
│   ├── layout/
│   │   ├── Navbar.tsx                # Navbar landing: logo · nav links · lang switch · Login
│   │   └── Footer.tsx                # Footer landing
│   ├── sections/                     # Secciones de la landing (solo lectura, no admin)
│   │   ├── Hero.tsx
│   │   ├── Services.tsx
│   │   └── BeforeAfter.tsx
│   ├── tours/
│   │   └── VirtualTour.tsx           # Visor 360° embed en landing
│   └── ui/
│       ├── AdminModal.tsx            # Modal de login por PIN (superadmin + colaboradores + recuperación)
│       ├── AdminSettings.tsx         # Panel cambio de PIN + correo de recuperación + nombre de display
│       ├── UsersPanel.tsx            # Gestión de equipo: co-workers + clientes, tab_access, contact_id, my_tasks_only
│       ├── VoiceFAB.tsx              # Asistente de voz flotante "Katy" (bottom-right)
│       ├── ProjectFormModal.tsx      # Crear/editar proyecto
│       ├── DayPlannerModal.tsx       # Day Planner drag-and-drop Estimate→Workflow (@dnd-kit)
│       ├── EstimateTab.tsx           # Tab de estimado — layout de sub-tabs: 📐 Sections + 💰 Payment Schedule; cabecera dark con WA/Copy/PDF/Save; FAB flotante eliminado
│       ├── Button.tsx                # Botón reutilizable
│       └── Container.tsx             # Contenedor de ancho máximo
│
├── config/
│   ├── branding.ts                   # Datos de la empresa (nombre, teléfono, iniciales, etc.)
│   └── translations.ts               # Traducciones EN + ES — usado por useLanguage()
│
├── context/
│   ├── AuthContext.tsx               # Autenticación, roles, permisos, bloqueo biométrico — PIN: sessionStorage · token: localStorage revalidado
│   ├── LanguageContext.tsx           # Idioma activo (en | es) — persiste en localStorage
│   └── VoiceContext.tsx              # Contexto activo de proyecto/tab para el asistente Katy
│
├── lib/
│   ├── supabase.ts                   # Cliente Supabase con anon key (browser)
│   ├── supabase-admin.ts             # Cliente Supabase con service_role (SOLO en API routes)
│   ├── pdf.ts                        # PDF del estimado (jsPDF) — buildEstimatePdf() interno + exportEstimatePdf() + getEstimatePdfBlob()
│   ├── activity.ts                   # logActivity() — fire-and-forget insert en activity_log
│   ├── schema.sql                    # Schema completo de la base de datos (ejecutar en orden)
│   └── utils.ts                      # money(), formatDate(), todayIso(), addDays()
│
└── types/
    ├── project.ts                    # Project, Task, Material, Payment, Expense, Contact, Estimate*
    ├── auth.ts                       # AppUser, Permission, AuthState
    ├── agenda.ts                     # AgendaEvent, DeviceToken
    └── booking.ts                    # Booking, BookingStatus (reservas online)
```

> **Eliminado (jul 2026):** El tour demo `cliente-01` (página, `Cliente01Showcase`, `Bathroom360Viewer`, `config/cliente01.ts`) y su link "Bathroom 360°" del Navbar fueron removidos por estar fuera de uso.

---

## Base de datos (Supabase Postgres)

Schema completo en `src/lib/schema.sql`. Ejecutar en el orden indicado en el archivo (7 bloques).

### Tablas del panel de gestión

| Tabla | Descripción |
|---|---|
| `projects` | Proyectos de remodelación |
| `contacts` | Especialistas y proveedores (global) |
| `project_contacts` | Relación N:M proyectos ↔ contactos |
| `tasks` | Tareas por proyecto (Kanban/Gantt) |
| `materials` | Materiales con checkbox "comprado" |
| `payments` | Ingresos recibidos del cliente |
| `expenses` | Egresos pagados a proveedores |
| `project_notes` | Notas con adjuntos JSONB por proyecto |
| `app_users` | Colaboradores con permisos granulares |
| `user_project_access` | Proyectos asignados por colaborador |
| `superadmin_config` | PIN + email del superadmin (singleton) |
| `voice_actions` | Auditoría de todos los comandos del asistente Katy |
| `bookings` | Reservas online del formulario público (admin en `/proyectos/reservas`) |
| `agenda_events` | Agenda personal del admin (citas, tasks, reuniones con recordatorios) |
| `device_tokens` | Tokens de acceso directo sin PIN — **sin política anon**, solo service_role |
| `push_subscriptions` | Suscripciones Web Push por dispositivo (avisos de la Agenda) |

### Tablas del módulo Estimate

| Tabla | Descripción |
|---|---|
| `estimate_section_catalog` | Catálogo de secciones predefinidas (seed incluido) |
| `estimate_item_catalog` | Catálogo de items por sección (seed incluido) |
| `project_estimates` | Estimado por proyecto (1:1) |
| `estimate_sections` | Secciones del estimado (N:1 → project_estimates) |
| `estimate_items` | Items dentro de cada sección |

### Estimate → Workflow (Day Planner)

- El Day Planner se abre desde EstimateTab → botón "Generate Workflow Tasks".
- Al abrir, **carga las tareas existentes** (`source IN ('estimate','planner')`) y pre-popula los day columns desde `scheduled_date`.
- El usuario arrastra items entre columnas; al presionar **Save** se hace:
  - `INSERT` para ítems asignados sin taskId todavía
  - `UPDATE scheduled_date` para ítems ya guardados que cambiaron de día
  - `UPDATE scheduled_date = null` para ítems devueltos al pool
- **Custom items**: el pool tiene un botón "+ Add custom item" que abre un mini-formulario (descripción, sección tag, horas, monto). Se guardan con `source = 'planner'` y `source_key = 'planner-custom:<uuid>'`.
- Campos usados en `tasks` para trazabilidad y planificación:
  - `scheduled_date` — fecha editable/reprogramable de la actividad
  - `estimate_item_id` — vínculo al item de Estimate cuando existe
  - `estimate_section_id` — vínculo a la sección del Estimate
  - `source` — `'estimate'` para items del estimado, `'planner'` para custom, `'manual'` para tareas del Workflow directo
  - `source_key` — llave estable para upsert; unique index en `(project_id, source_key) WHERE source_key IS NOT NULL`
  - `source_section` — etiqueta visible de sección (Demolition, Plumbing, etc.)
  - `amount` — monto del item para contexto operativo
- Workflow y Plan tabs se refrescan automáticamente después del Save (`onGenerated → fetchProject`).
- Para reprogramar: abrir la tarjeta de Workflow y editar **Scheduled date / Fecha programada**. El Plan/Gantt respeta esa fecha.

### Tab Workflow — métricas resumen

El tab Workflow muestra 4 KPI cards en la parte superior:
- **Total tasks** — todas las tareas del proyecto
- **From estimate** — tareas con `source = 'estimate'` o `'planner'`
- **Completed** — tareas con `status = 'done'`
- **Progress %** — `done / total * 100` con barra visual

Migración SQL requerida si estas columnas no existen:
```sql
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS scheduled_date DATE;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual';
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS source_key TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS source_section TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS amount NUMERIC(12,2) NOT NULL DEFAULT 0;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS estimate_item_id UUID REFERENCES estimate_items(id) ON DELETE SET NULL;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS estimate_section_id UUID REFERENCES estimate_sections(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS tasks_project_source_key_idx
  ON tasks(project_id, source_key)
  WHERE source_key IS NOT NULL;
```

### Lógica de totales del Estimate

- `section_total` = total plano editable de la sección
- Si algún item de la sección tiene `amount > 0` → el total efectivo es la **suma de items** (anula `section_total`)
- Si ningún item tiene monto → se usa `section_total` directamente
- Las secciones marcadas `is_material_type = true` quedan **excluidas** del descuento de mano de obra

### Checkboxes por sección (`estimate_sections`)

Cada sección tiene **dos checkboxes independientes** en el encabezado:

| Campo | Checkbox UI | Semántica |
|---|---|---|
| `material_included` | **Mat. incl.** (verde) | Informativo — indica que el precio ya incluye el costo de materiales (p.ej. PLOMERÍA con material incluido). No afecta cálculos. |
| `is_material_type` | **Labor %** (azul) | Computacional — `false` = la sección entra al labor subtotal y al descuento; `true` = excluida. Se invierte en UI: checked = incluida en mano de obra. |

Migración SQL requerida si la columna `material_included` no existe aún:
```sql
ALTER TABLE estimate_sections ADD COLUMN IF NOT EXISTS material_included BOOLEAN NOT NULL DEFAULT false;
```

### Sincronización Estimate → Dashboard

- El dashboard usa `enrichWithEstimateBudgets()` en `page.tsx` — hace dos queries separadas:
  1. `project_estimates` → filtra por `project_id IN [...]`
  2. `estimate_sections` + `estimate_items` → filtra por `estimate_id IN [...]`
- Calcula `grand_total` client-side con la misma lógica que `computeGrandTotal()` en `EstimateTab.tsx`
- Si el proyecto no tiene estimate, se usa `project.budget` como fallback
- También se sincroniza `project.budget` en la DB cuando el EstimateTab carga (`load()`) o el usuario guarda (`saveHeader()`)
- **Nota:** evitar nested Supabase selects de 3+ niveles (PostgREST devuelve null silenciosamente) — usar queries explícitas con `.in()`

### PDF del estimado (`src/lib/pdf.ts`)

- **`buildEstimatePdf()`** — función interna que genera el jsPDF doc. Diseño "Opción A":
  - Cabecera centrada: badge ESTIMATE, nombre empresa, slogan, teléfono+email, línea divisora teal
  - Barra oscura con nombre completo del proyecto en blanco
  - Bloque PROPOSAL (crema) en 2 columnas: cliente izquierda / contratista+fechas derecha
  - Header de tabla oscuro
  - Por sección: borde izquierdo de color (teal=labor, rojo=material) + items en 2 columnas (pares)
  - **Payment Schedule a la izquierda** · **Descuento + Grand Total a la derecha** (Grand Total anclado a la línea inferior del rectángulo del Payment Schedule)
  - Footer con divider + texto del contratista centrado
- **`exportEstimatePdf()`** — llama `buildEstimatePdf()` y hace `doc.save()` (descarga)
- **`getEstimatePdfBlob()`** — llama `buildEstimatePdf()` y devuelve `Blob` (para WhatsApp)

### WhatsApp PDF send (`EstimateTab.tsx`)

- Botón compacto **WA** (verde, `bg-[#1BAD4E]`) en la cabecera oscura del Estimate
  - Si no hay número configurado → al clic se despliega el formulario (`showWaForm` state) con selector de país + input + botón Enviar PDF
  - Si ya hay número guardado → al clic envía directamente sin abrir el formulario
- Campos: selector de código de país (🇺🇸 +1, 🇲🇽 +52, 🇨🇴 +57, 🇻🇪 +58, 🇦🇷 +54, 🇪🇸 +34) + input de número (formato US auto) + botón verde Send
- En **móvil** (iOS/Android): usa `navigator.share({ files: [pdfFile] })` — WhatsApp aparece en el menú nativo con el PDF adjunto
- En **desktop**: descarga el PDF + abre `https://wa.me/<number>` en nueva pestaña + toast explicativo
- El número final se construye como `waCode + waPhone` limpiando caracteres no numéricos

### Módulo Materials — Import desde Estimate

- Botón azul **"Import from Estimate / Importar del Estimado"** en la parte superior del tab Materials.
- Al presionar, carga todas las `estimate_sections` + `estimate_items` del estimado del proyecto y crea un registro en `materials` por cada item:
  - `name` = `"Compra de [item.description]"` (independiente del idioma de la UI)
  - `estimate_item_id` → vínculo al item de origen
  - `estimate_section_id` → vínculo a la sección de origen
- Deduplicación: si ya existe un material con ese `estimate_item_id` en el proyecto, se omite (índice único).
- Cards muestran una etiqueta **FROM EST / DEL EST** (azul) cuando `estimate_item_id IS NOT NULL`.
- Campos nuevos en la tabla `materials`:

| Campo | Tipo | Descripción |
|---|---|---|
| `quantity` | `NUMERIC(10,2)` | Cantidad (ej. 50) |
| `unit` | `TEXT` | Unidad de medida (ej. sq.ft, unit, box) |
| `notes` | `TEXT` | Notas de compra en texto libre |
| `purchase_date` | `DATE` | Fecha en que se realizó la compra |
| `estimate_item_id` | `UUID` | FK → `estimate_items(id)` ON DELETE SET NULL |
| `estimate_section_id` | `UUID` | FK → `estimate_sections(id)` ON DELETE SET NULL |

Migración SQL requerida:
```sql
ALTER TABLE materials ADD COLUMN IF NOT EXISTS quantity       NUMERIC(10,2);
ALTER TABLE materials ADD COLUMN IF NOT EXISTS unit           TEXT;
ALTER TABLE materials ADD COLUMN IF NOT EXISTS notes          TEXT;
ALTER TABLE materials ADD COLUMN IF NOT EXISTS purchase_date  DATE;
ALTER TABLE materials ADD COLUMN IF NOT EXISTS estimate_item_id
  UUID REFERENCES estimate_items(id) ON DELETE SET NULL;
ALTER TABLE materials ADD COLUMN IF NOT EXISTS estimate_section_id
  UUID REFERENCES estimate_sections(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS materials_project_estimate_item_idx
  ON materials(project_id, estimate_item_id)
  WHERE estimate_item_id IS NOT NULL;
```

- El formulario de edición de material incluye: name, quantity, unit, supplier, cost, purchase_date, notes, bought.
- La acción **Duplicate** clona una tarjeta completa (útil para el mismo item de dos proveedores).

### Contactos — formato de teléfono US

- El campo phone en el `ContactForm` de `contactos/page.tsx` usa `formatUSPhone()` en `onChange`
- Formatea automáticamente mientras el usuario escribe: `7865632531` → `(786) 563-2531`
- Acepta máximo 10 dígitos; filtra cualquier carácter no numérico

### Storage

- Bucket: `kokistyle-files` (público)
- Uso: adjuntos de notas (imágenes, PDFs)
- Políticas: INSERT, SELECT, DELETE para anon

---

## Landing pública (`/`)

Secciones activas (de arriba a abajo):

| Sección | Componente | Descripción |
|---|---|---|
| Navbar | `Navbar.tsx` | Logo · links de nav · EN/ES · teléfono · Login |
| Hero | `Hero.tsx` | Headline principal + CTA |
| Services | `Services.tsx` | Grid de servicios ofrecidos |
| Before/After | `BeforeAfter.tsx` | Slider comparativo de fotos |
| Tours | `VirtualTour.tsx` | Embed de tours virtuales 360° |
| Footer | `Footer.tsx` | Info de contacto + redes |

> **Eliminado (jun 2026):** El bloque `EstimateBuilder` (cotizador público con PDF/QR) fue removido de la landing. El archivo `src/components/estimate/EstimateBuilder.tsx` puede eliminarse si no hay otras referencias.

---

## Panel privado (`/proyectos/...`)

Requiere autenticación por PIN. Layout en `src/app/proyectos/layout.tsx`.

### Tabs del detalle de proyecto (`/proyectos/[id]`)

Orden de tabs (TabId array): `presupuesto · pagos · planner · workflow · plan · materiales · contactos · notas · design`

| Tab (id) | Label UI | Descripción |
|---|---|---|
| `presupuesto` | Estimate | Estimado profesional: secciones, items, PDF, WhatsApp send |
| `pagos` | Cash Flow | Ingresos y egresos con balance en tiempo real |
| `planner` | Day Planner | Planificador por día embebido — drag&drop, co-workers, custom items, auto-assign |
| `workflow` | Workflow | Kanban (Pendiente → En Proceso → Listo) + vista Gantt |
| `plan` | Gantt | Vista Gantt de todas las tareas del proyecto — cabecera `bg-[#16323D]` |
| `materiales` | Materials | Lista de compras con checkbox "comprado" + import desde Estimate |
| `contactos` | Contacts | Especialistas/proveedores vinculados al proyecto |
| `notas` | Notes | Notas con adjuntos (imágenes + PDFs) |
| `design` | Design | AI Render Studio — sube foto, brief de diseño, render fotorrealista con Replicate |

Tab activo por defecto al abrir un proyecto: `"presupuesto"` (Estimate).

### Navegación del panel (top nav)

Orden: Dashboard → Gantt G → Contacts → Agenda (superadmin) → Activity (superadmin) → Bookings (superadmin) → Help

| Link | Ruta | Notas |
|---|---|---|
| Dashboard | `/proyectos` | — |
| Gantt G | `/proyectos/plan` | Vista Gantt global, proyectos ordenados por start_date ASC |
| Contacts | `/proyectos/contactos` | Lista global de contactos |
| Agenda | `/proyectos/agenda` | Agenda personal — solo visible para superadmin |
| Activity | `/proyectos/activity` | Solo visible para superadmin |
| Bookings | `/proyectos/reservas` | Reservas online — solo visible para superadmin |
| Help | `/proyectos/help` | — |

---

## Agenda personal del admin (`/proyectos/agenda`)

Sección privada del superadmin para registrar **citas**, **tasks de proyecto** (con FK opcional a `projects`) y **reuniones de nuevos proyectos**, con configuración de avisos.

### Modelo (`agenda_events`)

| Campo | Valores | Descripción |
|---|---|---|
| `event_type` | `cita` \| `task` \| `reunion` | Tipo de entrada (📅 / ✅ / 🤝) |
| `event_date` / `event_time` | DATE / `"HH:MM"` | Fecha y hora del evento |
| `remind_from` | `2h` \| `1d` \| `2d` \| `1w` | Desde cuándo avisar antes del evento |
| `repeat_every` | `once` \| `daily` | `once` = un solo aviso; `daily` = en cada corrida programada del cron hasta el evento |
| `project_id` | UUID nullable | FK → projects (para tasks ligadas a un proyecto) |
| `done` | boolean | Marcada como completada (tachada en UI) |
| `last_notified_at` | timestamptz | Reservado para el motor de push (Fase pendiente) |

### Funcionalidad

- **Captura por voz/texto**: barra superior con micrófono (Web Speech API, mismo patrón que Katy). La frase va a `/api/voice` (acción `create_agenda_event`); si el modelo no responde se usa `localParse()` (fallback local que entiende "hoy/mañana/el martes/a las 3 de la tarde/cada 2 horas/desde un día antes", ES + EN). Siempre se muestra **tarjeta de confirmación editable** antes de insertar.
- **Formulario manual**: botón "+ Nueva entrada" con los mismos campos.
- **Export a calendario del teléfono**: cada tarjeta tiene botón **.ics** (Blob client-side con 2 `VALARM`: -2h y -1 día) y link directo a **Google Calendar** (`calendar.google.com/calendar/render?action=TEMPLATE`). El teléfono dispara las notificaciones nativas — sin backend.
- Grupos **Hoy / Próximos / Pasados** + 3 KPIs (hoy, semana, avisos activos).
- Acciones registradas en `activity_log` (`entity_type: "agenda_event"`).
- Katy (VoiceFAB) también soporta `create_agenda_event` desde cualquier página del panel.

Migración SQL (ya incluida en `schema.sql`):
```sql
CREATE TABLE IF NOT EXISTS agenda_events (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type       TEXT NOT NULL DEFAULT 'cita',
  title            TEXT NOT NULL,
  project_id       UUID REFERENCES projects(id) ON DELETE SET NULL,
  event_date       DATE NOT NULL,
  event_time       TEXT NOT NULL DEFAULT '10:00',
  remind_from      TEXT NOT NULL DEFAULT '1d',
  repeat_every     TEXT NOT NULL DEFAULT 'once',
  notes            TEXT,
  done             BOOLEAN NOT NULL DEFAULT false,
  last_notified_at TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE agenda_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY anon_all ON agenda_events FOR ALL TO anon USING (true) WITH CHECK (true);
```

### Avisos push nativos (PWA + Web Push)

Implementado (jul 2026) — la Agenda envía notificaciones nativas al teléfono:

- **PWA**: `public/manifest.json` (branding Luxaris, `start_url: /proyectos`) + íconos `icon-192.png`/`icon-512.png` + `public/sw.js` (service worker: `push` → `showNotification`, `notificationclick` → abre `/proyectos/agenda`). El SW se registra en `proyectos/layout.tsx`.
- **Suscripción**: botón 🔔 "Activar avisos en este dispositivo" en la Agenda → `Notification.requestPermission()` → `pushManager.subscribe()` con `NEXT_PUBLIC_VAPID_PUBLIC_KEY` → upsert en `push_subscriptions` (onConflict endpoint).
- **Motor**: `GET /api/agenda/remind` (protegido con `Bearer CRON_SECRET`, Vercel Cron lo envía automáticamente). Calcula en hora de Florida (`America/New_York`) qué eventos están dentro de su ventana `remind_from`; `repeat_every = "once"` avisa una sola vez, `"daily"` avisa en cada corrida (dedupe de 60 min vía `last_notified_at`). Envía con `web-push` a todas las suscripciones y elimina las muertas (404/410).
- **Cron programable**: `vercel.json` → **2 corridas diarias**: `0 12 * * *` y `0 21 * * *` UTC (~8:00 am y ~5:00 pm Florida en horario de verano). Compatible con plan **Hobby** (límite: 2 crons, 1 vez/día cada uno). Para cambiar los horarios de aviso, editar esos dos schedules (en UTC) y redesplegar.
- **iOS**: requiere iOS 16.4+ y la PWA instalada en pantalla de inicio (Add to Home Screen) antes de poder suscribirse.
- Dependencia: `web-push` (+ `@types/web-push` dev). Claves: `npx web-push generate-vapid-keys`.

---

## Acceso directo sin login (device tokens)

Shortcut para smartphone/tableta que abre el panel **ya autenticado**, sin PIN. Sirve para el superadmin y para cada miembro del equipo (cada quien conserva sus permisos).

### Flujo

1. Dashboard → **Seguridad → Dispositivos** (`AdminSettings`, solo superadmin): nombre del dispositivo + PIN → `POST /api/auth/device-tokens` (`op: "create"`) genera un token aleatorio (`crypto.randomBytes(24)`, base64url) y lo guarda en `device_tokens`.
2. El admin copia el enlace `https://<host>/acceso/<token>` y lo abre en el teléfono → "Añadir a pantalla de inicio".
3. `/acceso/[token]` llama a `POST /api/auth/device-login` (server-side, `supabase-admin`): valida token no revocado/no expirado, actualiza `last_used_at` y retorna la sesión (`role: superadmin` + name, o el registro de `app_users`).
4. `AuthContext.loginWithToken()` crea la sesión en `localStorage` + guarda el token en `kokistyle-device-token` (superadmin con `pin: ""` — el PIN **nunca** viaja en el enlace) y registra el login en `activity_log` con `details: { method: "device_token" }`.
5. En **cada apertura posterior** la sesión persistente se revalida llamando a `device-login` con el token guardado — si fue revocado o expiró, se cierra sola. Esto hace que el botón **Revocar** funcione como "cerrar sesión en ese dispositivo".
6. Revocación individual desde el mismo panel (`op: "revoke"`).

### Seguridad

- `device_tokens` **no tiene política RLS anon** → solo accesible vía `service_role` en API routes (mismo patrón que `superadmin_config`).
- Crear/listar/revocar siempre exige el PIN del superadmin verificado server-side.
- `expires_at` opcional (soportado en el schema y validado en device-login).

---

## Sistema de autenticación

### Superadmin
- PIN en `superadmin_config` (tabla singleton, acceso solo server-side)
- Panel completo: todos los proyectos, gestión de equipo, configuración de seguridad
- Recuperación de PIN por email vía Resend (código 6 dígitos, 15 min de expiración)

### Tipos de usuario (`app_users.user_type`)

| Tipo | `user_type` | Default tab_access | Descripción |
|---|---|---|---|
| Co-worker | `"coworker"` | workflow, planner, notas | Cuadrilla/especialistas — ve solo sus tareas |
| Cliente | `"client"` | presupuesto, workflow, plan, notas, design | Dueño/cliente — vista de seguimiento, sin datos financieros |

### Colaboradores y clientes (`app_users`)
- Creados desde panel "Equipo" del dashboard (solo superadmin puede crear)
- PIN numérico ≥ 4 dígitos
- Solo ven proyectos asignados en `user_project_access`
- Panel de edición con 4 sub-tabs: **Info · Tabs · Permisos · Projects**

### Columnas de `app_users`

| Columna | Tipo | Descripción |
|---|---|---|
| `user_type` | `TEXT` | `'coworker'` \| `'client'` — determina preset de acceso |
| `contact_id` | `UUID` | FK → `contacts(id)` — vincula al co-worker con su ficha de contacto |
| `tab_access` | `JSONB` | Array de TabId visibles. `null` = usar permisos legacy |
| `my_tasks_only` | `BOOLEAN` | Si true, Workflow y Gantt filtran a tareas asignadas a `contact_id` |
| `permissions` | `JSONB` | CRUD granular: view/create/edit/delete por sección de datos |

### Tab access vs Data permissions

- **`tab_access`** — controla qué tabs del proyecto son _visibles_ en la barra de navegación
- **`permissions`** — controla qué acciones CRUD puede hacer dentro de cada sección
- Si `tab_access` es `null`, se usa el sistema legacy (derivado de `permissions[section].view`)
- Si `tab_access` está seteado, toma precedencia absoluta

### Secciones con permisos granulares (CRUD)

`workflow` · `materiales` · `contactos` · `presupuesto` · `pagos` · `notas`

### Filtrado "My tasks only" en detalle de proyecto

En `src/app/proyectos/[id]/page.tsx`:
```typescript
const myContactId = currentUser?.my_tasks_only ? (currentUser.contact_id ?? null) : null;
const filteredTasks = myContactId
  ? project.tasks.filter(t => t.assigned_contact_id === myContactId)
  : project.tasks;
```
`filteredTasks` se pasa a `WorkflowTab` y `PlanTab`. Day Planner filtra internamente por `assigned_contact_id`.

### SQL de migración (`app_users`)
```sql
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS user_type     TEXT NOT NULL DEFAULT 'coworker';
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS contact_id    UUID REFERENCES contacts(id) ON DELETE SET NULL;
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS tab_access    JSONB;
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS my_tasks_only BOOLEAN NOT NULL DEFAULT false;
```

### Flujo de login
1. PIN ingresado en `AdminModal`
2. Si PIN = superadmin → verifica via `/api/auth/login` (server-side)
3. Si no → busca en `app_users` (cliente, anon key)
4. Sesión guardada en `sessionStorage` (usuario + permisos) — **expira al cerrar el navegador**

### Modelo de sesiones y bloqueo biométrico (jul 2026)

| Origen de la sesión | Storage | Vida | Cierre remoto |
|---|---|---|---|
| Login por PIN | `sessionStorage` | Muere al cerrar el navegador/pestaña — al reabrir pide PIN | No aplica (muere sola) |
| Shortcut por token (`/acceso/[token]`) | `localStorage` + `kokistyle-device-token` | Persistente — **nunca pide PIN** en ese dispositivo: si hay token guardado, la app auto-inicia sesión con él en cada apertura (aunque la sesión local se haya perdido) | **Sí** — se revalida contra `/api/auth/device-login` en **cada apertura**; si el token fue revocado/expiró, la sesión y el token se limpian |

- Las sesiones legacy en `localStorage` sin token se invalidan automáticamente al cargar (logout forzado una vez tras el deploy).
- `logout` limpia las sesiones pero **conserva el token del dispositivo** — el shortcut sigue entrando directo. La única forma de apagar un dispositivo es **Revocar** su enlace (o borrar datos del navegador).
- **Bloqueo biométrico** (huella/Face ID): opcional **por dispositivo**, se activa en Seguridad → Dispositivos. Usa WebAuthn (`navigator.credentials`, authenticator de plataforma, `userVerification: required`) como **candado local del dispositivo**: al abrir la app con sesión persistente de token, el panel muestra pantalla de bloqueo hasta pasar la huella (o "Entrar con PIN" que hace logout). Claves en localStorage: `kokistyle-bio-enabled` + `kokistyle-bio-cred` (credential id). No sustituye la autenticación del servidor — es una capa extra en el aparato.

### Flujo de recuperación de PIN
1. "¿Olvidaste tu PIN?" → ingresar correo en `AdminModal`
2. POST `/api/auth/recover` → código 6 dígitos → `superadmin_config` → email vía Resend
3. POST `/api/auth/reset-pin` → verifica código → actualiza PIN

### Nombre de display del superadmin

- Columna `name TEXT NOT NULL DEFAULT 'Admin'` en `superadmin_config`
- `/api/auth/login` devuelve `name` al cliente (además de `isSuperAdmin`)
- `AuthContext` usa el `name` recibido para poblar la sesión — ya no hardcodea "Marco"
- Cambio desde `AdminSettings` → tarjeta "Nombre de display" → PIN de confirmación → POST `/api/auth/set-name`
- `setDisplayName()` en `AuthContext` actualiza `localStorage` en memoria sin recargar la página
- El nombre aparece en: saludo del Dashboard, columna `user_name` de `activity_log`

Migración SQL requerida:
```sql
ALTER TABLE superadmin_config ADD COLUMN IF NOT EXISTS name TEXT NOT NULL DEFAULT 'Admin';
```

### Activity Log (`activity_log`)

- Tabla en Supabase para auditoría de todas las acciones del panel
- Registra: inicio de sesión, creación, actualización y eliminación de entidades
- Función `logActivity(entry)` en `src/lib/activity.ts` — fire-and-forget (no bloquea la UI)
- Se llama desde `AuthContext` en login (superadmin y colaboradores)
- Página `/proyectos/activity` — solo visible para superadmin
  - 4 KPI cards: Eventos hoy · Logins · Creados · Eliminados
  - Filtros: usuario, tipo de acción, rango de fechas
  - Tabla con avatar (iniciales + color determinístico), badge con emoji, timeAgo

```sql
CREATE TABLE IF NOT EXISTS activity_log (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      TEXT,
  user_name    TEXT,
  user_role    TEXT,
  action       TEXT NOT NULL,  -- 'login' | 'create' | 'update' | 'delete' | 'mark_bought'
  entity_type  TEXT,           -- 'project' | 'task' | 'payment' | 'expense' | 'material' | 'contact' | 'note' | 'estimate_item'
  entity_id    TEXT,
  entity_name  TEXT,
  project_id   UUID REFERENCES projects(id) ON DELETE SET NULL,
  project_name TEXT,
  details      JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY anon_all ON activity_log FOR ALL TO anon USING (true) WITH CHECK (true);
```

---

## Tipografía — Bookman Old Style

- Los títulos de proyectos usan la clase `.font-bookman` definida en `src/app/globals.css`
- Font stack: `"Bookman Old Style", "Book Antiqua", Palatino, Georgia, serif` (fuentes del sistema — no requiere Google Fonts)
- Usada en: `h3` de tarjetas del dashboard, `h1` del encabezado del proyecto, cabecera del tab Gantt

```css
.font-bookman {
  font-family: "Bookman Old Style", "Book Antiqua", Palatino, Georgia, serif;
}
```

---

## Layout del Estimate tab (EstimateTab.tsx) — "Opción A"

El tab Estimate usa un layout de sub-tabs con cabecera oscura. Implementado en julio 2026.

### Estructura visual

```
┌─────────────────────────────────────────────────────────────┐
│  CABECERA  bg-[#16323D]                                     │
│  [empresa] [status badge] [TÍTULO DEL PROYECTO]             │
│                              [WA] [Copy] [PDF] [Save/color] │
│  (formulario WA expandible — showWaForm)                    │
│  ┌──────────────┐  ┌───────────────────────────┐            │
│  │ 📐 Sections  │  │ 💰 Payment Schedule        │            │
│  └──────────────┘  └───────────────────────────┘            │
├─────────────────────────────────────────────────────────────┤
│  (contenido del sub-tab activo)                             │
└─────────────────────────────────────────────────────────────┘
```

### Sub-tab 📐 Sections

- Sub-banda `bg-[#F7F3EA]`: Labor subtotal + Grand Total + **badge rojo de descuento** (inline %, monto rojo)
- Customer info collapsible (nombre, ciudad, teléfono, email, fechas)
- Secciones con drag & drop (@dnd-kit)
- Footer de totales: Labor subtotal → Descuento (rojo `#B0492F`) → Grand Total
- Botón "Generate Workflow Tasks"

### Sub-tab 💰 Payment Schedule

- Sub-banda `bg-[#F7F3EA]`: cuotas | recibido (verde) | pendiente (rojo) | badge % ok
- **Tarjeta de totales** con 3 filas:
  - Fila 1 `bg-white`: Labor subtotal
  - Fila 2 `bg-[#FDF5F3]`: Descuento en rojo `#B0492F` (flecha ▼, badge %)
  - Fila 3 `bg-[#16323D]`: Grand Total en blanco
  - Footer: barra de progreso recibido vs pendiente (verde `#4F8A63`)
- Filas de cuotas en timeline: nodo de color + card con badge %, monto, concepto, track bar

### Botón Save — contexto-dependiente

| Sub-tab activo | Color | Label EN | Label ES |
|---|---|---|---|
| `"sections"` | `bg-white text-[#16323D]` | Save | Guardar |
| `"schedule"` | `bg-[#F0A090] text-[#7B1838]` | Save schedule | Guardar calendario |

Ambos llaman a `saveHeader()` — guarda el estimado completo (header + deposit_schedule).

### Estado relevante

- `estimateSubTab: "sections" | "schedule"` — sub-tab activo (useState)
- `showWaForm: boolean` — formulario WA expandido (useState)
- **FAB flotante eliminado** — el Save está en la cabecera, no hay botón fixed bottom-right

---

## Deposit Payment Modal (EstimateTab)

El modal de instalamentos del Estimate (`deposit_schedule`) tiene un detalle expandible por fila que muestra/crea los pagos reales del cliente.

- Tabla `payments` — tipo `anticipo | abono | final` mapeados a índice de instalamento (0, 1, 2)
- Validación: la suma de pagos de un instalamento **no puede superar el target** (`pct × grandTotal / 100`)
- Si la suma ya supera el target (datos históricos), se muestra un banner de advertencia rojo
- Formulario "Add": calcula `remaining = target - received`; bloquea el botón si `wouldExceed`
- Edición inline: ícono lápiz abre inputs en la misma fila; ✓ guarda, ✕ cancela
- Eliminación con confirmación: X muestra `¿Eliminar? [Sí] [No]` en la misma fila antes de borrar

---

## Prototypes

Prototipos HTML standalone en la carpeta `prototypes/` en la raíz del repo (no en `src/`):

| Archivo | Descripción |
|---|---|
| `activity-log-prototype.html` | Prototipo visual del Activity Log con Tailwind CDN y datos de ejemplo |
| `payment-schedule-sidebar.html` | Prototipo "Opción A" del layout de Estimate — cabecera dark + sub-tabs (referencia del diseño implementado) |
| `agenda-admin-prototype.html` | Prototipo de la Agenda personal — captura por voz + 3 opciones de notificación (referencia del diseño implementado) |
| `index02.html` | Prototipo 02 — referencia del patrón SpeechRecognition usado en Design tab (movido desde la raíz) |
| `propuesta-valor.html` | Página standalone de propuesta de valor (movida desde public/) |
| `pdf-options/a·b·c.html` | Prototipos de las 3 opciones de diseño del PDF del estimado (movidos desde public/) |

---

## Sistema de idioma (EN/ES)

- Contexto: `LanguageContext.tsx` → hook `useLanguage()` → devuelve `{ language, setLanguage, t }`
- Traducciones: `src/config/translations.ts` → objetos `en` y `es` completos
- Persistencia: `localStorage` key `kokistyle-language`
- Alcance: toda la app — landing, panel, tabs, ayuda, PDF

Para agregar texto nuevo: añadir la clave en **ambos** objetos `en` y `es` en `translations.ts`.

---

## Asistente de voz "Katy"

- Componente: `VoiceFAB.tsx` — dos botones flotantes: 🎙 mic (`fixed bottom-6 right-6`) y ⌨ teclado (`fixed bottom-6 right-[5.5rem]`)
- **Modo voz**: Web Speech API (`SpeechRecognition` / `webkitSpeechRecognition`) — disponible en Chrome/Safari
- **Modo texto**: panel de texto que se abre al tocar ⌨ — funciona en todos los navegadores sin permisos
- Síntesis: `SpeechSynthesis` (voz en español preferida)
- Modelo: `anthropic("claude-sonnet-4-6")` via `@ai-sdk/anthropic` — lee `ANTHROPIC_API_KEY` del env automáticamente (sin Vercel AI Gateway)
- Intención: POST `/api/voice` → Claude (multi-turn) → JSON `{ action, fields }` → fallback `localDetect()`
- Contexto: `VoiceContext` → `setMeta({ projectId, projectTitle, contacts, projects })` desde las páginas de proyecto
  - `projects` — lista de todos los proyectos activos (cargada en `page.tsx` del dashboard) para resolver referencias como "el de Brickell"
- Evento de refresh: `kokivoice_saved` (CustomEvent) → páginas escuchan para refrescar datos
- **Auditoría**: cada acción (confirmada, cancelada o error) se guarda en `voice_actions` vía `auditLog()` en VoiceFAB
- **Confirmación**: Katy siempre muestra tarjeta de confirmación con campos editables — nada se guarda hasta tocar Confirmar

### Comandos de voz soportados

| Acción | Ejemplo EN | Ejemplo ES |
|---|---|---|
| `create_project` | "Create project Miami Kitchen" | "Crear proyecto Cocina Miami" |
| `create_task` | "Add task install tile" | "Agregar tarea instalar tile" |
| `create_material` | "Add material tile $800" | "Agregar material tile $800" |
| `create_budget_item` | "Add budget item plumbing $1200" | "Agregar item plomería $1200" |
| `create_payment` | "Add payment $4000" | "Agregar pago $4000" |
| `create_expense` | "Add expense $500 Jorge" | "Agregar egreso $500 Jorge" |
| `create_contact` | "Add contact Jorge plumber" | "Agregar contacto Jorge plomero" |
| `create_agenda_event` | "Remind me of the inspection tomorrow at 9" | "Recuérdame la inspección mañana a las 9" |

### Flujo conversacional `create_contact`

Katy guía la creación de contacto en pasos, preguntando uno a la vez:

1. **Tipo** → `"¿Co-worker, cliente o amistad?"` — mapea a `"coworker" | "customer" | "friend"`
2. **Nombre** → `"¿Cómo se llama?"`
3. **Teléfono** → `"¿Número de teléfono?"`
4. **Especialidad** *(solo si coworker)* → `"¿Especialidad?"` — lista: Plumbing, Painting, Finisher, Electrical, Marble, Flooring, Bathroom, Handyman, Helper (se normaliza a EN en la DB)
5. **Tarifa** *(solo si coworker, opcional)* → `"¿Tarifa? (ej: 25/hora)"` — el usuario puede decir "omitir"

El `saveAction` en `VoiceFAB.tsx` normaliza el tipo hablado (ej: "cliente", "amigo") al enum de la DB. La especialidad siempre se guarda en inglés (`"Plumbing"` etc.) ya que `specialtyDisplay()` indexa por el valor en inglés.

### Tabla `voice_actions` (auditoría)

```sql
CREATE TABLE IF NOT EXISTS voice_actions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_label  TEXT,
  transcript  TEXT NOT NULL,
  action      TEXT,
  action_data JSONB,
  project_id  UUID REFERENCES projects(id) ON DELETE SET NULL,
  outcome     TEXT NOT NULL DEFAULT 'pending',  -- 'confirmed' | 'cancelled' | 'error'
  error_msg   TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE voice_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY anon_all ON voice_actions FOR ALL TO anon USING (true) WITH CHECK (true);
```

Ya incluida en `src/lib/schema.sql`. Ejecutar en Supabase SQL Editor si la tabla no existe aún.

---

## Design Tab — AI Render Studio

- Componente: `src/components/ui/DesignTab.tsx`
- API route: `src/app/api/design-render/route.ts` (GET + POST, `maxDuration = 60`)
- Modelo: `adirik/interior-design` en Replicate — img2img, parte de la foto original
- Variable de entorno requerida: `REPLICATE_API_TOKEN` (replicate.com → Account → API Tokens)

### Flujo de generación

1. Usuario sube foto(s) al bucket `kokistyle-files/design-refs/[project_id]/` vía Supabase Storage (public bucket)
2. POST `/api/design-render` con `{ imageUrl, prompt, roomType, style, strength }`
   - La route llama a Replicate con `Prefer: wait=55` (resultado síncrono hasta 55s)
   - Si el resultado viene en `data.output` → retorna directo al cliente
   - Si viene `data.id` → cliente hace polling GET `/api/design-render?id={predictionId}` cada 2.5s
3. Resultado aparece en el panel de comparación; el usuario arrastra el slider dorado para ver ANTES vs DESPUÉS

### Parámetros de generación

| Param | Valor | Efecto |
|---|---|---|
| `strength` | 0.3–0.95 | Intensidad del cambio (0.3=sutil, 0.95=máximo creativo) |
| `guidance_scale` | 15 | Adherencia al prompt |
| `num_inference_steps` | 50 | Calidad del render (más pasos = mejor calidad) |
| `seed` | aleatorio | Variación del resultado |

### Slider de comparación

- Drag nativo (mouse + touch) en el contenedor `containerRef`
- `clipPath: inset(0 ${100 - sliderPos}% 0 0)` sobre la imagen "antes"
- Imagen "después" en capa base con `object-fit: contain`
- Ambas imágenes usan el mismo container → alineación perfecta

### Voz en Design Tab

Usa el mismo patrón de `SpeechRecognition` que el prototipo 02:
```
rec.onresult = (e) => {
  const transcript = e.results[0]?.[0]?.transcript ?? "";
  setPrompt(cur => cur ? cur + ", " + transcript : transcript);
};
```
Cada clip de voz se agrega al campo de texto (no reemplaza).

### Instalación (one-time)

```bash
# 1. Crear cuenta en replicate.com
# 2. Account → API Tokens → crear token
# 3. Agregar a .env.local:
REPLICATE_API_TOKEN=r8_xxxxxxxxxxxxxxxxxxxx
# 4. Agregar en Vercel: Settings → Environment Variables → REPLICATE_API_TOKEN
```

Costo estimado: ~$0.01 por render. Cuentas nuevas reciben créditos gratuitos.

## Day Planner — Tab dedicado

- Componente: `DayPlannerModal.tsx` — tiene prop `embedded?: boolean` (default `false`)
- **Modo modal** (`embedded=false`): `fixed inset-0 z-[300]` — se usaba antes desde EstimateTab (botón "Generate Workflow Tasks") — **deprecado, botón eliminado del Estimate**
- **Modo embebido** (`embedded=true`): renderiza como contenido de tab normal, sin overlay ni botón X
- Tab `"planner"` en `src/app/proyectos/[id]/page.tsx` → componente `PlannerTab`:
  - Carga el `project_estimate` y sus secciones+items desde Supabase
  - Pasa `estimate` al `<DayPlannerModal embedded ...>` como prop
  - Muestra spinner si carga, mensaje si no hay estimado
- Drag & drop: `@dnd-kit` (DndContext, useDraggable, useDroppable, DragOverlay)
- Estado: pool de items sin asignar + columnas de días (hasta N días)
- Fechas: cada columna tiene datepicker nativo (`<input type="date">` con overlay transparente)
- Capacidad: `workersPerDay × hoursPerWorker` por día → barra de progreso visual
- Auto-assign: **phase-ordered + even-spread** — ordena por fase constructiva (Materiales → Demolición → Estructura → Plomería → Eléctrico → Tile/Piso → Handyman → Pintura → Otro), distribuye equitativamente entre todos los días configurados (`targetPerDay = ceil(n/numDays)`), y avanza de día en los límites de fase
- Asignación de co-worker por item: selector `<select>` con `onPointerDown={e => e.stopPropagation()}` para no disparar el drag
- **Quick-assign por fecha**: cada tarjeta del pool tiene un botón `📅 Agregar a día...` que llama a `inputRef.current?.showPicker()` abriendo el calendario nativo. Al elegir fecha se busca coincidencia exacta en `dayDates`; si no hay, se calcula el día más cercano por ms. Muestra `✓ Día N · fecha` en verde cuando ya está asignado.
- **Custom items**: botón "+ Custom" en el pool → mini-formulario (descripción, sección tag, horas, monto) → `source = 'planner'`, `source_key = 'planner-custom:<uuid>'`
- Output al guardar: `INSERT`/`UPDATE` en `tasks` con `scheduled_date`, `source_key`, `assigned_contact_id`, vínculo al Estimate para upsert sin duplicados

### Posición del tab `"planner"` en TabId

```typescript
type TabId = "workflow" | "materiales" | "contactos" | "presupuesto" | "planner" | "pagos" | "plan" | "notas";
```

Orden en `TABS` array: Plan · Workflow · Estimate · **Day Planner** · Payments · Materials · Contacts · Notes

---

## Sistema de diseño

```
Color primario:      #16323D  — dark teal (nav, botones principales, headers)
Color secundario:    #F5E9DA  — warm cream (backgrounds landing)
Color acento:        #7B1838  — burgundy (CTAs destructivos)
Color éxito:         #4F8A63  — green (ingresos, aprobado)
Color error:         #B0492F  — red (egresos, rechazado, destructivo)
Color texto suave:   #5C6A6E  — slate (labels, subtextos)
Color borde:         #E6DDCB  — cream border
Color fondo card:    #F7F3EA  — off-white card background
Color link/acción:   #395886  — navy blue (botones secundarios, links activos)
```

Tipografía: `Manrope` (headings via Google Fonts) + sistema sans-serif (body)

Estilo: luxury · premium · moderno · limpio · elegante

---

## Configuración inicial — Supabase

### 1. Crear proyecto en Supabase
1. [supabase.com](https://supabase.com) → New Project → anotar Project ID

### 2. Obtener credenciales
`Settings → API`:
- **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
- **anon/public** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **service_role** → `SUPABASE_SERVICE_ROLE_KEY` (secreto, nunca al cliente)

### 3. Ejecutar schema SQL
`SQL Editor → New query` → pegar `src/lib/schema.sql` completo → ejecutar.  
El archivo tiene 7 bloques en orden; verificar que ninguno falla.

### 4. Crear bucket Storage
`Storage → New bucket`:
- Nombre: `kokistyle-files`
- Tipo: **Public**
- Agregar políticas: INSERT · SELECT · DELETE para `anon` (están al final de `schema.sql`)

### 5. Verificar RLS
- Todas las tablas deben tener el candado (RLS activo)
- Cada tabla debe tener la policy `anon_all`
- `superadmin_config`: **sin políticas** = acceso denegado para anon (correcto)

---

## Configuración inicial — Vercel

### 1. Importar repo
[vercel.com](https://vercel.com) → Add New Project → seleccionar repo GitHub → Framework: **Next.js**

### 2. Variables de entorno
`Settings → Environment Variables` (agregar para Production + Preview + Development):

| Variable | Fuente |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API (**Sensitive**) |
| `RESEND_API_KEY` | resend.com → API Keys |
| `ANTHROPIC_API_KEY` | console.anthropic.com |

### 3. Deploy
Push a `main` → Vercel despliega automáticamente.  
Verificar en `Deployments` que el build termina sin errores.

---

## Configuración de Resend (emails de recuperación)

1. [resend.com](https://resend.com) → API Keys → crear y copiar clave
2. Agregar como `RESEND_API_KEY` en `.env.local` y en Vercel
3. Verificar dominio en Resend → `Domains` (para producción)
   - `onboarding@resend.dev` funciona sin verificación (solo testing)
4. El campo `from` se configura en `src/app/api/auth/recover/route.ts`

---

## Reglas de seguridad

- **Nunca** exponer `SUPABASE_SERVICE_ROLE_KEY` ni `RESEND_API_KEY` en componentes cliente
- `supabase-admin.ts` solo se importa en `src/app/api/` — nunca en componentes
- El PIN del superadmin nunca se devuelve al cliente — las API routes retornan solo `{ ok: true }`
- `superadmin_config` no tiene políticas RLS (sin políticas = acceso denegado para anon)
- No hardcodear PINs en código — leer siempre desde `superadmin_config` en el servidor

---

## Reglas para agentes IA

### Preguntar antes de:
- Instalar dependencias nuevas
- Eliminar archivos, tablas o columnas
- Modificar `next.config.ts`, `tailwind.config.ts`
- Cambiar configuración de despliegue o variables de entorno en Vercel
- Hacer push o crear PRs

### Nunca:
- Exponer secrets o API keys en código cliente
- Importar `supabase-admin` fuera de `src/app/api/`
- Reescribir la arquitectura completa sin instrucción explícita
- Agregar comentarios que describen QUÉ hace el código (los nombres ya lo dicen)
- Usar CSS externo, styled-components ni inline styles — solo TailwindCSS

### Convenciones de código:
- Todos los componentes con lógica de estado → `"use client"` al inicio
- Funciones de Supabase en el cliente → usar `src/lib/supabase.ts` (anon key)
- Texto visible → siempre bilingüe usando `useLanguage()` y `translations.ts`
- Interfaces TypeScript → definir en `src/types/` antes de usar
- Un solo `toast()` prop por página para feedback de operaciones
