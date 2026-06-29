# Plan de Implementación — "Obra" · Gestor de Remodelaciones (KokiStyle)

> **Handoff para Antigravity.** App operativa para el agente de construcción de KokiStyle (Miami): crear proyectos, presupuestar, ejecutar workflow, controlar avance, **llevar cuentas de pagos por cliente**, editar todo **por voz o texto**, y operar con **acceso protegido (Admin)**. Responsive: web + smartphone (Samsung S25 Ultra).

---

## 0. Contexto del proyecto

**Qué es.** "Obra" es el back-office operativo del negocio. El sitio público de cara al cliente ya existe (KokiStyle: estimados, before/after, tours 360). Esta app es la herramienta interna del agente para gestionar cada proyecto de remodelación de punta a punta. Los datos **no son públicos**: viven detrás de un login de administrador.

**Quién lo usa.** Hoy un solo usuario (Marco). Modelado desde el inicio para **equipo a futuro** (roles admin / miembro).

**Dónde vive.** Se cuelga dentro del proyecto KokiStyle en Vercel.

### Links de referencia

| Recurso | Link / ruta |
|---|---|
| Sitio público KokiStyle (marca/estilo a heredar) | https://kokistyle.vercel.app/ |
| Repo local destino | `/Users/marco/Proyectos/kokistyle` |
| Prototipo visual (fuente de verdad de UI) | `index.html` (este paquete) → colocar en `public/maqueta/` |
| Backend / DB | Supabase (ya conectado vía MCP) |
| Hosting | Vercel |
| Next.js | https://nextjs.org/docs |
| Supabase (Auth + RLS + Realtime) | https://supabase.com/docs |
| Web Speech API (voz es/en) | https://developer.mozilla.org/docs/Web/API/Web_Speech_API |
| dnd-kit (drag & drop táctil) | https://dndkit.com/ |
| API de Anthropic (entrevista por voz) | https://docs.claude.com |

---

## 1. Stack

| Capa | Tecnología |
|---|---|
| Frontend | Next.js (App Router) + TypeScript + Tailwind CSS, **PWA instalable** |
| Backend + Auth + DB | Supabase (Postgres + Auth + RLS + Realtime + Storage) |
| Hosting | Vercel |
| Voz (dictado + lectura) | Web Speech API (`es-US`, `en-US`); upgrade opcional a STT en la nube |
| Entrevista por voz | API de Anthropic (Claude) → respuestas libres a datos estructurados |
| Drag & drop del Plan | **dnd-kit** (soporta touch en S25 Ultra) |
| Gantt | Render propio con barras posicionadas por semana/fecha (ver prototipo) |
| PDF (cotización / estado de cuenta) | `@react-pdf/renderer` |

---

## 2. Tokens de marca (heredados de KokiStyle — premium)

Definir como variables CSS / theme de Tailwind. Extraídos del sitio real (azul marino sobre crema/arena, tipografía sans):

```css
--paper:#F7F3EA;  --card:#FFFFFF;   --card-2:#ECE3D1;   /* crema / blanco / arena */
--ink:#16323D;    --ink-soft:#5C6A6E;                   /* azul marino (texto + marca) */
--line:#E6DDCB;   --line-2:#D7CBB3;
--brand:#16323D;  --brand-deep:#0E2630;                 /* primario = marino (botones) */
--teal:#4E7A82;   --green:#4F8A63;  --red:#B0492F;       /* secundario + semánticos */
--font-display:'Manrope';  --font-body:'Hanken Grotesk';  --font-mono:'Spline Sans Mono';
```

> La tipografía exacta del sitio conviene confirmarla; "Manrope" es una sans cercana al look. El hex marino se afinó a partir del screenshot del sitio.

---

## 3. Modelo de datos (Supabase / Postgres)

