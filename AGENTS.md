# KokiStyle — Documentación de implementación y guía para agentes IA

## Descripción del proyecto

KokiStyle es una plataforma premium de remodelación y construcción enfocada en el mercado de Florida, USA.

Funcionalidades principales:
- Gestión de proyectos de remodelación (dashboard + detalle)
- Flujo de trabajo (Kanban/Gantt con drag & drop)
- Presupuesto, materiales, pagos, egresos y contactos por proyecto
- Notas con adjuntos (imágenes y PDFs) por proyecto
- Tours virtuales 360° por proyecto
- Asistente de voz "Katy" (Web Speech API + Claude API)
- Sistema de autenticación por PIN con roles y permisos granulares
- Panel de gestión de equipo (colaboradores)
- Recuperación de PIN por correo electrónico

---

## Tech Stack

| Tecnología | Uso |
|---|---|
| Next.js 15 (App Router) | Framework principal |
| TypeScript | Tipado estático |
| TailwindCSS | Estilos (único, sin CSS externo) |
| Framer Motion | Animaciones |
| Supabase (Postgres + Storage) | Base de datos y archivos |
| Resend | Envío de correos (recuperación de PIN) |
| Vercel | Despliegue y variables de entorno |
| pnpm | Gestor de paquetes |
| @dnd-kit | Drag & drop en tareas |

---

## Comandos

```bash
pnpm install        # Instalar dependencias
pnpm dev            # Servidor de desarrollo
pnpm build          # Build de producción
```

---

## Variables de entorno requeridas

```env
# .env.local — nunca en git
NEXT_PUBLIC_SUPABASE_URL=       # Supabase → Settings → API → Project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=  # Supabase → Settings → API → anon/public
SUPABASE_SERVICE_ROLE_KEY=      # Supabase → Settings → API → service_role (secret, solo server)
RESEND_API_KEY=                 # resend.com → API Keys
ANTHROPIC_API_KEY=              # console.anthropic.com → API Keys (voz)
```

---

## Estructura de carpetas

```
src/
├── app/
│   ├── page.tsx                    # Landing pública
│   ├── proyectos/
│   │   ├── page.tsx                # Dashboard de proyectos
│   │   ├── [id]/page.tsx           # Detalle de proyecto (todas las tabs)
│   │   ├── cliente-01/page.tsx     # Tour 360° showcase
│   │   ├── contactos/page.tsx      # Lista global de contactos
│   │   └── plan/page.tsx           # Gantt global
│   └── api/
│       ├── voice/route.ts          # Asistente de voz (Claude API)
│       └── auth/
│           ├── login/route.ts      # Verificar PIN superadmin (server-side)
│           ├── change-pin/route.ts # Cambiar PIN superadmin
│           ├── recover/route.ts    # Enviar código de recuperación por email
│           ├── reset-pin/route.ts  # Resetear PIN con código verificado
│           └── set-email/route.ts  # Guardar correo de recuperación
├── components/
│   ├── layout/
│   │   └── Navbar.tsx
│   ├── ui/
│   │   ├── AdminModal.tsx          # Modal de login por PIN (con recuperación)
│   │   ├── AdminSettings.tsx       # Panel cambio de PIN + correo de recuperación
│   │   ├── UsersPanel.tsx          # Gestión de colaboradores y permisos
│   │   ├── VoiceFAB.tsx            # Asistente de voz flotante "Katy"
│   │   ├── ProjectFormModal.tsx    # Crear/editar proyecto
│   │   └── EditorModal.tsx         # Modal genérico para CRUD en tabs
│   └── sections/                   # Secciones de la landing
├── context/
│   ├── AuthContext.tsx             # Autenticación, roles, permisos
│   └── VoiceContext.tsx            # Contexto activo para el asistente de voz
├── lib/
│   ├── supabase.ts                 # Cliente Supabase (anon key, browser)
│   ├── supabase-admin.ts           # Cliente Supabase (service_role, server-side)
│   ├── schema.sql                  # Schema completo de la base de datos
│   └── utils.ts                    # Funciones de negocio (money, totales, etc.)
└── types/
    ├── project.ts                  # Interfaces de proyecto y sus relaciones
    └── auth.ts                     # Interfaces de usuario, roles y permisos
```

---

## Base de datos (Supabase Postgres)

El schema completo con el orden de creación está en `src/lib/schema.sql`.

### Tablas

