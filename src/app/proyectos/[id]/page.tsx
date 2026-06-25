/**
 * Página de detalle de un proyecto (/proyectos/[id]).
 * Muestra el proyecto con 6 pestañas: Workflow, Materiales, Contactos,
 * Presupuesto, Pagos, y Plan (Gantt + drag & drop).
 */
"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Lock } from "lucide-react";
import { supabase } from "@/src/lib/supabase";
import {
  money, dateFmt, totalIncome, totalExpense, balanceDue, cashFlow,
  paymentPct, advancePct, addDays, dShort, initials, STATUS_LABELS,
  PAYMENT_TYPE_LABELS,
} from "@/src/lib/utils";
import type {
  Project, Task, Material, BudgetItem, Payment, Expense, Contact,
} from "@/src/types/project";

// ─── Tipos ──────────────────────────────────────────────────────────────────
interface ProjectFull extends Project {
  tasks: Task[];
  materials: Material[];
  budget_items: BudgetItem[];
  payments: Payment[];
  expenses: Expense[];
  contacts: Contact[];
}

type TabId = "workflow" | "materiales" | "contactos" | "presupuesto" | "pagos" | "plan";
type PaySubTab = "ingresos" | "egresos";

const TABS: { id: TabId; label: string }[] = [
  { id: "workflow", label: "Workflow" },
  { id: "materiales", label: "Materiales" },
  { id: "contactos", label: "Contactos" },
  { id: "presupuesto", label: "Presupuesto" },
  { id: "pagos", label: "Pagos" },
  { id: "plan", label: "Plan" },
];

// ─── StatusChip ──────────────────────────────────────────────────────────────
function StatusChip({ status }: { status: string }) {
  const styles: Record<string, string> = {
    presupuesto: "bg-[#DCE6E6] text-[#0E2630]",
    aprobado: "bg-[#DCE8E9] text-[#4E7A82]",
    en_obra: "bg-[#EDE3CF] text-[#7A6230]",
    terminado: "bg-[#DCEBDD] text-[#4F8A63]",
  };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${styles[status] ?? "bg-gray-100 text-gray-600"}`}>
      <span className="size-1.5 rounded-full bg-current" />
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

// ─── Toast notification ──────────────────────────────────────────────────────
function useToast() {
  const [msg, setMsg] = useState("");
  const [visible, setVisible] = useState(false);
  const show = (message: string) => {
    setMsg(message);
    setVisible(true);
    setTimeout(() => setVisible(false), 3500);
  };
  return { msg, visible, show };
}

// ─── Modal de confirmación genérico ─────────────────────────────────────────
function ConfirmModal({
  title, body, label, onConfirm, onCancel, danger = true,
}: {
  title: string; body: string; label: string;
  onConfirm: () => void; onCancel: () => void; danger?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-[110] flex items-end justify-center bg-[#16323D]/55 backdrop-blur-sm sm:items-center">
      <div className="w-full max-w-[440px] rounded-t-[22px] bg-[#F7F3EA] p-6 shadow-2xl sm:rounded-[20px]">
        <h3 className="mb-1 font-[Manrope] text-lg font-bold text-[#16323D]">{title}</h3>
        <p className="mb-5 text-sm text-[#5C6A6E]">{body}</p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 rounded-xl bg-[#ECE3D1] py-3 font-bold text-[#5C6A6E] transition hover:bg-[#D7CBB3]">
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 rounded-xl py-3 font-bold text-white transition ${danger ? "bg-[#B0492F] hover:bg-[#93341f]" : "bg-[#16323D] hover:bg-[#0E2630]"}`}
          >
            {label}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Editor Modal genérico ───────────────────────────────────────────────────
type FieldType = "text" | "number" | "date" | "select";
interface Field {
  key: string;
  label: string;
  type: FieldType;
  value: string | number;
  options?: string[];
}
interface EditorOpts {
  title: string;
  sub?: string;
  fields: Field[];
  onSave: (vals: Record<string, string | number>) => void;
  onDelete?: () => void;
}