- **`users`** — id, nombre, email, **role** (`admin` | `member`). Vía Supabase Auth.
- **`projects`** — id, cliente, dirección, status (`presupuesto`/`aprobado`/`en_obra`/`terminado`), monto presupuestado, **start_date**, owner_id.
- **`contacts`** — id, nombre, especialidad, teléfono, tarifa.
- **`project_contacts`** — project_id, contact_id. *(Relación muchos a muchos para asignar especialistas a cada proyecto.)*
- **`tasks`** (actividades) — project_id, nombre, status (`pend`/`prog`/`done`), horas estimadas, **order** (para drag&drop), duración, **scheduled_date** reprogramable, **assigned_contact_id** (relación con contact), trazabilidad opcional a Estimate (`source`, `source_key`, `estimate_item_id`, `estimate_section_id`, `source_section`, `amount`).
- **`budget_items`** — project_id, tipo (`mano`/`material`), descripción, cantidad, costo unitario, total.
- **`materials`** — project_id, nombre, proveedor, costo, comprado (bool).
- **`payments`** (Ingresos - Pagos recibidos del cliente) — project_id, monto, fecha, método (`Efectivo`/`Transferencia`/`Zelle`/`Cheque`/`Tarjeta`), tipo (`anticipo`/`abono`/`final`), nota.
- **`expenses`** (Egresos - Pagos a especialistas y proveedores) — project_id, monto, fecha, método (`Efectivo`/`Transferencia`/`Zelle`/`Cheque`/`Tarjeta`), payee_name (ej. especialista o "Equipo propio"), concept (concepto del pago).
- **`audit_log`** — quién, qué entidad, acción (create/update/delete), antes/después, timestamp. *(Soporta el requisito de "no borrar/actualizar sin querer" + trazabilidad de equipo.)*

**Derivados de pagos:** `total_pagado` (ingresos), `total_egresos`, `saldo_pendiente` (presupuesto − ingresos), `caja` (ingresos − egresos), `% cobrado` (calculados).
**Seguridad (RLS):** lectura/escritura solo para usuarios autenticados; escritura restringida por `role`.

---

## 4. Requisitos funcionales (incluye lo nuevo de esta iteración)

1. **Crear proyecto** y desglosar **tareas/actividades**.
2. **Presupuesto** por líneas (mano de obra + material) con aprobación del cliente y **PDF**.
3. ⭐ **Pagos / Control de Flujo**: Sección de pagos con soporte completo para **Ingresos** (pagos del cliente con conceptos de anticipo/abono/final) y **Egresos** (pagos a especialistas asignados o proveedores). Todo es 100% editable (crear, modificar, borrar con confirmación) y calcula métricas locales por proyecto y globales en el dashboard.
4. ⭐ **Asignación de Contactos**: A nivel de proyecto, poder gestionar y seleccionar qué especialistas de la base de contactos participan en dicho proyecto mediante un selector checkbox / modal dedicado.
5. **Workflow** (al aprobar el presupuesto): tablero Kanban de actividades, **compra de materiales**, **responsable por actividad** (mapeado de contactos asignados).
6. **Seguimiento**: checklist, horas, fechas de término, % de avance.
7. ⭐ **Acceso protegido — botón "Admin" (esquina superior derecha)** que abre **modal de autenticación**. El acceso se integra en el navbar de KokiStyle. Los datos del panel solo se ven/editan tras ingresar PIN administrador.
8. ⭐ **Plan con drag & drop y Autoprogramación**: Reordenar actividades arrastrando en la vista Gantt de proyecto; al reordenar, **el cronograma de fechas se recalcula automáticamente** basándose en el orden secuencial y las duraciones en semanas de cada actividad.
9. ⭐ **Dashboard General**: La página de inicio del administrador es un Dashboard centralizado con todos los KPIs del portafolio (Proyectos activos, Presupuestado total, Ingresos, Egresos, Por cobrar, Caja) y tarjetas interactivas de cada proyecto que al presionarse cargan el detalle correspondiente.
10. **Voz bilingüe (es/en)**: dictado de actividades y **entrevista por voz** que pregunta los datos y arma el plan/Gantt solo.
11. **Responsive**: web y smartphone (referencia S25 Ultra), PWA instalable, usable con señal intermitente en obra.

---

## 5. Fases / Módulos

- **Fase 0 — Cimientos:** Next.js + Supabase + Vercel, esquema + RLS, PWA base.
- **Fase 1 — Proyectos & actividades** (CRUD).
- **Fase 2 — Presupuesto** + PDF + aprobación.
- **Fase 3 — Pagos / cuentas por cobrar** + estado de cuenta.
- **Fase 4 — Workflow + materiales + contactos** *(prototipado ✓)*.
- **Fase 5 — Auth (Admin) + roles + RLS + edición con confirmación + audit_log.**
- **Fase 6 — Plan drag & drop con reprogramación automática.**
- **Fase 7 — Capa de voz** (dictado + entrevista bilingüe).
- **Fase 8 — Pulido PWA / offline / responsive fino.**

---

## 6. Reparto de agentes expertos (para Antigravity)

