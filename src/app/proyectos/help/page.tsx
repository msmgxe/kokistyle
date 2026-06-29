"use client";

import { useState } from "react";
import { useLanguage } from "@/src/context/LanguageContext";

// ─── Mockup components (visual pseudo-screenshots) ────────────────────────────

function MockupDashboard({ EN }: { EN: boolean }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-[#E6DDCB] bg-white shadow-sm">
      {/* KPI row */}
      <div className="grid grid-cols-4 gap-2 bg-[#F7F3EA] p-3">
        {[
          { label: EN?"Income":"Ingresos",  val:"$12,500", c:"text-[#4F8A63] bg-[#DCEBDD]" },
          { label: EN?"Expenses":"Egresos", val:"$8,200",  c:"text-[#B0492F] bg-[#F0DBD2]" },
          { label: "Balance",               val:"$4,300",  c:"text-[#395886] bg-[#EDF3FB]" },
          { label: "Estimate",              val:"$65,000", c:"text-[#7A6230] bg-[#EDE3CF]" },
        ].map(k => (
          <div key={k.label} className={`rounded-xl px-2 py-1.5 ${k.c.split(" ")[1]}`}>
            <div className={`text-[8px] font-bold uppercase ${k.c.split(" ")[0]}`}>{k.label}</div>
            <div className={`text-[12px] font-black ${k.c.split(" ")[0]}`}>{k.val}</div>
          </div>
        ))}
      </div>
      {/* Project cards */}
      {[
        { name:"KITCHEN REMODEL · MIAMI",  client:"Jennifer Walsh", status:EN?"Approved":"Aprobado", sc:"bg-[#DCEBDD] text-[#4F8A63]" },
        { name:"BATH RENO · BRICKELL",     client:"Carlos Ruiz",    status:EN?"In Progress":"En Obra", sc:"bg-[#DCE8E9] text-[#4E7A82]" },
      ].map(p => (
        <div key={p.name} className="flex items-center justify-between border-b border-[#F0EBE0] px-3 py-2.5 last:border-0">
          <div>
            <div className="text-[10px] font-bold text-[#16323D]">{p.name}</div>
            <div className="text-[9px] text-[#5C6A6E]">{p.client}</div>
          </div>
          <span className={`rounded-full px-2 py-0.5 text-[8px] font-bold ${p.sc}`}>{p.status}</span>
        </div>
      ))}
      <div className="flex items-center justify-center py-2">
        <div className="rounded-full bg-[#16323D] px-3 py-1 text-[9px] font-bold text-white">+ {EN?"New Project":"Nuevo Proyecto"}</div>
      </div>
    </div>
  );
}

function MockupWorkflow({ EN }: { EN: boolean }) {
  const cols = EN
    ? [{ label:"Pending", c:"#C4B89A", tasks:["Demo walls","Rough plumbing"] },
       { label:"In Progress", c:"#4E7A82", tasks:["Tile installation"] },
       { label:"Done ✓", c:"#4F8A63", tasks:["Demolition"] }]
    : [{ label:"Pendiente", c:"#C4B89A", tasks:["Demoler paredes","Plomería"] },
       { label:"En Proceso", c:"#4E7A82", tasks:["Instalación tile"] },
       { label:"Listo ✓", c:"#4F8A63", tasks:["Demolición"] }];
  return (
    <div className="grid grid-cols-3 gap-2">
      {cols.map(col => (
        <div key={col.label} className="rounded-xl bg-[#F7F3EA] p-2">
          <div className="mb-2 flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full" style={{ background: col.c }} />
            <span className="text-[9px] font-bold uppercase tracking-wide text-[#5C6A6E]">{col.label}</span>
          </div>
          {col.tasks.map(t => (
            <div key={t} className="mb-1.5 rounded-lg border border-[#E6DDCB] bg-white px-2 py-1.5">
              <div className="text-[9px] font-semibold text-[#16323D]">{t}</div>
              <div className="mt-0.5 text-[8px] text-[#5C6A6E]">4h · {EN?"Jorge":"Jorge"}</div>
            </div>
          ))}
          <div className="mt-1.5 rounded-lg border border-dashed border-[#D7CBB3] py-1 text-center text-[8px] text-[#C4B89A]">
            + {EN?"Add task":"Agregar tarea"}
          </div>
        </div>
      ))}
    </div>
  );
}

