"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, X, ChevronDown, ChevronUp, Trash2, Pencil, Check, FolderOpen } from "lucide-react";
import { supabase } from "@/src/lib/supabase";
import type { AppUser, Permissions, PermissionSection, PermissionAction } from "@/src/types/auth";
import { DEFAULT_PERMISSIONS, SECTION_LABELS } from "@/src/types/auth";
import type { Project } from "@/src/types/project";

const ACTIONS: { key: PermissionAction; label: string }[] = [
  { key: "view",   label: "Ver"      },
  { key: "create", label: "Crear"    },
  { key: "edit",   label: "Editar"   },
  { key: "delete", label: "Eliminar" },
];
const SECTIONS = Object.keys(SECTION_LABELS) as PermissionSection[];

function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

// ── Permission grid ───────────────────────────────────────────────────────────
function PermGrid({
  perms,
  onChange,
  readOnly = false,
}: {
  perms: Permissions;
  onChange?: (p: Permissions) => void;
  readOnly?: boolean;
}) {
  const toggle = (sec: PermissionSection, act: PermissionAction) => {
    if (readOnly || !onChange) return;
    const next = deepClone(perms);
    next[sec][act] = !next[sec][act];
    // "view" is required if any other action is enabled
    if (act !== "view" && next[sec][act]) next[sec].view = true;
    // if view is disabled, disable all
    if (act === "view" && !next[sec][act]) {
      next[sec] = { view: false, create: false, edit: false, delete: false };
    }
    onChange(next);
  };

  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full min-w-[340px] text-[11px]">
        <thead>
          <tr>
            <th className="pb-1.5 text-left font-bold text-[#5C6A6E]">Sección</th>
            {ACTIONS.map(a => (
              <th key={a.key} className="pb-1.5 text-center font-bold text-[#5C6A6E] w-14">{a.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {SECTIONS.map(sec => (
            <tr key={sec} className="border-t border-[#F0EAE0]">
              <td className="py-1.5 pr-3 font-semibold text-[#16323D]">{SECTION_LABELS[sec]}</td>
              {ACTIONS.map(a => (
                <td key={a.key} className="py-1.5 text-center">
                  <button
                    type="button"
                    onClick={() => toggle(sec, a.key)}
                    disabled={readOnly}
                    className={`mx-auto flex h-5 w-5 items-center justify-center rounded-md border transition ${
                      perms[sec][a.key]
                        ? "border-[#16323D] bg-[#16323D] text-white"
                        : "border-[#D7CBB3] bg-white text-transparent"
                    } ${readOnly ? "cursor-default" : "hover:opacity-80"}`}
                  >
                    <Check size={10} strokeWidth={3} />
                  </button>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Project assignment ────────────────────────────────────────────────────────
function ProjectAssign({
  userId,
  projects,
  assigned,
  onToggle,
}: {
  userId: string;
  projects: Project[];
  assigned: Set<string>;
  onToggle: (projectId: string, add: boolean) => void;
}) {
  return (
    <div className="space-y-1.5">
      {projects.length === 0 && (
        <p className="text-[11px] text-[#97A1A0]">No hay proyectos aún.</p>
      )}
      {projects.map(p => {
        const on = assigned.has(p.id);
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => onToggle(p.id, !on)}
            className={`flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-left text-xs transition ${
              on
                ? "border-[#16323D] bg-[#16323D] text-white"
                : "border-[#E6DDCB] bg-white text-[#16323D] hover:border-[#B0A08A]"
            }`}
          >
            <FolderOpen size={12} className="shrink-0" />
            <span className="truncate font-semibold">{p.title}</span>
            <span className={`ml-auto text-[10px] ${on ? "text-[#A8C4CC]" : "text-[#97A1A0]"}`}>
              {p.client}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ── User row ──────────────────────────────────────────────────────────────────
function UserRow({
  user,
  projects,
  onUpdated,
  onDeleted,
}: {
  user: AppUser;
  projects: Project[];
  onUpdated: (u: AppUser) => void;
  onDeleted: (id: string) => void;
}) {
  const [expanded,   setExpanded]   = useState(false);
  const [activeTab,  setActiveTab]  = useState<"perms" | "projects">("perms");
  const [editing,    setEditing]    = useState(false);
  const [name,       setName]       = useState(user.name);
  const [pin,        setPin]        = useState(user.pin);
  const [perms,      setPerms]      = useState<Permissions>(deepClone(user.permissions));
  const [assigned,   setAssigned]   = useState<Set<string>>(new Set());
  const [saving,     setSaving]     = useState(false);

  const loadAssigned = useCallback(async () => {
    const { data } = await supabase
      .from("user_project_access")
      .select("project_id")
      .eq("user_id", user.id);
    setAssigned(new Set(data?.map(r => r.project_id) ?? []));
  }, [user.id]);

  useEffect(() => { if (expanded) loadAssigned(); }, [expanded, loadAssigned]);

  const toggleProject = async (projectId: string, add: boolean) => {
    if (add) {
      await supabase.from("user_project_access").insert({ user_id: user.id, project_id: projectId });
      setAssigned(prev => new Set([...prev, projectId]));
    } else {
      await supabase.from("user_project_access").delete().eq("user_id", user.id).eq("project_id", projectId);
      setAssigned(prev => { const s = new Set(prev); s.delete(projectId); return s; });
    }
  };

  const save = async () => {
    setSaving(true);
    const { data, error } = await supabase
      .from("app_users")
      .update({ name, pin, permissions: perms })
      .eq("id", user.id)
      .select()
      .single();
    setSaving(false);
    if (!error && data) { onUpdated(data as AppUser); setEditing(false); }
  };

  const deactivate = async () => {
    if (!confirm(`¿Desactivar a ${user.name}?`)) return;
    await supabase.from("app_users").update({ active: false }).eq("id", user.id);
    onDeleted(user.id);
  };

  return (
    <div className="rounded-2xl border border-[#E6DDCB] bg-white overflow-hidden">
      {/* Header row */}
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#16323D] text-sm font-bold text-white">
          {user.name.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          {editing ? (
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full rounded-lg border border-[#D7CBB3] px-2 py-1 text-sm font-bold text-[#16323D] focus:outline-none focus:border-[#16323D]"
            />
          ) : (
            <p className="truncate text-sm font-bold text-[#16323D]">{user.name}</p>
          )}
          <p className="text-[11px] text-[#97A1A0]">PIN: {editing ? (
            <input
              type="password"
              value={pin}
              onChange={e => setPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
              inputMode="numeric"
              maxLength={8}
              className="ml-1 w-20 rounded border border-[#D7CBB3] px-1.5 py-0.5 text-xs text-[#16323D] focus:outline-none"
            />
          ) : "••••••••"}</p>
        </div>
        <div className="flex items-center gap-1">
          {editing ? (
            <>
              <button onClick={save} disabled={saving}
                className="rounded-lg bg-[#16323D] px-3 py-1.5 text-xs font-bold text-white hover:opacity-80">
                {saving ? "…" : "Guardar"}
              </button>
              <button onClick={() => { setEditing(false); setName(user.name); setPin(user.pin); setPerms(deepClone(user.permissions)); }}
                className="rounded-lg bg-[#ECE3D1] px-3 py-1.5 text-xs font-bold text-[#5C6A6E] hover:opacity-80">
                Cancelar
              </button>
            </>
          ) : (
            <>
              <button onClick={() => setEditing(true)}
                className="grid h-7 w-7 place-items-center rounded-lg text-[#5C6A6E] hover:bg-[#F0EAE0]">
                <Pencil size={13} />
              </button>
              <button onClick={deactivate}
                className="grid h-7 w-7 place-items-center rounded-lg text-[#B0492F] hover:bg-[#FFF0EE]">
                <Trash2 size={13} />
              </button>
              <button onClick={() => setExpanded(e => !e)}
                className="grid h-7 w-7 place-items-center rounded-lg text-[#5C6A6E] hover:bg-[#F0EAE0]">
                {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Expandable permissions + projects */}
      {expanded && (
        <div className="border-t border-[#F0EAE0] px-4 pb-4 pt-3">
          {/* Sub-tabs */}
          <div className="mb-3 flex gap-1">
            {(["perms", "projects"] as const).map(t => (
              <button key={t} onClick={() => setActiveTab(t)}
                className={`rounded-lg px-3 py-1.5 text-[11px] font-bold transition ${
                  activeTab === t
                    ? "bg-[#16323D] text-white"
                    : "bg-[#F0EAE0] text-[#5C6A6E] hover:bg-[#E6DDCB]"
                }`}>
                {t === "perms" ? "Permisos" : "Proyectos asignados"}
              </button>
            ))}
          </div>
          {activeTab === "perms" ? (
            <PermGrid perms={editing ? perms : user.permissions} onChange={editing ? setPerms : undefined} readOnly={!editing} />
          ) : (
            <ProjectAssign userId={user.id} projects={projects} assigned={assigned} onToggle={toggleProject} />
          )}
        </div>
      )}
    </div>
  );
}

// ── Create user form ──────────────────────────────────────────────────────────
function CreateUserForm({
  onCreated,
  onCancel,
}: {
  onCreated: (u: AppUser) => void;
  onCancel:  () => void;
}) {
  const [name,   setName]   = useState("");
  const [pin,    setPin]    = useState("");
  const [perms,  setPerms]  = useState<Permissions>(deepClone(DEFAULT_PERMISSIONS));
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState("");

  const create = async () => {
    if (!name.trim()) { setError("El nombre es obligatorio"); return; }
    if (pin.length < 4) { setError("El PIN debe tener al menos 4 dígitos"); return; }
    setSaving(true);
    const { data, error: e } = await supabase
      .from("app_users")
      .insert({ name: name.trim(), pin, role: "colaborador", permissions: perms, active: true })
      .select()
      .single();
    setSaving(false);
    if (e) { setError(e.message); return; }
    onCreated(data as AppUser);
  };

  return (
    <div className="rounded-2xl border border-[#16323D] bg-white p-4 shadow-md">
      <h4 className="mb-3 text-sm font-bold text-[#16323D]">Nuevo colaborador</h4>

      <div className="mb-3 grid grid-cols-2 gap-2">
        <div>
          <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-[#5C6A6E]">Nombre</label>
          <input value={name} onChange={e => setName(e.target.value)}
            placeholder="Ej: Ana López"
            className="w-full rounded-xl border border-[#D7CBB3] px-3 py-2 text-sm text-[#16323D] focus:border-[#16323D] focus:outline-none" />
        </div>
        <div>
          <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-[#5C6A6E]">PIN de acceso</label>
          <input value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
            type="password" inputMode="numeric" maxLength={8} placeholder="Mín. 4 dígitos"
            className="w-full rounded-xl border border-[#D7CBB3] px-3 py-2 text-sm text-[#16323D] focus:border-[#16323D] focus:outline-none" />
        </div>
      </div>

      <label className="mb-2 block text-[10px] font-bold uppercase tracking-wide text-[#5C6A6E]">Permisos</label>
      <PermGrid perms={perms} onChange={setPerms} />

      {error && <p className="mt-2 text-[11px] font-semibold text-[#B0492F]">{error}</p>}

      <div className="mt-3 flex gap-2">
        <button onClick={onCancel}
          className="flex-1 rounded-xl bg-[#ECE3D1] py-2.5 text-sm font-bold text-[#5C6A6E] hover:bg-[#D7CBB3]">
          Cancelar
        </button>
        <button onClick={create} disabled={saving}
          className="flex-1 rounded-xl bg-[#16323D] py-2.5 text-sm font-bold text-white hover:bg-[#0e2630] disabled:opacity-40">
          {saving ? "Creando…" : "Crear colaborador"}
        </button>
      </div>
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────
export default function UsersPanel({ projects }: { projects: Project[] }) {
  const [users,      setUsers]      = useState<AppUser[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const fetchUsers = useCallback(async () => {
    const { data } = await supabase
      .from("app_users")
      .select("*")
      .eq("active", true)
      .order("created_at", { ascending: true });
    setUsers((data as AppUser[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const handleCreated = (u: AppUser) => {
    setUsers(prev => [...prev, u]);
    setShowCreate(false);
  };

  return (
    <div className="mt-8">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="font-[Manrope] text-base font-bold text-[#16323D]">Equipo</h2>
          <p className="text-[11px] text-[#97A1A0]">Gestiona colaboradores y sus permisos</p>
        </div>
        <button
          onClick={() => setShowCreate(s => !s)}
          className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-[#D7CBB3] bg-[#ECE3D1] px-4 py-2 text-sm font-bold text-[#16323D] transition hover:border-[#16323D]"
        >
          {showCreate ? <X size={14} /> : <Plus size={14} />}
          {showCreate ? "Cancelar" : "Nuevo colaborador"}
        </button>
      </div>

      {showCreate && (
        <div className="mb-4">
          <CreateUserForm onCreated={handleCreated} onCancel={() => setShowCreate(false)} />
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-8">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#16323D] border-t-transparent" />
        </div>
      ) : users.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#D7CBB3] bg-white py-8 text-center text-sm text-[#97A1A0]">
          No hay colaboradores aún. Crea el primero.
        </div>
      ) : (
        <div className="space-y-3">
          {users.map(u => (
            <UserRow
              key={u.id}
              user={u}
              projects={projects}
              onUpdated={updated => setUsers(prev => prev.map(x => x.id === updated.id ? updated : x))}
              onDeleted={id => setUsers(prev => prev.filter(x => x.id !== id))}
            />
          ))}
        </div>
      )}
    </div>
  );
}
