"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/src/lib/supabase";
import { initials } from "@/src/lib/utils";
import type { Contact, Project } from "@/src/types/project";
import { useLanguage } from "@/src/context/LanguageContext";

type TabKey = "all" | "friend" | "coworker" | "customer";

const SPECIALTY_OPTIONS_EN = [
  "Plumbing", "Painting", "Finisher", "Electrical", "Marble",
  "Flooring", "Bathroom", "Handyman", "Helper",
];
const SPECIALTY_OPTIONS_ES = [
  "Plomería", "Pintura", "Finishero", "Electricidad", "Mármol",
  "Piso", "Baño", "Handyman", "Ayudante",
];

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
        <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.05em] text-[#5C6A6E]">
          {gc.name}
        </label>
        <input
          type="text"
          value={contact.name ?? ""}
          onChange={(e) => onChange({ ...contact, name: e.target.value })}
          className="w-full rounded-xl border border-[#D7CBB3] bg-white px-3 py-3 text-sm text-[#16323D] focus:border-[#16323D] focus:outline-none"
        />
      </div>

      <div>
        <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.05em] text-[#5C6A6E]">
          {gc.phone}
        </label>
        <input
          type="tel"
          value={contact.phone ?? ""}
          onChange={(e) => onChange({ ...contact, phone: formatUSPhone(e.target.value) })}
          placeholder="(786) 563-2531"
          className="w-full rounded-xl border border-[#D7CBB3] bg-white px-3 py-3 text-sm text-[#16323D] focus:border-[#16323D] focus:outline-none"
        />
      </div>

      <div>
        <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.05em] text-[#5C6A6E]">
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
                    ? "border-[#16323D] bg-[#16323D] text-white"
                    : "border-[#D7CBB3] bg-white text-[#5C6A6E] hover:border-[#16323D]"
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
            <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.05em] text-[#5C6A6E]">
              {gc.specialties}
            </label>
            <select
              value={contact.specialty ?? ""}
              onChange={(e) => onChange({ ...contact, specialty: e.target.value })}
              className="w-full rounded-xl border border-[#D7CBB3] bg-white px-3 py-3 text-sm text-[#16323D] focus:border-[#16323D] focus:outline-none"
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
            <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.05em] text-[#5C6A6E]">
              {gc.rate}
            </label>
            <input
              type="text"
              value={contact.rate ?? ""}
              onChange={(e) => onChange({ ...contact, rate: e.target.value })}
              className="w-full rounded-xl border border-[#D7CBB3] bg-white px-3 py-3 text-sm text-[#16323D] focus:border-[#16323D] focus:outline-none"
              placeholder="e.g. 25"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.05em] text-[#5C6A6E]">
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
                      ? "border-[#16323D] bg-[#16323D] text-white"
                      : "border-[#D7CBB3] bg-white text-[#5C6A6E] hover:border-[#16323D]"
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
        className="fixed inset-0 z-[100] flex items-end justify-center bg-[#16323D]/55 backdrop-blur-sm sm:items-center"
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        <div className="w-full max-w-[460px] overflow-y-auto rounded-t-[22px] bg-[#F7F3EA] p-6 shadow-2xl sm:rounded-[20px] max-h-[92vh]">
          <h3 className="mb-5 font-[Manrope] text-xl font-bold text-[#16323D]">
            {contact ? gc.editContact : gc.newContact}
          </h3>
          <ContactForm contact={form} language={language} tp={tp} onChange={setForm} />
          <div className="mt-5 flex gap-3">
            <button onClick={onClose} className="flex-1 rounded-xl bg-[#ECE3D1] py-3 font-bold text-[#5C6A6E]">
              {tp.common.cancel}
            </button>
            <button onClick={() => setConfirmSave(true)} className="flex-1 rounded-xl bg-[#16323D] py-3 font-bold text-white">
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
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-[#16323D]/55 backdrop-blur-sm">
          <div className="w-full max-w-[420px] rounded-[20px] bg-[#F7F3EA] p-6 shadow-2xl">
            <h3 className="mb-2 font-[Manrope] text-lg font-bold text-[#16323D]">{tp.common.confirmChanges}</h3>
            <p className="mb-5 text-sm text-[#5C6A6E]">{tp.common.confirmSaveQ}</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmSave(false)} className="flex-1 rounded-xl bg-[#ECE3D1] py-3 font-bold text-[#5C6A6E]">{tp.common.cancel}</button>
              <button onClick={() => { setConfirmSave(false); onSave(form); onClose(); }} className="flex-1 rounded-xl bg-[#16323D] py-3 font-bold text-white">{tp.common.save}</button>
            </div>
          </div>
        </div>
      )}

      {confirmDel && onDelete && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-[#16323D]/55 backdrop-blur-sm">
          <div className="w-full max-w-[420px] rounded-[20px] bg-[#F7F3EA] p-6 shadow-2xl">
            <h3 className="mb-2 font-[Manrope] text-lg font-bold text-[#16323D]">{gc.deleteContact}</h3>
            <p className="mb-5 text-sm text-[#5C6A6E]">{gc.deleteBody}</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDel(false)} className="flex-1 rounded-xl bg-[#ECE3D1] py-3 font-bold text-[#5C6A6E]">{tp.common.cancel}</button>
              <button onClick={() => { setConfirmDel(false); onDelete(); onClose(); }} className="flex-1 rounded-xl bg-[#B0492F] py-3 font-bold text-white">{tp.common.delete}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function specialtyDisplay(en: string, language: string): string {
  const idx = SPECIALTY_OPTIONS_EN.indexOf(en);
  if (idx === -1) return en;
  return language === "es" ? SPECIALTY_OPTIONS_ES[idx] : en;
}

export default function ContactosPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [assigned, setAssigned] = useState<Record<string, Set<string>>>({});
  const [editor, setEditor] = useState<{ contact?: Contact } | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("all");
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState("");
  const [toastVisible, setToastVisible] = useState(false);
  const { t, language } = useLanguage();
  const tp = t.panel;
  const gc = tp.globalContacts;

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

  return (
    <div className="animate-in fade-in duration-300">
      <div className="mb-6 rounded-2xl bg-[#395886] px-6 py-5">
        <h1 className="font-[Manrope] text-[22px] font-extrabold tracking-tight text-white">{gc.title}</h1>
        <p className="mt-1 text-sm text-[#B1C9EF]">{gc.subtitle}</p>
      </div>

      <div className="mb-4 flex items-center gap-3">
        <div className="relative flex-1">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#5C6A6E]">
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
            className="w-full rounded-xl border border-[#E6DDCB] bg-white py-2.5 pl-9 pr-3 text-sm text-[#16323D] placeholder:text-[#9CABB0] focus:border-[#16323D] focus:outline-none"
          />
        </div>
        <button
          onClick={() => setEditor({})}
          className="flex-none rounded-xl bg-[#16323D] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#1e4455]"
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
                ? "bg-[#16323D] text-white"
                : "border border-[#E6DDCB] bg-white text-[#5C6A6E] hover:border-[#D7CBB3]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-[#E6DDCB] bg-white p-10 text-center text-sm text-[#5C6A6E]">
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
                className="flex cursor-pointer items-start gap-4 rounded-2xl border border-[#E6DDCB] bg-white p-4 shadow-sm transition hover:border-[#16323D] hover:shadow-md"
              >
                <span className="grid size-11 flex-none place-items-center rounded-[13px] bg-[#16323D] font-[Manrope] text-sm font-bold text-white">
                  {initials(c.name)}
                </span>

                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold text-[#16323D]">{c.name}</div>
                  {(specialtyLabel || rateLabel) && (
                    <div className="mt-0.5 text-xs text-[#5C6A6E]">
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

                <div
                  className="flex flex-col items-end gap-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  <a
                    href={`tel:${c.phone}`}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[#DCEBDD] px-3 py-2 text-xs font-bold text-[#4F8A63]"
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

      <div
        className={`fixed bottom-24 left-1/2 z-[200] w-full max-w-sm -translate-x-1/2 rounded-2xl bg-[#16323D] px-4 py-3 text-center text-sm font-medium text-white shadow-2xl transition-all duration-300 ${toastVisible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0 pointer-events-none"}`}
      >
        {toast}
      </div>
    </div>
  );
}
