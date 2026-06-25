/**
 * Panel global de Contactos (/proyectos/contactos).
 * Muestra el directorio de especialistas y permite asignarlos a proyectos
 * mediante chips por proyecto en cada tarjeta.
 */
"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/src/lib/supabase";
import { initials } from "@/src/lib/utils";
import type { Contact, Project } from "@/src/types/project";

// ─── Editor modal ─────────────────────────────────────────────────────────────
type FieldDef = { key: string; label: string; value: string };

function EditorModal({
  title, fields, onSave, onDelete, onClose,
}: {
  title: string;
  fields: FieldDef[];
  onSave: (vals: Record<string, string>) => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const [vals, setVals] = useState<Record<string, string>>(
    Object.fromEntries(fields.map((f) => [f.key, f.value]))
  );
  const [confirmSave, setConfirmSave] = useState(false);
  const [confirmDel,  setConfirmDel]  = useState(false);

  return (
    <>
      <div
        className="fixed inset-0 z-[100] flex items-end justify-center bg-[#16323D]/55 backdrop-blur-sm sm:items-center"
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        <div className="w-full max-w-[460px] overflow-y-auto rounded-t-[22px] bg-[#F7F3EA] p-6 shadow-2xl sm:rounded-[20px] max-h-[92vh]">
          <h3 className="mb-4 font-[Manrope] text-xl font-bold text-[#16323D]">{title}</h3>
          <div className="space-y-3">
            {fields.map((f) => (
              <div key={f.key}>
                <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.05em] text-[#5C6A6E]">
                  {f.label}
                </label>
                <input
                  type="text"
                  value={vals[f.key]}
                  onChange={(e) => setVals((p) => ({ ...p, [f.key]: e.target.value }))}
                  className="w-full rounded-xl border border-[#D7CBB3] bg-white px-3 py-3 text-sm text-[#16323D] focus:border-[#16323D] focus:outline-none"
                />
              </div>
            ))}
          </div>
          <div className="mt-5 flex gap-3">
            <button onClick={onClose} className="flex-1 rounded-xl bg-[#ECE3D1] py-3 font-bold text-[#5C6A6E]">
              Cancelar
            </button>
            <button onClick={() => setConfirmSave(true)} className="flex-1 rounded-xl bg-[#16323D] py-3 font-bold text-white">
              Guardar
            </button>
          </div>
          {onDelete && (
            <button onClick={() => setConfirmDel(true)} className="mt-3 flex w-full items-center justify-center gap-2 py-2 text-sm font-bold text-[#B0492F]">
              Eliminar contacto
            </button>
          )}
        </div>
      </div>

      {confirmSave && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-[#16323D]/55 backdrop-blur-sm">
          <div className="w-full max-w-[420px] rounded-[20px] bg-[#F7F3EA] p-6 shadow-2xl">
            <h3 className="mb-2 font-[Manrope] text-lg font-bold text-[#16323D]">Confirmar cambios</h3>
            <p className="mb-5 text-sm text-[#5C6A6E]">¿Guardar los cambios?</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmSave(false)} className="flex-1 rounded-xl bg-[#ECE3D1] py-3 font-bold text-[#5C6A6E]">Cancelar</button>
              <button onClick={() => { setConfirmSave(false); onSave(vals); onClose(); }} className="flex-1 rounded-xl bg-[#16323D] py-3 font-bold text-white">Guardar</button>
            </div>
          </div>
        </div>
      )}

      {confirmDel && onDelete && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-[#16323D]/55 backdrop-blur-sm">
          <div className="w-full max-w-[420px] rounded-[20px] bg-[#F7F3EA] p-6 shadow-2xl">
            <h3 className="mb-2 font-[Manrope] text-lg font-bold text-[#16323D]">Eliminar contacto</h3>
            <p className="mb-5 text-sm text-[#5C6A6E]">Esta acción no se puede deshacer.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDel(false)} className="flex-1 rounded-xl bg-[#ECE3D1] py-3 font-bold text-[#5C6A6E]">Cancelar</button>
              <button onClick={() => { setConfirmDel(false); onDelete(); onClose(); }} className="flex-1 rounded-xl bg-[#B0492F] py-3 font-bold text-white">Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Página principal ──────────────────────────────────────────────────────────
export default function ContactosPage() {
  const [contacts, setContacts]       = useState<Contact[]>([]);
  const [projects, setProjects]       = useState<Project[]>([]);
  const [assigned, setAssigned]       = useState<Record<string, Set<string>>>({}); // contactId → Set<projectId>
  const [editor, setEditor]           = useState<{ contact?: Contact } | null>(null);
  const [toast, setToast]             = useState("");
  const [toastVisible, setToastVisible] = useState(false);

  const showToast = (msg: string) => {
    setToast(msg);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 3000);
  };

  const fetchAll = useCallback(async () => {
    const [{ data: ctData }, { data: prData }, { data: pcData }] = await Promise.all([
      supabase.from("contacts").select("*").order("name"),
      supabase.from("projects").select("id, title, status").order("created_at"),
      supabase.from("project_contacts").select("contact_id, project_id"),
    ]);

    if (ctData) setContacts(ctData as Contact[]);
    if (prData) setProjects(prData as Project[]);

    if (pcData) {
      const map: Record<string, Set<string>> = {};
      pcData.forEach(({ contact_id, project_id }) => {
        if (!map[contact_id]) map[contact_id] = new Set();
        map[contact_id].add(project_id);
      });
      setAssigned(map);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const toggleAssign = async (contactId: string, projectId: string) => {
    const isOn = assigned[contactId]?.has(projectId);
    if (isOn) {
      await supabase.from("project_contacts").delete()
        .eq("contact_id", contactId).eq("project_id", projectId);
    } else {
      await supabase.from("project_contacts").insert({ contact_id: contactId, project_id: projectId });
    }
    await fetchAll();
    showToast(isOn ? "Quitado del proyecto." : "Asignado al proyecto.");
  };

  const contactFields = (c?: Contact): FieldDef[] => [
    { key: "name",      label: "Nombre",       value: c?.name      ?? "" },
    { key: "specialty", label: "Especialidad",  value: c?.specialty ?? "" },
    { key: "phone",     label: "Teléfono",      value: c?.phone     ?? "" },
    { key: "rate",      label: "Tarifa",        value: c?.rate      ?? "" },
  ];

  const saveContact = async (id: string | undefined, vals: Record<string, string>) => {
    if (id) {
      await supabase.from("contacts").update(vals).eq("id", id);
      showToast("Contacto actualizado.");
    } else {
      await supabase.from("contacts").insert(vals);
      showToast("Contacto agregado.");
    }
    fetchAll();
  };

  const deleteContact = async (id: string) => {
    await supabase.from("contacts").delete().eq("id", id);
    showToast("Contacto eliminado.");
    fetchAll();
  };

  const shortTitle = (t: string) => t.split(" — ")[0];

  return (
    <div className="animate-in fade-in duration-300">
      <h1 className="font-[Manrope] text-[25px] font-extrabold tracking-tight text-[#16323D]">
        Contactos
      </h1>
      <p className="mb-6 mt-1 text-sm text-[#5C6A6E]">
        Directorio de especialistas. Toca un proyecto en cada tarjeta para asignar o quitar.
      </p>

      {contacts.length === 0 ? (
        <div className="rounded-2xl border border-[#E6DDCB] bg-white p-10 text-center text-sm text-[#5C6A6E]">
          Sin contactos todavía. Agrega el primero.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {contacts.map((c) => {
            const pIds = assigned[c.id] ?? new Set<string>();
            return (
              <div
                key={c.id}
                className="flex items-start gap-4 rounded-2xl border border-[#E6DDCB] bg-white p-4 shadow-sm"
              >
                {/* Avatar */}
                <span className="grid size-11 flex-none place-items-center rounded-[13px] bg-[#16323D] font-[Manrope] text-sm font-bold text-white">
                  {initials(c.name)}
                </span>

                {/* Info + project chips */}
                <div className="min-w-0 flex-1">
                  <button
                    onClick={() => setEditor({ contact: c })}
                    className="text-sm font-bold text-[#16323D] hover:underline"
                  >
                    {c.name}
                  </button>
                  <div className="text-xs text-[#5C6A6E]">{c.specialty} · {c.rate}</div>

                  {/* Chips de proyectos */}
                  {projects.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {projects.map((p) => {
                        const on = pIds.has(p.id);
                        return (
                          <button
                            key={p.id}
                            onClick={() => toggleAssign(c.id, p.id)}
                            className={`rounded-lg border px-2.5 py-1 text-[10.5px] font-bold transition ${
                              on
                                ? "border-[#DCE8E9] bg-[#DCE8E9] text-[#4E7A82]"
                                : "border-[#E6DDCB] bg-white text-[#5C6A6E] hover:border-[#D7CBB3]"
                            }`}
                          >
                            {shortTitle(p.title)}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Acciones */}
                <div className="flex flex-col items-end gap-2">
                  <a
                    href={`tel:${c.phone}`}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[#DCEBDD] px-3 py-2 text-xs font-bold text-[#4F8A63]"
                  >
                    📞 Llamar
                  </a>
                  <button
                    onClick={() => setEditor({ contact: c })}
                    className="grid size-8 place-items-center rounded-lg border border-[#E6DDCB] bg-white text-[#5C6A6E] transition hover:bg-[#ECE3D1]"
                    aria-label="Editar"
                  >
                    ✏️
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Botón agregar */}
      <button
        onClick={() => setEditor({})}
        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[#D7CBB3] bg-[#ECE3D1] py-3 text-sm font-bold text-[#16323D] transition hover:border-[#16323D]"
      >
        + Agregar contacto
      </button>

      {/* Editor modal */}
      {editor !== null && (
        <EditorModal
          title={editor.contact ? "Editar contacto" : "Nuevo contacto"}
          fields={contactFields(editor.contact)}
          onSave={(vals) => saveContact(editor.contact?.id, vals)}
          onDelete={editor.contact ? () => deleteContact(editor.contact!.id) : undefined}
          onClose={() => setEditor(null)}
        />
      )}

      {/* Toast */}
      <div
        className={`fixed bottom-24 left-1/2 z-[200] w-full max-w-sm -translate-x-1/2 rounded-2xl bg-[#16323D] px-4 py-3 text-center text-sm font-medium text-white shadow-2xl transition-all duration-300 ${toastVisible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0 pointer-events-none"}`}
      >
        {toast}
      </div>
    </div>
  );
}