function MockupEstimate({ EN }: { EN: boolean }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between rounded-xl border border-[#E6DDCB] bg-white px-3 py-2">
        <div className="text-[9px] font-bold text-[#16323D]">DEMOLITION {EN?"· Dumping included":"· Acarreo incluido"}</div>
        <div className="font-mono text-[10px] font-bold text-[#16323D]">$1,800</div>
      </div>
      <div className="overflow-hidden rounded-xl border border-[#395886] bg-white">
        <div className="flex items-center justify-between bg-[#EDF3FB] px-3 py-2">
          <div className="text-[9px] font-bold text-[#395886]">PLUMBING</div>
          <div className="font-mono text-[10px] font-bold text-[#395886]">$3,200</div>
        </div>
        {[
          { d:EN?"Replace Jacuzzi valves":"Reemplazar válvulas jacuzzi", a:"$800" },
          { d:EN?"Shower drain":"Desagüe de ducha",                      a:"$600" },
          { d:EN?"Hot water heater":"Calentador de agua",                 a:"$1,800" },
        ].map(i => (
          <div key={i.d} className="flex items-center justify-between border-t border-[#F0EBE0] px-4 py-1.5">
            <div className="text-[9px] text-[#16323D]">• {i.d}</div>
            <div className="font-mono text-[9px] text-[#5C6A6E]">{i.a}</div>
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-[#E6DDCB] bg-[#16323D] px-3 py-2 flex items-center justify-between">
        <div className="text-[9px] font-bold text-white">{EN?"GRAND TOTAL":"TOTAL FINAL"}</div>
        <div className="font-mono text-[11px] font-black text-white">$5,000</div>
      </div>
    </div>
  );
}

function MockupPayments({ EN }: { EN: boolean }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-[#E6DDCB] bg-white">
      <div className="grid grid-cols-3 gap-2 bg-[#F7F3EA] p-2.5">
        <div className="rounded-lg bg-[#DCEBDD] p-2 text-center">
          <div className="text-[7px] font-bold uppercase text-[#4F8A63]">{EN?"Income":"Ingresos"}</div>
          <div className="font-mono text-[11px] font-black text-[#4F8A63]">$8,000</div>
        </div>
        <div className="rounded-lg bg-[#F0DBD2] p-2 text-center">
          <div className="text-[7px] font-bold uppercase text-[#B0492F]">{EN?"Expenses":"Egresos"}</div>
          <div className="font-mono text-[11px] font-black text-[#B0492F]">$5,200</div>
        </div>
        <div className="rounded-lg bg-[#EDF3FB] p-2 text-center">
          <div className="text-[7px] font-bold uppercase text-[#395886]">Balance</div>
          <div className="font-mono text-[11px] font-black text-[#395886]">$2,800</div>
        </div>
      </div>
      {[
        { label:EN?"Client payment":"Pago cliente",       amt:"+$4,000", c:"text-[#4F8A63]", method:"Zelle" },
        { label:EN?"Jorge - Plumbing":"Jorge - Plomería", amt:"-$1,200", c:"text-[#B0492F]", method:"Cash" },
        { label:EN?"Client deposit":"Depósito cliente",   amt:"+$4,000", c:"text-[#4F8A63]", method:"Transfer" },
      ].map(r => (
        <div key={r.label} className="flex items-center justify-between border-t border-[#F0EBE0] px-3 py-2">
          <div>
            <div className="text-[9px] font-semibold text-[#16323D]">{r.label}</div>
            <div className="text-[8px] text-[#5C6A6E]">{r.method}</div>
          </div>
          <div className={`font-mono text-[11px] font-bold ${r.c}`}>{r.amt}</div>
        </div>
      ))}
    </div>
  );
}

function MockupMaterials({ EN }: { EN: boolean }) {
  const items = EN
    ? [{ n:"Porcelain tile 12x24",  s:"Home Depot",      c:"$1,200", bought:true  },
       { n:"Shower glass door",     s:"Glass Supply Co", c:"$850",   bought:true  },
       { n:"Vanity mirror",         s:"IKEA",            c:"$320",   bought:false },
       { n:"Waterproof membrane",   s:"Lowes",           c:"$180",   bought:false }]
    : [{ n:"Porcelanato 12x24",     s:"Home Depot",      c:"$1,200", bought:true  },
       { n:"Puerta ducha vidrio",   s:"Glass Supply Co", c:"$850",   bought:true  },
       { n:"Espejo tocador",        s:"IKEA",            c:"$320",   bought:false },
       { n:"Membrana impermeabl.",  s:"Lowes",           c:"$180",   bought:false }];
  return (
    <div className="overflow-hidden rounded-2xl border border-[#E6DDCB] bg-white">
      {items.map(i => (
        <div key={i.n} className={`flex items-center gap-2.5 border-b border-[#F0EBE0] px-3 py-2 last:border-0 ${i.bought ? "opacity-50" : ""}`}>
          <div className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${i.bought ? "border-[#4F8A63] bg-[#4F8A63] text-white" : "border-[#D7CBB3]"} text-[8px] font-bold`}>
            {i.bought ? "✓" : ""}
          </div>
          <div className="min-w-0 flex-1">
            <div className={`text-[9px] font-semibold ${i.bought ? "line-through text-[#5C6A6E]" : "text-[#16323D]"}`}>{i.n}</div>
            <div className="text-[8px] text-[#5C6A6E]">{i.s}</div>
          </div>
          <div className="font-mono text-[9px] font-bold text-[#16323D]">{i.c}</div>
        </div>
      ))}
    </div>
  );
}

function MockupContacts({ EN }: { EN: boolean }) {
  const contacts = [
    { name:"Jorge Saldarriaga", spec:EN?"Tile & Flooring":"Tile y Pisos", rate:"$45/hr", type:EN?"Specialist":"Especialista", c:"bg-[#EDF3FB] text-[#395886]" },
    { name:"Miami Plumbing Co", spec:EN?"Plumbing":"Plomería",             rate:"$1,800 job", type:EN?"Supplier":"Proveedor", c:"bg-[#EDE3CF] text-[#7A6230]" },
    { name:"Carlos Pinto",      spec:EN?"Electrical":"Eléctrico",          rate:"$55/hr", type:EN?"Specialist":"Especialista", c:"bg-[#EDF3FB] text-[#395886]" },
  ];
  return (
    <div className="space-y-2">
      {contacts.map(c => (
        <div key={c.name} className="flex items-center gap-3 rounded-xl border border-[#E6DDCB] bg-white px-3 py-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#16323D] text-[10px] font-bold text-white">
            {c.name.split(" ").map(w => w[0]).join("").slice(0,2)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-bold text-[#16323D]">{c.name}</div>
            <div className="text-[8px] text-[#5C6A6E]">{c.spec} · {c.rate}</div>
          </div>
          <span className={`rounded-full px-1.5 py-0.5 text-[8px] font-bold ${c.c}`}>{c.type}</span>
        </div>
      ))}
    </div>
  );
}

function MockupNotes({ EN }: { EN: boolean }) {
  return (
    <div className="space-y-2">
      <div className="overflow-hidden rounded-xl border border-[#E6DDCB] bg-white">
        <div className="px-3 py-2.5">
          <div className="mb-1 text-[9px] font-bold text-[#16323D]">{EN?"Client wants white subway tile on accent wall":"Cliente quiere tile subway blanco en pared de acento"}</div>
          <div className="text-[8px] leading-relaxed text-[#5C6A6E]">{EN?"Also requested heated floors in the master bath area. Confirm with supplier before ordering.":"También solicita piso con calefacción en el baño principal. Confirmar con proveedor antes de ordenar."}</div>
        </div>
        <div className="flex items-center gap-2 border-t border-[#F0EBE0] bg-[#FDFAF6] px-3 py-1.5">
          <div className="flex items-center gap-1 rounded-lg border border-[#E6DDCB] px-1.5 py-0.5">
            <div className="h-3 w-3 rounded bg-[#DCE8E9]" />
            <span className="text-[7px] text-[#5C6A6E]">site_photo.jpg</span>
          </div>
          <div className="flex items-center gap-1 rounded-lg border border-[#E6DDCB] px-1.5 py-0.5">
            <div className="h-3 w-3 rounded bg-[#F0DBD2]" />
            <span className="text-[7px] text-[#5C6A6E]">contract.pdf</span>
          </div>
        </div>
      </div>
      <div className="rounded-xl border border-[#E6DDCB] bg-white px-3 py-2.5">
        <div className="text-[9px] font-bold text-[#16323D]">{EN?"Inspection passed - June 14":"Inspección aprobada - 14 junio"}</div>
        <div className="mt-0.5 text-[8px] text-[#5C6A6E]">{EN?"Inspector signed off on rough plumbing.":"Inspector aprobó la plomería preliminar."}</div>
      </div>
      <div className="flex items-center justify-center rounded-xl border-2 border-dashed border-[#D7CBB3] py-2">
        <span className="text-[9px] font-semibold text-[#5C6A6E]">+ {EN?"New Note":"Nueva Nota"}</span>
      </div>
    </div>
  );
}

function MockupVoice({ EN }: { EN: boolean }) {
  const cmds = EN
    ? ["Create project Miami Kitchen","Add task demo walls","Add payment $4000","Add material tile $800"]
    : ["Crear proyecto Cocina Miami","Agregar tarea demoler paredes","Agregar pago $4000","Agregar material tile $800"];
  return (
    <div className="flex gap-3">
      <div className="flex shrink-0 flex-col items-center gap-2">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#16323D] shadow-lg">
          <span className="text-2xl">🎙</span>
        </div>
        <div className="text-[8px] text-center font-semibold text-[#5C6A6E]">Katy</div>
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#4F8A63]">
          <div className="h-2.5 w-2.5 animate-pulse rounded-full bg-white" />
        </div>
        <div className="text-[7px] text-[#4F8A63] font-bold">{EN?"Listening…":"Escuchando…"}</div>
      </div>
      <div className="flex-1 space-y-1.5">
        <div className="text-[9px] font-bold uppercase tracking-wide text-[#5C6A6E] mb-2">{EN?"Say commands like:":"Di comandos como:"}</div>
        {cmds.map(c => (
          <div key={c} className="flex items-center gap-1.5 rounded-lg border border-[#E6DDCB] bg-[#FDFAF6] px-2.5 py-1.5">
            <span className="text-[9px]">🗣</span>
            <span className="font-mono text-[9px] text-[#395886]">"{c}"</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Feature data ─────────────────────────────────────────────────────────────

function useFeatures(EN: boolean) {
  return [
    {
      id: "dashboard", icon: "📊",
      title:  EN ? "Dashboard" : "Dashboard",
      desc:   EN ? "Your control center. Monitor all projects, KPIs and financial health at a glance."
                 : "Tu centro de control. Monitorea todos tus proyectos, KPIs y estado financiero de un vistazo.",
      mockup: <MockupDashboard EN={EN} />,
      steps: EN ? [
        { t:"Create a project", d:"Click <b>+ New Project</b> at the top. Fill in title, client name, address and start date." },
        { t:"Read the KPI cards", d:"Each card shows <b>Income</b> (received from client), <b>Expenses</b> (paid out), <b>Balance</b> and <b>Estimate</b> total. Click any card to see the full breakdown." },
        { t:"Project amount", d:"The amount shown on each project card is automatically pulled from its <b>Estimate grand total</b> — it updates every time you open the Estimate tab." },
        { t:"Delete a project", d:"Hover over a project card — a <b>🗑 trash icon</b> appears in the top-right corner. Click it and confirm to permanently delete the project and all its data." },
        { t:"Edit a project", d:"Click the <b>✏ pencil icon</b> on any project card to update its title, client or status." },
      ] : [
        { t:"Crear un proyecto", d:"Clic en <b>+ Nuevo Proyecto</b>. Completa título, cliente, dirección y fecha de inicio." },
        { t:"Leer las tarjetas KPI", d:"Cada tarjeta muestra <b>Ingresos</b> (recibidos del cliente), <b>Egresos</b> (pagados), <b>Balance</b> y total del <b>Estimado</b>. Clic para ver el desglose completo." },
        { t:"Monto del proyecto", d:"El monto de cada tarjeta se toma automáticamente del <b>total del Estimado</b> — se actualiza cada vez que abres el tab Estimate." },
        { t:"Eliminar un proyecto", d:"Pasa el cursor sobre una tarjeta — aparece el <b>ícono 🗑 papelera</b> en la esquina superior derecha. Haz clic y confirma para eliminar el proyecto permanentemente." },
        { t:"Editar un proyecto", d:"Clic en el <b>ícono ✏ lápiz</b> de cualquier tarjeta para actualizar título, cliente o estado." },
      ],
      tips: EN ? [
        "💡 The balance turns <b>red</b> when expenses exceed income — a quick financial warning.",
        "💡 Project deletion is <b>permanent</b> — all tasks, payments, materials and estimates are removed.",
        "🎙 Say <b>\"Create project [name]\"</b> to Katy to add a new project by voice.",
      ] : [
        "💡 El balance se pone <b>rojo</b> cuando los egresos superan los ingresos.",
        "💡 Eliminar un proyecto es <b>permanente</b> — se borran todas las tareas, pagos, materiales y el estimado.",
        "🎙 Di <b>\"Crear proyecto [nombre]\"</b> a Katy para agregar un proyecto por voz.",
      ],
    },
    {
      id: "workflow", icon: "🗂",
      title: EN ? "Workflow" : "Flujo de Trabajo",
      desc:  EN ? "Manage project tasks with a Kanban board. Drag cards between columns or switch to Gantt timeline view."
                : "Gestiona las tareas del proyecto con un tablero Kanban. Arrastra tarjetas entre columnas o cambia a vista Gantt.",
      mockup: <MockupWorkflow EN={EN} />,
      steps: EN ? [
        { t:"Add a task", d:"Click <b>+ Add Task</b> under any column. Fill in name, estimated <b>hours</b>, duration in weeks, and optionally assign a contact." },
        { t:"Drag to change status", d:"Drag cards between <b>Pending → In Progress → Done</b>. On mobile, long-press to start dragging." },
        { t:"Switch to Gantt view", d:"Click the <b>Gantt</b> button above the board to see a horizontal timeline of all tasks by week." },
        { t:"Import from Estimate", d:"In the <b>Estimate</b> tab, click <b>Generate Workflow Tasks</b> to open the Day Planner and turn estimate items into scheduled Kanban tasks." },
      ] : [
        { t:"Agregar una tarea", d:"Clic en <b>+ Agregar Tarea</b> en cualquier columna. Ingresa nombre, <b>horas</b> estimadas, semanas y asigna un contacto (opcional)." },
        { t:"Arrastrar para cambiar estado", d:"Arrastra tarjetas entre <b>Pendiente → En Proceso → Listo</b>. En móvil, mantén presionado para arrastrar." },
        { t:"Cambiar a vista Gantt", d:"Clic en el botón <b>Gantt</b> encima del tablero para ver una línea de tiempo horizontal por semana." },
        { t:"Importar desde Estimado", d:"En la pestaña <b>Estimado</b>, clic en <b>Generar Tareas</b> para abrir el Planificador por Día y convertir items en tareas." },
      ],
      tips: EN ? [
        "💡 The <b>Day Planner</b> lets you drag estimate items into day columns (Day 1, Day 2…) with hours capacity bars. Use <b>Auto-assign</b> to fill days automatically.",
        "🎙 Say <b>\"Add task [description]\"</b> to Katy to add it to the current project.",
      ] : [
        "💡 El <b>Planificador por Día</b> permite arrastrar items del estimado a columnas de días con barras de capacidad. Usa <b>Auto-asignar</b> para llenar automáticamente.",
        "🎙 Di <b>\"Agregar tarea [descripción]\"</b> a Katy para añadirla al proyecto actual.",
      ],
    },
    {
      id: "estimate", icon: "💰",
      title: EN ? "Estimate" : "Estimado",
      desc:  EN ? "Create professional client proposals with sections, line items, discounts, payment schedules and PDF export."
                : "Crea propuestas profesionales para clientes con secciones, items, descuentos, calendario de pagos y exportación PDF.",
      mockup: <MockupEstimate EN={EN} />,
      steps: EN ? [
        { t:"Create the estimate", d:"Go to the <b>Estimate</b> tab inside a project and click <b>Create Estimate</b>. Customer info is pre-filled from the project data." },
        { t:"Add sections from catalog", d:"Click <b>+ Add Section</b> and choose from the catalog: DEMOLITION, PLUMBING, STRUCTURE, ELECTRICAL, TILE, PAINTING… or create a custom section." },
        { t:"Add line items", d:"Expand any section and click <b>+ Add item</b>. Type the description and dollar amount. Items auto-sum the section total. Or enter a single flat total if you don't need itemization." },
        { t:"Set discount & payment schedule", d:"In the <b>Totals card</b>, enter a discount % (applies only to labor, not materials). The payment schedule has 3 deposits (50/25/25% default) — fully editable." },
        { t:"Download the PDF", d:"Click <b>Download PDF</b>. A branded Luxaris Design proposal downloads instantly with all sections, totals, payment schedule and contractor name." },
      ] : [
        { t:"Crear el estimado", d:"Ve a la pestaña <b>Estimado</b> dentro del proyecto y clic en <b>Crear Estimado</b>. Los datos del cliente se llenan solos desde el proyecto." },
        { t:"Agregar secciones del catálogo", d:"Clic en <b>+ Agregar Sección</b> y elige: DEMOLICIÓN, PLOMERÍA, ESTRUCTURA, ELÉCTRICO, TILE, PINTURA… o crea una sección personalizada." },
        { t:"Agregar items", d:"Expande una sección y clic en <b>+ Agregar item</b>. Escribe descripción y monto. Los items suman el total de la sección automáticamente. O ingresa un total plano si no necesitas desglose." },
        { t:"Descuento y calendario de pagos", d:"En la <b>tarjeta de Totales</b>, ingresa un % de descuento (solo sobre mano de obra, no materiales). El calendario tiene 3 depósitos (50/25/25% por defecto) — totalmente editable." },
        { t:"Descargar PDF", d:"Clic en <b>Descargar PDF</b>. La propuesta Luxaris Design se descarga al instante con todas las secciones, totales, calendario de pagos y nombre del contratista." },
      ],
      tips: EN ? [
        "💡 <b>Materials sections</b> (toggle the checkbox per section) are excluded from the labor discount automatically.",
        "💡 After building the estimate, click <b>Generate Workflow Tasks</b> to open the Day Planner and schedule each item with dates.",
        "🔄 Change status: <b>Draft → Sent → Approved → Rejected</b> from the dropdown at the top of the tab.",
      ] : [
        "💡 Las <b>secciones de materiales</b> (activa el checkbox por sección) se excluyen del descuento automáticamente.",
        "💡 Después de crear el estimado, clic en <b>Generar Tareas</b> para abrir el Planificador por Día y programar cada item con fechas.",
        "🔄 Cambia estado: <b>Borrador → Enviado → Aprobado → Rechazado</b> desde el selector en la parte superior.",
      ],
    },
    {
      id: "payments", icon: "💳",
      title: EN ? "Payments" : "Pagos",
      desc:  EN ? "Track all money in (from client) and money out (to workers/suppliers) per project."
                : "Registra todo el dinero que entra (del cliente) y que sale (a trabajadores/proveedores) por proyecto.",
      mockup: <MockupPayments EN={EN} />,
      steps: EN ? [
        { t:"Log a client payment (Income)", d:"Click <b>+ Income</b>. Enter: amount, date, payment method (Cash / Zelle / Transfer / Check / Card) and type (Deposit / Advance / Final)." },
        { t:"Log an expense (Outflow)", d:"Click <b>+ Expense</b>. Enter: amount, date, method, <b>payee name</b> (who you paid) and <b>concept</b>. Example: Jorge · Tile installation labor." },
        { t:"Monitor the balance", d:"The summary at the top shows total Income, total Expenses and the running Balance. A <b>red balance</b> means you've paid out more than received." },
      ] : [
        { t:"Registrar ingreso (pago del cliente)", d:"Clic en <b>+ Ingreso</b>. Ingresa: monto, fecha, método (Efectivo/Zelle/Transferencia/Cheque/Tarjeta) y tipo (Abono/Anticipo/Final)." },
        { t:"Registrar egreso (pago realizado)", d:"Clic en <b>+ Egreso</b>. Ingresa: monto, fecha, método, <b>nombre del beneficiario</b> y <b>concepto</b>. Ej: Jorge · Instalación de tile." },
        { t:"Monitorear el balance", d:"El resumen muestra total Ingresos, total Egresos y el Balance corriente. Un <b>balance rojo</b> indica que has pagado más de lo que recibiste." },
      ],
      tips: EN ? [
        "💡 These numbers feed directly into the <b>Dashboard KPI cards</b> — keep them updated for accurate reporting.",
        "🎙 Say <b>\"Add payment $2000\"</b> or <b>\"Add expense $500 Jorge\"</b> to Katy for quick voice entry.",
      ] : [
        "💡 Estos números alimentan directamente las <b>tarjetas KPI del Dashboard</b> — mantenlos actualizados para reportes precisos.",
        "🎙 Di <b>\"Agregar pago $2000\"</b> o <b>\"Agregar egreso $500 Jorge\"</b> a Katy para registro rápido por voz.",
      ],
    },
    {
      id: "materials", icon: "🔩",
      title: EN ? "Materials" : "Materiales",
      desc:  EN ? "Shopping list of all materials needed per project. Mark items as purchased to track what's still pending."
                : "Lista de compras de todos los materiales necesarios por proyecto. Marca los items como comprados para ver qué falta.",
      mockup: <MockupMaterials EN={EN} />,
      steps: EN ? [
        { t:"Add a material", d:"Click <b>+ Add Material</b>. Enter the material name, supplier (store or person name) and cost." },
        { t:"Mark as purchased", d:"Click the <b>✓ checkbox</b> once you've bought it. The row turns gray so you can focus on what's still pending." },
        { t:"Track the total cost", d:"The tab shows the <b>total material cost</b> at the bottom — compare it against the Materials section in your Estimate." },
      ] : [
        { t:"Agregar un material", d:"Clic en <b>+ Agregar Material</b>. Ingresa nombre del material, proveedor (tienda o persona) y costo." },
        { t:"Marcar como comprado", d:"Clic en el <b>checkbox ✓</b> una vez comprado. La fila se pone gris para que te enfoques en lo que falta." },
        { t:"Ver el costo total", d:"La pestaña muestra el <b>costo total de materiales</b> abajo — compáralo con la sección Materiales del Estimado." },
      ],
      tips: EN ? [
        "💡 Use the supplier field to note <b>where to buy</b> — e.g., \"Home Depot · Aisle 12\". Makes shopping trips much faster.",
        "🎙 Say <b>\"Add material porcelain tile $800\"</b> to Katy.",
      ] : [
        "💡 Usa el campo de proveedor para anotar <b>dónde comprarlo</b> — ej. \"Home Depot · Pasillo 12\". Facilita las compras.",
        "🎙 Di <b>\"Agregar material porcelanato $800\"</b> a Katy.",
      ],
    },
    {
      id: "contacts", icon: "👥",
      title: EN ? "Contacts" : "Contactos",
      desc:  EN ? "Manage your specialists (plumbers, tile setters, electricians) and suppliers. Assign them to projects."
                : "Gestiona especialistas (plomeros, instaladores de tile, electricistas) y proveedores. Asígnalos a proyectos.",
      mockup: <MockupContacts EN={EN} />,
      steps: EN ? [
        { t:"Create a contact", d:"Go to <b>Contacts</b> in the top nav (global list) or the Contacts tab inside a project. Click <b>+ Add Contact</b> and fill in name, specialty, phone and rate." },
        { t:"Set type and rate", d:"Choose: <b>Coworker</b> (subcontractor) or <b>Supplier</b>. Set rate as hourly or by job — e.g., \"$45/hr\" or \"$1,200 per job\"." },
        { t:"Link contact to a project", d:"Inside a project's <b>Contacts tab</b>, search and add existing contacts. They then appear in the Workflow task assignment dropdown." },
      ] : [
        { t:"Crear un contacto", d:"Ve a <b>Contactos</b> en la navegación superior (lista global) o la pestaña Contactos dentro de un proyecto. Clic en <b>+ Agregar Contacto</b>." },
        { t:"Definir tipo y tarifa", d:"Elige: <b>Colaborador</b> (subcontratista) o <b>Proveedor</b>. Tarifa por hora o por trabajo — ej. \"$45/hr\" o \"$1,200 por trabajo\"." },
        { t:"Vincular contacto a un proyecto", d:"Dentro de la pestaña <b>Contactos</b> del proyecto, busca y agrega contactos existentes. Aparecerán en el selector de asignación del Workflow." },
      ],
      tips: EN ? [
        "💡 Contacts linked to a project appear in <b>Workflow → Assign</b> so you can assign tasks directly to them.",
        "📋 The global <b>Contacts page</b> (top nav) shows all specialists across all projects — great for building your trusted team list.",
      ] : [
        "💡 Los contactos vinculados al proyecto aparecen en <b>Workflow → Asignar</b> para asignar tareas directamente.",
        "📋 La página global de <b>Contactos</b> (nav superior) muestra todos los especialistas de todos los proyectos.",
      ],
    },
    {
      id: "notes", icon: "📝",
      title: EN ? "Notes" : "Notas",
      desc:  EN ? "Write free-form notes per project and attach images or PDFs. Great for client requests, site photos and documents."
                : "Escribe notas libres por proyecto y adjunta imágenes o PDFs. Ideal para solicitudes del cliente, fotos de obra y documentos.",
      mockup: <MockupNotes EN={EN} />,
      steps: EN ? [
        { t:"Write a note", d:"Go to the <b>Notes</b> tab and click <b>+ New Note</b>. Type freely — notes are saved per project and visible to anyone with access to that project." },
        { t:"Attach images or PDFs", d:"Click the <b>📎 attachment button</b> inside a note. Supported formats: JPG, PNG, PDF. Files are uploaded to secure storage and shown as previews." },
        { t:"View and delete", d:"Notes appear as cards in reverse chronological order. Click the <b>🗑 trash icon</b> to delete a note — this also permanently removes its attached files." },
      ] : [
        { t:"Escribir una nota", d:"Ve a la pestaña <b>Notas</b> y clic en <b>+ Nueva Nota</b>. Escribe libremente — las notas se guardan por proyecto y son visibles para quienes tengan acceso." },
        { t:"Adjuntar imágenes o PDFs", d:"Clic en el botón <b>📎 adjuntar</b> dentro de la nota. Formatos soportados: JPG, PNG, PDF. Los archivos se guardan en almacenamiento seguro." },
        { t:"Ver y eliminar", d:"Las notas aparecen en orden cronológico inverso. Clic en el <b>ícono 🗑</b> para eliminar una nota — esto también borra los archivos adjuntos permanentemente." },
      ],
      tips: EN ? [
        "💡 Use Notes to store <b>before/after photos</b> at each stage — giving you a built-in visual project timeline.",
        "📄 Attach the <b>signed contract PDF</b> to the project so it's always accessible inside the app, not buried in email.",
      ] : [
        "💡 Usa Notas para guardar <b>fotos de antes/después</b> de cada etapa — creas una línea de tiempo visual del proyecto.",
        "📄 Adjunta el <b>PDF del contrato firmado</b> para que siempre esté accesible dentro de la app, no enterrado en el email.",
      ],
    },
    {
      id: "voice", icon: "🎙",
      title: EN ? "Katy — Voice Assistant" : "Katy — Asistente de Voz",
      desc:  EN ? "Tap the microphone button (bottom-right of any screen), speak a command and Katy creates records automatically — no typing needed."
                : "Toca el botón del micrófono (abajo a la derecha de cualquier pantalla), habla un comando y Katy crea los registros automáticamente.",
      mockup: <MockupVoice EN={EN} />,
      steps: EN ? [
        { t:"Open Katy", d:"Tap the <b>🎙 microphone button</b> at the bottom-right corner of any page. The button glows when Katy is listening." },
        { t:"Speak your command", d:"Say a command clearly — for example: <b>\"Add payment $3000\"</b> or <b>\"Create task install tile\"</b>. Katy understands both English and Spanish." },
        { t:"Review before saving", d:"Katy shows you a confirmation card with what she understood. You can <b>edit any field</b> before confirming. Nothing saves until you tap Confirm." },
        { t:"Navigate to the right project first", d:"Katy uses the <b>currently open project</b> as context. Open the project you want to add to before speaking." },
      ] : [
        { t:"Abrir Katy", d:"Toca el <b>botón 🎙 micrófono</b> en la esquina inferior derecha de cualquier página. El botón brilla cuando Katy está escuchando." },
        { t:"Hablar el comando", d:"Di el comando claramente — por ejemplo: <b>\"Agregar pago $3000\"</b> o <b>\"Crear tarea instalar tile\"</b>. Katy entiende inglés y español." },
        { t:"Revisar antes de guardar", d:"Katy muestra una tarjeta de confirmación con lo que entendió. Puedes <b>editar cualquier campo</b> antes de confirmar. Nada se guarda hasta que toques Confirmar." },
        { t:"Navegar al proyecto correcto primero", d:"Katy usa el <b>proyecto actualmente abierto</b> como contexto. Abre el proyecto al que quieres agregar antes de hablar." },
      ],
      tips: EN ? [
        "🗣 Supported commands: <b>Create project · Add task · Add material · Add payment · Add expense · Add contact · Add note</b>",
        "💡 Speak at a <b>normal pace</b> — no need to pause between words. Katy waits for a natural silence before processing.",
        "🌐 Switch to Spanish in the top-right language toggle and Katy will respond in Spanish too.",
      ] : [
        "🗣 Comandos soportados: <b>Crear proyecto · Agregar tarea · Agregar material · Agregar pago · Agregar egreso · Agregar contacto · Agregar nota</b>",
        "💡 Habla a <b>ritmo normal</b> — no necesitas pausar entre palabras. Katy espera un silencio natural antes de procesar.",
        "🌐 Cambia a español con el selector de idioma (arriba a la derecha) y Katy también responderá en español.",
      ],
    },
  ];
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function HelpPage() {
  const { language } = useLanguage();
  const EN = language === "en";
  const features = useFeatures(EN);
  const [activeId, setActiveId] = useState("dashboard");
  const active = features.find(f => f.id === activeId) ?? features[0];

  return (
    <div className="flex min-h-[calc(100vh-80px)] gap-0 overflow-hidden rounded-2xl border border-[#E6DDCB] bg-white shadow-sm">

      {/* ── Sidebar ───────────────────────────────────────────────────────────── */}
      <aside className="flex w-52 shrink-0 flex-col border-r border-[#E6DDCB] py-4">
        <div className="mb-2 px-4 text-[9px] font-bold uppercase tracking-widest text-[#5C6A6E]">
          {EN ? "Features" : "Funcionalidades"}
        </div>
        {features.slice(0, 7).map(f => (
          <button
            key={f.id}
            onClick={() => setActiveId(f.id)}
            className={`flex items-center gap-2.5 px-3 py-2 mx-2 rounded-xl text-left transition ${
              activeId === f.id
                ? "bg-[#EDF3FB] text-[#395886]"
                : "text-[#16323D] hover:bg-[#F7F3EA]"
            }`}
          >
            <span className="text-base">{f.icon}</span>
            <span className={`text-[12px] font-semibold ${activeId === f.id ? "text-[#395886]" : "text-[#16323D]"}`}>
              {f.title}
            </span>
          </button>
        ))}

        <div className="mx-4 my-3 border-t border-[#E6DDCB]" />
        <div className="mb-2 px-4 text-[9px] font-bold uppercase tracking-widest text-[#5C6A6E]">
          {EN ? "Assistant" : "Asistente"}
        </div>
        {features.slice(7).map(f => (
          <button
            key={f.id}
            onClick={() => setActiveId(f.id)}
            className={`flex items-center gap-2.5 px-3 py-2 mx-2 rounded-xl text-left transition ${
              activeId === f.id
                ? "bg-[#EDF3FB] text-[#395886]"
                : "text-[#16323D] hover:bg-[#F7F3EA]"
            }`}
          >
            <span className="text-base">{f.icon}</span>
            <span className={`text-[12px] font-semibold ${activeId === f.id ? "text-[#395886]" : "text-[#16323D]"}`}>
              {f.title}
            </span>
          </button>
        ))}

        <div className="mt-auto mx-3 rounded-xl bg-[#F7F3EA] p-3">
          <div className="text-[9px] leading-relaxed text-[#5C6A6E]">
            {EN ? "💡 Click any feature to see step-by-step guide with visual examples."
                : "💡 Clic en cualquier función para ver la guía paso a paso con ejemplos visuales."}
          </div>
        </div>
      </aside>

      {/* ── Content ───────────────────────────────────────────────────────────── */}
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">

        {/* Header */}
        <div className="sticky top-0 z-10 border-b border-[#E6DDCB] bg-white px-8 py-5">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{active.icon}</span>
            <div>
              <h1 className="font-[Manrope] text-xl font-black text-[#16323D]">{active.title}</h1>
              <p className="text-[13px] text-[#5C6A6E]">{active.desc}</p>
            </div>
          </div>
        </div>

        <div className="p-8 space-y-8">

          {/* Visual mockup */}
          <section>
            <div className="mb-3 text-[10px] font-bold uppercase tracking-widest text-[#5C6A6E]">
              {EN ? "Visual Preview" : "Vista Previa Visual"}
            </div>
            <div className="rounded-2xl border border-[#E6DDCB] bg-[#FDFAF6] p-4">
              {active.mockup}
            </div>
          </section>

          {/* Steps */}
          <section>
            <div className="mb-3 text-[10px] font-bold uppercase tracking-widest text-[#5C6A6E]">
              {EN ? "How to use it" : "Cómo usarlo"}
            </div>
            <div className="space-y-0">
              {active.steps.map((step, i) => (
                <div key={i} className="flex gap-4 border-b border-[#F0EBE0] py-4 last:border-0">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#EDF3FB] text-[13px] font-black text-[#395886]">
                    {i + 1}
                  </div>
                  <div>
                    <div className="mb-1 text-[13px] font-bold text-[#16323D]">{step.t}</div>
                    <div
                      className="text-[12px] leading-relaxed text-[#5C6A6E]"
                      dangerouslySetInnerHTML={{ __html: step.d }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Tips */}
          <section>
            <div className="mb-3 text-[10px] font-bold uppercase tracking-widest text-[#5C6A6E]">
              Tips
            </div>
            <div className="rounded-2xl border border-[#E6DDCB] bg-[#F7F3EA] p-4 space-y-3">
              {active.tips.map((tip, i) => (
                <div
                  key={i}
                  className="text-[12px] leading-relaxed text-[#5C6A6E]"
                  dangerouslySetInnerHTML={{ __html: tip }}
                />
              ))}
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}
