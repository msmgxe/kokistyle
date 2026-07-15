"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, X, Trash2, Pencil, Check, ChevronDown, ChevronUp } from "lucide-react";
import { supabase } from "@/src/lib/supabase";
import type { AppUser, Permissions, PermissionSection, PermissionAction, UserType } from "@/src/types/auth";
import {
  DEFAULT_PERMISSIONS, DEFAULT_CLIENT_PERMISSIONS, FULL_PERMISSIONS,
  SECTION_LABELS, TAB_ACCESS_OPTIONS, DEFAULT_COWORKER_TAB_ACCESS, DEFAULT_CLIENT_TAB_ACCESS,
} from "@/src/types/auth";
import type { Project } from "@/src/types/project";
import ProjectThumb from "@/src/components/ui/ProjectThumb";

interface Contact { id: string; name: string; specialty: string; }

const ACTIONS: { key: PermissionAction; label: string }[] = [
  { key: "view",   label: "View"   },
  { key: "create", label: "Create" },
  { key: "edit",   label: "Edit"   },
  { key: "delete", label: "Delete" },
];
const SECTIONS = Object.keys(SECTION_LABELS) as PermissionSection[];

function deepClone<T>(obj: T): T { return JSON.parse(JSON.stringify(obj)); }

// ── Checkbox pill ─────────────────────────────────────────────────────────────
function Chk({
  on, onClick, disabled = false,
}: { on: boolean; onClick?: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || !onClick}
      className={`mx-auto flex h-5 w-5 items-center justify-center rounded-md border transition ${
        on ? "border-[var(--brand)] bg-[var(--brand)] text-white" : "border-[#D7CBB3] dark:border-[#2c3c5e] bg-white dark:bg-[#111a2e] text-transparent"
      } ${disabled || !onClick ? "cursor-default" : "hover:opacity-80"}`}
    >
      <Check size={10} strokeWidth={3} />
    </button>
  );
}