Ejecutar con un agente especializado por dominio. Orden sugerido y criterios de aceptación:

1. **Agente Arquitecto / Setup** — Scaffold Next.js (App Router, TS, Tailwind) + Supabase + deploy Vercel. Crea el esquema de la sección 3 y políticas RLS base.
   *Listo cuando:* la app despliega en Vercel y conecta a Supabase con login funcionando.

2. **Agente Auth & Roles** — Supabase Auth, botón **Admin** + modal, gating admin/member, RLS por rol, `audit_log`.
   *Listo cuando:* sin sesión no se ven datos; admin puede editar, member solo lectura; toda mutación se audita.

3. **Agente Frontend / UI** — Implementa las pantallas **fielmente desde `index.html`**, aplicando los tokens de la sección 2. Responsive web + S25 Ultra, PWA.
   *Listo cuando:* el prototipo está replicado en React, instalable, fluido en móvil.

4. **Agente Datos / CRUD** — CRUD de proyectos, tareas, contactos, materiales, líneas de presupuesto y pagos, con **diálogo de confirmación** en update/delete y updates optimistas + realtime.
   *Listo cuando:* cada entidad se crea/edita/borra con confirmación y se sincroniza en vivo entre dispositivos.

5. **Agente Plan / Scheduling** — Drag & drop con **dnd-kit** (touch), reprogramación automática por duración/fechas, vista Gantt.
   *Listo cuando:* arrastrar una actividad reordena y recalcula fechas de todas las siguientes.

6. **Agente Voz** — Web Speech API (dictado es/en) + entrevista por voz con la API de Anthropic que llena el plan.
   *Listo cuando:* se dicta una actividad y se crea; la entrevista por voz puebla el Gantt.

7. **Agente Pagos / PDF** — Estado de cuenta y cotización en PDF, resumen global de cuentas por cobrar.

8. **Agente QA / Responsive** — Pruebas en web y S25 Ultra, accesibilidad, estados offline.

---

## 7. Botón "Admin" en la landing de KokiStyle

El acceso al panel vive **dentro del sitio público existente**, no en una app aparte.

- **Ubicación:** en el navbar de KokiStyle, **esquina superior derecha**, junto al toggle EN/ES y "Estimación inicial". Mismo estilo de botón marino del sitio.
- **Acción:** abre un modal de autenticación (Supabase Auth). Tras validar, redirige a la ruta protegida `/proyectos` (la zona privada / app "Obra").
- **Protección:** `/proyectos/*` detrás de middleware de sesión + RLS por rol. Sin sesión no se renderiza nada del panel.
- En el prototipo (`index.html`) esto está demostrado: barra superior estilo KokiStyle + botón **Admin** arriba a la derecha → modal de PIN → zona de proyectos. (PIN demo: `1234`; en producción se reemplaza por email+password de Supabase.)

---

## 8. Empezar en Antigravity con Claude Code

1. Abre el repo `/Users/marco/Proyectos/kokistyle` en Antigravity.
2. Coloca `PLAN_IMPLEMENTACION.md` e `index.html` en la raíz (o en `/docs`) como contexto.
3. Abre **Claude Code** en el repo y dale este prompt de arranque:

   > Lee `PLAN_IMPLEMENTACION.md` (contexto y spec) e `index.html` (referencia visual y de marca). Vamos a construir la zona privada "Obra" dentro de este proyecto Next.js de KokiStyle. Empieza por la **Fase 0 (Agente Arquitecto/Setup)**: crea el esquema de Supabase de la sección 3 con RLS, la ruta protegida `/proyectos`, y el botón **Admin** en el navbar (sección 7). No implementes la voz todavía. Confírmame el plan de archivos antes de escribir código.

4. Avanza **fase por fase / agente por agente** según la sección 6, validando cada entregable contra su criterio de "listo".
5. Antes de cerrar el Agente Frontend, confirma los hex y la tipografía exactos contra https://kokistyle.vercel.app/.

> Sugerencia: corre un agente por dominio (Setup → Auth → Frontend → CRUD → Plan → Voz → Pagos/PDF → QA) en lugar de uno solo para todo; cada uno con el alcance de la sección 6.

---

## 9. Decisiones abiertas

1. Voz: Web Speech (gratis) vs STT en la nube (mejor español, costo por minuto).
2. Offline en obra: ¿cola de sincronización desde Fase 0?
3. Tipografía/branding: confirmar tokens exactos de KokiStyle.