function EditorModal({ opts, onClose }: { opts: EditorOpts; onClose: () => void }) {
  const [vals, setVals] = useState<Record<string, string | number>>(
    Object.fromEntries(opts.fields.map((f) => [f.key, f.value]))
  );
  const [pending, setPending] = useState(false);
  const [confirmSave, setConfirmSave] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);

  const set = (key: string, v: string | number) => setVals((prev) => ({ ...prev, [key]: v }));

  return (
    <>
      <div
        className="fixed inset-0 z-[100] flex items-end justify-center bg-[#16323D]/55 backdrop-blur-sm sm:items-center"
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        <div className="w-full max-w-[460px] rounded-t-[22px] bg-[#F7F3EA] p-6 shadow-2xl sm:rounded-[20px] max-h-[92vh] overflow-y-auto">
          <h3 className="mb-1 font-[Manrope] text-xl font-bold text-[#16323D]">{opts.title}</h3>
          {opts.sub && <p className="mb-4 text-sm text-[#5C6A6E]">{opts.sub}</p>}

          <div className="space-y-3">
            {opts.fields.map((f) => (
              <div key={f.key}>
                <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.05em] text-[#5C6A6E]">
                  {f.label}
                </label>
                {f.type === "select" ? (
                  <select
                    value={vals[f.key] as string}
                    onChange={(e) => set(f.key, e.target.value)}
                    className="w-full rounded-xl border border-[#D7CBB3] bg-white px-3 py-3 text-sm text-[#16323D] focus:border-[#16323D] focus:outline-none"
                  >
                    {f.options?.map((o) => (
                      <option key={o} value={o}>{o}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type={f.type}
                    value={vals[f.key] as string | number}
                    onChange={(e) =>
                      set(f.key, f.type === "number" ? parseFloat(e.target.value) || 0 : e.target.value)
                    }
                    className="w-full rounded-xl border border-[#D7CBB3] bg-white px-3 py-3 text-sm text-[#16323D] focus:border-[#16323D] focus:outline-none"
                  />
                )}
              </div>
            ))}
          </div>

          <div className="mt-5 flex gap-3">
            <button onClick={onClose} className="flex-1 rounded-xl bg-[#ECE3D1] py-3 font-bold text-[#5C6A6E]">
              Cancelar
            </button>
            <button
              disabled={pending}
              onClick={() => setConfirmSave(true)}
              className="flex-1 rounded-xl bg-[#16323D] py-3 font-bold text-white disabled:opacity-50"
            >
              Guardar
            </button>
          </div>

          {opts.onDelete && (
            <button
              onClick={() => setConfirmDel(true)}
              className="mt-3 flex w-full items-center justify-center gap-2 py-2 text-sm font-bold text-[#B0492F]"
            >
              Eliminar
            </button>
          )}
        </div>
      </div>

      {confirmSave && (
        <ConfirmModal
          title="Confirmar cambios"
          body="¿Guardar los cambios? Quedarán registrados."
          label="Guardar"
          danger={false}
          onConfirm={() => { setPending(true); setConfirmSave(false); opts.onSave(vals); onClose(); }}
          onCancel={() => setConfirmSave(false)}
        />
      )}
      {confirmDel && opts.onDelete && (
        <ConfirmModal
          title="Eliminar"
          body="Esta acción no se puede deshacer. ¿Eliminar?"
          label="Eliminar"
          onConfirm={() => { setConfirmDel(false); opts.onDelete!(); onClose(); }}
          onCancel={() => setConfirmDel(false)}
        />
      )}
    </>
  );
}

// ─── Tab: Workflow (Kanban) ──────────────────────────────────────────────────
function WorkflowTab({
  project, tasks, contacts, onRefresh, toast,
}: {
  project: Project; tasks: Task[]; contacts: Contact[];
  onRefresh: () => void; toast: (m: string) => void;
}) {
  const [editor, setEditor] = useState<EditorOpts | null>(null);
  const approved = project.status !== "presupuesto";

  if (!approved) {
    return (
      <div className="rounded-2xl border border-[#E6DDCB] bg-white p-10 text-center text-[#5C6A6E]">
        <Lock size={32} className="mx-auto mb-3 opacity-30" />
        <b className="mb-1 block font-[Manrope] text-base font-bold text-[#16323D]">
          Workflow bloqueado
        </b>
        <p className="text-sm">Se activa al aprobar el presupuesto. Ve a la pestaña Presupuesto.</p>
      </div>
    );
  }

  const cols = [
    { key: "pend", name: "Por hacer", color: "#D7CBB3" },
    { key: "prog", name: "En proceso", color: "#4E7A82" },
    { key: "done", name: "Hecho", color: "#4F8A63" },
  ];

  const whoOptions = ["Equipo propio", ...contacts.map((c) => c.name)];

  const openEdit = (t: Task) => {
    setEditor({
      title: "Editar actividad",
      sub: "Modifica los datos de esta actividad.",
      fields: [
        { key: "name", label: "Actividad", type: "text", value: t.name },
        { key: "hours", label: "Horas estimadas", type: "number", value: t.hours },
        { key: "duration_weeks", label: "Duración (semanas)", type: "number", value: t.duration_weeks },
        { key: "status", label: "Estado", type: "select", options: ["pend", "prog", "done"], value: t.status },
        {
          key: "assignee_name", label: "Responsable", type: "select",
          options: whoOptions,
          value: t.assigned_contact_id
            ? contacts.find((c) => c.id === t.assigned_contact_id)?.name ?? "Equipo propio"
            : "Equipo propio",
        },
      ],
      onSave: async (vals) => {
        const assignee = contacts.find((c) => c.name === vals.assignee_name);
        await supabase.from("tasks").update({
          name: vals.name,
          hours: vals.hours,
          duration_weeks: Math.max(1, Number(vals.duration_weeks)),
          status: vals.status,
          assigned_contact_id: assignee?.id ?? null,
        }).eq("id", t.id);
        onRefresh();
        toast("Actividad actualizada.");
      },
      onDelete: async () => {
        await supabase.from("tasks").delete().eq("id", t.id);
        onRefresh();
        toast("Actividad eliminada.");
      },
    });
  };

  const addTask = () => {
    setEditor({
      title: "Nueva actividad",
      fields: [
        { key: "name", label: "Actividad", type: "text", value: "" },
        { key: "hours", label: "Horas estimadas", type: "number", value: 8 },
        { key: "duration_weeks", label: "Duración (semanas)", type: "number", value: 1 },
        { key: "assignee_name", label: "Responsable", type: "select", options: whoOptions, value: "Equipo propio" },
      ],
      onSave: async (vals) => {
        const assignee = contacts.find((c) => c.name === vals.assignee_name);
        await supabase.from("tasks").insert({
          project_id: project.id,
          name: vals.name || "Actividad",
          hours: vals.hours || 0,
          duration_weeks: Math.max(1, Number(vals.duration_weeks)),
          status: "pend",
          sort_order: tasks.length,
          assigned_contact_id: assignee?.id ?? null,
        });
        onRefresh();
        toast("Actividad agregada.");
      },
    });
  };

  return (
    <div>
      <p className="mb-4 text-[11.5px] text-[#5C6A6E]">
        Toca una actividad para editarla o cambiar su estado.
      </p>
      {/* Kanban board */}
      <div className="flex gap-3 overflow-x-auto pb-1">
        {cols.map((col) => {
          const colTasks = tasks.filter((t) => t.status === col.key);
          return (
            <div key={col.key} className="min-w-[260px] flex-none rounded-2xl border border-[#E6DDCB] bg-[#ECE3D1] p-3">
              <h4 className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.06em] text-[#5C6A6E]">
                <span className="size-2 rounded-full" style={{ background: col.color }} />
                {col.name}
                <span className="ml-auto rounded-full border border-[#E6DDCB] bg-[#F7F3EA] px-2 py-0.5 font-mono text-[11px]">
                  {colTasks.length}
                </span>
              </h4>
              {colTasks.length === 0 && (
                <p className="py-3 text-center text-xs text-[#97A1A0]">—</p>
              )}
              {colTasks.map((t) => (
                <button
                  key={t.id}
                  onClick={() => openEdit(t)}
                  className="mb-2 w-full rounded-xl border border-[#E6DDCB] bg-white p-3 text-left transition hover:shadow-md"
                >
                  <div className="text-sm font-semibold leading-snug text-[#16323D]">{t.name}</div>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#5C6A6E]">
                      <span className="grid size-5 place-items-center rounded-full bg-[#16323D] text-[8px] font-bold text-white">
                        {initials(
                          t.assigned_contact_id
                            ? contacts.find((c) => c.id === t.assigned_contact_id)?.name ?? "EP"
                            : "EP"
                        )}
                      </span>
                      <span className="max-w-[110px] truncate">
                        {t.assigned_contact_id
                          ? contacts.find((c) => c.id === t.assigned_contact_id)?.name ?? "Equipo propio"
                          : "Equipo propio"}
                      </span>
                    </span>
                    <span className="font-mono text-[11px] text-[#5C6A6E]">{t.hours}h</span>
                  </div>
                </button>
              ))}
            </div>
          );
        })}
      </div>

      <button
        onClick={addTask}
        className="mt-4 inline-flex items-center gap-2 rounded-xl border border-dashed border-[#D7CBB3] bg-[#ECE3D1] px-4 py-3 text-sm font-bold text-[#16323D] transition hover:border-[#16323D]"
      >
        + Agregar actividad
      </button>

      {editor && <EditorModal opts={editor} onClose={() => setEditor(null)} />}
    </div>
  );
}

// ─── Tab: Materiales ─────────────────────────────────────────────────────────
function MaterialesTab({
  project, materials, onRefresh, toast,
}: {
  project: Project; materials: Material[];
  onRefresh: () => void; toast: (m: string) => void;
}) {
  const [editor, setEditor] = useState<EditorOpts | null>(null);

  const por = materials.filter((m) => !m.bought).reduce((s, m) => s + m.cost, 0);
  const com = materials.filter((m) => m.bought).reduce((s, m) => s + m.cost, 0);

  if (project.status === "presupuesto") {
    return (
      <div className="rounded-2xl border border-[#E6DDCB] bg-white p-10 text-center text-[#5C6A6E]">
        <Lock size={32} className="mx-auto mb-3 opacity-30" />
        <b className="mb-1 block font-[Manrope] text-base font-bold text-[#16323D]">Módulo bloqueado</b>
        <p className="text-sm">Se activa al aprobar el presupuesto.</p>
      </div>
    );
  }

  const openEdit = (m: Material) => {
    setEditor({
      title: "Editar material",
      fields: [
        { key: "name", label: "Material", type: "text", value: m.name },
        { key: "supplier", label: "Proveedor", type: "text", value: m.supplier },
        { key: "cost", label: "Costo (USD)", type: "number", value: m.cost },
        { key: "bought", label: "¿Comprado?", type: "select", options: ["No", "Sí"], value: m.bought ? "Sí" : "No" },
      ],
      onSave: async (vals) => {
        await supabase.from("materials").update({
          name: vals.name, supplier: vals.supplier, cost: vals.cost,
          bought: vals.bought === "Sí",
        }).eq("id", m.id);
        onRefresh(); toast("Material actualizado.");
      },
      onDelete: async () => {
        await supabase.from("materials").delete().eq("id", m.id);
        onRefresh(); toast("Material eliminado.");
      },
    });
  };

  return (
    <div className="max-w-[760px]">
      {/* Resumen */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:max-w-[420px]">
        <div className="rounded-[13px] border border-[#E6DDCB] bg-white p-3">
          <div className="text-[10.5px] font-bold uppercase tracking-[0.05em] text-[#5C6A6E]">Por comprar</div>
          <div className="mt-1 font-mono text-lg font-semibold text-[#16323D]">{money(por)}</div>
        </div>
        <div className="rounded-[13px] border border-[#E6DDCB] bg-white p-3">
          <div className="text-[10.5px] font-bold uppercase tracking-[0.05em] text-[#5C6A6E]">Comprado</div>
          <div className="mt-1 font-mono text-lg font-semibold text-[#4F8A63]">{money(com)}</div>
        </div>
      </div>

      {/* Lista */}
      <div className="flex flex-col gap-2">
        {materials.map((m) => (
          <button
            key={m.id}
            onClick={() => openEdit(m)}
            className={`flex items-center gap-3 rounded-[13px] border border-[#E6DDCB] bg-white p-3 text-left transition hover:shadow-sm ${m.bought ? "opacity-70" : ""}`}
          >
            <span className={`grid size-6 flex-none place-items-center rounded-lg border-2 ${m.bought ? "border-[#4F8A63] bg-[#4F8A63]" : "border-[#D7CBB3]"}`}>
              {m.bought && <span className="text-[10px] font-bold text-white">✓</span>}
            </span>
            <span className="flex-1 min-w-0">
              <span className={`block text-sm font-semibold ${m.bought ? "text-[#5C6A6E] line-through" : "text-[#16323D]"}`}>
                {m.name}
              </span>
              <span className="block text-[11px] text-[#97A1A0]">{m.supplier}</span>
            </span>
            <span className="font-mono text-sm font-semibold text-[#16323D]">{money(m.cost)}</span>
          </button>
        ))}
      </div>

      <button
        onClick={() => setEditor({
          title: "Nuevo material",
          fields: [
            { key: "name", label: "Material", type: "text", value: "" },
            { key: "supplier", label: "Proveedor", type: "text", value: "" },
            { key: "cost", label: "Costo (USD)", type: "number", value: 0 },
          ],
          onSave: async (vals) => {
            await supabase.from("materials").insert({
              project_id: project.id, name: vals.name || "Material",
              supplier: vals.supplier || "", cost: vals.cost || 0, bought: false,
            });
            onRefresh(); toast("Material agregado.");
          },
        })}
        className="mt-4 inline-flex items-center gap-2 rounded-xl border border-dashed border-[#D7CBB3] bg-[#ECE3D1] px-4 py-3 text-sm font-bold text-[#16323D] transition hover:border-[#16323D]"
      >
        + Agregar material
      </button>

      {editor && <EditorModal opts={editor} onClose={() => setEditor(null)} />}
    </div>
  );
}

// ─── Tab: Contactos ──────────────────────────────────────────────────────────
function ContactosTab({
  project, contacts, allContacts, onRefresh, toast,
}: {
  project: Project; contacts: Contact[]; allContacts: Contact[];
  onRefresh: () => void; toast: (m: string) => void;
}) {
  const [showAssign, setShowAssign] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set(contacts.map((c) => c.id)));

  const saveAssignments = async () => {
    await supabase.from("project_contacts").delete().eq("project_id", project.id);
    if (selected.size > 0) {
      await supabase.from("project_contacts").insert(
        [...selected].map((cid) => ({ project_id: project.id, contact_id: cid }))
      );
    }
    setShowAssign(false);
    onRefresh();
    toast("Especialistas actualizados.");
  };

  return (
    <div className="max-w-[760px]">
      <div className="flex flex-col gap-3">
        {contacts.length === 0 && (
          <div className="rounded-2xl border border-[#E6DDCB] bg-white p-8 text-center text-sm text-[#5C6A6E]">
            Aún no hay especialistas asignados a este proyecto.
          </div>
        )}
        {contacts.map((c) => (
          <div key={c.id} className="flex items-center gap-3 rounded-2xl border border-[#E6DDCB] bg-white p-4 shadow-sm">
            <span className="grid size-11 flex-none place-items-center rounded-[13px] bg-[#16323D] font-[Manrope] text-sm font-bold text-white">
              {initials(c.name)}
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold text-[#16323D]">{c.name}</div>
              <div className="text-xs text-[#5C6A6E]">{c.specialty} · {c.rate}</div>
            </div>
            <a
              href={`tel:${c.phone}`}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#DCEBDD] px-3 py-2 text-xs font-bold text-[#4F8A63]"
            >
              📞 Llamar
            </a>
          </div>
        ))}
      </div>

      <button
        onClick={() => { setSelected(new Set(contacts.map((c) => c.id))); setShowAssign(true); }}
        className="mt-4 inline-flex items-center gap-2 rounded-xl border border-dashed border-[#D7CBB3] bg-[#ECE3D1] px-4 py-3 text-sm font-bold text-[#16323D] transition hover:border-[#16323D]"
      >
        + Asignar / quitar especialista
      </button>

      {/* Modal de asignación */}
      {showAssign && (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-[#16323D]/55 backdrop-blur-sm sm:items-center"
          onClick={(e) => { if (e.target === e.currentTarget) setShowAssign(false); }}
        >
          <div className="w-full max-w-[460px] rounded-t-[22px] bg-[#F7F3EA] p-6 shadow-2xl sm:rounded-[20px] max-h-[90vh] overflow-y-auto">
            <h3 className="mb-1 font-[Manrope] text-xl font-bold text-[#16323D]">Asignar especialistas</h3>
            <p className="mb-4 text-sm text-[#5C6A6E]">Marca quién participa en este proyecto.</p>
            <div className="flex flex-col gap-2">
              {allContacts.map((c) => {
                const on = selected.has(c.id);
                return (
                  <button
                    key={c.id}
                    onClick={() => {
                      const next = new Set(selected);
                      if (on) next.delete(c.id); else next.add(c.id);
                      setSelected(next);
                    }}
                    className={`flex items-center gap-3 rounded-xl border p-3 text-left transition ${on ? "border-[#16323D] bg-[#DCE6E6]" : "border-[#E6DDCB] bg-white"}`}
                  >
                    <span className={`grid size-5 flex-none place-items-center rounded-md border-2 ${on ? "border-[#16323D] bg-[#16323D]" : "border-[#D7CBB3]"}`}>
                      {on && <span className="text-[10px] text-white">✓</span>}
                    </span>
                    <span>
                      <span className="block text-sm font-semibold text-[#16323D]">{c.name}</span>
                      <span className="block text-xs text-[#5C6A6E]">{c.specialty}</span>
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="mt-5 flex gap-3">
              <button onClick={() => setShowAssign(false)} className="flex-1 rounded-xl bg-[#ECE3D1] py-3 font-bold text-[#5C6A6E]">
                Cancelar
              </button>
              <button onClick={saveAssignments} className="flex-1 rounded-xl bg-[#16323D] py-3 font-bold text-white">
                Listo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tab: Presupuesto ────────────────────────────────────────────────────────
function PresupuestoTab({
  project, budgetItems, onRefresh, toast,
}: {
  project: Project; budgetItems: BudgetItem[];
  onRefresh: () => void; toast: (m: string) => void;
}) {
  const [editor, setEditor] = useState<EditorOpts | null>(null);
  const [confirming, setConfirming] = useState(false);

  const sum = budgetItems.reduce((s, b) => s + b.amount, 0);
  const approved = project.status !== "presupuesto";

  const openEdit = (b: BudgetItem) => {
    setEditor({
      title: "Editar línea",
      fields: [
        { key: "description", label: "Descripción", type: "text", value: b.description },
        { key: "type", label: "Tipo", type: "select", options: ["mano", "material"], value: b.type },
        { key: "amount", label: "Monto (USD)", type: "number", value: b.amount },
      ],
      onSave: async (vals) => {
        await supabase.from("budget_items").update({ description: vals.description, type: vals.type, amount: vals.amount }).eq("id", b.id);
        onRefresh(); toast("Línea actualizada.");
      },
      onDelete: async () => {
        await supabase.from("budget_items").delete().eq("id", b.id);
        onRefresh(); toast("Línea eliminada.");
      },
    });
  };

  const approveProject = async () => {
    await supabase.from("projects").update({ status: "en_obra" }).eq("id", project.id);
    setConfirming(false);
    onRefresh();
    toast("Presupuesto aprobado. Proyecto en obra.");
  };

  return (
    <div className="max-w-[760px]">
      <div className="overflow-hidden rounded-2xl border border-[#E6DDCB] bg-white">
        {budgetItems.map((b) => (
          <button
            key={b.id}
            onClick={() => openEdit(b)}
            className="flex w-full items-center justify-between gap-2 border-b border-[#E6DDCB] px-4 py-3 text-left last:border-0 hover:bg-[#F7F3EA]"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className={`rounded px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.05em] ${b.type === "mano" ? "bg-[#DCE8E9] text-[#4E7A82]" : "bg-[#DCE6E6] text-[#0E2630]"}`}>
                {b.type === "mano" ? "Mano obra" : "Material"}
              </span>
              <span className="truncate text-sm font-medium text-[#16323D]">{b.description}</span>
            </div>
            <span className="font-mono text-sm font-semibold text-[#16323D]">{money(b.amount)}</span>
          </button>
        ))}
      </div>

      <div className="mt-3 flex items-center justify-between rounded-2xl bg-[#16323D] px-5 py-4">
        <span className="text-sm font-semibold text-white/80">Total presupuestado</span>
        <span className="font-mono text-xl font-semibold text-white">{money(sum)}</span>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {approved ? (
          <div className="inline-flex items-center gap-2 rounded-xl bg-[#DCEBDD] px-4 py-3 text-sm font-semibold text-[#4F8A63]">
            ✓ Aprobado por el cliente
          </div>
        ) : (
          <button
            onClick={() => setConfirming(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-[#4E7A82] bg-[#DCE8E9] px-4 py-3 text-sm font-bold text-[#4E7A82] transition hover:bg-[#c8dfe0]"
          >
            Marcar como aprobado
          </button>
        )}
        <button
          onClick={() => setEditor({
            title: "Nueva línea de presupuesto",
            fields: [
              { key: "description", label: "Descripción", type: "text", value: "" },
              { key: "type", label: "Tipo", type: "select", options: ["mano", "material"], value: "material" },
              { key: "amount", label: "Monto (USD)", type: "number", value: 0 },
            ],
            onSave: async (vals) => {
              await supabase.from("budget_items").insert({ project_id: project.id, description: vals.description || "Línea", type: vals.type, amount: vals.amount || 0 });
              onRefresh(); toast("Línea agregada.");
            },
          })}
          className="inline-flex items-center gap-2 rounded-xl border border-dashed border-[#D7CBB3] bg-[#ECE3D1] px-4 py-3 text-sm font-bold text-[#16323D] transition hover:border-[#16323D]"
        >
          + Agregar línea
        </button>
      </div>

      {confirming && (
        <ConfirmModal
          title="Aprobar presupuesto"
          body="Pasa el proyecto a En obra y activa el workflow y materiales."
          label="Aprobar"
          danger={false}
          onConfirm={approveProject}
          onCancel={() => setConfirming(false)}
        />
      )}
      {editor && <EditorModal opts={editor} onClose={() => setEditor(null)} />}
    </div>
  );
}

// ─── Tab: Pagos (Ingresos y Egresos) ─────────────────────────────────────────
function PagosTab({
  project, payments, expenses, contacts, onRefresh, toast,
}: {
  project: Project; payments: Payment[]; expenses: Expense[]; contacts: Contact[];
  onRefresh: () => void; toast: (m: string) => void;
}) {
  const [subTab, setSubTab] = useState<PaySubTab>("ingresos");
  const [editor, setEditor] = useState<EditorOpts | null>(null);

  const inc = totalIncome(payments);
  const egr = totalExpense(expenses);
  const due = Math.max(0, balanceDue(project.budget, payments));
  const caja = cashFlow(payments, expenses);
  const paid = due <= 0;

  const methodOptions = ["Efectivo", "Transferencia", "Zelle", "Cheque", "Tarjeta"];
  const payeeOptions = ["Equipo propio", ...contacts.map((c) => c.name)];

  const openPayEdit = (x: Payment) => {
    setEditor({
      title: "Editar ingreso",
      fields: [
        { key: "amount", label: "Monto (USD)", type: "number", value: x.amount },
        { key: "date", label: "Fecha", type: "date", value: x.date },
        { key: "method", label: "Método", type: "select", options: methodOptions, value: x.method },
        { key: "type", label: "Concepto", type: "select", options: ["anticipo", "abono", "final"], value: x.type },
      ],
      onSave: async (vals) => {
        await supabase.from("payments").update(vals).eq("id", x.id);
        onRefresh(); toast("Ingreso actualizado.");
      },
      onDelete: async () => {
        await supabase.from("payments").delete().eq("id", x.id);
        onRefresh(); toast("Ingreso eliminado.");
      },
    });
  };

  const openExpEdit = (x: Expense) => {
    setEditor({
      title: "Editar egreso",
      fields: [
        { key: "payee_name", label: "Pagado a", type: "select", options: payeeOptions, value: x.payee_name },
        { key: "concept", label: "Concepto", type: "text", value: x.concept },
        { key: "amount", label: "Monto (USD)", type: "number", value: x.amount },
        { key: "date", label: "Fecha", type: "date", value: x.date },
        { key: "method", label: "Método", type: "select", options: methodOptions, value: x.method },
      ],
      onSave: async (vals) => {
        await supabase.from("expenses").update(vals).eq("id", x.id);
        onRefresh(); toast("Egreso actualizado.");
      },
      onDelete: async () => {
        await supabase.from("expenses").delete().eq("id", x.id);
        onRefresh(); toast("Egreso eliminado.");
      },
    });
  };

  return (
    <div className="max-w-[760px]">
      {/* KPIs locales */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-[#E6DDCB] bg-white p-4">
          <div className="text-[10.5px] font-bold uppercase tracking-[0.05em] text-[#5C6A6E]">Ingresos</div>
          <div className="mt-1.5 font-mono text-xl font-semibold text-[#4F8A63]">{money(inc)}</div>
        </div>
        <div className="rounded-2xl border border-[#E6DDCB] bg-white p-4">
          <div className="text-[10.5px] font-bold uppercase tracking-[0.05em] text-[#5C6A6E]">Egresos</div>
          <div className="mt-1.5 font-mono text-xl font-semibold text-[#B0492F]">{money(egr)}</div>
        </div>
        <div className="rounded-2xl border border-[#E6DDCB] bg-white p-4">
          <div className="text-[10.5px] font-bold uppercase tracking-[0.05em] text-[#5C6A6E]">Por cobrar</div>
          <div className="mt-1.5 font-mono text-xl font-semibold text-[#16323D]">{money(due)}</div>
        </div>
        <div className="rounded-2xl border border-[#E6DDCB] bg-white p-4">
          <div className="text-[10.5px] font-bold uppercase tracking-[0.05em] text-[#5C6A6E]">Caja</div>
          <div className="mt-1.5 font-mono text-xl font-semibold text-[#16323D]">{money(caja)}</div>
        </div>
      </div>

      {paid && (
        <div className="mb-4 flex items-center gap-2 rounded-2xl border border-[#DCEBDD] bg-[#E7F1E6] px-4 py-3 text-sm font-semibold text-[#4F8A63]">
          🎉 Cliente pagó por completo.
        </div>
      )}

      {/* Sub-tabs */}
      <div className="mb-4 inline-flex rounded-xl border border-[#E6DDCB] bg-[#ECE3D1] p-1">
        {(["ingresos", "egresos"] as PaySubTab[]).map((t) => (
          <button
            key={t}
            onClick={() => setSubTab(t)}
            className={`rounded-lg px-5 py-2 text-sm font-bold transition capitalize ${subTab === t ? "bg-white text-[#16323D] shadow-sm" : "text-[#5C6A6E]"}`}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Lista */}
      <div className="flex flex-col gap-2">
        {subTab === "ingresos" ? (
          <>
            {[...payments].reverse().map((x) => (
              <button
                key={x.id}
                onClick={() => openPayEdit(x)}
                className="flex items-center justify-between gap-2 rounded-[13px] border border-[#E6DDCB] bg-white px-4 py-3 text-left hover:bg-[#F7F3EA]"
              >
                <div>
                  <div className="flex items-center gap-2 text-sm font-semibold text-[#16323D]">
                    {x.method}
                    <span className="rounded bg-[#ECE3D1] px-1.5 py-0.5 text-[9px] font-bold uppercase text-[#5C6A6E]">
                      {PAYMENT_TYPE_LABELS[x.type] ?? x.type}
                    </span>
                  </div>
                  <div className="text-[11px] text-[#5C6A6E]">{dateFmt(x.date)}</div>
                </div>
                <span className="font-mono text-base font-semibold text-[#4F8A63]">+{money(x.amount)}</span>
              </button>
            ))}
            {payments.length === 0 && (
              <p className="py-4 text-center text-sm text-[#97A1A0]">Sin ingresos.</p>
            )}
            <button
              onClick={() => setEditor({
                title: "Nuevo ingreso",
                sub: "Pago recibido del cliente.",
                fields: [
                  { key: "amount", label: "Monto (USD)", type: "number", value: 0 },
                  { key: "date", label: "Fecha", type: "date", value: new Date().toISOString().split("T")[0] },
                  { key: "method", label: "Método", type: "select", options: methodOptions, value: "Transferencia" },
                  { key: "type", label: "Concepto", type: "select", options: ["anticipo", "abono", "final"], value: "abono" },
                ],
                onSave: async (vals) => {
                  if (Number(vals.amount) > 0) {
                    await supabase.from("payments").insert({ project_id: project.id, ...vals });
                    onRefresh(); toast(`Ingreso registrado.`);
                  }
                },
              })}
              className="mt-2 w-full rounded-[13px] border border-dashed border-[#D7CBB3] bg-[#ECE3D1] py-3 text-sm font-bold text-[#16323D] transition hover:border-[#16323D]"
            >
              + Registrar ingreso
            </button>
          </>
        ) : (
          <>
            {[...expenses].reverse().map((x) => (
              <button
                key={x.id}
                onClick={() => openExpEdit(x)}
                className="flex items-center justify-between gap-2 rounded-[13px] border border-[#E6DDCB] bg-white px-4 py-3 text-left hover:bg-[#F7F3EA]"
              >
                <div>
                  <div className="flex items-center gap-2 text-sm font-semibold text-[#16323D]">
                    {x.payee_name}
                    <span className="rounded bg-[#ECE3D1] px-1.5 py-0.5 text-[9px] font-bold uppercase text-[#5C6A6E]">{x.method}</span>
                  </div>
                  <div className="text-[11px] text-[#5C6A6E]">{x.concept} · {dateFmt(x.date)}</div>
                </div>
                <span className="font-mono text-base font-semibold text-[#B0492F]">−{money(x.amount)}</span>
              </button>
            ))}
            {expenses.length === 0 && (
              <p className="py-4 text-center text-sm text-[#97A1A0]">Sin egresos. Aquí van los pagos a especialistas y proveedores.</p>
            )}
            <button
              onClick={() => setEditor({
                title: "Nuevo egreso",
                sub: "Pago a un especialista o proveedor.",
                fields: [
                  { key: "payee_name", label: "Pagado a", type: "select", options: payeeOptions, value: payeeOptions[1] ?? "Equipo propio" },
                  { key: "concept", label: "Concepto", type: "text", value: "" },
                  { key: "amount", label: "Monto (USD)", type: "number", value: 0 },
                  { key: "date", label: "Fecha", type: "date", value: new Date().toISOString().split("T")[0] },
                  { key: "method", label: "Método", type: "select", options: methodOptions, value: "Transferencia" },
                ],
                onSave: async (vals) => {
                  if (Number(vals.amount) > 0) {
                    await supabase.from("expenses").insert({ project_id: project.id, ...vals });
                    onRefresh(); toast("Egreso registrado.");
                  }
                },
              })}
              className="mt-2 w-full rounded-[13px] border border-dashed border-[#D7CBB3] bg-[#ECE3D1] py-3 text-sm font-bold text-[#16323D] transition hover:border-[#16323D]"
            >
              + Registrar egreso
            </button>
          </>
        )}
      </div>

      {editor && <EditorModal opts={editor} onClose={() => setEditor(null)} />}
    </div>
  );
}

// ─── Tab: Plan Gantt ─────────────────────────────────────────────────────────
function PlanTab({
  project, tasks, onRefresh, toast,
}: {
  project: Project; tasks: Task[];
  onRefresh: () => void; toast: (m: string) => void;
}) {
  const [items, setItems] = useState<Task[]>([]);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);

  useEffect(() => {
    setItems([...tasks].sort((a, b) => a.sort_order - b.sort_order));
  }, [tasks]);

  // Cálculo de fechas: cada actividad comienza cuando termina la anterior
  const schedule = (): { task: Task; start: Date; end: Date; weekStart: number }[] => {
    let cum = 0;
    return items.map((t) => {
      const start = addDays(project.start_date, cum * 7);
      const end = addDays(project.start_date, (cum + t.duration_weeks) * 7 - 1);
      const ws = cum;
      cum += t.duration_weeks;
      return { task: t, start, end, weekStart: ws };
    });
  };

  const total = Math.max(6, items.reduce((s, t) => s + t.duration_weeks, 0));
  const rows = schedule();

  const COLORS: Record<string, string> = {
    done: "bg-gradient-to-r from-[#4F8A63] to-[#69a67e]",
    prog: "bg-gradient-to-r from-[#4E7A82] to-[#5e8c94]",
    pend: "bg-[#D7CBB3] text-[#5C6A6E]",
  };

  // Drag & drop simple
  const handlePointerDown = (e: React.PointerEvent, idx: number) => {
    e.preventDefault();
    setDragIdx(idx);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (dragIdx === null) return;
    const list = document.getElementById("gantt-list");
    if (!list) return;
    const listRows = [...list.children] as HTMLElement[];
    let targetIdx = listRows.length - 1;
    for (let k = 0; k < listRows.length; k++) {
      const r = listRows[k].getBoundingClientRect();
      if (e.clientY < r.top + r.height / 2) { targetIdx = k; break; }
    }
    if (targetIdx !== dragIdx) {
      const next = [...items];
      const [moved] = next.splice(dragIdx, 1);
      next.splice(targetIdx, 0, moved);
      setItems(next);
      setDragIdx(targetIdx);
    }
  };

  const handlePointerUp = async () => {
    if (dragIdx === null) return;
    setDragIdx(null);
    // Persistir el nuevo orden en Supabase
    await Promise.all(
      items.map((t, i) => supabase.from("tasks").update({ sort_order: i }).eq("id", t.id))
    );
    onRefresh();
    toast("Plan reordenado — fechas recalculadas.");
  };

  const deleteTask = async (id: string) => {
    await supabase.from("tasks").delete().eq("id", id);
    setConfirmDel(null);
    onRefresh();
    toast("Actividad eliminada.");
  };

  return (
    <div
      className="max-w-[900px]"
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      <p className="mb-4 text-xs text-[#5C6A6E]">
        Arrastra ⠿ para reordenar; las fechas se recalculan. Usa la papelera para eliminar.
      </p>

      <div id="gantt-list" className="flex flex-col gap-2">
        {rows.map(({ task: t, start, end, weekStart }, i) => {
          const left = (weekStart / total) * 100;
          const width = (t.duration_weeks / total) * 100;
          const isDragging = dragIdx === i;

          return (
            <div
              key={t.id}
              className={`grid items-center gap-3 rounded-xl border bg-white px-3 py-2 transition-shadow ${isDragging ? "border-[#16323D] opacity-85 shadow-lg" : "border-[#E6DDCB]"}`}
              style={{ gridTemplateColumns: "22px minmax(120px,180px) 1fr 34px" }}
            >
              {/* Handle */}
              <div
                className="flex h-8 cursor-grab touch-none items-center justify-center text-[#D7CBB3] select-none"
                onPointerDown={(e) => handlePointerDown(e, i)}
                aria-label="Arrastrar"
              >
                ⠿
              </div>
              {/* Meta */}
              <div className="min-w-0">
                <div className="truncate text-[13px] font-semibold text-[#16323D]">{t.name}</div>
                <div className="font-mono text-[10.5px] text-[#5C6A6E]">
                  {dShort(start)}–{dShort(end)} · {t.hours}h
                </div>
              </div>
              {/* Barra Gantt */}
              <div className="relative h-5 overflow-hidden rounded-[6px] bg-[#ECE3D1]">
                <div
                  className={`absolute top-0.5 h-4 rounded-[5px] px-1.5 text-[9.5px] font-bold text-white ${COLORS[t.status]}`}
                  style={{ left: `${left}%`, width: `${Math.max(width, 6)}%` }}
                >
                  S{weekStart + 1}
                </div>
              </div>
              {/* Eliminar */}
              <button
                onClick={() => setConfirmDel(t.id)}
                className="grid size-8 place-items-center rounded-lg border border-[#E6DDCB] bg-white text-[#B0492F] transition hover:bg-[#F0DBD2]"
                aria-label="Eliminar actividad"
              >
                🗑
              </button>
            </div>
          );
        })}
      </div>

      {/* Leyenda */}
      <div className="mt-4 flex flex-wrap gap-4 text-[11px] text-[#5C6A6E]">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block size-3 rounded bg-[#4F8A63]" /> Terminada
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block size-3 rounded bg-[#4E7A82]" /> En curso
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block size-3 rounded bg-[#D7CBB3]" /> Pendiente
        </span>
      </div>

      {confirmDel && (
        <ConfirmModal
          title="Eliminar actividad"
          body={`¿Eliminar "${items.find((t) => t.id === confirmDel)?.name}"? No se puede deshacer.`}
          label="Eliminar"
          onConfirm={() => deleteTask(confirmDel)}
          onCancel={() => setConfirmDel(null)}
        />
      )}
    </div>
  );
}

// ─── Página principal: Detalle del Proyecto ──────────────────────────────────
export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  const [project, setProject] = useState<ProjectFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>("workflow");
  const { msg: toastMsg, visible: toastVisible, show: showToast } = useToast();

  const fetchProject = useCallback(async () => {
    const { data, error } = await supabase
      .from("projects")
      .select(`
        *,
        tasks(*),
        materials(*),
        budget_items(*),
        payments(*),
        expenses(*),
        project_contacts(contact_id, contacts(*))
      `)
      .eq("id", id)
      .single();

    if (error || !data) {
      router.replace("/proyectos");
      return;
    }

    // Aplanar contactos de la relación muchos-a-muchos
    const contacts = (data.project_contacts as { contacts: Contact }[]).map(
      (pc) => pc.contacts
    );

    setProject({ ...data, contacts } as ProjectFull);
    setLoading(false);
  }, [id, router]);

  useEffect(() => { fetchProject(); }, [fetchProject]);

  const [allContacts, setAllContacts] = useState<Contact[]>([]);
  useEffect(() => {
    supabase.from("contacts").select("*").then(({ data }) => {
      if (data) setAllContacts(data as Contact[]);
    });
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#16323D] border-t-transparent" />
      </div>
    );
  }

  if (!project) return null;

  // Tareas ordenadas por sort_order
  const tasks = [...(project.tasks ?? [])].sort((a, b) => a.sort_order - b.sort_order);

  return (
    <div className="animate-in fade-in duration-300">
      {/* Cabecera */}
      <div className="mb-4">
        <button
          onClick={() => router.push("/proyectos")}
          className="mb-2 inline-flex items-center gap-1.5 text-sm font-semibold text-[#5C6A6E] transition hover:text-[#16323D]"
        >
          <ArrowLeft size={15} /> Dashboard
        </button>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-[Manrope] text-2xl font-extrabold tracking-tight text-[#16323D]">
              {project.title}
            </h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[12.5px] text-[#5C6A6E]">
              <StatusChip status={project.status} />
              <span>· {project.client}</span>
              <span>· {money(project.budget)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-5 flex gap-0.5 overflow-x-auto border-b border-[#E6DDCB] [scrollbar-width:none]">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`relative whitespace-nowrap px-3 py-2.5 text-sm font-semibold transition ${
              activeTab === t.id
                ? "text-[#16323D] after:absolute after:inset-x-2 after:-bottom-px after:h-[2.5px] after:rounded-full after:bg-[#16323D]"
                : "text-[#5C6A6E] hover:text-[#16323D]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Contenido del tab activo */}
      {activeTab === "workflow" && (
        <WorkflowTab
          project={project} tasks={tasks} contacts={project.contacts}
          onRefresh={fetchProject} toast={showToast}
        />
      )}
      {activeTab === "materiales" && (
        <MaterialesTab
          project={project} materials={project.materials}
          onRefresh={fetchProject} toast={showToast}
        />
      )}
      {activeTab === "contactos" && (
        <ContactosTab
          project={project} contacts={project.contacts} allContacts={allContacts}
          onRefresh={fetchProject} toast={showToast}
        />
      )}
      {activeTab === "presupuesto" && (
        <PresupuestoTab
          project={project} budgetItems={project.budget_items}
          onRefresh={fetchProject} toast={showToast}
        />
      )}
      {activeTab === "pagos" && (
        <PagosTab
          project={project} payments={project.payments} expenses={project.expenses}
          contacts={project.contacts} onRefresh={fetchProject} toast={showToast}
        />
      )}
      {activeTab === "plan" && (
        <PlanTab
          project={project} tasks={tasks}
          onRefresh={fetchProject} toast={showToast}
        />
      )}

      {/* Toast */}
      <div
        className={`fixed bottom-24 left-1/2 z-[200] -translate-x-1/2 max-w-sm w-full rounded-2xl bg-[#16323D] px-4 py-3 text-center text-sm font-medium text-white shadow-2xl transition-all duration-300 ${
          toastVisible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0 pointer-events-none"
        }`}
      >
        {toastMsg}
      </div>
    </div>
  );
}
