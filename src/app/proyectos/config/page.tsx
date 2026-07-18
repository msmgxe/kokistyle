"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Users, ShieldCheck, Palette, Sun, Moon } from "lucide-react";
import { useAuth } from "@/src/context/AuthContext";
import { useLanguage } from "@/src/context/LanguageContext";
import { useTheme, ACCENTS } from "@/src/context/ThemeContext";
import { supabase } from "@/src/lib/supabase";
import type { Project } from "@/src/types/project";
import UsersPanel from "@/src/components/ui/UsersPanel";
import AdminSettings from "@/src/components/ui/AdminSettings";

type SubTab = "users" | "security" | "themes";

// Área de administración con 3 sub-tabs (por importancia): Usuarios (permisos por
// usuario), Seguridad (PIN, correo, dispositivos) y Temas (color + modo claro/oscuro).
// Solo superadmin. Es la única tuerca del panel.
export default function ConfigPage() {
  const { isSuperAdmin } = useAuth();
  const { t } = useLanguage();
  const router = useRouter();
  const tp = t.panel;
  const tc = tp.config;

  const [tab, setTab] = useState<SubTab>("users");
  const [projects, setProjects] = useState<Project[]>([]);
  const [contacts, setContacts] = useState<{ id: string; name: string; specialty: string }[]>([]);

  useEffect(() => {
    if (!isSuperAdmin) router.replace("/proyectos");
  }, [isSuperAdmin, router]);

  useEffect(() => {
    if (!isSuperAdmin) return;
    supabase.from("projects").select("id, title, client, photo_url").neq("status", "terminado").order("title")
      .then(({ data }) => { if (data) setProjects(data as unknown as Project[]); });
    supabase.from("contacts").select("id, name, specialty").order("name")
      .then(({ data }) => { if (data) setContacts(data); });
  }, [isSuperAdmin]);

  if (!isSuperAdmin) return null;

  const tabs: { id: SubTab; label: string; icon: typeof Users }[] = [
    { id: "users",    label: tc.tabUsers,    icon: Users },
    { id: "security", label: tc.tabSecurity, icon: ShieldCheck },
    { id: "themes",   label: tc.tabThemes,   icon: Palette },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-5">
        <h1 className="font-display text-2xl font-medium text-[var(--brand)]">{tp.nav.config}</h1>
        <p className="text-[12px] text-[#97A1A0] dark:text-[#728098]">{tc.subtitle}</p>
      </div>

      <div className="mb-6 inline-flex flex-wrap gap-1 rounded-xl border border-[#E6DDCB] dark:border-[#22304d] bg-white dark:bg-[#111a2e] p-1">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            aria-current={tab === id ? "page" : undefined}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-[13px] font-bold transition ${
              tab === id
                ? "bg-[var(--brand)] text-white shadow-sm"
                : "text-[var(--brand)] dark:text-[#9fb0cc] hover:bg-[#F0F3FA] dark:hover:bg-[#17233d]"
            }`}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      {tab === "users" && (
        <section>
          <div className="mb-4">
            <h2 className="text-base font-bold text-[var(--brand)]">{tc.tabUsers}</h2>
            <p className="text-[11px] text-[#97A1A0] dark:text-[#728098]">{tc.usersDesc}</p>
          </div>
          <UsersPanel projects={projects} contacts={contacts} />
        </section>
      )}

      {tab === "security" && (
        <section>
          <div className="mb-4">
            <h2 className="text-base font-bold text-[var(--brand)]">{tp.dashboard.security}</h2>
            <p className="text-[11px] text-[#97A1A0] dark:text-[#728098]">{tp.dashboard.securityDesc}</p>
          </div>
          <AdminSettings />
        </section>
      )}

      {tab === "themes" && <ThemesTab />}
    </div>
  );
}

function ThemesTab() {
  const { t } = useLanguage();
  const tc = t.panel.config;
  const { accent, dark, setAccent, toggleDark } = useTheme();

  return (
    <section className="max-w-xl">
      <div className="mb-4">
        <h2 className="text-base font-bold text-[var(--brand)]">{tc.themesTitle}</h2>
        <p className="text-[11px] text-[#97A1A0] dark:text-[#728098]">{tc.themesDesc}</p>
      </div>

      <div className="rounded-2xl border border-[#E6DDCB] dark:border-[#22304d] bg-white dark:bg-[#111a2e] p-5">
        <button
          onClick={toggleDark}
          className="flex w-full items-center justify-between rounded-xl border border-[#E6DDCB] dark:border-[#22304d] px-4 py-3 text-sm font-bold text-[var(--brand)] dark:text-[#e8edf7] transition hover:bg-[#F0F3FA] dark:hover:bg-[#17233d]"
        >
          <span className="flex items-center gap-2">
            {dark ? <Moon size={16} /> : <Sun size={16} />}
            {dark ? tc.modeDark : tc.modeLight}
          </span>
          <span className={`relative h-6 w-11 rounded-full transition ${dark ? "bg-[var(--accent)]" : "bg-[#D7CBB3]"}`}>
            <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${dark ? "left-[22px]" : "left-0.5"}`} />
          </span>
        </button>

        <div className="mb-2 mt-5 text-[10px] font-bold uppercase tracking-[0.14em] text-[#97A1A0] dark:text-[#728098]">
          {tc.colorTheme}
        </div>
        <div className="grid grid-cols-5 gap-2.5">
          {ACCENTS.map(a => (
            <button
              key={a.id}
              onClick={() => setAccent(a.id)}
              title={a.label}
              aria-label={a.label}
              aria-pressed={accent === a.id}
              className={`h-12 rounded-xl border-2 transition ${
                accent === a.id
                  ? "border-[var(--brand)] dark:border-[#e8edf7]"
                  : "border-transparent hover:border-[#D5DEEF] dark:hover:border-[#22304d]"
              }`}
              style={{ background: a.dab }}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
