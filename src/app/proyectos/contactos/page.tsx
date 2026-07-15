"use client";

import { useEffect, useState, useCallback } from "react";
import { Users, HardHat } from "lucide-react";
import { supabase } from "@/src/lib/supabase";
import { initials } from "@/src/lib/utils";
import type { Contact, Project } from "@/src/types/project";
import { useLanguage } from "@/src/context/LanguageContext";
import { useAuth } from "@/src/context/AuthContext";
import TeamPanel from "@/src/components/ui/TeamPanel";
import { SPECIALTY_OPTIONS_EN, SPECIALTY_OPTIONS_ES, specialtyDisplay as sharedSpecialtyDisplay } from "@/src/lib/specialties";

type TabKey = "all" | "friend" | "coworker" | "customer";
type SectionKey = "directory" | "team";

type TPanel = ReturnType<typeof useLanguage>["t"]["panel"];

function formatUSPhone(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

function ContactForm({
  contact,
  language,
  tp,
  onChange,
}: {
  contact: Partial<Contact>;
  language: string;
  tp: TPanel;
  onChange: (updated: Partial<Contact>) => void;
}) {
  const gc = tp.globalContacts;
  const type = contact.type ?? "coworker";
  const specialtyOptions = language === "es" ? SPECIALTY_OPTIONS_ES : SPECIALTY_OPTIONS_EN;

  return (
    <div className="space-y-4">
      <div>
        <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.05em] text-[#5C6A6E] dark:text-[#9fb0cc]">
          {gc.name}
        </label>
        <input
          type="text"
          value={contact.name ?? ""}
          onChange={(e) => onChange({ ...contact, name: e.target.value })}
          className="w-full rounded-xl border border-[#D7CBB3] dark:border-[#2c3c5e] bg-white dark:bg-[#111a2e] px-3 py-3 text-sm text-[var(--brand)] focus:border-[var(--brand)] focus:outline-none"
        />
      </div>

      <div>
        <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.05em] text-[#5C6A6E] dark:text-[#9fb0cc]">
          {gc.phone}
        </label>
        <input
          type="tel"
          value={contact.phone ?? ""}
          onChange={(e) => onChange({ ...contact, phone: formatUSPhone(e.target.value) })}
          placeholder="(786) 563-2531"
          className="w-full rounded-xl border border-[#D7CBB3] dark:border-[#2c3c5e] bg-white dark:bg-[#111a2e] px-3 py-3 text-sm text-[var(--brand)] focus:border-[var(--brand)] focus:outline-none"
        />
      </div>

      <div>
        <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.05em] text-[#5C6A6E] dark:text-[#9fb0cc]">
          {gc.contactType}
        </label>
        <div className="flex gap-2">
          {(["friend", "coworker", "customer"] as const).map((ct) => {
            const label = ct === "friend" ? gc.typeFriend : ct === "coworker" ? gc.typeCoworker : gc.typeCustomer;
            return (
              <button
                key={ct}
                type="button"
                onClick={() => onChange({ ...contact, type: ct })}
                className={`flex-1 rounded-xl border py-2.5 text-xs font-bold transition ${
                  type === ct
                    ? "border-[var(--brand)] bg-[var(--brand)] text-white"
                    : "border-[#D7CBB3] dark:border-[#2c3c5e] bg-white dark:bg-[#111a2e] text-[#5C6A6E] dark:text-[#9fb0cc] hover:border-[var(--brand)]"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {type === "coworker" && (
        <>
          <div>
            <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.05em] text-[#5C6A6E] dark:text-[#9fb0cc]">
              {gc.specialties}
            </label>
            <select
              value={contact.specialty ?? ""}
              onChange={(e) => onChange({ ...contact, specialty: e.target.value })}
              className="w-full rounded-xl border border-[#D7CBB3] dark:border-[#2c3c5e] bg-white dark:bg-[#111a2e] px-3 py-3 text-sm text-[var(--brand)] focus:border-[var(--brand)] focus:outline-none"
            >
              <option value="">—</option>
              {SPECIALTY_OPTIONS_EN.map((en, i) => (
                <option key={en} value={en}>
                  {specialtyOptions[i]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.05em] text-[#5C6A6E] dark:text-[#9fb0cc]">
              {gc.rate}
            </label>
            <input
              type="text"
              value={contact.rate ?? ""}
              onChange={(e) => onChange({ ...contact, rate: e.target.value })}
              className="w-full rounded-xl border border-[#D7CBB3] dark:border-[#2c3c5e] bg-white dark:bg-[#111a2e] px-3 py-3 text-sm text-[var(--brand)] focus:border-[var(--brand)] focus:outline-none"
              placeholder="e.g. 25"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.05em] text-[#5C6A6E] dark:text-[#9fb0cc]">
              {gc.rateType}
            </label>
            <div className="flex gap-2">
              {(["hour", "day"] as const).map((rt) => (
                <button
                  key={rt}
                  type="button"
                  onClick={() => onChange({ ...contact, rate_type: rt })}
                  className={`flex-1 rounded-xl border py-2.5 text-xs font-bold transition ${
                    (contact.rate_type ?? "hour") === rt
                      ? "border-[var(--brand)] bg-[var(--brand)] text-white"
                      : "border-[#D7CBB3] dark:border-[#2c3c5e] bg-white dark:bg-[#111a2e] text-[#5C6A6E] dark:text-[#9fb0cc] hover:border-[var(--brand)]"
                  }`}
                >
                  {rt === "hour" ? gc.rateHour : gc.rateDay}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function ContactModal({
  contact,
  language,
  tp,
  onSave,
  onDelete,
  onClose,
}: {
  contact?: Contact;
  language: string;
  tp: TPanel;
  onSave: (vals: Partial<Contact>) => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const gc = tp.globalContacts;
  const [form, setForm] = useState<Partial<Contact>>(
    contact
      ? { ...contact }
      : { name: "", phone: "", specialty: "", rate: "", type: "coworker", rate_type: "hour" }
  );
  const [confirmSave, setConfirmSave] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);

  return (
    <>
      <div
        className="fixed inset-0 z-[100] flex items-end justify-center bg-[var(--brand)]/55 backdrop-blur-sm sm:items-center"
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        <div className="w-full max-w-[460px] overflow-y-auto rounded-t-[22px] bg-[#F7F3EA] dark:bg-[#0b1220] p-6 shadow-2xl sm:rounded-[20px] max-h-[92vh]">
          <h3 className="mb-5 text-xl font-bold text-[var(--brand)]">
            {contact ? gc.editContact : gc.newContact}
          </h3>
          <ContactForm contact={form} language={language} tp={tp} onChange={setForm} />
          <div className="mt-5 flex gap-3">
            <button onClick={onClose} className="flex-1 rounded-xl bg-[#ECE3D1] dark:bg-[#17233d] py-3 font-bold text-[#5C6A6E] dark:text-[#9fb0cc]">
              {tp.common.cancel}
            </button>
            <button onClick={() => setConfirmSave(true)} className="flex-1 rounded-xl bg-[var(--brand)] py-3 font-bold text-white">
              {tp.common.save}
            </button>
          </div>
          {onDelete && (
            <button onClick={() => setConfirmDel(true)} className="mt-3 flex w-full items-center justify-center py-2 text-sm font-bold text-[#B0492F]">
              {gc.deleteContact}
            </button>
          )}
        </div>
      </div>

      {confirmSave && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-[var(--brand)]/55 backdrop-blur-sm">
          <div className="w-full max-w-[420px] rounded-[20px] bg-[#F7F3EA] dark:bg-[#0b1220] p-6 shadow-2xl">
            <h3 className="mb-2 text-lg font-bold text-[var(--brand)]">{tp.common.confirmChanges}</h3>
            <p className="mb-5 text-sm text-[#5C6A6E] dark:text-[#9fb0cc]">{tp.common.confirmSaveQ}</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmSave(false)} className="flex-1 rounded-xl bg-[#ECE3D1] dark:bg-[#17233d] py-3 font-bold text-[#5C6A6E] dark:text-[#9fb0cc]">{tp.common.cancel}</button>
              <button onClick={() => { setConfirmSave(false); onSave(form); onClose(); }} className="flex-1 rounded-xl bg-[var(--brand)] py-3 font-bold text-white">{tp.common.save}</button>
            </div>
          </div>
        </div>
      )}

      {confirmDel && onDelete && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-[var(--brand)]/55 backdrop-blur-sm">
          <div className="w-full max-w-[420px] rounded-[20px] bg-[#F7F3EA] dark:bg-[#0b1220] p-6 shadow-2xl">
            <h3 className="mb-2 text-lg font-bold text-[var(--brand)]">{gc.deleteContact}</h3>
            <p className="mb-5 text-sm text-[#5C6A6E] dark:text-[#9fb0cc]">{gc.deleteBody}</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDel(false)} className="flex-1 rounded-xl bg-[#ECE3D1] dark:bg-[#17233d] py-3 font-bold text-[#5C6A6E] dark:text-[#9fb0cc]">{tp.common.cancel}</button>
              <button onClick={() => { setConfirmDel(false); onDelete(); onClose(); }} className="flex-1 rounded-xl bg-[#B0492F] py-3 font-bold text-white">{tp.common.delete}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

const specialtyDisplay = sharedSpecialtyDisplay;

export default function ContactosPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [assigned, setAssigned] = useState<Record<string, Set<string>>>({});
  const [editor, setEditor] = useState<{ contact?: Contact } | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("all");
  const [section, setSection] = useState<SectionKey>("directory");
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState("");
  const [toastVisible, setToastVisible] = useState(false);
  const { isSuperAdmin } = useAuth();
  const { t, language } = useLanguage();
  const tp = t.panel;
  const gc = tp.globalContacts;
  const tt = tp.team;

  // Deep link desde la ruta vieja /proyectos/equipo (?tab=equipo)
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("tab") === "equipo") setSection("team");
  }, []);

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
    showToast(isOn ? gc.removed : gc.assigned);
  };

  const saveContact = async (id: string | undefined, vals: Partial<Contact>) => {
    const payload = {
      name: vals.name ?? "",
      phone: vals.phone ?? "",
      specialty: vals.type === "coworker" ? (vals.specialty ?? "") : "",
      rate: vals.type === "coworker" ? (vals.rate ?? "") : "",
      type: vals.type ?? "coworker",
      rate_type: vals.type === "coworker" ? (vals.rate_type ?? "hour") : "hour",
    };
    if (id) {
      await supabase.from("contacts").update(payload).eq("id", id);
      showToast(gc.contactUpdated);
    } else {
      await supabase.from("contacts").insert(payload);
      showToast(gc.contactAdded);
    }
    fetchAll();
  };

  const deleteContact = async (id: string) => {
    await supabase.from("contacts").delete().eq("id", id);
    showToast(gc.contactDeleted);
    fetchAll();
  };

  const shortTitle = (title: string) => title.split(" — ")[0];

  const tabs: { key: TabKey; label: string }[] = [
    { key: "all",      label: gc.tabAll },
    { key: "friend",   label: gc.tabFriends },
    { key: "coworker", label: gc.tabCoworkers },
    { key: "customer", label: gc.tabCustomers },
  ];

  const filtered = contacts.filter((c) => {
    const effectiveType = c.type ?? "coworker";
    if (activeTab !== "all" && effectiveType !== activeTab) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return c.name.toLowerCase().includes(q) || c.specialty.toLowerCase().includes(q);
  });

  const showTeam = isSuperAdmin && section === "team";

  return (
    <div className="animate-in fade-in duration-300">
      <div className="mb-6 rounded-2xl bg-[var(--accent)] px-6 py-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-[28px] font-semibold tracking-tight text-white">
              {showTeam ? tt.title : gc.title}
            </h1>
            <p className="mt-1 text-sm text-[#B1C9EF]">{showTeam ? tt.subtitle : gc.subtitle}</p>
          </div>
          {isSuperAdmin && (
            <div className="flex rounded-xl bg-white/10 p-1">
              {([
                { id: "directory", icon: <Users size={13} />,   label: gc.tabDirectory },
                { id: "team",      icon: <HardHat size={13} />, label: tt.title },
              ] as const).map(s => (
                <button key={s.id} onClick={() => setSection(s.id)}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-[12px] font-bold transition ${
                    section === s.id ? "bg-white dark:bg-[#111a2e] text-[var(--accent)] shadow-sm" : "text-[#B1C9EF] hover:text-white"
                  }`}>
                  {s.icon} {s.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {showTeam && <TeamPanel />}

      {!showTeam && (<>
      <div className="mb-4 flex items-center gap-3">
        <div className="relative flex-1">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#5C6A6E] dark:text-[#9fb0cc]">
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
              <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.8"/>
              <path d="M13.5 13.5L17 17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={gc.searchPlaceholder}
            className="w-full rounded-xl border border-[#E6DDCB] dark:border-[#22304d] bg-white dark:bg-[#111a2e] py-2.5 pl-9 pr-3 text-sm text-[var(--brand)] placeholder:text-[#9CABB0] dark:placeholder:text-[#9fb0cc] focus:border-[var(--brand)] focus:outline-none"
          />
        </div>
        <button
          onClick={() => setEditor({})}
          className="flex-none rounded-xl bg-[var(--brand)] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#1e4455]"
        >
          {gc.add}
        </button>
      </div>

      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-none rounded-full px-4 py-1.5 text-xs font-bold transition ${
              activeTab === tab.key
                ? "bg-[var(--brand)] text-white"
                : "border border-[#E6DDCB] dark:border-[#22304d] bg-white dark:bg-[#111a2e] text-[#5C6A6E] dark:text-[#9fb0cc] hover:border-[#D7CBB3] dark:hover:border-[#2c3c5e]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-[#E6DDCB] dark:border-[#22304d] bg-white dark:bg-[#111a2e] p-10 text-center text-sm text-[#5C6A6E] dark:text-[#9fb0cc]">
          {search.trim() ? gc.noResults : gc.noContacts}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((c) => {
            const pIds = assigned[c.id] ?? new Set<string>();
            const effectiveType = c.type ?? "coworker";
            const isCoworker = effectiveType === "coworker";
            const rateLabel = isCoworker && c.rate
              ? `${c.rate} ${c.rate_type === "day" ? gc.rateDay : gc.rateHour}`
              : "";
            const specialtyLabel = isCoworker ? specialtyDisplay(c.specialty, language) : "";

            return (
              <div
                key={c.id}
                role="button"
                tabIndex={0}
                onClick={() => setEditor({ contact: c })}
                onKeyDown={(e) => { if (e.key === "Enter") setEditor({ contact: c }); }}
                className="flex cursor-pointer items-start gap-4 rounded-2xl border border-[#E6DDCB] dark:border-[#22304d] bg-white dark:bg-[#111a2e] p-4 shadow-sm transition hover:border-[var(--brand)] hover:shadow-md"
              >
                <span className="grid size-11 flex-none place-items-center rounded-[13px] bg-[var(--brand)] text-sm font-bold text-white">
                  {initials(c.name)}
                </span>

                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold text-[var(--brand)]">{c.name}</div>
                  {(specialtyLabel || rateLabel) && (
                    <div className="mt-0.5 text-xs text-[#5C6A6E] dark:text-[#9fb0cc]">
                      {[specialtyLabel, rateLabel].filter(Boolean).join(" · ")}
                    </div>
                  )}
                  {projects.length > 0 && (
                    <div
                      className="mt-2 flex flex-wrap gap-1.5"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {projects.map((p) => {
                        const on = pIds.has(p.id);
                        return (
                          <button
                            key={p.id}
                            onClick={() => toggleAssign(c.id, p.id)}
                            className={`rounded-lg border px-2.5 py-1 text-[10.5px] font-bold transition ${
                              on
                                ? "border-[#DCE8E9] dark:border-[#1f3a44] bg-[#DCE8E9] dark:bg-[#122a2c] text-[#4E7A82]"
                                : "border-[#E6DDCB] dark:border-[#22304d] bg-white dark:bg-[#111a2e] text-[#5C6A6E] dark:text-[#9fb0cc] hover:border-[#D7CBB3] dark:hover:border-[#2c3c5e]"
                            }`}
                          >
                            {shortTitle(p.title)}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div
                  className="flex flex-col items-end gap-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  <a
                    href={`tel:${c.phone}`}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[#DCEBDD] dark:bg-[#14261c] px-3 py-2 text-xs font-bold text-[#4F8A63]"
                  >
                    {gc.call}
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {editor !== null && (
        <ContactModal
          contact={editor.contact}
          language={language}
          tp={tp}
          onSave={(vals) => saveContact(editor.contact?.id, vals)}
          onDelete={editor.contact ? () => deleteContact(editor.contact!.id) : undefined}
          onClose={() => setEditor(null)}
        />
      )}
      </>)}

      <div
        className={`fixed bottom-24 left-1/2 z-[200] w-full max-w-sm -translate-x-1/2 rounded-2xl bg-[var(--brand)] px-4 py-3 text-center text-sm font-medium text-white shadow-2xl transition-all duration-300 ${toastVisible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0 pointer-events-none"}`}
      >
        {toast}
      </div>
    </div>
  );
}
