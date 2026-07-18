"use client";

import { useState } from "react";
import { useLanguage } from "@/src/context/LanguageContext";

// ─── Mockup components (visual pseudo-screenshots) ────────────────────────────

function MockupDashboard({ EN }: { EN: boolean }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-[#E6DDCB] dark:border-[#22304d] bg-white dark:bg-[#111a2e] shadow-sm">
      {/* KPI row */}
      <div className="grid grid-cols-4 gap-2 bg-[#F7F3EA] dark:bg-[#0b1220] p-3">
        {[
          { label: EN?"Income":"Ingresos",  val:"$12,500", c:"text-[#4F8A63] bg-[#DCEBDD] dark:bg-[#14261c]" },
          { label: EN?"Expenses":"Egresos", val:"$8,200",  c:"text-[#B0492F] bg-[#F0DBD2] dark:bg-[#2a1712]" },
          { label: "Balance",               val:"$4,300",  c:"text-[var(--accent)] bg-[#EDF3FB] dark:bg-[#111a2e]" },
          { label: "Estimate",              val:"$65,000", c:"text-[#7A6230] bg-[#EDE3CF] dark:bg-[#17233d]" },
        ].map(k => (
          <div key={k.label} className={`rounded-xl px-2 py-1.5 ${k.c.split(" ")[1]}`}>
            <div className={`text-[8px] font-bold uppercase ${k.c.split(" ")[0]}`}>{k.label}</div>
            <div className={`text-[12px] font-black ${k.c.split(" ")[0]}`}>{k.val}</div>
          </div>
        ))}
      </div>
      {/* Project cards */}
      {[
        { name:"KITCHEN REMODEL · MIAMI",  client:"Jennifer Walsh", status:EN?"Approved":"Aprobado", sc:"bg-[#DCEBDD] dark:bg-[#14261c] text-[#4F8A63]" },
        { name:"BATH RENO · BRICKELL",     client:"Carlos Ruiz",    status:EN?"In Progress":"En Obra", sc:"bg-[#DCE8E9] dark:bg-[#122a2c] text-[#4E7A82]" },
      ].map(p => (
        <div key={p.name} className="flex items-center justify-between border-b border-[#F0EBE0] dark:border-[#22304d] px-3 py-2.5 last:border-0">
          <div>
            <div className="text-[10px] font-bold text-[var(--brand)]">{p.name}</div>
            <div className="text-[9px] text-[#5C6A6E] dark:text-[#9fb0cc]">{p.client}</div>
          </div>
          <span className={`rounded-full px-2 py-0.5 text-[8px] font-bold ${p.sc}`}>{p.status}</span>
        </div>
      ))}
      <div className="flex items-center justify-center py-2">
        <div className="rounded-full bg-[var(--brand)] px-3 py-1 text-[9px] font-bold text-white">+ {EN?"New Project":"Nuevo Proyecto"}</div>
      </div>
    </div>
  );
}

