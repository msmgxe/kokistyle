import { NextRequest, NextResponse } from "next/server";
import webpush from "web-push";
import { getSupabaseAdmin } from "@/src/lib/supabase-admin";

export const maxDuration = 60;

const FROM_MINUTES: Record<string, number> = { "2h": 120, "1d": 1440, "2d": 2880, "1w": 10080 };
const TYPE_EMOJI: Record<string, string> = { cita: "📅", task: "✅", reunion: "🤝" };

/** Minutos "epoch" del reloj de Florida — mismo marco de referencia que event_date+event_time */
function nowFloridaMinutes(): number {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date());
  const get = (t: string) => parts.find(p => p.type === t)?.value ?? "00";
  return Date.parse(`${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}:00Z`) / 60000;
}

interface AgendaRow {
  id: string;
  event_type: string;
  title: string;
  event_date: string;
  event_time: string;
  remind_from: string;
  repeat_every: string;
  done: boolean;
  last_notified_at: string | null;
}

export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  const publicKey  = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) {
    return NextResponse.json({ ok: false, error: "VAPID keys not configured" }, { status: 500 });
  }
  webpush.setVapidDetails("mailto:luxaris25@yahoo.com", publicKey, privateKey);

  const admin = getSupabaseAdmin();
  const [{ data: events }, { data: subs }] = await Promise.all([
    admin.from("agenda_events").select("*").eq("done", false),
    admin.from("push_subscriptions").select("id, endpoint, subscription"),
  ]);
  if (!subs?.length || !events?.length) {
    return NextResponse.json({ ok: true, sent: 0, reason: "nothing to do" });
  }

  const nowFl = nowFloridaMinutes();
  const nowReal = Date.now();
  const due: AgendaRow[] = [];

  for (const ev of events as AgendaRow[]) {
    const eventMin = Date.parse(`${ev.event_date}T${ev.event_time}:00Z`) / 60000;
    if (Number.isNaN(eventMin)) continue;
    const minutesUntil = eventMin - nowFl;
    if (minutesUntil < 0) continue;
    if (minutesUntil > (FROM_MINUTES[ev.remind_from] ?? 1440)) continue;

    if (ev.last_notified_at) {
      if (ev.repeat_every === "once") continue;
      // "daily" (y valores legacy): avisar en cada corrida programada del cron,
      // con margen de 60 min para no duplicar si el cron reintenta
      const sinceLast = (nowReal - new Date(ev.last_notified_at).getTime()) / 60000;
      if (sinceLast < 60) continue;
    }
    due.push(ev);
  }

  let sent = 0;
  const deadSubIds: string[] = [];

  for (const ev of due) {
    const payload = JSON.stringify({
      title: `⏰ ${TYPE_EMOJI[ev.event_type] ?? "📅"} ${ev.title}`,
      body: `${ev.event_date} · ${ev.event_time}${ev.repeat_every !== "once" ? " · se repetirá hasta el día del evento" : ""}`,
      url: "/proyectos/agenda",
      tag: `agenda-${ev.id}`,
    });
    for (const sub of subs) {
      try {
        await webpush.sendNotification(sub.subscription as webpush.PushSubscription, payload);
        sent++;
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) deadSubIds.push(sub.id);
      }
    }
    await admin.from("agenda_events").update({ last_notified_at: new Date().toISOString() }).eq("id", ev.id);
  }

  if (deadSubIds.length) {
    await admin.from("push_subscriptions").delete().in("id", [...new Set(deadSubIds)]);
  }

  console.log(JSON.stringify({ route: "/api/agenda/remind", due: due.length, sent, removedSubs: deadSubIds.length }));
  return NextResponse.json({ ok: true, due: due.length, sent, removedSubs: deadSubIds.length });
}