// ── Permission grid ───────────────────────────────────────────────────────────
function PermGrid({
  perms, onChange,
}: { perms: Permissions; onChange?: (p: Permissions) => void }) {
  const toggle = (sec: PermissionSection, act: PermissionAction) => {
    if (!onChange) return;
    const next = deepClone(perms);
    next[sec][act] = !next[sec][act];
    if (act !== "view" && next[sec][act]) next[sec].view = true;
    if (act === "view" && !next[sec][act])
      next[sec] = { view: false, create: false, edit: false, delete: false };
    onChange(next);
  };
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[320px] text-[11px]">
        <thead>
          <tr>
            <th className="pb-2 text-left font-bold text-[#5C6A6E] dark:text-[#9fb0cc]">Section</th>
            {ACTIONS.map(a => (
              <th key={a.key} className="pb-2 w-14 text-center font-bold text-[#5C6A6E] dark:text-[#9fb0cc]">{a.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {SECTIONS.map(sec => (
            <tr key={sec} className="border-t border-[#F0EAE0] dark:border-[#22304d]">
              <td className="py-1.5 pr-3 font-semibold text-[var(--brand)]">{SECTION_LABELS[sec]}</td>
              {ACTIONS.map(a => (
                <td key={a.key} className="py-1.5 text-center">
                  <Chk on={perms[sec][a.key]} onClick={onChange ? () => toggle(sec, a.key) : undefined} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Tab access grid ───────────────────────────────────────────────────────────
function TabAccessGrid({
  tabAccess, onChange, userType,
}: { tabAccess: string[]; onChange?: (t: string[]) => void; userType: UserType }) {
  const toggle = (id: string) => {
    if (!onChange) return;
    const next = tabAccess.includes(id)
      ? tabAccess.filter(t => t !== id)
      : [...tabAccess, id];
    onChange(next);
  };
  return (
    <div className="grid grid-cols-3 gap-1">
      {TAB_ACCESS_OPTIONS.map(tab => {
        const on = tabAccess.includes(tab.id);
        const recommended = userType === "coworker" ? tab.coworker : tab.client;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange && toggle(tab.id)}
            disabled={!onChange}
            className={`flex flex-col items-center gap-1 rounded-xl border px-2 py-2.5 text-center transition ${
              on
                ? "border-[var(--brand)] bg-[var(--brand)] text-white"
                : recommended
                  ? "border-[#B8DEC9] bg-[#EBF5F0] dark:bg-[#14261c] text-[var(--brand)] hover:border-[var(--brand)]"
                  : "border-[#E6DDCB] dark:border-[#22304d] bg-white dark:bg-[#111a2e] text-[#97A1A0] dark:text-[#728098] hover:border-[#B0A08A]"
            } ${!onChange ? "cursor-default" : "cursor-pointer"}`}
          >
            <span className={`text-[11px] font-bold leading-tight ${on ? "text-white" : "text-[var(--brand)]"}`}>{tab.label}</span>
            {recommended && !on && (
              <span className="text-[9px] text-[#4F8A63] font-semibold">recommended</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ── Project assignment ────────────────────────────────────────────────────────
function ProjectAssign({
  userId, projects, assigned, onToggle,
}: { userId: string; projects: Project[]; assigned: Set<string>; onToggle: (id: string, add: boolean) => void }) {
  return (
    <div className="space-y-1.5">
      {projects.length === 0 && (
        <p className="text-[11px] text-[#97A1A0] dark:text-[#728098]">No projects yet.</p>
      )}
      {projects.map(p => {
        const on = assigned.has(p.id);
        return (
          <button key={p.id} type="button" onClick={() => onToggle(p.id, !on)}
            className={`flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-left text-xs transition ${
              on ? "border-[var(--brand)] bg-[var(--brand)] text-white" : "border-[#E6DDCB] dark:border-[#22304d] bg-white dark:bg-[#111a2e] text-[var(--brand)] hover:border-[#B0A08A]"
            }`}>
            <ProjectThumb photoUrl={p.photo_url} title={p.title} size={24} rounded="rounded-md" />
            <span className="truncate font-semibold">{p.title}</span>
            <span className={`ml-auto text-[10px] ${on ? "text-[#A8C4CC]" : "text-[#97A1A0] dark:text-[#728098]"}`}>{p.client}</span>
          </button>
        );
      })}
    </div>
  );
}

// ── User type badge ───────────────────────────────────────────────────────────
function TypeBadge({ type }: { type: UserType }) {
  return type === "coworker"
    ? <span className="rounded-full border border-[#B8DEC9] bg-[#EBF5F0] dark:bg-[#14261c] px-2 py-0.5 text-[10px] font-bold text-[#2E6B50]">👷 Co-worker</span>
    : <span className="rounded-full border border-[#B8CCEE] bg-[#EDF2FB] dark:bg-[#111a2e] px-2 py-0.5 text-[10px] font-bold text-[#2C4A8A]">👤 Client</span>;
}

// ── User row ──────────────────────────────────────────────────────────────────
type EditSubTab = "info" | "tabs" | "perms" | "projects";

function UserRow({
  user, projects, contacts, onUpdated, onDeleted,
}: {
  user: AppUser; projects: Project[]; contacts: Contact[];
  onUpdated: (u: AppUser) => void; onDeleted: (id: string) => void;
}) {
  const [expanded,      setExpanded]      = useState(false);
  const [editing,       setEditing]       = useState(false);
  const [editTab,       setEditTab]       = useState<EditSubTab>("info");
  const [name,          setName]          = useState(user.name);
  const [pin,           setPin]           = useState(user.pin);
  const [userType,      setUserType]      = useState<UserType>(user.user_type ?? "coworker");
  const [contactId,     setContactId]     = useState<string>(user.contact_id ?? "");
  const [tabAccess,     setTabAccess]     = useState<string[]>(user.tab_access ?? DEFAULT_COWORKER_TAB_ACCESS);
  const [myTasksOnly,   setMyTasksOnly]   = useState(user.my_tasks_only ?? false);
  const [perms,         setPerms]         = useState<Permissions>(deepClone(user.permissions));
  const [assigned,      setAssigned]      = useState<Set<string>>(new Set());
  const [saving,        setSaving]        = useState(false);
  const [confirmDel,    setConfirmDel]    = useState(false);

  const loadAssigned = useCallback(async () => {
    const { data } = await supabase.from("user_project_access").select("project_id").eq("user_id", user.id);
    setAssigned(new Set(data?.map(r => r.project_id) ?? []));
  }, [user.id]);

  useEffect(() => { if (expanded) loadAssigned(); }, [expanded, loadAssigned]);

  const startEdit = () => {
    setName(user.name);
    setPin(user.pin);
    setUserType(user.user_type ?? "coworker");
    setContactId(user.contact_id ?? "");
    setTabAccess(user.tab_access ?? DEFAULT_COWORKER_TAB_ACCESS);
    setMyTasksOnly(user.my_tasks_only ?? false);
    setPerms(deepClone(user.permissions));
    setEditing(true);
    setExpanded(true);
    setEditTab("info");
  };

  const cancelEdit = () => {
    setEditing(false);
  };

  const save = async () => {
    setSaving(true);
    const { data, error } = await supabase.from("app_users").update({
      name,
      pin,
      user_type:     userType,
      contact_id:    contactId || null,
      tab_access:    tabAccess,
      my_tasks_only: myTasksOnly,
      permissions:   perms,
    }).eq("id", user.id).select().single();
    setSaving(false);
    if (!error && data) { onUpdated(data as AppUser); setEditing(false); }
  };

  const toggleProject = async (projectId: string, add: boolean) => {
    if (add) {
      await supabase.from("user_project_access").insert({ user_id: user.id, project_id: projectId });
      setAssigned(prev => new Set([...prev, projectId]));
    } else {
      await supabase.from("user_project_access").delete().eq("user_id", user.id).eq("project_id", projectId);
      setAssigned(prev => { const s = new Set(prev); s.delete(projectId); return s; });
    }
  };

  const deactivate = async () => {
    await supabase.from("app_users").update({ active: false }).eq("id", user.id);
    onDeleted(user.id);
  };

  const applyPreset = (type: UserType) => {
    setTabAccess(type === "coworker" ? DEFAULT_COWORKER_TAB_ACCESS : DEFAULT_CLIENT_TAB_ACCESS);
    setPerms(deepClone(type === "coworker" ? DEFAULT_PERMISSIONS : DEFAULT_CLIENT_PERMISSIONS));
    setMyTasksOnly(type === "coworker");
  };

  const linkedContact = contacts.find(c => c.id === (user.contact_id ?? ""));

  const SUB_TABS: { id: EditSubTab; label: string }[] = [
    { id: "info",     label: "Info"     },
    { id: "tabs",     label: "Tabs"     },
    { id: "perms",    label: "Permisos" },
    { id: "projects", label: "Projects" },
  ];

  return (
    <>
      <div className="rounded-2xl border border-[#E6DDCB] dark:border-[#22304d] bg-white dark:bg-[#111a2e] overflow-hidden">
        {/* Header row */}
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--brand)] text-sm font-bold text-white">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <p className="text-sm font-bold text-[var(--brand)]">{user.name}</p>
              <TypeBadge type={user.user_type ?? "coworker"} />
              {user.my_tasks_only && (
                <span className="rounded-full border border-[#F0CFA0] bg-[#FEF6ED] dark:bg-[#17233d] px-2 py-0.5 text-[10px] font-bold text-[#9B6A2F]">
                  My tasks only
                </span>
              )}
            </div>
            <p className="mt-0.5 text-[11px] text-[#97A1A0] dark:text-[#728098]">
              {linkedContact
                ? <><span className="font-semibold text-[#5C6A6E] dark:text-[#9fb0cc]">{linkedContact.name}{linkedContact.specialty ? ` — ${linkedContact.specialty}` : ""}</span></>
                : user.tab_access
                  ? <>{user.tab_access.length} tabs visible</>
                  : "No restrictions set"}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={startEdit}
              className="grid h-7 w-7 place-items-center rounded-lg text-[#5C6A6E] dark:text-[#9fb0cc] hover:bg-[#F0EAE0] dark:hover:bg-[#17233d]">
              <Pencil size={13} />
            </button>
            <button onClick={() => setConfirmDel(true)}
              className="grid h-7 w-7 place-items-center rounded-lg text-[#B0492F] hover:bg-[#FFF0EE] dark:hover:bg-[#2a1712]">
              <Trash2 size={13} />
            </button>
            <button onClick={() => setExpanded(e => !e)}
              className="grid h-7 w-7 place-items-center rounded-lg text-[#5C6A6E] dark:text-[#9fb0cc] hover:bg-[#F0EAE0] dark:hover:bg-[#17233d]">
              {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          </div>
        </div>

        {/* Expandable panel */}
        {expanded && (
          <div className="border-t border-[#F0EAE0] dark:border-[#22304d] px-4 pb-4 pt-3">
            {/* Sub-tab bar */}
            <div className="mb-3 flex gap-1">
              {SUB_TABS.map(t => (
                <button key={t.id} onClick={() => setEditTab(t.id)}
                  className={`rounded-lg px-3 py-1.5 text-[11px] font-bold transition ${
                    editTab === t.id ? "bg-[var(--brand)] text-white" : "bg-[#F0EAE0] dark:bg-[#17233d] text-[#5C6A6E] dark:text-[#9fb0cc] hover:bg-[#E6DDCB] dark:hover:bg-[#17233d]"
                  }`}>
                  {t.label}
                </button>
              ))}
            </div>

            {/* ── Info ── */}
            {editTab === "info" && (
              <div className="space-y-3">
                {editing ? (
                  <>
                    {/* Type toggle */}
                    <div>
                      <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wide text-[#5C6A6E] dark:text-[#9fb0cc]">User type</label>
                      <div className="grid grid-cols-2 gap-2">
                        {(["coworker", "client"] as UserType[]).map(type => (
                          <button key={type} type="button" onClick={() => { setUserType(type); applyPreset(type); }}
                            className={`flex items-center justify-center gap-2 rounded-xl border py-2 text-[12px] font-bold transition ${
                              userType === type
                                ? type === "coworker"
                                  ? "border-[#2E6B50] bg-[#EBF5F0] dark:bg-[#14261c] text-[#2E6B50]"
                                  : "border-[#2C4A8A] bg-[#EDF2FB] dark:bg-[#111a2e] text-[#2C4A8A]"
                                : "border-[#E6DDCB] dark:border-[#22304d] bg-white dark:bg-[#111a2e] text-[#5C6A6E] dark:text-[#9fb0cc] hover:border-[#B0A08A]"
                            }`}>
                            {type === "coworker" ? "👷 Co-worker" : "👤 Client"}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Name + PIN */}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-[#5C6A6E] dark:text-[#9fb0cc]">Name</label>
                        <input value={name} onChange={e => setName(e.target.value)}
                          className="w-full rounded-xl border border-[#D7CBB3] dark:border-[#2c3c5e] px-3 py-2 text-sm text-[var(--brand)] focus:border-[var(--brand)] focus:outline-none" />
                      </div>
                      <div>
                        <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-[#5C6A6E] dark:text-[#9fb0cc]">PIN</label>
                        <input type="password" value={pin}
                          onChange={e => setPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
                          inputMode="numeric" maxLength={8}
                          className="w-full rounded-xl border border-[#D7CBB3] dark:border-[#2c3c5e] px-3 py-2 text-sm text-[var(--brand)] focus:border-[var(--brand)] focus:outline-none" />
                      </div>
                    </div>

                    {/* Contact link (co-worker only) */}
                    {userType === "coworker" && (
                      <>
                        <div>
                          <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-[#5C6A6E] dark:text-[#9fb0cc]">
                            Linked contact <span className="font-normal normal-case text-[#97A1A0] dark:text-[#728098]">(filters their tasks)</span>
                          </label>
                          <select value={contactId} onChange={e => setContactId(e.target.value)}
                            className="w-full rounded-xl border border-[#D7CBB3] dark:border-[#2c3c5e] bg-white dark:bg-[#111a2e] px-3 py-2.5 text-sm text-[var(--brand)] focus:border-[var(--brand)] focus:outline-none">
                            <option value="">— No linked contact —</option>
                            {contacts.map(c => (
                              <option key={c.id} value={c.id}>{c.name}{c.specialty ? ` — ${c.specialty}` : ""}</option>
                            ))}
                          </select>
                          <p className="mt-1 text-[10px] text-[#97A1A0] dark:text-[#728098]">When linked, they see only tasks assigned to them in Workflow and Day Planner.</p>
                        </div>
                        <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-[#E6DDCB] dark:border-[#22304d] bg-[#F7F3EA] dark:bg-[#0b1220] p-3">
                          <input type="checkbox" checked={myTasksOnly} onChange={e => setMyTasksOnly(e.target.checked)}
                            className="h-4 w-4 accent-[var(--brand)]" />
                          <div>
                            <p className="text-[12px] font-bold text-[var(--brand)]">My tasks only</p>
                            <p className="text-[10px] text-[#5C6A6E] dark:text-[#9fb0cc]">Shows only tasks assigned to this user in Workflow & Day Planner</p>
                          </div>
                        </label>
                      </>
                    )}

                    <div className="flex gap-2 pt-1">
                      <button onClick={cancelEdit}
                        className="flex-1 rounded-xl bg-[#ECE3D1] dark:bg-[#17233d] py-2.5 text-sm font-bold text-[#5C6A6E] dark:text-[#9fb0cc] hover:bg-[#D7CBB3] dark:hover:bg-[#17233d]">
                        Cancel
                      </button>
                      <button onClick={save} disabled={saving}
                        className="flex-1 rounded-xl bg-[var(--brand)] py-2.5 text-sm font-bold text-white disabled:opacity-50">
                        {saving ? "Saving…" : "Save changes"}
                      </button>
                    </div>
                  </>
                ) : (
                  /* Read-only info */
                  <div className="space-y-2 text-sm">
                    <div className="flex gap-4">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wide text-[#97A1A0] dark:text-[#728098]">Type</p>
                        <TypeBadge type={user.user_type ?? "coworker"} />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wide text-[#97A1A0] dark:text-[#728098]">PIN</p>
                        <p className="text-sm font-semibold text-[var(--brand)]">••••</p>
                      </div>
                    </div>
                    {linkedContact && (
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wide text-[#97A1A0] dark:text-[#728098]">Linked contact</p>
                        <p className="text-sm font-semibold text-[var(--brand)]">{linkedContact.name} — {linkedContact.specialty}</p>
                      </div>
                    )}
                    {user.my_tasks_only && (
                      <p className="text-[11px] font-semibold text-[#9B6A2F]">✓ My tasks only is active</p>
                    )}
                    <button onClick={startEdit}
                      className="mt-1 flex items-center gap-1.5 rounded-xl bg-[#F0EAE0] dark:bg-[#17233d] px-4 py-2 text-[12px] font-bold text-[var(--brand)] hover:bg-[#E6DDCB] dark:hover:bg-[#17233d]">
                      <Pencil size={12} /> Edit info
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* ── Tab access ── */}
            {editTab === "tabs" && (
              <div>
                {editing && (
                  <div className="mb-3 flex flex-wrap gap-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wide text-[#5C6A6E] dark:text-[#9fb0cc] mr-1 self-center">Presets:</span>
                    <button onClick={() => applyPreset("coworker")}
                      className="rounded-md border border-[#B8DEC9] bg-[#EBF5F0] dark:bg-[#14261c] px-2.5 py-1 text-[10px] font-bold text-[#2E6B50] hover:opacity-80">
                      👷 Co-worker
                    </button>
                    <button onClick={() => applyPreset("client")}
                      className="rounded-md border border-[#B8CCEE] bg-[#EDF2FB] dark:bg-[#111a2e] px-2.5 py-1 text-[10px] font-bold text-[#2C4A8A] hover:opacity-80">
                      👤 Client
                    </button>
                    <button onClick={() => setTabAccess(TAB_ACCESS_OPTIONS.map(t => t.id))}
                      className="rounded-md border border-[#D7CBB3] dark:border-[#2c3c5e] bg-[#ECE3D1] dark:bg-[#17233d] px-2.5 py-1 text-[10px] font-bold text-[#5C6A6E] dark:text-[#9fb0cc] hover:opacity-80">
                      All tabs
                    </button>
                  </div>
                )}
                <TabAccessGrid
                  tabAccess={editing ? tabAccess : (user.tab_access ?? [])}
                  onChange={editing ? setTabAccess : undefined}
                  userType={editing ? userType : (user.user_type ?? "coworker")}
                />
                {editing && (
                  <div className="mt-3 flex gap-2">
                    <button onClick={cancelEdit}
                      className="flex-1 rounded-xl bg-[#ECE3D1] dark:bg-[#17233d] py-2.5 text-sm font-bold text-[#5C6A6E] dark:text-[#9fb0cc]">Cancel</button>
                    <button onClick={save} disabled={saving}
                      className="flex-1 rounded-xl bg-[var(--brand)] py-2.5 text-sm font-bold text-white disabled:opacity-50">
                      {saving ? "Saving…" : "Save changes"}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* ── Permissions ── */}
            {editTab === "perms" && (
              <div>
                <PermGrid
                  perms={editing ? perms : user.permissions}
                  onChange={editing ? setPerms : undefined}
                />
                {editing && (
                  <div className="mt-3 flex gap-2">
                    <button onClick={cancelEdit}
                      className="flex-1 rounded-xl bg-[#ECE3D1] dark:bg-[#17233d] py-2.5 text-sm font-bold text-[#5C6A6E] dark:text-[#9fb0cc]">Cancel</button>
                    <button onClick={save} disabled={saving}
                      className="flex-1 rounded-xl bg-[var(--brand)] py-2.5 text-sm font-bold text-white disabled:opacity-50">
                      {saving ? "Saving…" : "Save changes"}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* ── Projects ── */}
            {editTab === "projects" && (
              <ProjectAssign userId={user.id} projects={projects} assigned={assigned} onToggle={toggleProject} />
            )}
          </div>
        )}
      </div>

      {/* Delete confirmation */}
      {confirmDel && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-[var(--brand)]/55 backdrop-blur-sm">
          <div className="w-full max-w-[400px] rounded-[20px] bg-[#F7F3EA] dark:bg-[#0b1220] p-6 shadow-2xl">
            <h3 className="mb-2 text-lg font-bold text-[var(--brand)]">Remove user</h3>
            <p className="mb-5 text-sm text-[#5C6A6E] dark:text-[#9fb0cc]">
              Remove <strong>{user.name}</strong> from the team? They won&apos;t be able to log in.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDel(false)}
                className="flex-1 rounded-xl bg-[#ECE3D1] dark:bg-[#17233d] py-3 font-bold text-[#5C6A6E] dark:text-[#9fb0cc]">Cancel</button>
              <button onClick={deactivate}
                className="flex-1 rounded-xl bg-[#B0492F] py-3 font-bold text-white">Remove</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Create user form ──────────────────────────────────────────────────────────
function CreateUserForm({
  projects, contacts, onCreated, onCancel,
}: { projects: Project[]; contacts: Contact[]; onCreated: (u: AppUser) => void; onCancel: () => void }) {
  const [userType,    setUserType]    = useState<UserType>("coworker");
  const [name,        setName]        = useState("");
  const [pin,         setPin]         = useState("");
  const [contactId,   setContactId]   = useState("");
  const [tabAccess,   setTabAccess]   = useState<string[]>(DEFAULT_COWORKER_TAB_ACCESS);
  const [myTasksOnly, setMyTasksOnly] = useState(true);
  const [perms,       setPerms]       = useState<Permissions>(deepClone(DEFAULT_PERMISSIONS));
  const [activeTab,   setActiveTab]   = useState<"info" | "tabs" | "perms">("info");
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState("");

  const applyPreset = (type: UserType) => {
    setTabAccess(type === "coworker" ? DEFAULT_COWORKER_TAB_ACCESS : DEFAULT_CLIENT_TAB_ACCESS);
    setPerms(deepClone(type === "coworker" ? DEFAULT_PERMISSIONS : DEFAULT_CLIENT_PERMISSIONS));
    setMyTasksOnly(type === "coworker");
  };

  const handleTypeChange = (type: UserType) => {
    setUserType(type);
    applyPreset(type);
    if (type === "client") setContactId("");
  };

  const create = async () => {
    if (!name.trim()) { setError("Name is required"); return; }
    if (pin.length < 4) { setError("PIN must be at least 4 digits"); return; }
    setSaving(true);
    const { data, error: e } = await supabase
      .from("app_users")
      .insert({
        name: name.trim(),
        pin,
        role:          "colaborador",
        user_type:     userType,
        contact_id:    contactId || null,
        tab_access:    tabAccess,
        my_tasks_only: myTasksOnly,
        permissions:   perms,
        active:        true,
      })
      .select()
      .single();
    setSaving(false);
    if (e) { setError(e.message); return; }
    onCreated(data as AppUser);
  };

  const FORM_TABS: { id: "info" | "tabs" | "perms"; label: string }[] = [
    { id: "info",  label: "Info" },
    { id: "tabs",  label: "Tab access" },
    { id: "perms", label: "Permissions" },
  ];

  return (
    <div className="rounded-2xl border-2 border-[var(--brand)] bg-white dark:bg-[#111a2e] p-5 shadow-md">
      <h4 className="mb-4 text-[12px] font-bold uppercase tracking-widest text-[var(--brand)]">New team member</h4>

      {/* Form sub-tabs */}
      <div className="mb-4 flex gap-1">
        {FORM_TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`rounded-lg px-3 py-1.5 text-[11px] font-bold transition ${
              activeTab === t.id ? "bg-[var(--brand)] text-white" : "bg-[#F0EAE0] dark:bg-[#17233d] text-[#5C6A6E] dark:text-[#9fb0cc] hover:bg-[#E6DDCB] dark:hover:bg-[#17233d]"
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Info tab */}
      {activeTab === "info" && (
        <div className="space-y-3">
          {/* Type toggle */}
          <div>
            <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wide text-[#5C6A6E] dark:text-[#9fb0cc]">User type</label>
            <div className="grid grid-cols-2 gap-2">
              {(["coworker", "client"] as UserType[]).map(type => (
                <button key={type} type="button" onClick={() => handleTypeChange(type)}
                  className={`flex items-center justify-center gap-2 rounded-xl border py-2.5 text-[12px] font-bold transition ${
                    userType === type
                      ? type === "coworker"
                        ? "border-[#2E6B50] bg-[#EBF5F0] dark:bg-[#14261c] text-[#2E6B50]"
                        : "border-[#2C4A8A] bg-[#EDF2FB] dark:bg-[#111a2e] text-[#2C4A8A]"
                      : "border-[#E6DDCB] dark:border-[#22304d] bg-white dark:bg-[#111a2e] text-[#5C6A6E] dark:text-[#9fb0cc] hover:border-[#B0A08A]"
                  }`}>
                  {type === "coworker" ? "👷 Co-worker" : "👤 Client"}
                </button>
              ))}
            </div>
          </div>

          {/* Name + PIN */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-[#5C6A6E] dark:text-[#9fb0cc]">Name</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="E.g. Ana López"
                className="w-full rounded-xl border border-[#D7CBB3] dark:border-[#2c3c5e] px-3 py-2.5 text-sm text-[var(--brand)] focus:border-[var(--brand)] focus:outline-none" />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-[#5C6A6E] dark:text-[#9fb0cc]">Access PIN</label>
              <input value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
                type="password" inputMode="numeric" maxLength={8} placeholder="Min. 4 digits"
                className="w-full rounded-xl border border-[#D7CBB3] dark:border-[#2c3c5e] px-3 py-2.5 text-sm text-[var(--brand)] focus:border-[var(--brand)] focus:outline-none" />
            </div>
          </div>

          {/* Co-worker extras */}
          {userType === "coworker" && (
            <>
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-[#5C6A6E] dark:text-[#9fb0cc]">
                  Linked contact <span className="font-normal normal-case text-[#97A1A0] dark:text-[#728098]">(for task filtering)</span>
                </label>
                <select value={contactId} onChange={e => setContactId(e.target.value)}
                  className="w-full rounded-xl border border-[#D7CBB3] dark:border-[#2c3c5e] bg-white dark:bg-[#111a2e] px-3 py-2.5 text-sm text-[var(--brand)] focus:border-[var(--brand)] focus:outline-none">
                  <option value="">— No linked contact —</option>
                  {contacts.map(c => (
                    <option key={c.id} value={c.id}>{c.name}{c.specialty ? ` — ${c.specialty}` : ""}</option>
                  ))}
                </select>
              </div>
              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-[#E6DDCB] dark:border-[#22304d] bg-[#F7F3EA] dark:bg-[#0b1220] p-3">
                <input type="checkbox" checked={myTasksOnly} onChange={e => setMyTasksOnly(e.target.checked)}
                  className="h-4 w-4 accent-[var(--brand)]" />
                <div>
                  <p className="text-[12px] font-bold text-[var(--brand)]">My tasks only</p>
                  <p className="text-[10px] text-[#5C6A6E] dark:text-[#9fb0cc]">Shows only tasks assigned to this user in Workflow & Day Planner</p>
                </div>
              </label>
            </>
          )}
        </div>
      )}

      {/* Tab access tab */}
      {activeTab === "tabs" && (
        <div>
          <div className="mb-3 flex flex-wrap gap-1.5">
            <span className="self-center text-[10px] font-bold uppercase tracking-wide text-[#5C6A6E] dark:text-[#9fb0cc] mr-1">Presets:</span>
            <button onClick={() => applyPreset("coworker")}
              className="rounded-md border border-[#B8DEC9] bg-[#EBF5F0] dark:bg-[#14261c] px-2.5 py-1 text-[10px] font-bold text-[#2E6B50]">
              👷 Co-worker
            </button>
            <button onClick={() => applyPreset("client")}
              className="rounded-md border border-[#B8CCEE] bg-[#EDF2FB] dark:bg-[#111a2e] px-2.5 py-1 text-[10px] font-bold text-[#2C4A8A]">
              👤 Client
            </button>
            <button onClick={() => setTabAccess(TAB_ACCESS_OPTIONS.map(t => t.id))}
              className="rounded-md border border-[#D7CBB3] dark:border-[#2c3c5e] bg-[#ECE3D1] dark:bg-[#17233d] px-2.5 py-1 text-[10px] font-bold text-[#5C6A6E] dark:text-[#9fb0cc]">
              All
            </button>
          </div>
          <TabAccessGrid tabAccess={tabAccess} onChange={setTabAccess} userType={userType} />
        </div>
      )}

      {/* Permissions tab */}
      {activeTab === "perms" && (
        <PermGrid perms={perms} onChange={setPerms} />
      )}

      {error && <p className="mt-3 text-[11px] font-semibold text-[#B0492F]">{error}</p>}

      <div className="mt-4 flex gap-2">
        <button onClick={onCancel}
          className="flex-1 rounded-xl bg-[#ECE3D1] dark:bg-[#17233d] py-2.5 text-sm font-bold text-[#5C6A6E] dark:text-[#9fb0cc] hover:bg-[#D7CBB3] dark:hover:bg-[#17233d]">
          Cancel
        </button>
        <button onClick={create} disabled={saving}
          className="flex-1 rounded-xl bg-[var(--brand)] py-2.5 text-sm font-bold text-white disabled:opacity-40">
          {saving ? "Creating…" : "Create user"}
        </button>
      </div>
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────
export default function UsersPanel({ projects, contacts }: { projects: Project[]; contacts: Contact[] }) {
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

  return (
    <div className="mt-8">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-[var(--brand)]">Team</h2>
          <p className="text-[11px] text-[#97A1A0] dark:text-[#728098]">Co-workers and clients — granular access by tab and section</p>
        </div>
        <button onClick={() => setShowCreate(s => !s)}
          className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-[#D7CBB3] dark:border-[#2c3c5e] bg-[#ECE3D1] dark:bg-[#17233d] px-4 py-2 text-sm font-bold text-[var(--brand)] transition hover:border-[var(--brand)]">
          {showCreate ? <X size={14} /> : <Plus size={14} />}
          {showCreate ? "Cancel" : "New user"}
        </button>
      </div>

      {showCreate && (
        <div className="mb-4">
          <CreateUserForm
            projects={projects}
            contacts={contacts}
            onCreated={u => { setUsers(prev => [...prev, u]); setShowCreate(false); }}
            onCancel={() => setShowCreate(false)}
          />
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-8">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--brand)] border-t-transparent" />
        </div>
      ) : users.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#D7CBB3] dark:border-[#2c3c5e] bg-white dark:bg-[#111a2e] py-8 text-center text-sm text-[#97A1A0] dark:text-[#728098]">
          No team members yet. Create the first one.
        </div>
      ) : (
        <div className="space-y-3">
          {users.map(u => (
            <UserRow
              key={u.id}
              user={u}
              projects={projects}
              contacts={contacts}
              onUpdated={updated => setUsers(prev => prev.map(x => x.id === updated.id ? updated : x))}
              onDeleted={id => setUsers(prev => prev.filter(x => x.id !== id))}
            />
          ))}
        </div>
      )}
    </div>
  );
}