| Tabla | Descripción |
|---|---|
| `projects` | Proyectos de remodelación |
| `contacts` | Especialistas y proveedores |
| `project_contacts` | Relación N:M proyectos ↔ contactos |
| `tasks` | Tareas por proyecto (Kanban/Gantt) |
| `budget_items` | Líneas de presupuesto por proyecto |
| `materials` | Materiales por proyecto |
| `payments` | Ingresos recibidos del cliente |
| `expenses` | Egresos pagados a proveedores |
| `project_notes` | Notas con adjuntos (JSONB) por proyecto |
| `app_users` | Colaboradores con permisos granulares |
| `user_project_access` | Proyectos asignados por colaborador |
| `superadmin_config` | PIN y email de recuperación del superadmin (singleton) |

### Storage

- Bucket: `kokistyle-files` (público)
- Uso: adjuntos de notas (imágenes, PDFs)
- Políticas: INSERT, SELECT, DELETE para anon

---

## Sistema de autenticación

### Superadmin
- PIN almacenado en `superadmin_config` (tabla singleton, solo acceso server-side)
- Acceso al panel completo, gestión de usuarios y configuración de seguridad
- Recuperación de PIN por email vía Resend
- Panel "Seguridad" en el dashboard: cambiar PIN + correo de recuperación

### Colaboradores
- Creados desde el panel "Equipo" del dashboard (solo superadmin)
- PIN numérico de mínimo 4 dígitos almacenado en `app_users`
- Solo ven proyectos asignados explícitamente por el superadmin
- Permisos granulares por sección: `view`, `create`, `edit`, `delete`

### Secciones con permisos
- `workflow` — Flujo de trabajo / tareas
- `materiales` — Materiales
- `contactos` — Contactos / especialistas
- `presupuesto` — Líneas de presupuesto
- `pagos` — Ingresos y egresos
- `notas` — Notas con adjuntos

### Flujo de login
1. Usuario ingresa PIN en `AdminModal`
2. Se verifica contra `/api/auth/login` (superadmin, server-side) o tabla `app_users` (colaboradores)
3. Sesión guardada en `localStorage` con usuario completo + permisos

### Flujo de recuperación de PIN
1. "¿Olvidaste tu PIN?" en AdminModal → ingresar correo
2. POST `/api/auth/recover` → genera código 6 dígitos, lo guarda en `superadmin_config`, envía email vía Resend
3. Usuario ingresa código → POST `/api/auth/reset-pin` → verifica y actualiza PIN
4. Usuario puede hacer login con el nuevo PIN

---

## Asistente de voz "Katy"

- Componente: `VoiceFAB.tsx` — botón flotante en toda la app
- Reconocimiento: Web Speech API (`SpeechRecognition` / `webkitSpeechRecognition`)
- Síntesis: `SpeechSynthesis` (voces en español)
- Intención: API route `/api/voice` con Claude → fallback `localDetect()`
- Acciones soportadas: `create_project`, `create_task`, `create_material`, `create_budget_item`, `create_payment`, `create_expense`, `create_contact`
- Contexto: `VoiceContext` informa al FAB en qué tab/proyecto está el usuario
- Evento de refresh: `kokivoice_saved` (CustomEvent) → las páginas escuchan para refrescar datos
- Campos editables en confirm: el usuario puede corregir lo transcrito antes de guardar
- Optimización Android: delay TTS→mic reducido de 3000ms a 900ms; silence timeout 1200ms

---

## Reglas de arquitectura

- Componentes reutilizables y pequeños
- Mobile-first (diseño responsive desde móvil)
- TypeScript en todo — interfaces definidas en `src/types/`
- Solo TailwindCSS — sin CSS externo ni styled-components
- Sin comentarios innecesarios en código
- Sin manejo de errores para escenarios imposibles
- Validación solo en fronteras del sistema (inputs de usuario, APIs externas)
- `supabase-admin.ts` solo en Server Components y API routes — nunca en el cliente

---

## Sistema de diseño

```
Color primario:    #16323D  (dark teal)
Color secundario:  #F5E9DA  (warm cream)
Color acento:      #7B1838  (burgundy — CTAs destructivos)
Color éxito:       #4F8A63
Color error:       #B0492F
Color texto suave: #5C6A6E
Color borde:       #E6DDCB
Color fondo card:  #F7F3EA
```

Tipografía: `Manrope` (headings) + sistema sans-serif

Estilo: luxury · premium · moderno · limpio · elegante

---

## Configuración inicial — Supabase paso a paso

