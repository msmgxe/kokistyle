"use client";

// Calendario Gantt estilo Excel compartido por el Gantt G y el Gantt de cada proyecto:
// una columna real por día (o semana), cabecera Mes / Día-semana / Nº día, fin de
// semana coloreado (sáb azul · dom naranja) y línea vertical de "hoy".

export type GanttUnit = "day" | "week";

export interface GanttScale {
  unit: GanttUnit;
  col: number;
  start: string;
  totalDays: number;
  totalCols: number;
  laneWidth: number;
}

const DAY_MS = 86400000;

export const WEEKEND_SAT = "#9DC3E6";
export const WEEKEND_SUN = "#F4B183";
const SAT_SOFT = "#DCEBF7";
const SUN_SOFT = "#FBE5D3";
const GRID_LINE = "#EFE9DD";

function toIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function parseIso(iso: string): Date {
  return new Date(iso + "T00:00:00");
}

function diffDays(fromIso: string, toIsoStr: string): number {
  return Math.round((parseIso(toIsoStr).getTime() - parseIso(fromIso).getTime()) / DAY_MS);
}

function snapToMonday(iso: string): string {
  const d = parseIso(iso);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return toIso(d);
}

export function todayIsoLocal(): string {
  return toIso(new Date());
}

export function isoOfDate(d: Date): string {
  return toIso(d);
}

export function buildGanttScale(minIso: string, maxIso: string, unit: GanttUnit): GanttScale {
  const start = snapToMonday(minIso);
  const rawDays = Math.max(diffDays(start, maxIso) + 1, 14);
  const totalDays = Math.ceil(rawDays / 7) * 7;
  const col = unit === "day" ? 30 : 46;
  const totalCols = unit === "day" ? totalDays : totalDays / 7;
  return { unit, col, start, totalDays, totalCols, laneWidth: totalCols * col };
}

export function ganttX(scale: GanttScale, iso: string): number {
  const dayIdx = Math.min(Math.max(diffDays(scale.start, iso), 0), scale.totalDays);
  return scale.unit === "day" ? dayIdx * scale.col : (dayIdx / 7) * scale.col;
}

// end inclusivo — la barra cubre la celda del último día
export function ganttBar(scale: GanttScale, startIso: string, endIso: string): { left: number; width: number } {
  const left = ganttX(scale, startIso);
  const endDate = parseIso(endIso >= startIso ? endIso : startIso);
  endDate.setDate(endDate.getDate() + 1);
  const right = ganttX(scale, toIso(endDate));
  return { left, width: Math.max(right - left, 8) };
}

// Fondo del carril: rayas de fin de semana (solo escala día) + línea de grilla por columna
export function laneBg(scale: GanttScale): React.CSSProperties {
  const c = scale.col;
  const grid = `repeating-linear-gradient(90deg, transparent 0, transparent ${c - 1}px, ${GRID_LINE} ${c - 1}px, ${GRID_LINE} ${c}px)`;
  if (scale.unit === "week") return { backgroundImage: grid };
  const weekend = `repeating-linear-gradient(90deg, transparent 0, transparent ${5 * c}px, ${SAT_SOFT} ${5 * c}px, ${SAT_SOFT} ${6 * c}px, ${SUN_SOFT} ${6 * c}px, ${SUN_SOFT} ${7 * c}px)`;
  return { backgroundImage: `${grid}, ${weekend}` };
}

export function TodayLine({ scale }: { scale: GanttScale }) {
  const today = todayIsoLocal();
  if (diffDays(scale.start, today) < 0 || diffDays(scale.start, today) >= scale.totalDays) return null;
  return (
    <span
      className="pointer-events-none absolute bottom-0 top-0 z-[5] w-[2px] bg-[#B0492F]/70"
      style={{ left: ganttX(scale, today) }}
      aria-hidden
    />
  );
}

const WD_EN = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"];
const WD_ES = ["LU", "MA", "MI", "JU", "VI", "SA", "DO"];
const MO_EN = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const MO_ES = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];

export function GanttHeader({
  scale, EN, leftWidth, leftHeader,
}: {
  scale: GanttScale;
  EN: boolean;
  leftWidth: number;
  leftHeader: React.ReactNode;
}) {
  const WD = EN ? WD_EN : WD_ES;
  const MO = EN ? MO_EN : MO_ES;

  const days: { iso: string; d: Date }[] = [];
  for (let i = 0; i < scale.totalDays; i++) {
    const d = parseIso(scale.start);
    d.setDate(d.getDate() + i);
    days.push({ iso: toIso(d), d });
  }

  // Banda de meses: segmentos contiguos con su ancho real en px
  const monthSegs: { label: string; days: number }[] = [];
  for (const { d } of days) {
    const label = `${MO[d.getMonth()]} ${d.getFullYear()}`;
    const last = monthSegs[monthSegs.length - 1];
    if (last && last.label === label) last.days++;
    else monthSegs.push({ label, days: 1 });
  }
  const pxPerDay = scale.laneWidth / scale.totalDays;

  const weeks = days.filter((_, i) => i % 7 === 0);

  return (
    <div className="flex" style={{ width: leftWidth + scale.laneWidth }}>
      <div
        className="sticky left-0 z-20 shrink-0 self-stretch bg-[var(--brand)]"
        style={{ width: leftWidth }}
      >
        {leftHeader}
      </div>
      <div style={{ width: scale.laneWidth }} className="shrink-0">
        <div className="flex h-6 bg-[var(--accent)]">
          {monthSegs.map((m, i) => (
            <span
              key={`${m.label}-${i}`}
              className="flex items-center justify-center overflow-hidden whitespace-nowrap border-r border-white/15 text-[9.5px] font-bold uppercase tracking-widest text-white"
              style={{ width: m.days * pxPerDay }}
            >
              {m.label}
            </span>
          ))}
        </div>
        {scale.unit === "day" ? (
          <>
            <div className="flex h-5">
              {days.map(({ iso, d }) => {
                const wd = d.getDay();
                return (
                  <span
                    key={iso}
                    className={`flex items-center justify-center text-[8px] font-extrabold ${
                      wd === 6 ? "bg-[#9DC3E6] text-[var(--brand)]" : wd === 0 ? "bg-[#F4B183] text-[#7A3C12]" : "bg-[#EDF3FB] text-[var(--accent)]"
                    }`}
                    style={{ width: scale.col }}
                  >
                    {WD[(wd + 6) % 7]}
                  </span>
                );
              })}
            </div>
            <div className="flex h-5 border-b border-[#E6DDCB] bg-white">
              {days.map(({ iso, d }) => {
                const wd = d.getDay();
                return (
                  <span
                    key={iso}
                    className={`flex items-center justify-center border-r border-[#F0EBE0] font-mono text-[9px] ${
                      wd === 6 ? "bg-[#DCEBF7] font-bold text-[var(--brand)]" : wd === 0 ? "bg-[#FBE5D3] font-bold text-[#7A3C12]" : "text-[#5C6A6E]"
                    }`}
                    style={{ width: scale.col }}
                  >
                    {d.getDate()}
                  </span>
                );
              })}
            </div>
          </>
        ) : (
          <div className="flex h-6 border-b border-[#E6DDCB] bg-[#EDF3FB]">
            {weeks.map(({ iso, d }, i) => (
              <span
                key={iso}
                className="flex items-center justify-center gap-1 border-r border-[#D5DEEF] text-[8.5px] font-bold text-[var(--accent)]"
                style={{ width: scale.col }}
              >
                W{i + 1}
                <span className="font-mono font-normal text-[#5C6A6E]">{d.getDate()}/{d.getMonth() + 1}</span>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
