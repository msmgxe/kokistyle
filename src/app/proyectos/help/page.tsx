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
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 rounded-xl border border-[#395886] bg-[#EDF3FB] px-3 py-2">
        <div className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#395886] text-[8px] font-bold text-white">↓</div>
        <span className="text-[9px] font-bold text-[#395886]">
          {EN ? "Import from Estimate" : "Importar del Estimado"}
        </span>
      </div>
      <div className="overflow-hidden rounded-2xl border border-[#E6DDCB] bg-white">
        {[
          { n: EN ? "Compra de PORCELAIN" : "Compra de PORCELAIN", badge: EN ? "FROM EST" : "DEL EST", qty: "50 sq.ft", cost: "$1,500", bought: false },
          { n: EN ? "Compra de GLASS DOOR" : "Compra de GLASS DOOR", badge: EN ? "FROM EST" : "DEL EST", qty: "1 unit",  cost: "$1,850", bought: true  },
          { n: "LED MIRROR",                                          badge: null,                        qty: "",        cost: "$650",   bought: false },
        ].map(i => (
          <div key={i.n} className={`flex items-center gap-2.5 border-b border-[#F0EBE0] px-3 py-2 last:border-0 ${i.bought ? "opacity-50" : ""}`}>
            <div className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${i.bought ? "border-[#4F8A63] bg-[#4F8A63] text-white" : "border-[#D7CBB3]"} text-[8px] font-bold`}>
              {i.bought ? "✓" : ""}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className={`text-[9px] font-semibold ${i.bought ? "line-through text-[#5C6A6E]" : "text-[#16323D]"}`}>{i.n}</span>
                {i.badge && (
                  <span className="rounded bg-[#EDF3FB] px-1 py-px text-[7px] font-bold text-[#395886]">{i.badge}</span>
                )}
              </div>
              {i.qty && <div className="text-[8px] text-[#5C6A6E]">{i.qty}</div>}
            </div>
            <div className="font-mono text-[9px] font-bold text-[#16323D]">{i.cost}</div>
          </div>
        ))}
      </div>
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

function MockupPlan({ EN }: { EN: boolean }) {
  const tasks = EN
    ? [
        { name:"Demo walls",        weeks:1, col:"#B0492F", start:0, span:1, status:"Done ✓" },
        { name:"Rough plumbing",    weeks:2, col:"#395886", start:1, span:2, status:"In Progress" },
        { name:"Tile installation", weeks:2, col:"#7A6230", start:2, span:2, status:"Pending" },
        { name:"Painting",          weeks:1, col:"#4F8A63", start:4, span:1, status:"Pending" },
      ]
    : [
        { name:"Demoler paredes",   weeks:1, col:"#B0492F", start:0, span:1, status:"Listo ✓" },
        { name:"Plomería inicial",  weeks:2, col:"#395886", start:1, span:2, status:"En Proceso" },
        { name:"Instalación tile",  weeks:2, col:"#7A6230", start:2, span:2, status:"Pendiente" },
        { name:"Pintura",           weeks:1, col:"#4F8A63", start:4, span:1, status:"Pendiente" },
      ];
  const weeks = [1,2,3,4,5];
  return (
    <div className="overflow-hidden rounded-2xl border border-[#E6DDCB] bg-white">
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-[#F0EBE0] bg-[#F7F3EA] px-3 py-2">
        <div className="flex gap-1">
          {[EN?"All":"Todo", EN?"To do":"Por hacer", EN?"In progress":"En proceso", EN?"Done":"Listo"].map((f,i) => (
            <span key={f} className={`rounded-full px-2 py-0.5 text-[8px] font-bold ${i===0 ? "bg-[#16323D] text-white" : "text-[#5C6A6E]"}`}>{f}</span>
          ))}
        </div>
        <div className="flex gap-1">
          {[EN?"Weeks":"Semanas", EN?"Days":"Días"].map((v,i) => (
            <span key={v} className={`rounded-lg px-2 py-0.5 text-[8px] font-semibold ${i===0 ? "bg-[#395886] text-white" : "text-[#5C6A6E]"}`}>{v}</span>
          ))}
        </div>
      </div>
      {/* Gantt grid */}
      <div className="p-3">
        {/* Week headers */}
        <div className="mb-1.5 flex">
          <div className="w-28 shrink-0" />
          {weeks.map(w => (
            <div key={w} className="flex-1 text-center text-[8px] font-bold text-[#5C6A6E]">
              {EN ? `Wk ${w}` : `Sem ${w}`}
            </div>
          ))}
        </div>
        {/* Task rows */}
        {tasks.map(task => (
          <div key={task.name} className="mb-1.5 flex items-center">
            <div className="w-28 shrink-0 truncate pr-2 text-[9px] font-semibold text-[#16323D]">{task.name}</div>
            <div className="relative flex flex-1 gap-0">
              {weeks.map(w => (
                <div key={w} className="flex-1 border-l border-[#F0EBE0] px-px py-px first:border-l-0">
                  {w === task.start + 1 && (
                    <div
                      className="h-4 rounded-full px-1.5 flex items-center"
                      style={{
                        background: task.col,
                        width: `calc(${task.span * 100}% - 2px)`,
                        position: "absolute",
                        left: `calc(${task.start * (100/5)}% + 1px)`,
                        opacity: 0.85,
                      }}
                    >
                      <span className="truncate text-[7px] font-bold text-white">{task.name}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MockupDayPlanner({ EN }: { EN: boolean }) {
  const pool = EN
    ? [{ label:"Electrical rough-in", sec:"ELECTRICAL", hrs:8, c:"#395886" },
       { label:"Custom item: cleanup",  sec:"CUSTOM",    hrs:2, c:"#7A6230" }]
    : [{ label:"Rough eléctrico",      sec:"ELÉCTRICO", hrs:8, c:"#395886" },
       { label:"Item custom: limpieza", sec:"CUSTOM",   hrs:2, c:"#7A6230" }];
  const days = EN
    ? [
        { label:"Day 1", date:"Jun 30", items:[{ label:"Demo walls", sec:"DEMOLITION", hrs:6, c:"#B0492F" }], cap:8, used:6 },
        { label:"Day 2", date:"Jul 1",  items:[{ label:"Rough plumbing", sec:"PLUMBING", hrs:8, c:"#395886" }], cap:8, used:8 },
        { label:"Day 3", date:"Jul 2",  items:[], cap:8, used:0 },
      ]
    : [
        { label:"Día 1", date:"30 jun", items:[{ label:"Demoler paredes", sec:"DEMOLICIÓN", hrs:6, c:"#B0492F" }], cap:8, used:6 },
        { label:"Día 2", date:"1 jul",  items:[{ label:"Plomería inicial", sec:"PLOMERÍA", hrs:8, c:"#395886" }], cap:8, used:8 },
        { label:"Día 3", date:"2 jul",  items:[], cap:8, used:0 },
      ];
  return (
    <div className="flex gap-2.5">
      {/* Pool */}
      <div className="w-36 shrink-0">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-[8px] font-bold uppercase tracking-wide text-[#5C6A6E]">{EN ? "Item Pool" : "Items"}</span>
          <span className="rounded-full bg-[#16323D] px-1.5 py-0.5 text-[7px] font-bold text-white">+ {EN?"Custom":"Custom"}</span>
        </div>
        <div className="space-y-1.5">
          {pool.map(item => (
            <div key={item.label} className="rounded-lg border border-[#E6DDCB] bg-white px-2 py-1.5">
              <div className="mb-0.5 truncate text-[8px] font-semibold text-[#16323D]">{item.label}</div>
              <div className="flex items-center gap-1">
                <span className="rounded-full px-1 py-0.5 text-[6px] font-bold text-white" style={{ background: item.c }}>{item.sec}</span>
                <span className="text-[7px] text-[#5C6A6E]">{item.hrs}h</span>
              </div>
            </div>
          ))}
        </div>
      </div>
      {/* Day columns */}
      <div className="flex flex-1 gap-1.5">
        {days.map(day => {
          const pct = Math.round((day.used / day.cap) * 100);
          return (
            <div key={day.label} className="flex-1 rounded-xl bg-[#F7F3EA] p-1.5">
              <div className="mb-1 text-[8px] font-bold text-[#16323D]">{day.label}</div>
              <div className="mb-1 text-[7px] text-[#5C6A6E]">{day.date}</div>
              {/* Capacity bar */}
              <div className="mb-1.5 h-1 w-full overflow-hidden rounded-full bg-[#E6DDCB]">
                <div className="h-full rounded-full" style={{ width: `${pct}%`, background: pct >= 100 ? "#B0492F" : "#4F8A63" }} />
              </div>
              <div className="mb-1.5 text-[6px] text-[#5C6A6E]">{day.used}/{day.cap}h</div>
              {day.items.map(item => (
                <div key={item.label} className="mb-1 rounded-lg border border-[#E6DDCB] bg-white px-1.5 py-1">
                  <div className="truncate text-[7px] font-semibold text-[#16323D]">{item.label}</div>
                  <span className="rounded px-0.5 py-px text-[6px] font-bold text-white" style={{ background: item.c }}>{item.sec}</span>
                </div>
              ))}
              {day.items.length === 0 && (
                <div className="rounded-lg border border-dashed border-[#D7CBB3] py-2 text-center text-[7px] text-[#C4B89A]">
                  {EN ? "Drop here" : "Soltar aquí"}
                </div>
              )}
            </div>
          );
        })}
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

function MockupTeam({ EN }: { EN: boolean }) {
  const users = EN
    ? [
        { initials:"L", bg:"#395886", name:"Lidette",       badge:"👷 Co-worker", tag:"My tasks only", tabs:"Workflow · Day Planner · Notes" },
        { initials:"G", bg:"#7B6A45", name:"García Family", badge:"👤 Client",    tag:"",              tabs:"Estimate · Workflow · Gantt · Notes · Design" },
      ]
    : [
        { initials:"L", bg:"#395886", name:"Lidette",       badge:"👷 Co-worker", tag:"Solo sus tareas", tabs:"Workflow · Day Planner · Notas" },
        { initials:"G", bg:"#7B6A45", name:"Familia García", badge:"👤 Cliente",  tag:"",               tabs:"Estimate · Workflow · Gantt · Notas · Design" },
      ];
  return (
    <div className="space-y-2">
      {/* New user button */}
      <div className="flex justify-end mb-1">
        <div className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-[#D7CBB3] bg-[#ECE3D1] px-3 py-1.5 text-[9px] font-bold text-[#16323D]">
          + {EN ? "New user" : "Nuevo usuario"}
        </div>
      </div>
      {users.map(u => (
        <div key={u.name} className="overflow-hidden rounded-2xl border border-[#E6DDCB] bg-white">
          <div className="flex items-center gap-2 px-3 py-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white" style={{ background: u.bg }}>
              {u.initials}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-1">
                <span className="text-[10px] font-bold text-[#16323D]">{u.name}</span>
                <span className="rounded-full border border-[#B8DEC9] bg-[#EBF5F0] px-1.5 py-px text-[7px] font-bold text-[#2E6B50]">
                  {u.badge}
                </span>
                {u.tag && (
                  <span className="rounded-full border border-[#F0CFA0] bg-[#FEF6ED] px-1.5 py-px text-[7px] font-bold text-[#9B6A2F]">
                    {u.tag}
                  </span>
                )}
              </div>
              <div className="mt-0.5 text-[7px] text-[#97A1A0]">{u.tabs}</div>
            </div>
            <div className="flex gap-1">
              <div className="grid h-5 w-5 place-items-center rounded bg-[#F0EAE0] text-[9px]">✏️</div>
              <div className="grid h-5 w-5 place-items-center rounded bg-[#F0EAE0] text-[9px]">▾</div>
            </div>
          </div>
        </div>
      ))}
      {/* Inline preview strip */}
      <div className="mt-1 grid grid-cols-2 gap-1.5 rounded-xl border border-[#E6DDCB] bg-[#F7F3EA] p-2">
        <div>
          <div className="mb-1 text-[7px] font-bold uppercase tracking-wide text-[#5C6A6E]">{EN?"Co-worker sees:":"Co-worker ve:"}</div>
          <div className="flex flex-wrap gap-1">
            {["Workflow","Day Planner","Notes"].map(t => (
              <span key={t} className="rounded bg-[#16323D] px-1 py-px text-[6px] font-bold text-white">{t}</span>
            ))}
          </div>
        </div>
        <div>
          <div className="mb-1 text-[7px] font-bold uppercase tracking-wide text-[#5C6A6E]">{EN?"Client sees:":"Cliente ve:"}</div>
          <div className="flex flex-wrap gap-1">
            {["Estimate","Workflow","Gantt","Notes","Design"].map(t => (
              <span key={t} className="rounded bg-[#395886] px-1 py-px text-[6px] font-bold text-white">{t}</span>
            ))}
          </div>
        </div>
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
      id: "plan", icon: "📅",
      title: EN ? "Gantt" : "Gantt",
      desc:  EN ? "Bird's-eye Gantt chart of all tasks in the project. See timelines, filter by status, toggle between week and day resolution."
                : "Vista Gantt de todas las tareas del proyecto. Visualiza líneas de tiempo, filtra por estado y alterna entre semanas y días.",
      mockup: <MockupPlan EN={EN} />,
      steps: EN ? [
        { t:"Open the Gantt tab", d:"Inside any project, click the <b>Gantt</b> tab. All tasks are displayed as horizontal bars on a timeline, ordered by start date." },
        { t:"Filter by status", d:"Use the filter pills at the top: <b>All · To do · In progress · Done</b>. Only matching tasks are shown — useful to focus on what's still pending." },
        { t:"Toggle Weeks / Days", d:"Switch between <b>Weeks</b> and <b>Days</b> resolution using the toggle in the top-right. Days view gives you finer granularity for short-duration tasks." },
        { t:"Edit a task inline", d:"Click any task bar to open the edit panel. You can update: <b>name, hours, start date, end date, and status</b>. Changes save immediately." },
        { t:"Reorder tasks", d:"Drag any task row up or down to reorder the list — useful to visually group related work." },
        { t:"Scheduled dates from Day Planner", d:"Tasks generated via the <b>Day Planner</b> carry a <b>scheduled date</b>. The Gantt respects this date, so the bar is placed on the correct day automatically." },
      ] : [
        { t:"Abrir la pestaña Plan", d:"Dentro de cualquier proyecto, clic en la pestaña <b>Plan</b>. Todas las tareas se muestran como barras horizontales en una línea de tiempo ordenada por fecha de inicio." },
        { t:"Filtrar por estado", d:"Usa los botones de filtro arriba: <b>Todo · Por hacer · En proceso · Listo</b>. Solo se muestran las tareas que coinciden — útil para enfocarte en lo pendiente." },
        { t:"Alternar Semanas / Días", d:"Cambia entre resolución de <b>Semanas</b> y <b>Días</b> con el toggle arriba a la derecha. La vista Días da mayor granularidad para tareas cortas." },
        { t:"Editar una tarea inline", d:"Clic en cualquier barra de tarea para abrir el panel de edición. Puedes actualizar: <b>nombre, horas, fecha de inicio, fecha fin y estado</b>. Los cambios se guardan al instante." },
        { t:"Reordenar tareas", d:"Arrastra cualquier fila de tarea hacia arriba o abajo para reordenar la lista — útil para agrupar visualmente el trabajo relacionado." },
        { t:"Fechas del Planificador por Día", d:"Las tareas generadas por el <b>Planificador por Día</b> llevan una <b>fecha programada</b>. El Gantt respeta esta fecha y posiciona la barra en el día correcto automáticamente." },
      ],
      tips: EN ? [
        "💡 The Gantt tab reads the same <b>scheduled_date</b> field set by the Day Planner — so scheduling in Estimate directly drives the Gantt.",
        "💡 Use the <b>Days</b> toggle when your project spans less than 2 weeks — individual days become visible columns for precise scheduling.",
        "💡 Changing a task's <b>start/end date</b> in Plan also updates the bar width. Tasks with no dates appear at the top without a bar.",
      ] : [
        "💡 La pestaña Plan lee el mismo campo <b>scheduled_date</b> asignado por el Planificador por Día — programar en Estimate impulsa el Gantt directamente.",
        "💡 Usa el toggle de <b>Días</b> cuando tu proyecto dura menos de 2 semanas — los días individuales se convierten en columnas visibles para programación precisa.",
        "💡 Cambiar la <b>fecha de inicio/fin</b> de una tarea en Plan también actualiza el ancho de la barra. Las tareas sin fecha aparecen al inicio sin barra.",
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
        { t:"Read the metrics strip", d:"At the top of the Workflow board, <b>4 KPI cards</b> summarise the project at a glance: <b>Total tasks · From estimate · Completed · Progress %</b>. The Progress card shows a colour-coded progress bar." },
        { t:"Switch to Gantt view", d:"Click the <b>Gantt</b> button above the board to see a horizontal timeline of all tasks by week." },
        { t:"Import from Estimate", d:"In the <b>Estimate</b> tab, click <b>Generate Workflow Tasks</b> to open the Day Planner. Each scheduled estimate item becomes its own Kanban task, with date, hours and Estimate traceability." },
        { t:"Filter generated work", d:"Use the Workflow filters to view tasks by <b>assignee</b> or <b>scheduled date</b>. This makes it easy to run the crew day by day." },
        { t:"Reschedule tasks", d:"Tap any task and change <b>Scheduled date</b>. The date is saved in the task and reflected in the Plan/Gantt view." },
      ] : [
        { t:"Agregar una tarea", d:"Clic en <b>+ Agregar Tarea</b> en cualquier columna. Ingresa nombre, <b>horas</b> estimadas, semanas y asigna un contacto (opcional)." },
        { t:"Arrastrar para cambiar estado", d:"Arrastra tarjetas entre <b>Pendiente → En Proceso → Listo</b>. En móvil, mantén presionado para arrastrar." },
        { t:"Leer el panel de métricas", d:"Al inicio del tablero Workflow, <b>4 tarjetas KPI</b> resumen el proyecto de un vistazo: <b>Total tareas · Del estimado · Completadas · Progreso %</b>. La tarjeta de Progreso muestra una barra de avance con código de color." },
        { t:"Cambiar a vista Gantt", d:"Clic en el botón <b>Gantt</b> encima del tablero para ver una línea de tiempo horizontal por semana." },
        { t:"Importar desde Estimado", d:"En la pestaña <b>Estimado</b>, clic en <b>Generar Tareas</b> para abrir el Planificador por Día. Cada item programado del estimado se convierte en su propia tarea Kanban, con fecha, horas y trazabilidad al Estimate." },
        { t:"Filtrar trabajo generado", d:"Usa los filtros del Workflow para ver tareas por <b>responsable</b> o por <b>fecha programada</b>. Así puedes gestionar la cuadrilla día por día." },
        { t:"Reprogramar tareas", d:"Toca cualquier tarea y cambia <b>Fecha programada</b>. La fecha queda guardada en la tarea y se refleja en la vista Plan/Gantt." },
      ],
      tips: EN ? [
        "📊 The <b>metrics strip</b> at the top shows: Total tasks, how many came <b>From estimate</b>, how many are <b>Completed</b>, and overall <b>Progress %</b> with a progress bar — updated in real time as you move cards.",
        "💡 The <b>Day Planner</b> lets you drag estimate items into day columns (Day 1, Day 2…) with hours capacity bars. Use <b>Auto-assign</b> to fill days automatically. Generated tasks are skipped if they already exist, preventing duplicates.",
        "🎙 Say <b>\"Add task [description]\"</b> to Katy to add it to the current project.",
      ] : [
        "📊 El <b>panel de métricas</b> arriba muestra: Total de tareas, cuántas vienen <b>Del estimado</b>, cuántas están <b>Completadas</b> y el <b>% de Progreso</b> con barra de avance — se actualiza en tiempo real al mover tarjetas.",
        "💡 El <b>Planificador por Día</b> permite arrastrar items del estimado a columnas de días con barras de capacidad. Usa <b>Auto-asignar</b> para llenar automáticamente. Si una tarea ya existe, se omite para evitar duplicados.",
        "🎙 Di <b>\"Agregar tarea [descripción]\"</b> a Katy para añadirla al proyecto actual.",
      ],
    },
    {
      id: "estimate", icon: "💰",
      title: EN ? "Estimate" : "Estimado",
      desc:  EN ? "Create professional client proposals with sections, line items, discounts, payment schedules, PDF export and WhatsApp delivery."
                : "Crea propuestas profesionales con secciones, items, descuentos, calendario de pagos, exportación PDF y envío por WhatsApp.",
      mockup: (
        <div className="space-y-4">
          <MockupEstimate EN={EN} />
          <div className="text-[9px] font-bold uppercase tracking-widest text-[#5C6A6E] pt-1">
            {EN ? "Day Planner — Schedule items into days" : "Planificador por Día — Programa items por día"}
          </div>
          <MockupDayPlanner EN={EN} />
        </div>
      ),
      steps: EN ? [
        { t:"Create the estimate", d:"Go to the <b>Estimate</b> tab inside a project and click <b>Create Estimate</b>. The tab opens with a dark header band containing the project name, status selector, and action buttons." },
        { t:"Two sub-tabs: Sections & Payment Schedule", d:"The Estimate tab is split into two sub-tabs visible at the bottom of the dark header. <b>📐 Sections</b> is where you build the proposal — sections, items, discount. <b>💰 Payment Schedule</b> is where you manage installments, track received amounts, and view the full totals breakdown." },
        { t:"Add sections from catalog", d:"In the <b>Sections</b> sub-tab, click <b>+ Add Section</b> and choose from the catalog: DEMOLITION, PLUMBING, STRUCTURE, ELECTRICAL, TILE, PAINTING… or create a custom section." },
        { t:"Section checkboxes", d:"Each section header has two independent checkboxes: <b>Mat. incl.</b> — marks that the section price already includes material cost (informational). <b>Labor %</b> — controls whether the section is counted in the labor subtotal and discount calculation. Uncheck <b>Labor %</b> for pure material sections to exclude them from the discount." },
        { t:"Add line items", d:"Expand any section and click <b>+ Add item</b>. Type the description and dollar amount. Items auto-sum the section total. Or enter a single flat total if you don't need itemization." },
        { t:"Set discount", d:"In the Sections sub-tab, the <b>red Discount badge</b> in the top sub-band lets you enter a discount % inline. It applies only to labor sections with <b>Labor %</b> checked. The amount shows in red — consistent with expenses." },
        { t:"Payment Schedule", d:"Switch to <b>💰 Payment Schedule</b>. At the top you see a totals card: <b>Labor subtotal → Discount (red) → Grand Total (dark)</b>, plus a received vs. pending progress bar. Below, each installment shows as a timeline row with its target, received amount and track bar. Click any deposit row or percentage badge to edit the installment details." },
        { t:"Context-aware Save", d:"The <b>Save</b> button in the header always saves the full estimate. Its label and color change to reflect the active sub-tab: white <b>Save</b> on Sections, salmon <b>Save schedule</b> on Payment Schedule." },
        { t:"WhatsApp send", d:"In the header, click the green <b>WA</b> button. If no phone number is set yet, the form expands — choose country code, enter number, click <b>Send PDF</b>. Once a number is saved, clicking WA sends immediately. On <b>mobile</b>: the PDF is shared via the OS share sheet. On <b>desktop</b>: the PDF downloads and WhatsApp Web opens." },
        { t:"Download PDF", d:"Click the <b>PDF</b> button in the header. Choose <b>Estimate with detail</b> (sections + item amounts) or <b>Estimate without detail</b> (scope only, no amounts). The proposal includes a full payment schedule at the bottom." },
        { t:"Schedule with Day Planner", d:"In the <b>Sections</b> sub-tab, click <b>Generate Workflow Tasks</b> to open the Day Planner. Drag estimate items into day columns, assign workers, add custom items, and click <b>Save / Update</b> to create Workflow tasks." },
      ] : [
        { t:"Crear el estimado", d:"Ve a la pestaña <b>Estimado</b> dentro del proyecto y clic en <b>Crear Estimado</b>. El tab se abre con una banda oscura de cabecera que contiene el nombre del proyecto, el selector de estado y los botones de acción." },
        { t:"Dos sub-tabs: Secciones y Calendario de Pagos", d:"El tab Estimado está dividido en dos sub-tabs visibles al final de la banda oscura. <b>📐 Secciones</b> es donde construyes la propuesta — secciones, items, descuento. <b>💰 Calendario de Pagos</b> es donde gestionas las cuotas, rastreas los montos recibidos y ves el desglose de totales completo." },
        { t:"Agregar secciones del catálogo", d:"En el sub-tab <b>Secciones</b>, clic en <b>+ Agregar Sección</b> y elige: DEMOLICIÓN, PLOMERÍA, ESTRUCTURA, ELÉCTRICO, TILE, PINTURA… o crea una sección personalizada." },
        { t:"Checkboxes por sección", d:"Cada encabezado de sección tiene dos checkboxes independientes: <b>Mat. incl.</b> — indica que el precio de la sección ya incluye el costo de materiales (informativo). <b>M. obra %</b> — controla si la sección entra al subtotal de mano de obra y al cálculo del descuento. Desmarca <b>M. obra %</b> en secciones de solo materiales para excluirlas del descuento." },
        { t:"Agregar items", d:"Expande una sección y clic en <b>+ Agregar item</b>. Escribe descripción y monto. Los items suman el total de la sección automáticamente. O ingresa un total plano si no necesitas desglose." },
        { t:"Descuento", d:"En el sub-tab Secciones, el <b>badge rojo de Descuento</b> en la sub-banda superior permite ingresar el porcentaje de descuento. Aplica solo a secciones con <b>M. obra %</b> activado. El monto se muestra en rojo — consistente con los egresos." },
        { t:"Calendario de Pagos", d:"Cambia al sub-tab <b>💰 Calendario de Pagos</b>. Arriba verás la tarjeta de totales: <b>Subtotal mano de obra → Descuento (rojo) → Total Final (oscuro)</b>, más una barra de progreso recibido vs. pendiente. Abajo, cada cuota aparece como fila de línea de tiempo con su objetivo, monto recibido y barra de seguimiento. Clic en cualquier fila o badge de porcentaje para editar la cuota." },
        { t:"Guardar contextual", d:"El botón <b>Guardar</b> en la cabecera siempre guarda el estimado completo. Su etiqueta y color cambian según el sub-tab activo: blanco <b>Guardar</b> en Secciones, salmón <b>Guardar calendario</b> en Calendario de Pagos." },
        { t:"Enviar por WhatsApp", d:"En la cabecera, clic en el botón verde <b>WA</b>. Si no hay número configurado, el formulario se despliega — elige código de país, ingresa el número y clic en <b>Enviar PDF</b>. Una vez guardado el número, al presionar WA se envía directamente. En <b>móvil</b>: el PDF se comparte por el menú nativo. En <b>desktop</b>: el PDF se descarga y abre WhatsApp Web." },
        { t:"Descargar PDF", d:"Clic en el botón <b>PDF</b> en la cabecera. Elige <b>Estimado con detalle</b> (secciones + montos de items) o <b>Estimado sin detalle</b> (solo alcance, sin montos). La propuesta incluye el calendario de pagos completo al final." },
        { t:"Programar con el Planificador", d:"En el sub-tab <b>Secciones</b>, clic en <b>Generar Tareas</b> para abrir el Planificador por Día. Arrastra items a columnas de días, asigna trabajadores, agrega items personalizados y clic en <b>Guardar / Actualizar</b> para crear tareas en Workflow." },
      ],
      tips: EN ? [
        "🗂 The Estimate tab has <b>two sub-tabs</b>: use <b>📐 Sections</b> to build the proposal and <b>💰 Payment Schedule</b> to manage installments and track payments.",
        "💡 Each section has <b>two checkboxes</b>: <b>Mat. incl.</b> flags that the price includes material cost. <b>Labor %</b> controls whether the section feeds the labor discount — uncheck it for pure material sections.",
        "💾 The <b>Save button changes color</b> based on which sub-tab you're on — white on Sections, salmon on Payment Schedule — so you always know what context you're saving.",
        "📱 WhatsApp Send works natively on mobile — the OS share sheet appears and WhatsApp attaches the PDF automatically. On desktop, download the PDF first, then attach it in WhatsApp Web.",
        "🔴 <b>Discount and pending amounts</b> are always shown in red/burgundy — consistent with the expense color convention throughout the app.",
      ] : [
        "🗂 El tab Estimado tiene <b>dos sub-tabs</b>: usa <b>📐 Secciones</b> para construir la propuesta y <b>💰 Calendario de Pagos</b> para gestionar cuotas y rastrear pagos.",
        "💡 Cada sección tiene <b>dos checkboxes</b>: <b>Mat. incl.</b> indica que el precio ya incluye materiales. <b>M. obra %</b> controla si la sección entra al descuento de mano de obra — desactívalo en secciones de solo materiales.",
        "💾 El <b>botón Guardar cambia de color</b> según el sub-tab activo — blanco en Secciones, salmón en Calendario de Pagos — para que siempre sepas qué contexto estás guardando.",
        "📱 El envío por WhatsApp funciona nativamente en móvil — el menú de compartir del sistema adjunta el PDF automáticamente. En desktop, descarga el PDF primero y luego adjúntalo en WhatsApp Web.",
        "🔴 <b>El descuento y los montos pendientes</b> siempre se muestran en rojo/guinda — consistente con la convención de color de egresos en toda la app.",
      ],
    },
    {
      id: "planner", icon: "🗓",
      title: EN ? "Day Planner" : "Planificador por Día",
      desc:  EN ? "Schedule estimate items into day columns with drag & drop. Set dates, assign workers, add custom items and generate Workflow tasks — all in one place as a dedicated tab."
               : "Programa items del estimado en columnas de días con drag & drop. Asigna fechas, asigna trabajadores, agrega items personalizados y genera tareas de Workflow — todo en un tab dedicado.",
      mockup: <MockupDayPlanner EN={EN} />,
      steps: EN ? [
        { t:"Open the tab", d:"Click the <b>Day Planner</b> tab next to Estimate in the project navigation. The planner loads all estimate sections and their items automatically." },
        { t:"Items pool", d:"All unscheduled estimate items appear in the left <b>Pool</b> column. You can drag any item to a day column — or tap the <b>📅 Agregar a día...</b> button on the card to open a date picker and jump directly, no dragging needed." },
        { t:"Quick-assign via date picker", d:"Each pool card has a <b>📅 Agregar a día...</b> button. Tap it → the native calendar opens → pick a date → the item instantly moves to the matching day column. If the exact date isn't configured, it snaps to the nearest day. Once assigned, the card shows <b>✓ Día N · date</b> in green; tap again to reassign." },
        { t:"Add custom items", d:"Click <b>+ Custom</b> in the pool header to add activities not in the estimate. Fill in description, section tag, hours and amount. Custom items are saved with source = 'planner'." },
        { t:"Set day dates", d:"Each day column has a <b>date picker</b> at the top. Click the date to change it — the column keeps its items when you change the date." },
        { t:"Capacity bar", d:"Each column shows a <b>capacity bar</b> based on workers × hours per worker. The bar turns red when the day is over capacity." },
        { t:"Assign a worker", d:"Each item card has an <b>Assignee</b> selector. Choose a co-worker contact to assign that item. Assignments are saved with the task." },
        { t:"Auto-assign", d:"Click <b>Auto-assign</b> to fill day columns automatically. Items are ordered by construction phase — <b>Materials → Demo → Structure → Plumbing → Electrical → Tile → Handyman → Painting</b> — then spread evenly across all configured days. Phase boundaries advance to the next day automatically." },
        { t:"Save / Update", d:"Click <b>Save / Update</b> to upsert all scheduled items. New assignments create Workflow tasks with the scheduled date. Moving an item updates its date. Returning an item to the pool removes its scheduled date." },
      ] : [
        { t:"Abrir el tab", d:"Clic en el tab <b>Day Planner</b> junto al tab Estimate en la navegación del proyecto. Las secciones e items del estimado se cargan automáticamente." },
        { t:"Pool de items", d:"Todos los items sin programar aparecen en el <b>Pool</b> a la izquierda. Puedes arrastrarlos a una columna de día — o tocar el botón <b>📅 Agregar a día...</b> en la tarjeta para asignar directamente sin arrastrar." },
        { t:"Asignar por fecha (sin arrastrar)", d:"Cada tarjeta del pool tiene el botón <b>📅 Agregar a día...</b>. Al tocarlo se abre el calendario nativo del dispositivo. Elige la fecha del día al que quieres asignar → el item salta a esa columna al instante. Si la fecha no está configurada exactamente, salta al día más cercano. Una vez asignado muestra <b>✓ Día N · fecha</b> en verde; tocándolo puedes reasignar." },
        { t:"Agregar items personalizados", d:"Clic en <b>+ Custom</b> en el encabezado del pool para agregar actividades que no están en el estimado. Completa descripción, etiqueta de sección, horas y monto." },
        { t:"Asignar fechas", d:"Cada columna de día tiene un <b>selector de fecha</b>. Clic para cambiarlo — la columna conserva sus items al cambiar la fecha." },
        { t:"Barra de capacidad", d:"Cada columna muestra una <b>barra de capacidad</b> según trabajadores × horas por trabajador. La barra se vuelve roja cuando el día está sobre capacidad." },
        { t:"Asignar trabajador", d:"Cada tarjeta de item tiene un selector de <b>responsable</b>. Elige un contacto co-worker para asignar ese item. La asignación se guarda con la tarea." },
        { t:"Auto-asignar", d:"Clic en <b>Auto-asignar</b> para llenar las columnas automáticamente. Los items se ordenan por fase de construcción — <b>Materiales → Demolición → Estructura → Plomería → Eléctrico → Piso/Tile → Handyman → Pintura</b> — luego se distribuyen equitativamente entre todos los días configurados. Los límites de fase avanzan al siguiente día automáticamente." },
        { t:"Guardar / Actualizar", d:"Clic en <b>Guardar / Actualizar</b> para upsert de todos los items programados. Nuevas asignaciones crean tareas en Workflow con la fecha programada. Mover un item actualiza su fecha. Devolver un item al pool elimina su fecha." },
      ],
      tips: EN ? [
        "📅 <b>No need to drag</b> to distant columns — tap <b>📅 Agregar a día...</b> on any pool card to pick the date directly from a calendar. Snaps to nearest configured day if exact date not found.",
        "🗓 The Day Planner is now a <b>dedicated tab</b> — no need to open it from Estimate. Access it directly alongside Estimate in the project tabs.",
        "🔗 Items scheduled in Day Planner become <b>Workflow tasks</b> with `source = estimate` or `planner`. They appear in Kanban and Gantt with the scheduled date.",
        "👤 Assignees set in Day Planner are saved on the Workflow task and visible in the <b>Plan/Gantt</b> view.",
        "➕ Custom items let you plan <b>any activity</b> beyond the estimate — site prep, inspections, cleanups. They save with a 'planner' source tag.",
        "🔄 Reopen the planner anytime — all existing day assignments reload automatically.",
      ] : [
        "📅 <b>Sin arrastrar</b> — toca <b>📅 Agregar a día...</b> en cualquier tarjeta del pool para elegir la fecha en un calendario. Si la fecha exacta no está configurada, salta al día más cercano.",
        "🗓 El Planificador es ahora un <b>tab dedicado</b> — ya no necesitas abrirlo desde Estimate. Accede directamente en la navegación del proyecto.",
        "🔗 Los items programados se convierten en <b>tareas del Workflow</b> con `source = estimate` o `planner`. Aparecen en Kanban y Gantt con la fecha programada.",
        "👤 Los responsables asignados en el Planner se guardan en la tarea del Workflow y son visibles en el <b>Plan/Gantt</b>.",
        "➕ Los items personalizados permiten planear <b>cualquier actividad</b> fuera del estimado — preparación del sitio, inspecciones, limpiezas.",
        "🔄 Vuelve a abrir el Planificador cuando quieras — las asignaciones de días existentes se recargan automáticamente.",
      ],
    },
    {
      id: "payments", icon: "💳",
      title: EN ? "Cash Flow" : "Cash Flow",
      desc:  EN ? "Track all money in (from client) and money out (to workers/suppliers) per project."
                : "Registra todo el dinero que entra (del cliente) y que sale (a trabajadores/proveedores) por proyecto.",
      mockup: <MockupPayments EN={EN} />,
      steps: EN ? [
        { t:"Log a client payment (Income)", d:"Click <b>+ Income</b>. Enter: amount, date, payment method (Cash / Zelle / Transfer / Check / Card) and type (Deposit / Advance / Final)." },
        { t:"Log an expense (Outflow)", d:"Click <b>+ Expense</b>. Enter: amount, date, method, <b>payee name</b> (who you paid) and <b>concept</b>. Example: Jorge · Tile installation labor." },
        { t:"FROM MAT expenses", d:"Expenses created automatically when you check a material as <b>bought</b> show a <b>FROM MAT</b> badge. Tap <b>↩ Unmark</b> on that expense to reverse: the expense is deleted and the material checkbox resets." },
        { t:"Monitor the balance", d:"The summary at the top shows total Income, total Expenses and the running Balance. A <b>red balance</b> means you've paid out more than received." },
      ] : [
        { t:"Registrar ingreso (pago del cliente)", d:"Clic en <b>+ Ingreso</b>. Ingresa: monto, fecha, método (Efectivo/Zelle/Transferencia/Cheque/Tarjeta) y tipo (Abono/Anticipo/Final)." },
        { t:"Registrar egreso (pago realizado)", d:"Clic en <b>+ Egreso</b>. Ingresa: monto, fecha, método, <b>nombre del beneficiario</b> y <b>concepto</b>. Ej: Jorge · Instalación de tile." },
        { t:"Egresos FROM MAT", d:"Los egresos creados automáticamente al marcar un material como <b>comprado</b> muestran la etiqueta <b>FROM MAT</b>. Toca <b>↩ Desmarcar</b> para revertir: se elimina el egreso y el checkbox del material se restablece." },
        { t:"Monitorear el balance", d:"El resumen muestra total Ingresos, total Egresos y el Balance corriente. Un <b>balance rojo</b> indica que has pagado más de lo que recibiste." },
      ],
      tips: EN ? [
        "💡 These numbers feed directly into the <b>Dashboard KPI cards</b> — keep them updated for accurate reporting.",
        "✅ <b>FROM MAT expenses</b> are created automatically when you mark a material as bought — and reversed with ↩ Unmark. No manual bookkeeping between tabs.",
        "🎙 Say <b>\"Add payment $2000\"</b> or <b>\"Add expense $500 Jorge\"</b> to Katy for quick voice entry.",
      ] : [
        "💡 Estos números alimentan directamente las <b>tarjetas KPI del Dashboard</b> — mantenlos actualizados para reportes precisos.",
        "✅ Los <b>egresos FROM MAT</b> se crean solos al marcar un material como comprado — y se revierten con ↩ Desmarcar. Sin contabilidad manual entre tabs.",
        "🎙 Di <b>\"Agregar pago $2000\"</b> o <b>\"Agregar egreso $500 Jorge\"</b> a Katy para registro rápido por voz.",
      ],
    },
    {
      id: "materials", icon: "🛒",
      title: EN ? "Materials / Materiales" : "Materials / Materiales",
      desc:  EN ? "Shopping list per project — import items directly from the Estimate or add them manually. Track quantity, unit, supplier, purchase date and notes."
                : "Lista de compras por proyecto — importa items directamente del Estimado o agrégalos manualmente. Registra cantidad, unidad, proveedor, fecha de compra y notas.",
      mockup: <MockupMaterials EN={EN} />,
      steps: EN ? [
        { t:"Import from Estimate", d:"At the top of the Materials tab, click the blue <b>Import from Estimate</b> banner. The app reads all sections and items from the project's Estimate and creates one material record per item, named <b>\"Compra de [item]\"</b>. Items already imported are skipped automatically — no duplicates." },
        { t:"\"Compra de\" naming", d:"Imported materials follow the naming convention <b>Compra de [ITEM NAME]</b> (e.g., \"Compra de PORCELAIN\"). Cards from the Estimate show a blue <b>FROM EST</b> badge so you can tell them apart from manual entries at a glance." },
        { t:"Edit quantity, unit and notes", d:"Tap any material card to open the edit form. You can set: <b>name, quantity</b> (e.g., 50), <b>unit</b> (e.g., sq.ft, unit, box), <b>supplier, cost, purchase date</b> and free-text <b>notes</b>. All fields are optional." },
        { t:"Mark as purchased", d:"Click the <b>✓ checkbox</b> on any card once you've bought it. The card dims and the name gets a strikethrough. This <b>automatically creates an expense</b> in the Cash Flow tab with the material's cost — no double entry needed." },
        { t:"Undo a purchase from Cash Flow", d:"Go to the <b>Cash Flow tab</b> and find the expense with the <b>FROM MAT</b> badge. Tap <b>↩ Unmark</b> to reverse: the expense is deleted and the material checkbox resets to unchecked." },
        { t:"Bulk delete", d:"Tap the <b>Select</b> button at the top right. Cards switch to multi-select mode with checkboxes. Check the ones you want to remove and tap the red <b>Delete N</b> bar that appears at the bottom." },
        { t:"Duplicate a card", d:"Use the <b>duplicate</b> action on any card to quickly clone a material — useful when you need the same item from two different suppliers or in different quantities." },
        { t:"Add manually", d:"Click <b>+ Add Material</b> to create a material from scratch — no Estimate needed. Manual entries have no FROM EST badge and can include any name, quantity and supplier you like." },
      ] : [
        { t:"Importar del Estimado", d:"En la parte superior del tab Materiales, clic en el banner azul <b>Importar del Estimado</b>. La app lee todas las secciones e items del Estimado del proyecto y crea un registro de material por item con el nombre <b>\"Compra de [item]\"</b>. Los items ya importados se omiten automáticamente — sin duplicados." },
        { t:"Nomenclatura \"Compra de\"", d:"Los materiales importados siguen la convención <b>Compra de [NOMBRE DEL ITEM]</b> (ej. \"Compra de PORCELAIN\"). Las tarjetas del Estimado muestran una etiqueta azul <b>DEL EST</b> para distinguirlas de los registros manuales de un vistazo." },
        { t:"Editar cantidad, unidad y notas", d:"Toca cualquier tarjeta para abrir el formulario de edición. Puedes definir: <b>nombre, cantidad</b> (ej. 50), <b>unidad</b> (ej. sq.ft, unidad, caja), <b>proveedor, costo, fecha de compra</b> y <b>notas</b> en texto libre. Todos los campos son opcionales." },
        { t:"Marcar como comprado", d:"Clic en el <b>checkbox ✓</b> de cualquier tarjeta una vez comprado. La tarjeta se atenúa y el nombre queda tachado. Esto <b>crea automáticamente un egreso</b> en el tab Pagos con el costo del material — sin doble entrada." },
        { t:"Revertir desde Cash Flow", d:"Ve al tab <b>Cash Flow</b> y busca el egreso con la etiqueta <b>FROM MAT</b>. Toca <b>↩ Desmarcar</b> para revertir: se elimina el egreso y el checkbox del material vuelve a desmarcarse." },
        { t:"Eliminación en bloque", d:"Toca el botón <b>Seleccionar</b> arriba a la derecha. Las tarjetas cambian a modo multi-selección con checkboxes. Marca las que quieres eliminar y toca la barra roja <b>Eliminar N</b> que aparece abajo." },
        { t:"Duplicar una tarjeta", d:"Usa la acción <b>duplicar</b> en cualquier tarjeta para clonarla rápidamente — útil cuando necesitas el mismo item de dos proveedores distintos o en diferentes cantidades." },
        { t:"Agregar manualmente", d:"Clic en <b>+ Agregar Material</b> para crear un material desde cero — sin necesitar el Estimado. Los registros manuales no tienen etiqueta DEL EST y admiten cualquier nombre, cantidad y proveedor." },
      ],
      tips: EN ? [
        "💡 <b>Import first, then fill details.</b> Click Import from Estimate to populate the list instantly, then open each card to add quantity, unit and purchase date as you shop.",
        "✅ The <b>bought checkbox is bidirectional</b> — checking it creates an expense in Payments; unchecking from Payments (↩ Unmark) resets the material. No manual bookkeeping needed.",
        "🗑 <b>Select mode</b> lets you delete many materials at once — great for clearing a completed purchase list at the end of a phase.",
        "🔵 The <b>FROM EST badge</b> links each material back to its Estimate line item — so you always know what it covers and what section it belongs to.",
      ] : [
        "💡 <b>Importa primero, luego agrega detalles.</b> Clic en Importar del Estimado para llenar la lista al instante, luego abre cada tarjeta para agregar cantidad, unidad y fecha de compra mientras compras.",
        "✅ El <b>checkbox de comprado es bidireccional</b> — marcarlo crea un egreso en Pagos; desde Pagos tocar ↩ Desmarcar lo revierte. Sin contabilidad manual.",
        "🗑 El <b>modo Seleccionar</b> permite eliminar varios materiales a la vez — ideal para limpiar la lista al terminar una fase.",
        "🔵 La <b>etiqueta DEL EST</b> vincula cada material con su línea del Estimado — así siempre sabes qué cubre y a qué sección pertenece.",
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
        { t:"US phone format", d:"The phone field auto-formats to US format as you type — just enter the digits and it becomes <b>(786) 563-2531</b> automatically. You can also type the full number and it reformats on completion." },
        { t:"Set type and rate", d:"Choose: <b>Friend</b>, <b>Co-worker</b> (subcontractor) or <b>Customer</b>. Co-workers also have specialty (Plumbing, Electrical, Tile…) and rate fields — hourly or per job." },
        { t:"Link contact to a project", d:"Inside a project's <b>Contacts tab</b>, search and add existing contacts. They then appear in the Workflow task assignment dropdown." },
      ] : [
        { t:"Crear un contacto", d:"Ve a <b>Contactos</b> en la navegación superior (lista global) o la pestaña Contactos dentro de un proyecto. Clic en <b>+ Agregar Contacto</b>." },
        { t:"Formato de teléfono US", d:"El campo de teléfono formatea automáticamente mientras escribes — ingresa los dígitos y se convierte en <b>(786) 563-2531</b> solo. También puedes pegar el número completo y se reformatea." },
        { t:"Definir tipo y tarifa", d:"Elige: <b>Amigo</b>, <b>Colaborador</b> (subcontratista) o <b>Cliente</b>. Los colaboradores tienen además campos de especialidad (Plomería, Eléctrico, Tile…) y tarifa por hora o trabajo." },
        { t:"Vincular contacto a un proyecto", d:"Dentro de la pestaña <b>Contactos</b> del proyecto, busca y agrega contactos existentes. Aparecerán en el selector de asignación del Workflow." },
      ],
      tips: EN ? [
        "💡 Contacts linked to a project appear in <b>Workflow → Assign</b> so you can assign tasks directly to them.",
        "📋 The global <b>Contacts page</b> (top nav) shows all specialists across all projects — great for building your trusted team list.",
        "📞 Phone numbers are stored with US format <b>(XXX) XXX-XXXX</b> — makes them tappable on mobile to call directly.",
      ] : [
        "💡 Los contactos vinculados al proyecto aparecen en <b>Workflow → Asignar</b> para asignar tareas directamente.",
        "📋 La página global de <b>Contactos</b> (nav superior) muestra todos los especialistas de todos los proyectos.",
        "📞 Los teléfonos se guardan con formato US <b>(XXX) XXX-XXXX</b> — en móvil se pueden tocar para llamar directamente.",
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
      id: "design", icon: "✨",
      title: EN ? "Design — AI Render" : "Design — AI Render",
      desc:  EN ? "Upload a reference photo of the room and generate a photorealistic AI render using your design brief. Drag the comparison slider to see Before vs After side by side."
               : "Sube una foto de referencia del ambiente y genera un render fotorrealista con IA usando tu brief de diseño. Arrastra el slider para comparar Antes vs Después.",
      mockup: (
        <div className="overflow-hidden rounded-2xl border border-[#E6DDCB] bg-white shadow-sm">
          {/* 3-col header */}
          <div className="grid grid-cols-3 text-[9px] font-bold uppercase tracking-wider">
            <div className="bg-[#16323D] text-white/60 px-2 py-1.5">📸 {EN ? "References" : "Referencias"}</div>
            <div className="bg-[#16323D] text-white/60 px-2 py-1.5 border-x border-white/10">Brief</div>
            <div className="bg-[#16323D] text-white/60 px-2 py-1.5">AI Render</div>
          </div>
          <div className="grid grid-cols-3 gap-0" style={{ height: 110 }}>
            {/* Col 1 */}
            <div className="border-r border-[#E6DDCB] p-1.5 flex flex-col gap-1">
              {[{ bg:"#D4C8B8", h: 48 }, { bg:"#C4B89A", h: 40 }].map((b, i) => (
                <div key={i} className="rounded flex-none" style={{ height: b.h, background: b.bg }} />
              ))}
            </div>
            {/* Col 2 */}
            <div className="border-r border-[#E6DDCB] p-1.5 flex flex-col gap-1.5">
              <div className="rounded bg-[#F7F3EA] h-5 text-[8px] text-[#5C6A6E] flex items-center px-2">{EN ? "Kitchen" : "Cocina"}</div>
              <div className="grid grid-cols-2 gap-0.5">
                <div className="rounded bg-[#16323D] h-4 text-[7px] text-white flex items-center justify-center">{EN ? "Modern" : "Moderno"}</div>
                <div className="rounded border border-[#E6DDCB] h-4 text-[7px] text-[#5C6A6E] flex items-center justify-center">{EN ? "Luxury" : "Lujo"}</div>
              </div>
              <div className="h-1.5 rounded-full bg-[#E6DDCB] overflow-hidden"><div className="h-full bg-[#C9A96E]" style={{ width: "75%" }} /></div>
              <div className="mt-auto rounded bg-[#16323D] h-5 text-[8px] text-white flex items-center justify-center">✨ {EN ? "Generate" : "Generar"}</div>
            </div>
            {/* Col 3 — comparison slider */}
            <div className="relative overflow-hidden bg-[#0d1f27]">
              <div className="absolute inset-0 flex">
                <div className="flex-1 bg-[#2a3a40]" />
                <div className="flex-1" style={{ background: "linear-gradient(135deg, #3a5a6a 0%, #1a3040 100%)" }} />
              </div>
              <div className="absolute inset-0 flex items-center justify-center" style={{ left: "50%" }}>
                <div className="absolute top-0 bottom-0 w-0.5 bg-[#C9A96E]" />
                <div className="w-6 h-6 rounded-full bg-[#C9A96E] border-2 border-white flex items-center justify-center text-[9px] text-[#16323D] font-bold">⟺</div>
              </div>
              <div className="absolute top-1.5 left-1.5 text-[7px] font-bold text-white/70 bg-black/40 rounded px-1">{EN ? "BEFORE" : "ANTES"}</div>
              <div className="absolute top-1.5 right-1.5 text-[7px] font-bold text-white/70 bg-[#4F8A63]/60 rounded px-1">{EN ? "AFTER" : "DESPUÉS"}</div>
            </div>
          </div>
        </div>
      ),
      steps: EN ? [
        { t: "Upload reference photos", d: "Go to the <b>Design</b> tab in any project. Click <b>+ Add Photos</b> on the left panel and select one or more photos of the room you want to transform. The active photo (gold border) will be used as the base for generation." },
        { t: "Select Room Type and Style", d: "Choose the <b>room type</b> from the dropdown (Kitchen, Living Room, Bathroom…) and click a <b>design style</b> (Modern, Luxury, Mediterranean…). These guide the AI's creative direction." },
        { t: "Adjust Change Intensity", d: "The <b>Change Intensity</b> slider (30–95%) controls how much the AI modifies your photo. <b>Subtle</b> keeps the structure; <b>Balanced</b> applies guided changes; <b>Bold</b> does a major redesign; <b>Full Creative</b> applies maximum transformation." },
        { t: "Describe your vision — voice or text", d: "Type in the <b>Description</b> field or click <b>🎙 Voice</b> to speak your instructions. Example: \"marble floors, white quartz countertops, pendant lights, open concept\". Each voice clip appends to your description — combine multiple inputs for more detail." },
        { t: "Generate the render", d: "Click <b>✨ Generate Render</b>. The AI takes your photo, reads your brief, and generates a photorealistic render in 20–40 seconds using Replicate's <code>adirik/interior-design</code> img2img model." },
        { t: "Compare Before / After", d: "When the render is ready, <b>drag the gold slider</b> left and right across the result panel to compare the original photo and the AI render side by side. ANTES = original, DESPUÉS = AI render." },
        { t: "View full size, download or regenerate", d: "Click <b>🔍</b> to open both images in a full-screen modal for detailed inspection. Click <b>⬇</b> to download the render. Click <b>🔄</b> to generate a new variation with the same settings." },
      ] : [
        { t: "Subir fotos de referencia", d: "Ve al tab <b>Design</b> en cualquier proyecto. Clic en <b>+ Agregar fotos</b> en el panel izquierdo y selecciona una o más fotos del ambiente a transformar. La foto activa (borde dorado) se usará como base de la generación." },
        { t: "Seleccionar tipo de ambiente y estilo", d: "Elige el <b>tipo de ambiente</b> en el selector (Cocina, Sala, Baño…) y clic en un <b>estilo de diseño</b> (Moderno, Lujo, Mediterráneo…). Estos guían la dirección creativa de la IA." },
        { t: "Ajustar la intensidad del cambio", d: "El slider de <b>Intensidad del cambio</b> (30–95%) controla cuánto modifica la IA tu foto. <b>Sutil</b> conserva la estructura; <b>Equilibrado</b> aplica cambios guiados; <b>Atrevido</b> hace un rediseño mayor; <b>Máximo creativo</b> aplica transformación total." },
        { t: "Describir tu visión — voz o texto", d: "Escribe en el campo <b>Descripción</b> o clic en <b>🎙 Voz</b> para hablar tus instrucciones. Ejemplo: \"piso de mármol, encimera de cuarzo blanco, luces colgantes, concepto abierto\". Cada clip de voz se agrega al texto — combina múltiples inputs para más detalle." },
        { t: "Generar el render", d: "Clic en <b>✨ Generar Render</b>. La IA toma tu foto, lee el brief y genera un render fotorrealista en 20–40 segundos usando el modelo img2img <code>adirik/interior-design</code> de Replicate." },
        { t: "Comparar Antes / Después", d: "Cuando el render está listo, <b>arrastra el slider dorado</b> de izquierda a derecha en el panel de resultado para comparar la foto original y el render de IA. ANTES = original, DESPUÉS = AI render." },
        { t: "Ver completo, descargar o regenerar", d: "Clic en <b>🔍</b> para abrir ambas imágenes en modal de pantalla completa. Clic en <b>⬇</b> para descargar el render. Clic en <b>🔄</b> para generar una nueva variación con los mismos ajustes." },
      ],
      tips: EN ? [
        "📸 Use <b>wide-angle photos</b> that show the full room — the AI needs to see the space structure to apply changes accurately.",
        "🎚 Start with <b>Balanced (60–65%)</b> intensity for the first render. Increase to Bold or Full Creative for more dramatic transformations.",
        "🗣 <b>Voice + text combo</b>: speak a broad description first, then type specific details. Voice clips append to the text field each time.",
        "🔄 Click <b>🔄 Regenerate</b> to get a different variation with the same brief — useful when you like the direction but want more options.",
        "💾 Download renders to share with clients via WhatsApp or email as part of the design proposal.",
        "🔑 Requires <b>REPLICATE_API_TOKEN</b> in environment variables. Get a free token at replicate.com — new accounts include free credits.",
      ] : [
        "📸 Usa <b>fotos gran angular</b> que muestren la sala completa — la IA necesita ver la estructura del espacio para aplicar cambios con precisión.",
        "🎚 Comienza con intensidad <b>Equilibrado (60–65%)</b> para el primer render. Aumenta a Atrevido o Máximo creativo para transformaciones más dramáticas.",
        "🗣 <b>Combo voz + texto</b>: habla una descripción amplia primero, luego escribe detalles específicos. Los clips de voz se agregan al campo de texto cada vez.",
        "🔄 Clic en <b>🔄 Regenerar</b> para obtener una variación diferente con el mismo brief — útil cuando te gusta la dirección pero quieres más opciones.",
        "💾 Descarga los renders para compartir con clientes via WhatsApp o email como parte de la propuesta de diseño.",
        "🔑 Requiere <b>REPLICATE_API_TOKEN</b> en variables de entorno. Obtén un token gratuito en replicate.com — las cuentas nuevas incluyen créditos gratis.",
      ],
    },
    {
      id: "voice", icon: "🎙",
      title: EN ? "Katy — Voice Assistant" : "Katy — Asistente de Voz",
      desc:  EN ? "Tap the microphone button (bottom-right) and speak, or tap the keyboard button to type — Katy understands both modes and creates records automatically."
                : "Toca el micrófono (abajo a la derecha) y habla, o toca el botón de teclado para escribir — Katy entiende ambos modos y crea los registros automáticamente.",
      mockup: <MockupVoice EN={EN} />,
      steps: EN ? [
        { t:"Voice mode — mic button", d:"Tap the <b>🎙 microphone button</b> at the bottom-right corner of any page. It glows while Katy listens. Works on Chrome/Safari on devices with a microphone." },
        { t:"Text mode — keyboard button", d:"No mic available? Tap the <b>⌨ keyboard button</b> (to the left of the mic). A text panel slides up — type your command and press Enter or the Send button. Useful on noisy job sites or desktop browsers." },
        { t:"Speak or type your command", d:"Examples: <b>\"Add payment $3000\"</b>, <b>\"Create task install tile\"</b>, <b>\"Add expense $500 Jorge\"</b>. Katy understands English and Spanish and handles amounts in words (\"fifteen hundred\" → 1500)." },
        { t:"Creating a contact (conversational)", d:"Say <b>\"Create a contact\"</b> and Katy guides you step by step: (1) <i>Type? Co-worker, client or friend?</i> (2) <i>Name?</i> (3) <i>Phone?</i> (4) <i>Specialty?</i> (only for co-workers — Plumbing, Painting, Electrical…) (5) <i>Rate?</i> (optional, e.g. 25/hour). Each question waits for your answer before asking the next." },
        { t:"Review before saving", d:"Katy shows a confirmation card with what she understood and all extracted fields. You can <b>edit any field</b> before confirming. Nothing saves until you tap Confirm." },
        { t:"Katy knows your projects", d:"From the Dashboard, Katy receives the full list of active projects. You can say <b>\"the Brickell one\"</b> or <b>\"the Miami kitchen project\"</b> and she'll match it automatically." },
        { t:"Navigate context first", d:"Inside a project, Katy automatically uses that project as context — no need to name it. From Dashboard, name the project or Katy will ask." },
      ] : [
        { t:"Modo voz — botón micrófono", d:"Toca el <b>botón 🎙 micrófono</b> en la esquina inferior derecha. Brilla mientras Katy escucha. Funciona en Chrome/Safari en dispositivos con micrófono." },
        { t:"Modo texto — botón teclado", d:"¿Sin micrófono? Toca el <b>botón ⌨ teclado</b> (a la izquierda del mic). Un panel de texto sube — escribe tu comando y presiona Enter o el botón Enviar. Ideal en obras ruidosas o en desktop." },
        { t:"Hablar o escribir el comando", d:"Ejemplos: <b>\"Agregar pago $3000\"</b>, <b>\"Crear tarea instalar tile\"</b>, <b>\"Agregar egreso $500 Jorge\"</b>. Katy entiende inglés y español y convierte montos en palabras (\"quince mil\" → 15000)." },
        { t:"Crear un contacto (conversacional)", d:"Di <b>\"Crear un contacto\"</b> y Katy te guía paso a paso: (1) <i>¿Tipo? ¿Co-worker, cliente o amistad?</i> (2) <i>¿Nombre?</i> (3) <i>¿Teléfono?</i> (4) <i>¿Especialidad?</i> (solo co-workers — Plomería, Pintura, Electricidad…) (5) <i>¿Tarifa?</i> (opcional, ej: 25/hora). Cada pregunta espera tu respuesta antes de la siguiente." },
        { t:"Revisar antes de guardar", d:"Katy muestra una tarjeta de confirmación con lo que entendió y todos los campos extraídos. Puedes <b>editar cualquier campo</b> antes de confirmar. Nada se guarda hasta que toques Confirmar." },
        { t:"Katy conoce tus proyectos", d:"Desde el Dashboard, Katy recibe la lista completa de proyectos activos. Puedes decir <b>\"el de Brickell\"</b> o <b>\"el proyecto de la cocina\"</b> y lo identificará automáticamente." },
        { t:"Navegar al contexto primero", d:"Dentro de un proyecto, Katy lo usa automáticamente como contexto — no necesitas nombrarlo. Desde el Dashboard, indica el proyecto o Katy lo preguntará." },
      ],
      tips: EN ? [
        "🗣 Supported commands: <b>Create project · Add task · Add material · Add budget item · Add payment · Add expense · Add contact</b>",
        "⌨ The <b>keyboard button</b> is always available next to the mic — no browser permissions needed. Great for desktop use or quiet zones.",
        "📋 Every command (confirmed, cancelled or error) is <b>automatically logged</b> as an audit trail — so you always have a record of voice actions.",
        "💡 Speak at a <b>normal pace</b> — Katy waits for a natural silence before processing. Amounts in words are converted automatically.",
        "🌐 Switch to Spanish with the top-right language toggle and Katy will respond in Spanish too.",
      ] : [
        "🗣 Comandos soportados: <b>Crear proyecto · Agregar tarea · Agregar material · Agregar item de presupuesto · Agregar pago · Agregar egreso · Agregar contacto</b>",
        "⌨ El <b>botón de teclado</b> siempre está disponible junto al mic — sin permisos del navegador. Ideal para desktop o zonas tranquilas.",
        "📋 Cada comando (confirmado, cancelado o error) se <b>registra automáticamente</b> como auditoría — siempre hay rastro de las acciones por voz.",
        "💡 Habla a <b>ritmo normal</b> — Katy espera un silencio natural antes de procesar. Los montos en palabras se convierten automáticamente.",
        "🌐 Cambia a español con el selector de idioma (arriba a la derecha) y Katy también responderá en español.",
      ],
    },
    {
      id: "team", icon: "👥",
      title: EN ? "Team Access" : "Acceso del Equipo",
      desc:  EN ? "Grant co-workers and clients access to specific tabs and data sections — with fine-grained control over what each person can see and do."
                : "Otorga acceso a co-workers y clientes a tabs y secciones específicas — con control granular sobre lo que cada persona puede ver y hacer.",
      mockup: <MockupTeam EN={EN} />,
      steps: EN ? [
        { t:"Open Team section", d:"On the Dashboard, scroll down to the <b>Team</b> section (visible only to superadmin). Here you see all active team members and clients." },
        { t:"Create a new user", d:"Click <b>+ New user</b>. First choose the type: <b>👷 Co-worker</b> (field crew, specialists) or <b>👤 Client</b> (owner/client). The type determines the default preset applied automatically." },
        { t:"Co-worker preset", d:"Co-workers get Workflow + Day Planner + Notes by default and the <b>My tasks only</b> toggle is active — they only see tasks assigned to them in Workflow and Gantt." },
        { t:"Client preset", d:"Clients get read-only access to Estimate, Workflow (progress view), Gantt, Notes, and Design. No financial data is exposed by default." },
        { t:"Link a co-worker to a contact", d:"Under the <b>Info</b> sub-tab, select a contact from the dropdown. When <b>My tasks only</b> is active, Workflow and Gantt filter to show only tasks where that contact is assigned." },
        { t:"Configure visible tabs", d:"Open the <b>Tabs</b> sub-tab and check exactly which project tabs this user can see. Use the preset buttons (👷 Co-worker / 👤 Client) for quick defaults, or customize freely." },
        { t:"Set data permissions", d:"Under <b>Permisos</b>, control CRUD access for each section: View, Create, Edit, Delete. These control what data they can read or modify within their allowed tabs." },
        { t:"Assign projects", d:"Under <b>Projects</b>, toggle which projects appear on this user's dashboard. Unassigned projects are invisible to them." },
        { t:"Edit a user", d:"Click the <b>✏ pencil icon</b> on any user card. The panel expands with 4 sub-tabs: Info · Tabs · Permisos · Projects. Click <b>Save changes</b> after editing." },
      ] : [
        { t:"Abrir la sección Equipo", d:"En el Dashboard, baja hasta la sección <b>Equipo</b> (visible solo para el superadmin). Aquí ves todos los miembros activos del equipo y clientes." },
        { t:"Crear un nuevo usuario", d:"Clic en <b>+ Nuevo usuario</b>. Primero elige el tipo: <b>👷 Co-worker</b> (cuadrilla, especialistas) o <b>👤 Cliente</b> (dueño/cliente). El tipo determina el preset aplicado automáticamente." },
        { t:"Preset Co-worker", d:"Los co-workers obtienen Workflow + Day Planner + Notas por defecto y el toggle <b>Solo sus tareas</b> está activo — solo ven las tareas asignadas a ellos en Workflow y Gantt." },
        { t:"Preset Cliente", d:"Los clientes obtienen acceso de solo lectura a Estimate, Workflow (vista de progreso), Gantt, Notas y Design. No se exponen datos financieros por defecto." },
        { t:"Vincular un co-worker a un contacto", d:"En el sub-tab <b>Info</b>, selecciona un contacto del selector. Con <b>Solo sus tareas</b> activo, el Workflow y Gantt filtran para mostrar solo las tareas donde ese contacto está asignado." },
        { t:"Configurar tabs visibles", d:"Abre el sub-tab <b>Tabs</b> y marca exactamente qué tabs del proyecto puede ver este usuario. Usa los botones de preset (👷 Co-worker / 👤 Cliente) para configurar rápido, o personaliza libremente." },
        { t:"Establecer permisos de datos", d:"En <b>Permisos</b>, controla el acceso CRUD por sección: Ver, Crear, Editar, Eliminar. Estos controlan qué datos puede leer o modificar dentro de sus tabs permitidos." },
        { t:"Asignar proyectos", d:"En <b>Proyectos</b>, activa cuáles proyectos aparecen en el dashboard de este usuario. Los proyectos no asignados son invisibles para ellos." },
        { t:"Editar un usuario", d:"Clic en el <b>ícono ✏ lápiz</b> de cualquier tarjeta. El panel se expande con 4 sub-tabs: Info · Tabs · Permisos · Proyectos. Clic en <b>Guardar cambios</b> después de editar." },
      ],
      tips: EN ? [
        "👷 <b>My tasks only</b> (co-worker): when a co-worker is linked to a contact and this toggle is on, Workflow and Gantt show <i>only</i> their assigned tasks — perfect for field crew who shouldn't see the full project scope.",
        "👤 <b>Client access</b>: clients never see Cash Flow or Materials by default — protect sensitive financial info while giving them a professional project tracking experience.",
        "🗂 <b>Tab access is independent</b> from CRUD permissions. A user can have the Estimate tab visible (tab_access) but still be read-only (permissions: view only). This lets you show the quote without allowing edits.",
        "🔄 After editing a user, they will see the updated tabs on their next login or page refresh.",
        "🔐 Only the superadmin can create, edit, or remove team members. Collaborators cannot see the Team section.",
      ] : [
        "👷 <b>Solo sus tareas</b> (co-worker): cuando un co-worker está vinculado a un contacto y este toggle está activo, Workflow y Gantt muestran <i>solo</i> sus tareas asignadas — perfecto para cuadrilla que no debe ver el alcance completo del proyecto.",
        "👤 <b>Acceso cliente</b>: los clientes nunca ven Cash Flow ni Materials por defecto — protege info financiera sensible mientras les das una experiencia profesional de seguimiento del proyecto.",
        "🗂 <b>El acceso a tabs es independiente</b> de los permisos CRUD. Un usuario puede tener el tab Estimate visible (tab_access) pero ser de solo lectura (permisos: solo Ver). Esto permite mostrar la cotización sin permitir ediciones.",
        "🔄 Después de editar un usuario, verá los tabs actualizados en su próximo login o al refrescar la página.",
        "🔐 Solo el superadmin puede crear, editar o eliminar miembros del equipo. Los colaboradores no ven la sección Equipo.",
      ],
    },
    {
      id: "activity", icon: "📋",
      title: EN ? "Activity Log" : "Registro de Actividad",
      desc:  EN ? "Full audit trail of who logged in, what was created and what was deleted — visible only to the superadmin."
                : "Auditoría completa de quién ingresó, qué se creó y qué se eliminó — visible solo para el superadmin.",
      mockup: null,
      steps: EN ? [
        { t:"Open Activity Log", d:"Click <b>Activity</b> in the top navigation bar (only visible when logged in as superadmin). The page lists all recorded events ordered newest first." },
        { t:"Stats strip", d:"Four KPI cards at the top summarise: <b>Today's events · Logins · Records created · Records deleted</b>. Counts reset at midnight." },
        { t:"Filter by user", d:"Use the <b>User</b> dropdown to view events from a specific team member. Combine with the <b>Action</b> filter to narrow down login events, creations, or deletions." },
        { t:"Filter by action type", d:"Select <b>Login · Create · Update · Delete</b> from the Action dropdown. Each event row shows a colored badge with an emoji: 🔑 Login · ➕ Create · ✏️ Update · 🗑 Delete." },
        { t:"Filter by date range", d:"Use the <b>From / To</b> date pickers to restrict events to a specific period. Useful for reviewing activity during a particular week or month." },
        { t:"Superadmin display name", d:"Go to <b>Settings → Nombre de display</b> to set the name shown in the Activity Log and the Dashboard greeting. Enter your desired name, confirm with your PIN, and it's saved immediately." },
      ] : [
        { t:"Abrir el Registro de Actividad", d:"Clic en <b>Activity</b> en la barra de navegación superior (solo visible cuando estás autenticado como superadmin). La página lista todos los eventos registrados del más reciente al más antiguo." },
        { t:"Panel de estadísticas", d:"Cuatro tarjetas KPI en la parte superior resumen: <b>Eventos de hoy · Inicios de sesión · Registros creados · Registros eliminados</b>. Los conteos se reinician a medianoche." },
        { t:"Filtrar por usuario", d:"Usa el selector <b>Usuario</b> para ver eventos de un miembro específico del equipo. Combínalo con el filtro de <b>Acción</b> para ver solo inicios de sesión, creaciones o eliminaciones." },
        { t:"Filtrar por tipo de acción", d:"Selecciona <b>Login · Crear · Actualizar · Eliminar</b> en el selector de Acción. Cada fila muestra un badge con emoji: 🔑 Login · ➕ Crear · ✏️ Actualizar · 🗑 Eliminar." },
        { t:"Filtrar por rango de fechas", d:"Usa los selectores <b>Desde / Hasta</b> para restringir los eventos a un período específico. Útil para revisar la actividad de una semana o mes particular." },
        { t:"Nombre de display del superadmin", d:"Ve a <b>Configuración → Nombre de display</b> para establecer el nombre que aparece en el Registro de Actividad y el saludo del Dashboard. Ingresa el nombre deseado, confirma con tu PIN y se guarda de inmediato." },
      ],
      tips: EN ? [
        "🔐 Only the <b>superadmin</b> can see the Activity tab — it is hidden from all collaborators regardless of their permissions.",
        "🔑 Every login — both superadmin and collaborator — is automatically recorded with the user name, role and timestamp.",
        "🤖 Voice commands confirmed through Katy are also logged in the Activity Log as <b>Create</b> events.",
        "🗑 Delete events capture the entity name so you know what was removed even after it's gone.",
        "👤 Use the <b>Nombre de display</b> card in Settings to set a personalized name for each superadmin session — useful when multiple people share the superadmin PIN.",
      ] : [
        "🔐 Solo el <b>superadmin</b> puede ver el tab Activity — está oculto para todos los colaboradores independientemente de sus permisos.",
        "🔑 Cada inicio de sesión — tanto del superadmin como de colaboradores — se registra automáticamente con el nombre, rol y timestamp.",
        "🤖 Los comandos de voz confirmados a través de Katy también se registran en el Activity Log como eventos de <b>Creación</b>.",
        "🗑 Los eventos de eliminación capturan el nombre de la entidad para saber qué se borró incluso después de que ya no existe.",
        "👤 Usa la tarjeta <b>Nombre de display</b> en Configuración para establecer un nombre personalizado — útil cuando varias personas comparten el PIN de superadmin.",
      ],
    },
    {
      id: "agenda", icon: "🗓",
      title: EN ? "My Agenda" : "Mi Agenda",
      desc:  EN ? "Personal admin agenda: appointments, project tasks and meetings for new projects — with reminders you can repeat until the event and export to your phone's calendar."
                : "Agenda personal del admin: citas, tasks de proyecto y reuniones de nuevos proyectos — con avisos repetibles hasta el evento y export al calendario del teléfono.",
      mockup: null,
      steps: EN ? [
        { t:"Open the Agenda", d:"Click <b>Agenda</b> in the top navigation (visible only to the superadmin). You'll see three groups: <b>Today · Upcoming · Past</b>, plus KPI counters." },
        { t:"Create by voice or text", d:"Use the capture bar at the top: tap the <b>🎙 mic</b> and speak, or type a phrase like <i>\"Meeting with Mrs. Herrera on Tuesday at 10, remind me every 2 hours from a day before\"</i> and tap <b>Create</b>. Katy extracts type, date, time and reminders." },
        { t:"Review the confirmation card", d:"Katy shows what she understood with <b>all fields editable</b> — type (📅 Appointment / ✅ Project task / 🤝 Meeting), title, project, date, time, reminder start and repetition. Nothing saves until you tap <b>Confirm & schedule</b>." },
        { t:"Or use the manual form", d:"Click <b>+ New entry</b> to open the classic form with the same fields. Project tasks can be linked to any active project from the dropdown." },
        { t:"Configure reminders", d:"<b>Remind me from</b> sets when alerts start (2 hours to 1 week before). <b>Repeat reminder</b> repeats the alert every 1, 2 or 4 hours until the event time." },
        { t:"Send it to your phone", d:"On each entry, tap <b>Add to calendar (.ics)</b> to download a calendar file — open it on your phone and the event is added with alarms. Or use the <b>Google Calendar</b> link to add it directly to your Google account." },
        { t:"Mark as done", d:"Tap <b>Done</b> when the appointment or task is finished — it stays visible with a strikethrough. Use <b>Remove</b> to delete it permanently." },
      ] : [
        { t:"Abrir la Agenda", d:"Clic en <b>Agenda</b> en la navegación superior (visible solo para el superadmin). Verás tres grupos: <b>Hoy · Próximos · Pasados</b>, más contadores KPI." },
        { t:"Crear por voz o texto", d:"Usa la barra de captura arriba: toca el <b>🎙 micrófono</b> y habla, o escribe una frase como <i>\"Reunión con la Sra. Herrera el martes a las 10, avísame cada 2 horas desde un día antes\"</i> y toca <b>Crear</b>. Katy extrae tipo, fecha, hora y avisos." },
        { t:"Revisar la tarjeta de confirmación", d:"Katy muestra lo que entendió con <b>todos los campos editables</b> — tipo (📅 Cita / ✅ Task de proyecto / 🤝 Reunión), título, proyecto, fecha, hora, inicio del aviso y repetición. Nada se guarda hasta que toques <b>Confirmar y agendar</b>." },
        { t:"O usar el formulario manual", d:"Clic en <b>+ Nueva entrada</b> para abrir el formulario clásico con los mismos campos. Las tasks de proyecto se pueden vincular a cualquier proyecto activo desde el selector." },
        { t:"Configurar los avisos", d:"<b>Avisarme desde</b> define cuándo empiezan las alertas (de 2 horas a 1 semana antes). <b>Repetir aviso</b> repite la alerta cada 1, 2 o 4 horas hasta la hora del evento." },
        { t:"Enviarlo a tu teléfono", d:"En cada entrada, toca <b>Añadir al calendario (.ics)</b> para descargar un archivo de calendario — ábrelo en tu teléfono y el evento se agrega con alarmas. O usa el link de <b>Google Calendar</b> para agregarlo directo a tu cuenta de Google." },
        { t:"Marcar como listo", d:"Toca <b>Listo</b> cuando la cita o task termine — queda visible tachada. Usa <b>Quitar</b> para eliminarla permanentemente." },
      ],
      tips: EN ? [
        "🎙 The capture bar understands relative dates: <b>today, tomorrow, Tuesday, on the 15th</b> — and times like <b>at 3 pm</b>.",
        "📲 The <b>.ics file</b> works with iPhone Calendar, Google Calendar and Outlook — the phone itself fires the notifications, no app install needed.",
        "🤖 You can also tell Katy (the floating mic) things like <b>\"Remind me of the city inspection tomorrow at 9\"</b> from anywhere in the panel.",
        "🔐 The Agenda is <b>private to the superadmin</b> — collaborators and clients never see it.",
      ] : [
        "🎙 La barra de captura entiende fechas relativas: <b>hoy, mañana, el martes, el 15</b> — y horas como <b>a las 3 de la tarde</b>.",
        "📲 El <b>archivo .ics</b> funciona con el Calendario del iPhone, Google Calendar y Outlook — el propio teléfono dispara las notificaciones, sin instalar nada.",
        "🤖 También puedes decirle a Katy (el micrófono flotante) cosas como <b>\"Recuérdame la inspección de la ciudad mañana a las 9\"</b> desde cualquier parte del panel.",
        "🔐 La Agenda es <b>privada del superadmin</b> — colaboradores y clientes nunca la ven.",
      ],
    },
    {
      id: "devices", icon: "📲",
      title: EN ? "Direct Access (no PIN)" : "Acceso Directo (sin PIN)",
      desc:  EN ? "Create per-device links that open the panel already signed in — perfect as a home-screen shortcut on your phone or tablet. Works for you and for each team member, and each link can be revoked individually."
                : "Crea enlaces por dispositivo que abren el panel ya autenticado — perfecto como shortcut en la pantalla de inicio del teléfono o tableta. Funciona para ti y para cada miembro del equipo, y cada enlace se revoca individualmente.",
      mockup: null,
      steps: EN ? [
        { t:"Open Settings → Devices", d:"On the Dashboard, go to the <b>Security</b> section and open the <b>Devices</b> tab (superadmin only)." },
        { t:"Generate an access link", d:"Enter a device name (e.g. <i>Marco's iPhone</i>), confirm with your <b>PIN</b>, and tap <b>Generate access link</b>. A unique, secret URL is created." },
        { t:"Copy and open it on the phone", d:"Tap <b>Copy link</b> and send it to the device (WhatsApp to yourself works great). Open it once in the phone's browser — you'll land on the Dashboard already signed in." },
        { t:"Add to Home Screen", d:"In the phone browser menu, choose <b>\"Add to Home Screen\"</b>. The Luxaris icon now opens the panel directly — no PIN, no login screen." },
        { t:"Revoke when needed", d:"If a phone is lost or a person leaves the team, open <b>Devices</b>, and tap <b>Revoke</b> on that link. It stops working immediately — other devices are unaffected." },
      ] : [
        { t:"Abrir Configuración → Dispositivos", d:"En el Dashboard, ve a la sección <b>Seguridad</b> y abre el tab <b>Dispositivos</b> (solo superadmin)." },
        { t:"Generar un enlace de acceso", d:"Escribe el nombre del dispositivo (ej: <i>iPhone de Marco</i>), confirma con tu <b>PIN</b> y toca <b>Generar enlace de acceso</b>. Se crea una URL única y secreta." },
        { t:"Copiarlo y abrirlo en el teléfono", d:"Toca <b>Copiar enlace</b> y envíalo al dispositivo (un WhatsApp a ti mismo funciona perfecto). Ábrelo una vez en el navegador del teléfono — entrarás al Dashboard ya autenticado." },
        { t:"Añadir a pantalla de inicio", d:"En el menú del navegador del teléfono, elige <b>\"Añadir a pantalla de inicio\"</b>. El ícono de Luxaris ahora abre el panel directo — sin PIN, sin pantalla de login." },
        { t:"Revocar cuando haga falta", d:"Si un teléfono se pierde o alguien deja el equipo, abre <b>Dispositivos</b> y toca <b>Revocar</b> en ese enlace. Deja de funcionar de inmediato — los demás dispositivos no se afectan." },
      ],
      tips: EN ? [
        "🔐 The link <b>never contains your PIN</b> — it's a random token validated server-side on every use, and each use is recorded in the Activity Log.",
        "📵 Treat each link like a key: <b>one link per device</b>, never shared in groups. If in doubt, revoke it and generate a new one.",
        "👥 Works for the whole team too — each person keeps <b>their own permissions</b> (visible tabs, my-tasks-only) when entering via their link.",
        "⏱ Revoked links show their <b>last used</b> date, so you can audit when a device last entered.",
      ] : [
        "🔐 El enlace <b>nunca contiene tu PIN</b> — es un token aleatorio validado en el servidor en cada uso, y cada uso queda registrado en el Activity Log.",
        "📵 Trata cada enlace como una llave: <b>un enlace por dispositivo</b>, nunca compartido en grupos. Ante la duda, revócalo y genera uno nuevo.",
        "👥 También funciona para todo el equipo — cada persona conserva <b>sus propios permisos</b> (tabs visibles, solo-sus-tareas) al entrar por su enlace.",
        "⏱ Los enlaces revocados muestran su fecha de <b>último uso</b>, para auditar cuándo entró ese dispositivo por última vez.",
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
        {features.slice(0, 8).map(f => (
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
          {EN ? "Tools & Admin" : "Herramientas"}
        </div>
        {features.slice(8).map(f => (
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
              <h1 className="font-display text-2xl font-medium text-[#16323D]">{active.title}</h1>
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