function MockupEstimate({ EN }: { EN: boolean }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between rounded-xl border border-[#E6DDCB] dark:border-[#22304d] bg-white dark:bg-[#111a2e] px-3 py-2">
        <div className="text-[9px] font-bold text-[var(--brand)]">DEMOLITION {EN?"· Dumping included":"· Acarreo incluido"}</div>
        <div className="font-mono text-[10px] font-bold text-[var(--brand)]">$1,800</div>
      </div>
      <div className="overflow-hidden rounded-xl border border-[var(--accent)] bg-white dark:bg-[#111a2e]">
        <div className="flex items-center justify-between bg-[#EDF3FB] dark:bg-[#111a2e] px-3 py-2">
          <div className="text-[9px] font-bold text-[var(--accent)]">PLUMBING</div>
          <div className="font-mono text-[10px] font-bold text-[var(--accent)]">$3,200</div>
        </div>
        {[
          { d:EN?"Replace Jacuzzi valves":"Reemplazar válvulas jacuzzi", a:"$800" },
          { d:EN?"Shower drain":"Desagüe de ducha",                      a:"$600" },
          { d:EN?"Hot water heater":"Calentador de agua",                 a:"$1,800" },
        ].map(i => (
          <div key={i.d} className="flex items-center justify-between border-t border-[#F0EBE0] dark:border-[#22304d] px-4 py-1.5">
            <div className="text-[9px] text-[var(--brand)]">• {i.d}</div>
            <div className="font-mono text-[9px] text-[#5C6A6E] dark:text-[#9fb0cc]">{i.a}</div>
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-[#E6DDCB] dark:border-[#22304d] bg-[var(--brand)] px-3 py-2 flex items-center justify-between">
        <div className="text-[9px] font-bold text-white">{EN?"GRAND TOTAL":"TOTAL FINAL"}</div>
        <div className="font-mono text-[11px] font-black text-white">$5,000</div>
      </div>
    </div>
  );
}

function MockupPayments({ EN }: { EN: boolean }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-[#E6DDCB] dark:border-[#22304d] bg-white dark:bg-[#111a2e]">
      <div className="grid grid-cols-3 gap-2 bg-[#F7F3EA] dark:bg-[#0b1220] p-2.5">
        <div className="rounded-lg bg-[#DCEBDD] dark:bg-[#14261c] p-2 text-center">
          <div className="text-[7px] font-bold uppercase text-[#4F8A63]">{EN?"Income":"Ingresos"}</div>
          <div className="font-mono text-[11px] font-black text-[#4F8A63]">$8,000</div>
        </div>
        <div className="rounded-lg bg-[#F0DBD2] dark:bg-[#2a1712] p-2 text-center">
          <div className="text-[7px] font-bold uppercase text-[#B0492F]">{EN?"Expenses":"Egresos"}</div>
          <div className="font-mono text-[11px] font-black text-[#B0492F]">$5,200</div>
        </div>
        <div className="rounded-lg bg-[#EDF3FB] dark:bg-[#111a2e] p-2 text-center">
          <div className="text-[7px] font-bold uppercase text-[var(--accent)]">Balance</div>
          <div className="font-mono text-[11px] font-black text-[var(--accent)]">$2,800</div>
        </div>
      </div>
      {[
        { label:EN?"Client payment":"Pago cliente",       amt:"+$4,000", c:"text-[#4F8A63]", method:"Zelle" },
        { label:EN?"Jorge - Plumbing":"Jorge - Plomería", amt:"-$1,200", c:"text-[#B0492F]", method:"Cash" },
        { label:EN?"Client deposit":"Depósito cliente",   amt:"+$4,000", c:"text-[#4F8A63]", method:"Transfer" },
      ].map(r => (
        <div key={r.label} className="flex items-center justify-between border-t border-[#F0EBE0] dark:border-[#22304d] px-3 py-2">
          <div>
            <div className="text-[9px] font-semibold text-[var(--brand)]">{r.label}</div>
            <div className="text-[8px] text-[#5C6A6E] dark:text-[#9fb0cc]">{r.method}</div>
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
      <div className="flex items-center gap-2 rounded-xl border border-[var(--accent)] bg-[#EDF3FB] dark:bg-[#111a2e] px-3 py-2">
        <div className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-[8px] font-bold text-white">↓</div>
        <span className="text-[9px] font-bold text-[var(--accent)]">
          {EN ? "Import from Estimate" : "Importar del Estimado"}
        </span>
      </div>
      <div className="overflow-hidden rounded-2xl border border-[#E6DDCB] dark:border-[#22304d] bg-white dark:bg-[#111a2e]">
        {[
          { n: EN ? "Compra de PORCELAIN" : "Compra de PORCELAIN", badge: EN ? "FROM EST" : "DEL EST", qty: "50 sq.ft", cost: "$1,500", bought: false },
          { n: EN ? "Compra de GLASS DOOR" : "Compra de GLASS DOOR", badge: EN ? "FROM EST" : "DEL EST", qty: "1 unit",  cost: "$1,850", bought: true  },
          { n: "LED MIRROR",                                          badge: null,                        qty: "",        cost: "$650",   bought: false },
        ].map(i => (
          <div key={i.n} className={`flex items-center gap-2.5 border-b border-[#F0EBE0] dark:border-[#22304d] px-3 py-2 last:border-0 ${i.bought ? "opacity-50" : ""}`}>
            <div className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${i.bought ? "border-[#4F8A63] bg-[#4F8A63] text-white" : "border-[#D7CBB3] dark:border-[#2c3c5e]"} text-[8px] font-bold`}>
              {i.bought ? "✓" : ""}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className={`text-[9px] font-semibold ${i.bought ? "line-through text-[#5C6A6E] dark:text-[#9fb0cc]" : "text-[var(--brand)]"}`}>{i.n}</span>
                {i.badge && (
                  <span className="rounded bg-[#EDF3FB] dark:bg-[#111a2e] px-1 py-px text-[7px] font-bold text-[var(--accent)]">{i.badge}</span>
                )}
              </div>
              {i.qty && <div className="text-[8px] text-[#5C6A6E] dark:text-[#9fb0cc]">{i.qty}</div>}
            </div>
            <div className="font-mono text-[9px] font-bold text-[var(--brand)]">{i.cost}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MockupContacts({ EN }: { EN: boolean }) {
  const contacts = [
    { name:"Jorge Saldarriaga", spec:EN?"Tile & Flooring":"Tile y Pisos", rate:"$45/hr", type:EN?"Specialist":"Especialista", c:"bg-[#EDF3FB] dark:bg-[#111a2e] text-[var(--accent)]" },
    { name:"Miami Plumbing Co", spec:EN?"Plumbing":"Plomería",             rate:"$1,800 job", type:EN?"Supplier":"Proveedor", c:"bg-[#EDE3CF] dark:bg-[#17233d] text-[#7A6230]" },
    { name:"Carlos Pinto",      spec:EN?"Electrical":"Eléctrico",          rate:"$55/hr", type:EN?"Specialist":"Especialista", c:"bg-[#EDF3FB] dark:bg-[#111a2e] text-[var(--accent)]" },
  ];
  return (
    <div className="space-y-2">
      {contacts.map(c => (
        <div key={c.name} className="flex items-center gap-3 rounded-xl border border-[#E6DDCB] dark:border-[#22304d] bg-white dark:bg-[#111a2e] px-3 py-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--brand)] text-[10px] font-bold text-white">
            {c.name.split(" ").map(w => w[0]).join("").slice(0,2)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-bold text-[var(--brand)]">{c.name}</div>
            <div className="text-[8px] text-[#5C6A6E] dark:text-[#9fb0cc]">{c.spec} · {c.rate}</div>
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
      <div className="overflow-hidden rounded-xl border border-[#E6DDCB] dark:border-[#22304d] bg-white dark:bg-[#111a2e]">
        <div className="px-3 py-2.5">
          <div className="mb-1 text-[9px] font-bold text-[var(--brand)]">{EN?"Client wants white subway tile on accent wall":"Cliente quiere tile subway blanco en pared de acento"}</div>
          <div className="text-[8px] leading-relaxed text-[#5C6A6E] dark:text-[#9fb0cc]">{EN?"Also requested heated floors in the master bath area. Confirm with supplier before ordering.":"También solicita piso con calefacción en el baño principal. Confirmar con proveedor antes de ordenar."}</div>
        </div>
        <div className="flex items-center gap-2 border-t border-[#F0EBE0] dark:border-[#22304d] bg-[#FDFAF6] dark:bg-[#111a2e] px-3 py-1.5">
          <div className="flex items-center gap-1 rounded-lg border border-[#E6DDCB] dark:border-[#22304d] px-1.5 py-0.5">
            <div className="h-3 w-3 rounded bg-[#DCE8E9] dark:bg-[#122a2c]" />
            <span className="text-[7px] text-[#5C6A6E] dark:text-[#9fb0cc]">site_photo.jpg</span>
          </div>
          <div className="flex items-center gap-1 rounded-lg border border-[#E6DDCB] dark:border-[#22304d] px-1.5 py-0.5">
            <div className="h-3 w-3 rounded bg-[#F0DBD2] dark:bg-[#2a1712]" />
            <span className="text-[7px] text-[#5C6A6E] dark:text-[#9fb0cc]">contract.pdf</span>
          </div>
        </div>
      </div>
      <div className="rounded-xl border border-[#E6DDCB] dark:border-[#22304d] bg-white dark:bg-[#111a2e] px-3 py-2.5">
        <div className="text-[9px] font-bold text-[var(--brand)]">{EN?"Inspection passed - June 14":"Inspección aprobada - 14 junio"}</div>
        <div className="mt-0.5 text-[8px] text-[#5C6A6E] dark:text-[#9fb0cc]">{EN?"Inspector signed off on rough plumbing.":"Inspector aprobó la plomería preliminar."}</div>
      </div>
      <div className="flex items-center justify-center rounded-xl border-2 border-dashed border-[#D7CBB3] dark:border-[#2c3c5e] py-2">
        <span className="text-[9px] font-semibold text-[#5C6A6E] dark:text-[#9fb0cc]">+ {EN?"New Note":"Nueva Nota"}</span>
      </div>
    </div>
  );
}

function MockupPlan({ EN }: { EN: boolean }) {
  const tasks = EN
    ? [
        { name:"Demo walls",        weeks:1, col:"#B0492F", start:0, span:1, status:"Done ✓" },
        { name:"Rough plumbing",    weeks:2, col:"var(--accent)", start:1, span:2, status:"In Progress" },
        { name:"Tile installation", weeks:2, col:"#7A6230", start:2, span:2, status:"Pending" },
        { name:"Painting",          weeks:1, col:"#4F8A63", start:4, span:1, status:"Pending" },
      ]
    : [
        { name:"Demoler paredes",   weeks:1, col:"#B0492F", start:0, span:1, status:"Listo ✓" },
        { name:"Plomería inicial",  weeks:2, col:"var(--accent)", start:1, span:2, status:"En Proceso" },
        { name:"Instalación tile",  weeks:2, col:"#7A6230", start:2, span:2, status:"Pendiente" },
        { name:"Pintura",           weeks:1, col:"#4F8A63", start:4, span:1, status:"Pendiente" },
      ];
  const weeks = [1,2,3,4,5];
  return (
    <div className="overflow-hidden rounded-2xl border border-[#E6DDCB] dark:border-[#22304d] bg-white dark:bg-[#111a2e]">
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-[#F0EBE0] dark:border-[#22304d] bg-[#F7F3EA] dark:bg-[#0b1220] px-3 py-2">
        <div className="flex gap-1">
          {[EN?"All":"Todo", EN?"To do":"Por hacer", EN?"In progress":"En proceso", EN?"Done":"Listo"].map((f,i) => (
            <span key={f} className={`rounded-full px-2 py-0.5 text-[8px] font-bold ${i===0 ? "bg-[var(--brand)] text-white" : "text-[#5C6A6E] dark:text-[#9fb0cc]"}`}>{f}</span>
          ))}
        </div>
        <div className="flex gap-1">
          {[EN?"Weeks":"Semanas", EN?"Days":"Días"].map((v,i) => (
            <span key={v} className={`rounded-lg px-2 py-0.5 text-[8px] font-semibold ${i===0 ? "bg-[var(--accent)] text-white" : "text-[#5C6A6E] dark:text-[#9fb0cc]"}`}>{v}</span>
          ))}
        </div>
      </div>
      {/* Gantt grid */}
      <div className="p-3">
        {/* Week headers */}
        <div className="mb-1.5 flex">
          <div className="w-28 shrink-0" />
          {weeks.map(w => (
            <div key={w} className="flex-1 text-center text-[8px] font-bold text-[#5C6A6E] dark:text-[#9fb0cc]">
              {EN ? `Wk ${w}` : `Sem ${w}`}
            </div>
          ))}
        </div>
        {/* Task rows */}
        {tasks.map(task => (
          <div key={task.name} className="mb-1.5 flex items-center">
            <div className="w-28 shrink-0 truncate pr-2 text-[9px] font-semibold text-[var(--brand)]">{task.name}</div>
            <div className="relative flex flex-1 gap-0">
              {weeks.map(w => (
                <div key={w} className="flex-1 border-l border-[#F0EBE0] dark:border-[#22304d] px-px py-px first:border-l-0">
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
    ? [{ label:"Electrical rough-in", sec:"ELECTRICAL", hrs:8, c:"var(--accent)" },
       { label:"Custom item: cleanup",  sec:"CUSTOM",    hrs:2, c:"#7A6230" }]
    : [{ label:"Rough eléctrico",      sec:"ELÉCTRICO", hrs:8, c:"var(--accent)" },
       { label:"Item custom: limpieza", sec:"CUSTOM",   hrs:2, c:"#7A6230" }];
  const days = EN
    ? [
        { label:"Day 1", date:"Jun 30", items:[{ label:"Demo walls", sec:"DEMOLITION", hrs:6, c:"#B0492F" }], cap:8, used:6 },
        { label:"Day 2", date:"Jul 1",  items:[{ label:"Rough plumbing", sec:"PLUMBING", hrs:8, c:"var(--accent)" }], cap:8, used:8 },
        { label:"Day 3", date:"Jul 2",  items:[], cap:8, used:0 },
      ]
    : [
        { label:"Día 1", date:"30 jun", items:[{ label:"Demoler paredes", sec:"DEMOLICIÓN", hrs:6, c:"#B0492F" }], cap:8, used:6 },
        { label:"Día 2", date:"1 jul",  items:[{ label:"Plomería inicial", sec:"PLOMERÍA", hrs:8, c:"var(--accent)" }], cap:8, used:8 },
        { label:"Día 3", date:"2 jul",  items:[], cap:8, used:0 },
      ];
  return (
    <div className="flex gap-2.5">
      {/* Pool */}
      <div className="w-36 shrink-0">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-[8px] font-bold uppercase tracking-wide text-[#5C6A6E] dark:text-[#9fb0cc]">{EN ? "Item Pool" : "Items"}</span>
          <span className="rounded-full bg-[var(--brand)] px-1.5 py-0.5 text-[7px] font-bold text-white">+ {EN?"Custom":"Custom"}</span>
        </div>
        <div className="space-y-1.5">
          {pool.map(item => (
            <div key={item.label} className="rounded-lg border border-[#E6DDCB] dark:border-[#22304d] bg-white dark:bg-[#111a2e] px-2 py-1.5">
              <div className="mb-0.5 truncate text-[8px] font-semibold text-[var(--brand)]">{item.label}</div>
              <div className="flex items-center gap-1">
                <span className="rounded-full px-1 py-0.5 text-[6px] font-bold text-white" style={{ background: item.c }}>{item.sec}</span>
                <span className="text-[7px] text-[#5C6A6E] dark:text-[#9fb0cc]">{item.hrs}h</span>
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
            <div key={day.label} className="flex-1 rounded-xl bg-[#F7F3EA] dark:bg-[#0b1220] p-1.5">
              <div className="mb-1 text-[8px] font-bold text-[var(--brand)]">{day.label}</div>
              <div className="mb-1 text-[7px] text-[#5C6A6E] dark:text-[#9fb0cc]">{day.date}</div>
              {/* Capacity bar */}
              <div className="mb-1.5 h-1 w-full overflow-hidden rounded-full bg-[#E6DDCB] dark:bg-[#17233d]">
                <div className="h-full rounded-full" style={{ width: `${pct}%`, background: pct >= 100 ? "#B0492F" : "#4F8A63" }} />
              </div>
              <div className="mb-1.5 text-[6px] text-[#5C6A6E] dark:text-[#9fb0cc]">{day.used}/{day.cap}h</div>
              {day.items.map(item => (
                <div key={item.label} className="mb-1 rounded-lg border border-[#E6DDCB] dark:border-[#22304d] bg-white dark:bg-[#111a2e] px-1.5 py-1">
                  <div className="truncate text-[7px] font-semibold text-[var(--brand)]">{item.label}</div>
                  <span className="rounded px-0.5 py-px text-[6px] font-bold text-white" style={{ background: item.c }}>{item.sec}</span>
                </div>
              ))}
              {day.items.length === 0 && (
                <div className="rounded-lg border border-dashed border-[#D7CBB3] dark:border-[#2c3c5e] py-2 text-center text-[7px] text-[#C4B89A]">
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
  // Una conversación real: acuse de recibo, franja de destino y continuación manos libres
  return (
    <div className="flex gap-3">
      <div className="flex shrink-0 flex-col items-center gap-2">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--brand)] shadow-lg">
          <span className="text-2xl">🎙</span>
        </div>
        <div className="text-[8px] text-center font-semibold text-[#5C6A6E] dark:text-[#9fb0cc]">Katy</div>
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#4F8A63]">
          <div className="h-2.5 w-2.5 animate-pulse rounded-full bg-white dark:bg-[#111a2e]" />
        </div>
        <div className="text-[7px] font-bold text-[#4F8A63]">{EN ? "Listening…" : "Escuchando…"}</div>
      </div>

      <div className="flex-1 space-y-1.5">
        <div className="rounded-lg rounded-bl-sm bg-[var(--brand)] px-2.5 py-1.5 text-[9px] text-white">
          🗣 {EN ? "Add an income of four thousand by Zelle" : "Agregar un ingreso de cuatro mil por Zelle"}
        </div>
        <div className="pl-2 text-[9px] text-[#5C6A6E] dark:text-[#9fb0cc]">
          <b className="text-[var(--brand)] dark:text-[#cfe0ff]">K ·</b>{" "}
          {EN ? "Got it, $4,000 by Zelle. Adding it to Miami Kitchen." : "Ok, $4,000 por Zelle. Lo agrego a Cocina Miami."}
        </div>

        {/* Franja de destino — el punto que resuelve "¿dónde lo registró?" */}
        <div className="overflow-hidden rounded-lg border border-[#D7CBB3] dark:border-[#2c3c5e]">
          <div className="flex items-center gap-1.5 bg-[#F7F3EA] dark:bg-[#16233d] px-2 py-1">
            <span className="text-[7px] font-bold uppercase tracking-wide text-[#5C6A6E] dark:text-[#9fb0cc]">
              {EN ? "Will save to" : "Se guardará en"}
            </span>
            <span className="text-[9px] font-black text-[var(--brand)] dark:text-[#cfe0ff]">Cocina Miami</span>
          </div>
          <div className="flex gap-1 bg-white px-2 py-1.5 dark:bg-[#111a2e]">
            <span className="rounded bg-[#F7F3EA] px-1.5 py-0.5 font-mono text-[8px] text-[var(--brand)] dark:bg-[#16233d] dark:text-[#cfe0ff]">4000</span>
            <span className="rounded bg-[#F7F3EA] px-1.5 py-0.5 font-mono text-[8px] text-[var(--brand)] dark:bg-[#16233d] dark:text-[#cfe0ff]">Zelle</span>
            <span className="rounded bg-[#F7F3EA] px-1.5 py-0.5 font-mono text-[8px] text-[var(--brand)] dark:bg-[#16233d] dark:text-[#cfe0ff]">abono</span>
          </div>
        </div>

        <div className="rounded-lg rounded-bl-sm bg-[var(--brand)] px-2.5 py-1.5 text-[9px] text-white">
          🗣 {EN ? "Yes" : "Sí"}
        </div>
        <div className="flex items-center gap-1.5 rounded-lg bg-[#DCEBDD] px-2.5 py-1.5 dark:bg-[#14261c]">
          <span className="text-[9px]">✅</span>
          <span className="text-[9px] font-bold text-[#4F8A63]">
            {EN ? "Income of $4,000 saved in Cocina Miami. Anything else?" : "Ingreso de $4,000 guardado en Cocina Miami. ¿Algo más?"}
          </span>
        </div>
      </div>
    </div>
  );
}

function MockupTeam({ EN }: { EN: boolean }) {
  const users = EN
    ? [
        { initials:"L", bg:"var(--accent)", name:"Lidette",       badge:"👷 Co-worker", tag:"My tasks only", tabs:"Workflow · Day Planner · Notes" },
        { initials:"G", bg:"#7B6A45", name:"García Family", badge:"👤 Client",    tag:"",              tabs:"Estimate · Workflow · Gantt · Notes · Design" },
      ]
    : [
        { initials:"L", bg:"var(--accent)", name:"Lidette",       badge:"👷 Co-worker", tag:"Solo sus tareas", tabs:"Workflow · Day Planner · Notas" },
        { initials:"G", bg:"#7B6A45", name:"Familia García", badge:"👤 Cliente",  tag:"",               tabs:"Estimate · Workflow · Gantt · Notas · Design" },
      ];
  return (
    <div className="space-y-2">
      {/* New user button */}
      <div className="flex justify-end mb-1">
        <div className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-[#D7CBB3] dark:border-[#2c3c5e] bg-[#ECE3D1] dark:bg-[#17233d] px-3 py-1.5 text-[9px] font-bold text-[var(--brand)]">
          + {EN ? "New user" : "Nuevo usuario"}
        </div>
      </div>
      {users.map(u => (
        <div key={u.name} className="overflow-hidden rounded-2xl border border-[#E6DDCB] dark:border-[#22304d] bg-white dark:bg-[#111a2e]">
          <div className="flex items-center gap-2 px-3 py-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white" style={{ background: u.bg }}>
              {u.initials}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-1">
                <span className="text-[10px] font-bold text-[var(--brand)]">{u.name}</span>
                <span className="rounded-full border border-[#B8DEC9] bg-[#EBF5F0] dark:bg-[#14261c] px-1.5 py-px text-[7px] font-bold text-[#2E6B50]">
                  {u.badge}
                </span>
                {u.tag && (
                  <span className="rounded-full border border-[#F0CFA0] bg-[#FEF6ED] dark:bg-[#17233d] px-1.5 py-px text-[7px] font-bold text-[#9B6A2F]">
                    {u.tag}
                  </span>
                )}
              </div>
              <div className="mt-0.5 text-[7px] text-[#97A1A0] dark:text-[#728098]">{u.tabs}</div>
            </div>
            <div className="flex gap-1">
              <div className="grid h-5 w-5 place-items-center rounded bg-[#F0EAE0] dark:bg-[#17233d] text-[9px]">✏️</div>
              <div className="grid h-5 w-5 place-items-center rounded bg-[#F0EAE0] dark:bg-[#17233d] text-[9px]">▾</div>
            </div>
          </div>
        </div>
      ))}
      {/* Inline preview strip */}
      <div className="mt-1 grid grid-cols-2 gap-1.5 rounded-xl border border-[#E6DDCB] dark:border-[#22304d] bg-[#F7F3EA] dark:bg-[#0b1220] p-2">
        <div>
          <div className="mb-1 text-[7px] font-bold uppercase tracking-wide text-[#5C6A6E] dark:text-[#9fb0cc]">{EN?"Co-worker sees:":"Co-worker ve:"}</div>
          <div className="flex flex-wrap gap-1">
            {["Workflow","Day Planner","Notes"].map(t => (
              <span key={t} className="rounded bg-[var(--brand)] px-1 py-px text-[6px] font-bold text-white">{t}</span>
            ))}
          </div>
        </div>
        <div>
          <div className="mb-1 text-[7px] font-bold uppercase tracking-wide text-[#5C6A6E] dark:text-[#9fb0cc]">{EN?"Client sees:":"Cliente ve:"}</div>
          <div className="flex flex-wrap gap-1">
            {["Estimate","Workflow","Gantt","Notes","Design"].map(t => (
              <span key={t} className="rounded bg-[var(--accent)] px-1 py-px text-[6px] font-bold text-white">{t}</span>
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
      id: "estimate", icon: "💰",
      title: EN ? "Estimate" : "Estimado",
      desc:  EN ? "Create professional client proposals with sections, line items, discounts, payment schedules, PDF export and WhatsApp delivery."
                : "Crea propuestas profesionales con secciones, items, descuentos, calendario de pagos, exportación PDF y envío por WhatsApp.",
      mockup: (
        <div className="space-y-4">
          <MockupEstimate EN={EN} />
          <div className="text-[9px] font-bold uppercase tracking-widest text-[#5C6A6E] dark:text-[#9fb0cc] pt-1">
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
        <div className="overflow-hidden rounded-2xl border border-[#E6DDCB] dark:border-[#22304d] bg-white dark:bg-[#111a2e] shadow-sm">
          {/* 3-col header */}
          <div className="grid grid-cols-3 text-[9px] font-bold uppercase tracking-wider">
            <div className="bg-[var(--brand)] text-white/60 px-2 py-1.5">📸 {EN ? "References" : "Referencias"}</div>
            <div className="bg-[var(--brand)] text-white/60 px-2 py-1.5 border-x border-white/10">Brief</div>
            <div className="bg-[var(--brand)] text-white/60 px-2 py-1.5">AI Render</div>
          </div>
          <div className="grid grid-cols-3 gap-0" style={{ height: 110 }}>
            {/* Col 1 */}
            <div className="border-r border-[#E6DDCB] dark:border-[#22304d] p-1.5 flex flex-col gap-1">
              {[{ bg:"#D4C8B8", h: 48 }, { bg:"#C4B89A", h: 40 }].map((b, i) => (
                <div key={i} className="rounded flex-none" style={{ height: b.h, background: b.bg }} />
              ))}
            </div>
            {/* Col 2 */}
            <div className="border-r border-[#E6DDCB] dark:border-[#22304d] p-1.5 flex flex-col gap-1.5">
              <div className="rounded bg-[#F7F3EA] dark:bg-[#0b1220] h-5 text-[8px] text-[#5C6A6E] dark:text-[#9fb0cc] flex items-center px-2">{EN ? "Kitchen" : "Cocina"}</div>
              <div className="grid grid-cols-2 gap-0.5">
                <div className="rounded bg-[var(--brand)] h-4 text-[7px] text-white flex items-center justify-center">{EN ? "Modern" : "Moderno"}</div>
                <div className="rounded border border-[#E6DDCB] dark:border-[#22304d] h-4 text-[7px] text-[#5C6A6E] dark:text-[#9fb0cc] flex items-center justify-center">{EN ? "Luxury" : "Lujo"}</div>
              </div>
              <div className="h-1.5 rounded-full bg-[#E6DDCB] dark:bg-[#17233d] overflow-hidden"><div className="h-full bg-[#C9A96E]" style={{ width: "75%" }} /></div>
              <div className="mt-auto rounded bg-[var(--brand)] h-5 text-[8px] text-white flex items-center justify-center">✨ {EN ? "Generate" : "Generar"}</div>
            </div>
            {/* Col 3 — comparison slider */}
            <div className="relative overflow-hidden bg-[#0d1f27]">
              <div className="absolute inset-0 flex">
                <div className="flex-1 bg-[#2a3a40]" />
                <div className="flex-1" style={{ background: "linear-gradient(135deg, #3a5a6a 0%, #1a3040 100%)" }} />
              </div>
              <div className="absolute inset-0 flex items-center justify-center" style={{ left: "50%" }}>
                <div className="absolute top-0 bottom-0 w-0.5 bg-[#C9A96E]" />
                <div className="w-6 h-6 rounded-full bg-[#C9A96E] border-2 border-white flex items-center justify-center text-[9px] text-[var(--brand)] font-bold">⟺</div>
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
      desc:  EN ? "Talk to her like you'd talk to a coworker. She records 9 kinds of entry, answers questions about your data, and always shows you where it's going to be saved — hands-free."
                : "Háblale como le hablarías a un compañero. Registra 9 tipos de entrada, responde preguntas sobre tus datos, y siempre te muestra dónde va a guardar — sin usar las manos.",
      mockup: <MockupVoice EN={EN} />,
      steps: EN ? [
        { t:"Tap the mic — or the keyboard", d:"The <b>🎙 mic button</b> sits bottom-right on every page and listens the moment you tap it. No mic, or a loud job site? The <b>⌨ keyboard button</b> next to it opens a text panel instead — no browser permission needed." },
        { t:"Say it all in one breath", d:"The more complete your sentence, the fewer questions. <b>\"Add material tile for 800 from Home Depot\"</b> goes straight to the card — Katy only asks for what's genuinely missing. She converts amounts in words (\"four thousand\" → 4000) and understands \"the Brickell one\"." },
        { t:"She repeats back what she understood", d:"Katy acknowledges before asking: <b>\"Got it, $4,000 income — which method?\"</b>. If she misheard, correct her mid-sentence — no need to start over." },
        { t:"Check WHERE it will be saved", d:"The card always shows a <b>“Will save to: …”</b> strip. From the Dashboard, Katy proposes the <b>last project you used</b> — convenient, but check it. If it's red saying <b>“Pick a project”</b>, you can't confirm until you choose one." },
        { t:"Confirm by voice or by button", d:"Say <b>\"yes\"</b> / <b>\"go ahead\"</b> to save, <b>\"no\"</b> to discard — or tap the buttons. A long sentence like <b>\"yes but change the amount to 500\"</b> is treated as a correction, not a save." },
        { t:"Hands-free: keep going", d:"After saving, the session stays alive: <b>\"Saved in Miami Kitchen. Anything else?\"</b> — dictate the next one without touching the phone. Close with <b>\"done\"</b>, <b>\"that's all\"</b> or <b>\"thanks\"</b>." },
        { t:"Ask her things too — 8 kinds of question", d:"<b>Agenda (any day, past too):</b> \"What do I have today?\", \"What did I have yesterday?\", \"What was last week?\" · <b>Project sheet:</b> \"How's Brickell going?\", \"Whose project is this?\" · <b>Notes:</b> \"Read me the notes for Miami Kitchen\" · <b>Money (from the Estimate):</b> \"How much did I quote the client?\", \"How much is still owed?\", \"What did I spend it on?\" · <b>Tasks:</b> \"What's on for today?\" (all projects) or \"What's left in Brickell?\" · <b>Materials:</b> \"What's left to buy?\" · <b>Contacts:</b> \"What's Jorge's phone?\", \"Who are my plumbers?\" · <b>Gaps:</b> \"What am I missing on Brickell?\"" },
        { t:"Chain questions — she keeps the thread", d:"In one conversation Katy remembers which project you're on, so follow-ups don't repeat it: <b>\"How much have I collected on Jacuzzi? … and how much did I spend? … what's left to buy?\"</b> — three questions, no re-naming the project, and each answer comes faster because she reuses the context." },
        { t:"What she answers depends on your role", d:"Each lookup is permission-gated: a co-worker only hears what <b>their permissions</b> allow — no permission, no amounts. The agenda and the \"what am I missing\" audit need <b>admin level</b>: the superadmin, or a co-worker you've granted <b>all permissions</b> in the Team panel. Grant those and they get the same full voice as you. If she can't answer something, she tells you which tab to open instead of guessing." },
      ] : [
        { t:"Toca el micrófono — o el teclado", d:"El <b>botón 🎙</b> está abajo a la derecha en todas las pantallas y escucha apenas lo tocas. ¿Sin micrófono, o mucho ruido en obra? El <b>botón ⌨</b> de al lado abre un panel para escribir — sin permisos del navegador." },
        { t:"Dilo todo de un tirón", d:"Entre más completa la frase, menos preguntas. <b>\"Agregar material tile por 800 de Home Depot\"</b> va directo a la tarjeta — Katy solo pregunta lo que de verdad falta. Convierte montos en palabras (\"cuatro mil\" → 4000) y entiende \"el de Brickell\"." },
        { t:"Te repite lo que entendió", d:"Katy acusa recibo antes de preguntar: <b>\"Ok, ingreso de $4,000 — ¿por qué método?\"</b>. Si escuchó mal, corrígela a media frase — no hace falta empezar de nuevo." },
        { t:"Revisa DÓNDE se va a guardar", d:"La tarjeta siempre muestra la franja <b>“Se guardará en: …”</b>. Desde el Dashboard, Katy propone el <b>último proyecto que usaste</b> — cómodo, pero revísalo. Si sale en rojo diciendo <b>“Elige un proyecto”</b>, no podrás confirmar hasta escoger uno." },
        { t:"Confirma por voz o con el botón", d:"Di <b>\"sí\"</b> / <b>\"dale\"</b> para guardar, <b>\"no\"</b> para descartar — o toca los botones. Una frase larga como <b>\"sí pero cambia el monto a 500\"</b> se toma como corrección, no como guardado." },
        { t:"Manos libres: sigue dictando", d:"Después de guardar la sesión sigue viva: <b>\"Guardado en Cocina Miami. ¿Algo más?\"</b> — dicta el siguiente sin tocar el teléfono. Cierra con <b>\"listo\"</b>, <b>\"nada más\"</b> o <b>\"gracias\"</b>." },
        { t:"También puedes preguntarle — 8 tipos de pregunta", d:"<b>Agenda (cualquier día, también pasado):</b> \"¿Qué tengo hoy?\", \"¿Qué tuve ayer?\", \"¿Qué hubo la semana pasada?\" · <b>Ficha del proyecto:</b> \"¿Cómo va Brickell?\", \"¿De quién es Cocina Miami?\" · <b>Notas:</b> \"Léeme las notas de Cocina Miami\" · <b>Dinero (sale del Estimate):</b> \"¿Cuánto le presupuesté al cliente?\", \"¿Cuánto falta por cobrar?\", \"¿En qué se fue el dinero?\" · <b>Tareas:</b> \"¿Qué hay para hoy?\" (todos los proyectos) o \"¿Qué falta en Brickell?\" · <b>Materiales:</b> \"¿Qué falta comprar?\" · <b>Contactos:</b> \"¿Cuál es el teléfono de Jorge?\", \"¿Qué plomeros tengo?\" · <b>Huecos:</b> \"¿Qué me falta en Brickell?\"" },
        { t:"Encadena preguntas — mantiene el hilo", d:"En una conversación Katy recuerda de qué proyecto hablan, así que las preguntas seguidas no lo repiten: <b>\"¿Cuánto llevo cobrado en Jacuzzi? … ¿y cuánto gasté? … ¿qué falta comprar?\"</b> — tres preguntas, sin volver a nombrar el proyecto, y cada respuesta sale más rápido porque reutiliza el contexto." },
        { t:"Lo que responde depende de tu rol", d:"Cada consulta está gateada por permisos: un co-worker solo escucha lo que <b>sus permisos</b> permiten — sin permiso, no hay montos. La agenda y la auditoría de \"¿qué me falta?\" piden <b>nivel admin</b>: el superadmin, o un co-worker a quien le diste <b>todos los permisos</b> en el panel de Equipo. Dáselos y tiene la misma voz completa que tú. Si no puede responder algo, te dice qué tab abrir en vez de adivinar." },
      ],
      tips: EN ? [
        "🗣 <b>Records 9 things:</b> project · income · expense · task · task status · material · budget line · contact · agenda entry.",
        "❓ <b>Answers 8 kinds of question:</b> agenda · project sheet · notes · money · tasks · materials · contacts · what's missing. All permission-gated.",
        "🚫 <b>She can't:</b> wake on \"hey Katy\" or listen with the app closed (that's a browser limit, not a bug), delete anything, edit what's already saved (except task status), read a photo, or walk you through the Estimate line by line.",
        "⚠️ <b>\"Outstanding\"</b> comes from the Estimate's Grand Total, which syncs when you open or save that tab — if you changed the estimate without opening it, the number may lag. She'll flag it rather than state it as fact.",
        "🔍 <b>\"What am I missing on Brickell?\"</b> audits the project: no estimate, no tasks, nobody assigned, approved but no income, tasks with no day, materials not bought, still to collect.",
        "📋 Every command (confirmed, cancelled or error) is <b>logged automatically</b> — there's always an audit trail. Nothing saves without your confirmation.",
      ] : [
        "🗣 <b>Registra 9 cosas:</b> proyecto · ingreso · egreso · tarea · estado de tarea · material · línea de presupuesto · contacto · entrada de agenda.",
        "❓ <b>Responde 8 tipos de pregunta:</b> agenda · ficha del proyecto · notas · dinero · tareas · materiales · contactos · qué te falta. Todas gateadas por permisos.",
        "🚫 <b>No puede:</b> despertar con \"hey Katy\" ni escuchar con la app cerrada (es un límite del navegador, no un bug), borrar nada, editar lo ya guardado (salvo el estado de una tarea), ver una foto, ni leerte el Estimate línea por línea.",
        "⚠️ El <b>\"por cobrar\"</b> sale del Grand Total del Estimate, que se sincroniza al abrir o guardar ese tab — si cambiaste el estimado sin abrirlo, el número puede ir atrasado. Katy lo advierte en vez de afirmarlo.",
        "🔍 <b>\"¿Qué me falta en Brickell?\"</b> audita el proyecto: sin estimado, sin tareas, sin equipo asignado, aprobado pero sin ingresos, tareas sin día, materiales sin comprar, y cuánto falta por cobrar.",
        "📋 Cada comando (confirmado, cancelado o con error) se <b>registra automáticamente</b> — siempre hay rastro. Nada se guarda sin tu confirmación.",
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
      id: "teamassign", icon: "👷",
      title: EN ? "Team & Assignments" : "Equipo y Asignaciones",
      desc:  EN ? "Assign co-workers to projects with amounts and dates in a matrix, then read participation reports by person and date range — the base for the reporting module."
                : "Asigna co-workers a proyectos con montos y fechas en una matriz, y luego lee reportes de participación por persona y rango de fechas — la base del módulo de reportes.",
      mockup: null,
      steps: EN ? [
        { t:"Open the Team tab", d:"Click <b>Team</b> in the top navigation (superadmin only). Co-workers come from Contacts (type = Co-worker); add them there first if the list is empty." },
        { t:"Assignment matrix", d:"The <b>Assignment matrix</b> sub-tab shows a grid of co-workers (grouped by specialty) × projects. Tap an empty cell to assign that person to that project — it creates the record with today's date and a 2-week default range." },
        { t:"Set the amount and dates", d:"Type the assigned <b>amount</b> directly in the cell. Tap the small date link under the amount to set the <b>start and end dates</b>. Tap the <b>✕</b> to remove the assignment. Everything saves instantly." },
        { t:"Read the live totals", d:"The <b>Total</b> column shows each co-worker's total load; the bottom row shows the <b>team cost per project</b>; the corner shows the grand total. All recalculate as you type." },
        { t:"Reports sub-tab", d:"Switch to <b>Reports</b>. Pick a co-worker from the roster on the left to see their KPIs: projects in range, assigned amount, and share of the team. Each project shows its dates and a share bar." },
        { t:"Filter by date range", d:"Use the <b>From / To</b> date pickers in the report header to restrict to a period — this is the base for future date-based reports." },
        { t:"Export to Excel", d:"Tap <b>Export CSV</b> to download the selected co-worker's assignments (project, client, dates, amount) as a spreadsheet file, ready for Excel or Google Sheets." },
      ] : [
        { t:"Abrir el tab Equipo", d:"Clic en <b>Equipo</b> en la navegación superior (solo superadmin). Los co-workers salen de Contactos (tipo = Co-worker); agrégalos ahí primero si la lista está vacía." },
        { t:"Matriz de asignación", d:"El sub-tab <b>Matriz de asignación</b> muestra una grilla de co-workers (agrupados por especialidad) × proyectos. Toca una celda vacía para asignar esa persona a ese proyecto — crea el registro con la fecha de hoy y un rango de 2 semanas por defecto." },
        { t:"Definir el monto y las fechas", d:"Escribe el <b>monto</b> asignado directamente en la celda. Toca el pequeño link de fechas bajo el monto para fijar la <b>fecha de inicio y fin</b>. Toca la <b>✕</b> para quitar la asignación. Todo se guarda al instante." },
        { t:"Leer los totales en vivo", d:"La columna <b>Total</b> muestra la carga total de cada co-worker; la fila inferior muestra el <b>costo de equipo por proyecto</b>; la esquina muestra el total general. Todo se recalcula al escribir." },
        { t:"Sub-tab Reportes", d:"Cambia a <b>Reportes</b>. Elige un co-worker del roster de la izquierda para ver sus KPIs: proyectos en el rango, monto asignado y participación del equipo. Cada proyecto muestra sus fechas y una barra de participación." },
        { t:"Filtrar por rango de fechas", d:"Usa los selectores <b>Desde / Hasta</b> en la cabecera del reporte para restringir a un período — esta es la base de los futuros reportes por fecha." },
        { t:"Exportar a Excel", d:"Toca <b>Export CSV</b> para descargar las asignaciones del co-worker seleccionado (proyecto, cliente, fechas, monto) como archivo de hoja de cálculo, listo para Excel o Google Sheets." },
      ],
      tips: EN ? [
        "🧩 The matrix and the reports read the <b>same data</b> — assign in the matrix, analyze in reports. It's the groundwork for reports by date, project, participation and amounts.",
        "👷 Co-workers are grouped by <b>specialty</b> (Plumbing, Painting, Electrical…) taken from their Contact card.",
        "🔐 The Team panel is <b>superadmin-only</b> — assigned amounts are internal financial data and are never shown to co-workers or clients.",
        "📊 <b>Export CSV</b> opens directly in Excel/Sheets — build pivot tables and charts on top of the raw assignments.",
      ] : [
        "🧩 La matriz y los reportes leen los <b>mismos datos</b> — asigna en la matriz, analiza en reportes. Es la base para reportes por fecha, proyecto, participación y montos.",
        "👷 Los co-workers se agrupan por <b>especialidad</b> (Plomería, Pintura, Electricidad…) tomada de su ficha de Contacto.",
        "🔐 El panel de Equipo es <b>solo superadmin</b> — los montos asignados son datos financieros internos y nunca se muestran a co-workers ni clientes.",
        "📊 <b>Export CSV</b> abre directo en Excel/Sheets — arma tablas dinámicas y gráficos sobre las asignaciones.",
      ],
    },
    {
      id: "prospects", icon: "🎯",
      title: EN ? "Prospects (AI Design leads)" : "Prospectos (leads del Diseño IA)",
      desc:  EN ? "The free AI Design tool on the public site captures every visitor who tries it as a prospect — with name, email and phone — so you can follow up and win the project."
                : "La herramienta gratuita de Diseño IA del sitio público captura como prospecto a cada visitante que la usa — con nombre, correo y teléfono — para que puedas contactarlo y ganar el proyecto.",
      mockup: null,
      steps: EN ? [
        { t:"How leads are captured", d:"On the landing, the <b>AI Design</b> section lets a visitor reimagine their space for free. Before generating, they must enter <b>name, email and phone</b> — that becomes a prospect. This also limits abuse: each person gets a few free renders (set by <code>FREE_RENDER_LIMIT</code>)." },
        { t:"Open the Prospects tab", d:"Click <b>Prospects</b> in the top navigation (superadmin only). You'll see every lead newest-first, with 3 KPI cards: Total, New and Converted." },
        { t:"Contact in one tap", d:"Each card has <b>Call</b>, <b>Email</b> and <b>WhatsApp</b> buttons wired to the lead's number/email — reach out while they're still warm." },
        { t:"Track the pipeline", d:"Set each lead's status with the dropdown: <b>New → Contacted → Converted</b> (or Discarded). Use the filter pills and the search box to focus." },
        { t:"Add private notes", d:"Type a note in each card (e.g. \"wants a kitchen quote, call Friday\") and tap <b>Save note</b>. Notes are internal only." },
        { t:"See what they designed", d:"If the lead generated a render, <b>View last render</b> opens the AI image they made — great context before you call." },
      ] : [
        { t:"Cómo se capturan los leads", d:"En la landing, la sección <b>Diseño IA</b> deja al visitante reimaginar su espacio gratis. Antes de generar, debe ingresar <b>nombre, correo y teléfono</b> — eso se vuelve un prospecto. También limita el abuso: cada persona recibe unos pocos renders gratis (definido por <code>FREE_RENDER_LIMIT</code>)." },
        { t:"Abrir el tab Prospectos", d:"Clic en <b>Prospectos</b> en la navegación superior (solo superadmin). Verás cada lead del más reciente al más antiguo, con 3 tarjetas KPI: Total, Nuevos y Convertidos." },
        { t:"Contactar en un toque", d:"Cada tarjeta tiene botones <b>Llamar</b>, <b>Correo</b> y <b>WhatsApp</b> conectados al número/correo del lead — contáctalo mientras está interesado." },
        { t:"Seguir el pipeline", d:"Define el estado de cada lead con el selector: <b>Nuevo → Contactado → Convertido</b> (o Descartado). Usa los filtros y el buscador para enfocarte." },
        { t:"Agregar notas privadas", d:"Escribe una nota en cada tarjeta (ej: \"quiere cotización de cocina, llamar el viernes\") y toca <b>Guardar nota</b>. Las notas son solo internas." },
        { t:"Ver lo que diseñaron", d:"Si el lead generó un render, <b>Ver último render</b> abre la imagen IA que creó — excelente contexto antes de llamar." },
      ],
      tips: EN ? [
        "🎯 The AI tool is a <b>lead magnet</b>: free for the visitor, but every use leaves you a contact you can call — turning curiosity into projects.",
        "🔒 Prospect contact data is <b>private</b> — the table has no public access; only the superadmin reads it through a secured server route.",
        "🛡️ The free render is <b>rate-limited per person</b> (name/email/phone gate + render cap) so it can't be abused to burn your AI budget.",
        "💬 <b>WhatsApp</b> is usually the fastest channel in South Florida — the button pre-opens the chat with the lead's number.",
      ] : [
        "🎯 La herramienta IA es un <b>imán de leads</b>: gratis para el visitante, pero cada uso te deja un contacto para llamar — convierte la curiosidad en proyectos.",
        "🔒 Los datos de contacto de los prospectos son <b>privados</b> — la tabla no tiene acceso público; solo el superadmin los lee por una ruta de servidor protegida.",
        "🛡️ El render gratis está <b>limitado por persona</b> (gate de nombre/correo/teléfono + tope de renders) para que no se abuse y gaste tu presupuesto de IA.",
        "💬 <b>WhatsApp</b> suele ser el canal más rápido en el sur de Florida — el botón abre el chat con el número del lead.",
      ],
    },
    {
      id: "site", icon: "🖥️",
      title: EN ? "Home Page Editor" : "Editor de la Página de Inicio",
      desc:  EN ? "A built-in CMS to edit the texts, images and visible sections of your public landing page — no developer needed. This is the piece that makes the platform sellable to other companies."
                : "Un CMS integrado para editar los textos, imágenes y secciones visibles de tu landing pública — sin depender de un programador. Es la pieza que hace la plataforma vendible a otras empresas.",
      mockup: null,
      steps: EN ? [
        { t:"Open the Site tab", d:"Click <b>Site</b> in the top navigation (superadmin only). Use <b>Open home page</b> to preview your public site in a new tab at any time." },
        { t:"Edit the Hero", d:"In the <b>Hero</b> tab, change the eyebrow, headline, description, the two buttons (label + link), the two hero images and the floating badge. Every text has an <b>English and a Spanish</b> field side by side." },
        { t:"Change images two ways", d:"For any image, either <b>Upload</b> a file from your computer or paste an <b>image URL</b>. A live thumbnail shows the current picture." },
        { t:"Edit Before / After cards", d:"In the <b>Before / After</b> tab, edit the section heading and each transformation card (before image, after image, space name, city). Use <b>+ Add card</b> or <b>Remove</b> to manage the list." },
        { t:"Show or hide sections", d:"In the <b>Sections</b> tab, toggle each landing section on/off: Before/After, AI Design, Process, Virtual Tours, Reviews, FAQ. Turn off what you don't need." },
        { t:"Save and see it live", d:"Tap <b>Save changes</b> in the bottom bar. Refresh the home page and your edits are live — instantly, worldwide." },
      ] : [
        { t:"Abrir el tab Sitio", d:"Clic en <b>Sitio</b> en la navegación superior (solo superadmin). Usa <b>Abrir página de inicio</b> para previsualizar tu sitio público en una pestaña nueva cuando quieras." },
        { t:"Editar la Portada (Hero)", d:"En el tab <b>Portada</b>, cambia el antetítulo, el titular, la descripción, los dos botones (texto + enlace), las dos imágenes y el badge flotante. Cada texto tiene un campo en <b>inglés y otro en español</b> lado a lado." },
        { t:"Cambiar imágenes de dos formas", d:"Para cualquier imagen, puedes <b>Subir</b> un archivo de tu computadora o pegar la <b>URL de una imagen</b>. Una miniatura muestra la foto actual en vivo." },
        { t:"Editar tarjetas Antes / Después", d:"En el tab <b>Antes / Después</b>, edita el encabezado de la sección y cada tarjeta de transformación (imagen antes, imagen después, nombre del espacio, ciudad). Usa <b>+ Agregar tarjeta</b> o <b>Quitar</b> para gestionar la lista." },
        { t:"Mostrar u ocultar secciones", d:"En el tab <b>Secciones</b>, prende/apaga cada sección de la landing: Antes/Después, Diseño IA, Proceso, Tours Virtuales, Reseñas, Preguntas. Apaga lo que no necesites." },
        { t:"Guardar y verlo en vivo", d:"Toca <b>Guardar cambios</b> en la barra inferior. Refresca la página de inicio y tus cambios están en vivo — al instante, en todo el mundo." },
      ],
      tips: EN ? [
        "🖥️ It's a real <b>content manager</b>: you control your website without touching code or waiting on anyone.",
        "🌐 Everything is <b>bilingual</b> — fill the English and Spanish fields so both audiences see polished copy.",
        "↩️ Leave any text <b>empty to use the built-in default</b> — the site never breaks, even before you customize it.",
        "🔒 Only the superadmin can edit; the content is <b>publicly readable but write-protected</b> at the database level — a clean, secure CMS pattern.",
        "💼 This editor is a strong <b>selling point</b>: other remodeling companies can run their own site from the same panel.",
      ] : [
        "🖥️ Es un <b>gestor de contenido</b> real: controlas tu web sin tocar código ni esperar a nadie.",
        "🌐 Todo es <b>bilingüe</b> — completa los campos en inglés y español para que ambos públicos vean textos pulidos.",
        "↩️ Deja cualquier texto <b>vacío para usar el valor por defecto</b> — el sitio nunca se rompe, incluso antes de personalizarlo.",
        "🔒 Solo el superadmin edita; el contenido es <b>de lectura pública pero protegido contra escritura</b> a nivel de base de datos — un patrón CMS limpio y seguro.",
        "💼 Este editor es un fuerte <b>argumento de venta</b>: otras empresas de remodelación pueden manejar su propio sitio desde el mismo panel.",
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
        { t:"Configure reminders", d:"<b>Remind me from</b> sets when alerts start (2 hours to 1 week before). <b>Repeat reminder</b> re-sends the alert at each daily reminder run (~8:00 am and ~5:00 pm Florida time) until the event." },
        { t:"Enable native phone alerts", d:"Tap <b>🔔 Enable alerts on this device</b> at the top. Accept the notification permission and this phone/computer will receive the reminders on the lock screen — twice a day (~8:00 am and ~5:00 pm Florida time). On iPhone, first add the app to the Home Screen (iOS 16.4+)." },
        { t:"Send it to your phone calendar", d:"On each entry, tap <b>Add to calendar (.ics)</b> to download a calendar file — open it on your phone and the event is added with alarms. Or use the <b>Google Calendar</b> link to add it directly to your Google account." },
        { t:"Mark as done", d:"Tap <b>Done</b> when the appointment or task is finished — it stays visible with a strikethrough. Use <b>Remove</b> to delete it permanently." },
      ] : [
        { t:"Abrir la Agenda", d:"Clic en <b>Agenda</b> en la navegación superior (visible solo para el superadmin). Verás tres grupos: <b>Hoy · Próximos · Pasados</b>, más contadores KPI." },
        { t:"Crear por voz o texto", d:"Usa la barra de captura arriba: toca el <b>🎙 micrófono</b> y habla, o escribe una frase como <i>\"Reunión con la Sra. Herrera el martes a las 10, avísame cada 2 horas desde un día antes\"</i> y toca <b>Crear</b>. Katy extrae tipo, fecha, hora y avisos." },
        { t:"Revisar la tarjeta de confirmación", d:"Katy muestra lo que entendió con <b>todos los campos editables</b> — tipo (📅 Cita / ✅ Task de proyecto / 🤝 Reunión), título, proyecto, fecha, hora, inicio del aviso y repetición. Nada se guarda hasta que toques <b>Confirmar y agendar</b>." },
        { t:"O usar el formulario manual", d:"Clic en <b>+ Nueva entrada</b> para abrir el formulario clásico con los mismos campos. Las tasks de proyecto se pueden vincular a cualquier proyecto activo desde el selector." },
        { t:"Configurar los avisos", d:"<b>Avisarme desde</b> define cuándo empiezan las alertas (de 2 horas a 1 semana antes). <b>Repetir aviso</b> reenvía la alerta en cada aviso programado del día (~8:00 am y ~5:00 pm hora Florida) hasta el evento." },
        { t:"Activar avisos nativos del teléfono", d:"Toca <b>🔔 Activar avisos en este dispositivo</b> arriba. Acepta el permiso de notificaciones y este teléfono/computadora recibirá los avisos en la pantalla de bloqueo — 2 veces al día (~8:00 am y ~5:00 pm hora Florida). En iPhone, primero añade la app a la pantalla de inicio (iOS 16.4+)." },
        { t:"Enviarlo al calendario del teléfono", d:"En cada entrada, toca <b>Añadir al calendario (.ics)</b> para descargar un archivo de calendario — ábrelo en tu teléfono y el evento se agrega con alarmas. O usa el link de <b>Google Calendar</b> para agregarlo directo a tu cuenta de Google." },
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
        "🚪 <b>PIN sessions now end when you close the browser</b> — reopening always asks for the PIN again. Only the device-link shortcut keeps a session, and it re-validates against the server on every open.",
        "🔒 <b>Revoke = remote sign-out</b>: when you revoke a device link, that device's saved session is cleared the next time it opens the app.",
        "👆 Enable the <b>Fingerprint / Face ID lock</b> (same Devices tab) and the app will ask for your biometrics every time it opens with a saved session on that device.",
        "👥 Works for the whole team too — each person keeps <b>their own permissions</b> (visible tabs, my-tasks-only) when entering via their link.",
      ] : [
        "🔐 El enlace <b>nunca contiene tu PIN</b> — es un token aleatorio validado en el servidor en cada uso, y cada uso queda registrado en el Activity Log.",
        "🚪 <b>Las sesiones por PIN ahora terminan al cerrar el navegador</b> — al reabrir siempre pide el PIN de nuevo. Solo el shortcut por enlace mantiene sesión, y se revalida contra el servidor en cada apertura.",
        "🔒 <b>Revocar = cerrar sesión remota</b>: al revocar un enlace de dispositivo, la sesión guardada de ese aparato se limpia la próxima vez que abra la app.",
        "👆 Activa el <b>Bloqueo con huella / Face ID</b> (mismo tab Dispositivos) y la app pedirá tu biometría cada vez que abra con sesión guardada en ese aparato.",
        "👥 También funciona para todo el equipo — cada persona conserva <b>sus propios permisos</b> (tabs visibles, solo-sus-tareas) al entrar por su enlace.",
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
    <div className="flex min-h-[calc(100vh-80px)] gap-0 overflow-hidden rounded-2xl border border-[#E6DDCB] dark:border-[#22304d] bg-white dark:bg-[#111a2e] shadow-sm">

      {/* ── Sidebar ───────────────────────────────────────────────────────────── */}
      <aside className="flex w-52 shrink-0 flex-col border-r border-[#E6DDCB] dark:border-[#22304d] py-4">
        <div className="mb-2 px-4 text-[9px] font-bold uppercase tracking-widest text-[#5C6A6E] dark:text-[#9fb0cc]">
          {EN ? "Features" : "Funcionalidades"}
        </div>
        {features.slice(0, 8).map(f => (
          <button
            key={f.id}
            onClick={() => setActiveId(f.id)}
            className={`flex items-center gap-2.5 px-3 py-2 mx-2 rounded-xl text-left transition ${
              activeId === f.id
                ? "bg-[#EDF3FB] dark:bg-[#111a2e] text-[var(--accent)]"
                : "text-[var(--brand)] hover:bg-[#F7F3EA] dark:hover:bg-[#0b1220]"
            }`}
          >
            <span className="text-base">{f.icon}</span>
            <span className={`text-[12px] font-semibold ${activeId === f.id ? "text-[var(--accent)]" : "text-[var(--brand)]"}`}>
              {f.title}
            </span>
          </button>
        ))}

        <div className="mx-4 my-3 border-t border-[#E6DDCB] dark:border-[#22304d]" />
        <div className="mb-2 px-4 text-[9px] font-bold uppercase tracking-widest text-[#5C6A6E] dark:text-[#9fb0cc]">
          {EN ? "Tools & Admin" : "Herramientas"}
        </div>
        {features.slice(8).map(f => (
          <button
            key={f.id}
            onClick={() => setActiveId(f.id)}
            className={`flex items-center gap-2.5 px-3 py-2 mx-2 rounded-xl text-left transition ${
              activeId === f.id
                ? "bg-[#EDF3FB] dark:bg-[#111a2e] text-[var(--accent)]"
                : "text-[var(--brand)] hover:bg-[#F7F3EA] dark:hover:bg-[#0b1220]"
            }`}
          >
            <span className="text-base">{f.icon}</span>
            <span className={`text-[12px] font-semibold ${activeId === f.id ? "text-[var(--accent)]" : "text-[var(--brand)]"}`}>
              {f.title}
            </span>
          </button>
        ))}

        <div className="mx-4 my-3 border-t border-[#E6DDCB] dark:border-[#22304d]" />
        <div className="mb-2 px-4 text-[9px] font-bold uppercase tracking-widest text-[#5C6A6E] dark:text-[#9fb0cc]">
          {EN ? "Printable guides" : "Guías imprimibles"}
        </div>
        {[
          { href: "/guias/guia-navegacion-luxaris.html", icon: "🧭", label: EN ? "New navigation" : "Nueva navegación" },
          { href: "/guias/guia-voz-katy.html",           icon: "🎙", label: EN ? "Talk to Katy"   : "Habla con Katy" },
        ].map(g => (
          <a
            key={g.href}
            href={g.href}
            target="_blank"
            rel="noopener noreferrer"
            className="mx-2 flex items-center gap-2.5 rounded-xl px-3 py-2 text-left text-[var(--brand)] transition hover:bg-[#F7F3EA] dark:hover:bg-[#0b1220]"
          >
            <span className="text-base">{g.icon}</span>
            <span className="text-[12px] font-semibold">{g.label}</span>
            <span className="ml-auto text-[11px] text-[#97A1A0] dark:text-[#728098]">↗</span>
          </a>
        ))}

        <div className="mt-auto mx-3 rounded-xl bg-[#F7F3EA] dark:bg-[#0b1220] p-3">
          <div className="text-[9px] leading-relaxed text-[#5C6A6E] dark:text-[#9fb0cc]">
            {EN ? "💡 Click a feature for a step-by-step guide, or open a printable guide (PDF) to share with your team."
                : "💡 Clic en una función para la guía paso a paso, o abre una guía imprimible (PDF) para repartir al equipo."}
          </div>
        </div>
      </aside>

      {/* ── Content ───────────────────────────────────────────────────────────── */}
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">

        {/* Header */}
        <div className="sticky top-0 z-10 border-b border-[#E6DDCB] dark:border-[#22304d] bg-white dark:bg-[#111a2e] px-8 py-5">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{active.icon}</span>
            <div>
              <h1 className="font-display text-2xl font-medium text-[var(--brand)]">{active.title}</h1>
              <p className="text-[13px] text-[#5C6A6E] dark:text-[#9fb0cc]">{active.desc}</p>
            </div>
          </div>
        </div>

        <div className="p-8 space-y-8">

          {/* Visual mockup */}
          <section>
            <div className="mb-3 text-[10px] font-bold uppercase tracking-widest text-[#5C6A6E] dark:text-[#9fb0cc]">
              {EN ? "Visual Preview" : "Vista Previa Visual"}
            </div>
            <div className="rounded-2xl border border-[#E6DDCB] dark:border-[#22304d] bg-[#FDFAF6] dark:bg-[#111a2e] p-4">
              {active.mockup}
            </div>
          </section>

          {/* Steps */}
          <section>
            <div className="mb-3 text-[10px] font-bold uppercase tracking-widest text-[#5C6A6E] dark:text-[#9fb0cc]">
              {EN ? "How to use it" : "Cómo usarlo"}
            </div>
            <div className="space-y-0">
              {active.steps.map((step, i) => (
                <div key={i} className="flex gap-4 border-b border-[#F0EBE0] dark:border-[#22304d] py-4 last:border-0">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#EDF3FB] dark:bg-[#111a2e] text-[13px] font-black text-[var(--accent)]">
                    {i + 1}
                  </div>
                  <div>
                    <div className="mb-1 text-[13px] font-bold text-[var(--brand)]">{step.t}</div>
                    <div
                      className="text-[12px] leading-relaxed text-[#5C6A6E] dark:text-[#9fb0cc]"
                      dangerouslySetInnerHTML={{ __html: step.d }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Tips */}
          <section>
            <div className="mb-3 text-[10px] font-bold uppercase tracking-widest text-[#5C6A6E] dark:text-[#9fb0cc]">
              Tips
            </div>
            <div className="rounded-2xl border border-[#E6DDCB] dark:border-[#22304d] bg-[#F7F3EA] dark:bg-[#0b1220] p-4 space-y-3">
              {active.tips.map((tip, i) => (
                <div
                  key={i}
                  className="text-[12px] leading-relaxed text-[#5C6A6E] dark:text-[#9fb0cc]"
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