### Paso 1: Crear proyecto en Supabase
1. Ir a [supabase.com](https://supabase.com) → New Project
2. Anotar el **Project ID** (aparece en la URL: `https://supabase.com/dashboard/project/<PROJECT_ID>`)

### Paso 2: Obtener credenciales
1. En Supabase Dashboard → `Settings` → `API`
2. Copiar:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon/public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role key** (secreto) → `SUPABASE_SERVICE_ROLE_KEY`
3. Nunca exponer `service_role` en código cliente

### Paso 3: Ejecutar el schema SQL
1. Supabase Dashboard → `SQL Editor` → `New query`
2. Pegar y ejecutar el contenido completo de `src/lib/schema.sql`
3. Ejecutar en el orden de los 7 pasos (el archivo ya está en orden)
4. Verificar que no hay errores en la consola de resultados

### Paso 4: Crear bucket de Storage
1. Supabase Dashboard → `Storage` → `New bucket`
2. Nombre: `kokistyle-files`
3. Marcar **Public bucket** → Save
4. Ir a `Storage` → `Policies`
5. Ejecutar las 3 políticas del Paso 6 del schema SQL (INSERT, SELECT, DELETE para anon)
   > O ir a la pestaña `Policies` del bucket y usar el UI para crearlas manualmente

### Paso 5: Verificar RLS
- En `Table Editor`, confirmar que todas las tablas tienen el ícono de candado (RLS activo)
- En `Authentication` → `Policies`, verificar que cada tabla tiene la policy `anon_all`
- `superadmin_config` NO debe tener políticas (sin políticas = acceso denegado para anon)

---

## Configuración inicial — Vercel paso a paso

### Paso 1: Conectar repositorio
1. Ir a [vercel.com](https://vercel.com) → `Add New Project`
2. Importar el repositorio GitHub de KokiStyle
3. Framework: **Next.js** (Vercel lo detecta automáticamente)

### Paso 2: Configurar variables de entorno
1. Vercel Dashboard → `[Proyecto]` → `Settings` → `Environment Variables`
2. Agregar cada variable con valor para los entornos **Production**, **Preview** y **Development**:

| Variable | Descripción | Dónde obtener |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase | Supabase → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clave anónima pública | Supabase → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Clave secreta del servidor | Supabase → Settings → API |
| `RESEND_API_KEY` | Clave de Resend para emails | resend.com → API Keys |
| `ANTHROPIC_API_KEY` | Clave de Claude para voz | console.anthropic.com |

3. Marcar `SUPABASE_SERVICE_ROLE_KEY` como **Sensitive** (ocultar el valor)

### Paso 3: Primer deploy
1. Hacer push a `main` (o al branch configurado como producción)
2. Vercel despliega automáticamente
3. Verificar en `Deployments` que el build termina sin errores

### Paso 4: Verificar variables en producción
```bash
# Desde el proyecto local, verificar que el build usa las vars correctas:
vercel env pull .env.local     # Descarga vars de Vercel a local
pnpm build                      # Verificar que compila sin errores
```

### Paso 5: Configurar dominio (opcional)
1. Vercel Dashboard → `[Proyecto]` → `Settings` → `Domains`
2. Agregar dominio personalizado y seguir instrucciones DNS

---

## Configuración de Resend (emails de recuperación)

1. Crear cuenta en [resend.com](https://resend.com)
2. `API Keys` → `Create API Key` → copiar la clave
3. Agregar como `RESEND_API_KEY` en `.env.local` y en Vercel
4. Verificar el dominio del correo remitente en Resend → `Domains`
   - Si se usa `onboarding@resend.dev` no requiere verificación (solo para pruebas)
   - Para producción: agregar y verificar el dominio real
5. En `src/app/api/auth/recover/route.ts`, el campo `from` usa el dominio verificado

---

## Reglas de seguridad para agentes

- No exponer `SUPABASE_SERVICE_ROLE_KEY` ni `RESEND_API_KEY` en componentes cliente
- `supabase-admin.ts` solo se importa en API routes (`src/app/api/`)
- El PIN del superadmin nunca se devuelve al cliente — solo `isSuperAdmin: boolean`
- Las políticas RLS de `superadmin_config` no tienen acceso anon (sin políticas = denegado)
- No hardcodear el PIN del superadmin en código (leerlo siempre desde `superadmin_config`)

## Reglas generales para agentes

Preguntar antes de:
- Instalar dependencias grandes
- Eliminar archivos o tablas
- Modificar archivos de configuración (`next.config.ts`, `tailwind.config.ts`)
- Cambiar configuración de despliegue en Vercel

Nunca:
- Exponer secrets o API keys
- Usar `supabase-admin` en componentes cliente
- Reescribir la arquitectura completa sin instrucción explícita
- Agregar comentarios que explican qué hace el código (los nombres ya lo hacen)
