"use client";

import { getExamReadiness, type ReadinessVerdict } from "@/lib/readiness";
import { getWeakObjectives, type MasteryMap } from "@/lib/mastery";

const VERDICT_STYLES: Record<ReadinessVerdict, { ring: string; text: string; bar: string }> = {
  ready: { ring: "border-emerald-300/50 text-emerald-300", text: "text-emerald-300", bar: "bg-emerald-300" },
  approaching: { ring: "border-cyan-300/50 text-cyan-300", text: "text-cyan-300", bar: "bg-cyan-300" },
  developing: { ring: "border-amber-300/50 text-amber-300", text: "text-amber-300", bar: "bg-amber-300" },
  starting: { ring: "border-rose-300/50 text-rose-300", text: "text-rose-300", bar: "bg-rose-300" },
};

const BAND_CHIPS: { key: keyof ReturnType<typeof getExamReadiness>["bands"]; label: string; className: string }[] = [
  { key: "independent", label: "Independent", className: "border-emerald-300/30 bg-emerald-300/10 text-emerald-200" },
  { key: "guided", label: "Guided", className: "border-cyan-300/30 bg-cyan-300/10 text-cyan-200" },
  { key: "recognized", label: "Recognized", className: "border-amber-300/30 bg-amber-300/10 text-amber-200" },
  { key: "introduced", label: "Introduced", className: "border-slate-600 bg-slate-800/60 text-slate-300" },
  { key: "unseen", label: "Unseen", className: "border-slate-700 bg-slate-900 text-slate-500" },
];

/** Exam-readiness report: one score per player, weighted by domain exam share. */
export default function ReadinessReport({ mastery }: { mastery: MasteryMap }) {
  const report = getExamReadiness(mastery);
  const style = VERDICT_STYLES[report.verdict];
  const focus = getWeakObjectives(mastery).slice(0, 4).map((objective) => objective.label);

  return (
    <section className="mt-6 rounded-xl border border-slate-800 bg-slate-900/60 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-8">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">Exam readiness</p>
          <div className="mt-4 flex items-center gap-5">
            <div className={`flex h-24 w-24 shrink-0 flex-col items-center justify-center rounded-full border-4 ${style.ring} bg-slate-950`}>
              <span className="text-2xl font-black">{report.readiness}%</span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">ready</span>
            </div>
            <div className="min-w-0">
              <p className={`text-xl font-black ${style.text}`}>{report.verdictLabel}</p>
              <p className="mt-1 max-w-md text-sm leading-6 text-slate-400">{report.verdictCopy}</p>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            {BAND_CHIPS.map((chip) => (
              <span className={`rounded-full border px-3 py-1 text-xs font-bold ${chip.className}`} key={chip.key}>
                {report.bands[chip.key]} {chip.label}
              </span>
            ))}
          </div>
        </div>
        <div className="w-full max-w-sm space-y-4">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">By domain · exam weight</p>
          {report.domains.map((entry) => (
            <div key={entry.domainId}>
              <div className="flex items-baseline justify-between gap-3 text-xs">
                <span className="truncate text-slate-300">{entry.title}</span>
                <span className="shrink-0 text-slate-500">
                  {entry.weight}% · {entry.average}%
                </span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-800">
                <div className={`h-full rounded-full ${style.bar}`} style={{ width: `${entry.average}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
      {focus.length > 0 && (
        <p className="mt-5 border-t border-slate-800 pt-4 text-sm text-slate-400">
          Focus next: <span className="text-amber-200">{focus.join(" · ")}</span>
        </p>
      )}
    </section>
  );
}
