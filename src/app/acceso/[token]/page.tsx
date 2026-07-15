"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/src/context/AuthContext";
import { branding } from "@/src/config/branding";

export default function AccesoTokenPage() {
  const { token } = useParams<{ token: string }>();
  const { loginWithToken } = useAuth();
  const router = useRouter();
  const [failed, setFailed] = useState(false);
  const attempted = useRef(false);

  useEffect(() => {
    if (!token || attempted.current) return;
    attempted.current = true;
    // ?to=hoy → el shortcut aterriza en el checklist del día en vez del dashboard
    const to = new URLSearchParams(window.location.search).get("to");
    const dest = to === "hoy" ? "/proyectos/hoy" : "/proyectos";
    loginWithToken(String(token)).then(ok => {
      if (ok) router.replace(dest);
      else setFailed(true);
    });
  }, [token, loginWithToken, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F7F3EB] dark:bg-[#0b1220] px-6">
      <div className="w-full max-w-sm rounded-2xl border border-[#E6DDCB] dark:border-[#22304d] bg-white dark:bg-[#111a2e] p-8 text-center">
        <span className="mx-auto mb-4 grid size-12 place-items-center rounded-xl bg-[#16323D] text-base font-bold text-white">
          {branding.initials}
        </span>
        <p className="text-sm font-bold text-[#16323D] dark:text-[#e8edf7]">{branding.companyShort}</p>
        {failed ? (
          <>
            <p className="mt-3 text-sm font-semibold text-[#B0492F]">
              Enlace inválido, expirado o revocado.
            </p>
            <p className="mt-1 text-xs text-[#5C6A6E] dark:text-[#9fb0cc]">
              Invalid, expired or revoked link. Pide al administrador un enlace nuevo.
            </p>
          </>
        ) : (
          <p className="mt-3 animate-pulse text-sm font-semibold text-[#5C6A6E] dark:text-[#9fb0cc]">
            Verificando acceso…
          </p>
        )}
      </div>
    </div>
  );
}
