"use client";

import { getReadinessReportV2, type ReadinessConfidence } from "@/lib/readiness";
import type { SkillMap } from "@/lib/skills";
import type { MasteryMap } from "@/lib/mastery";

const CONFIDENCE_STYLES: Record<ReadinessConfidence, { ring: string; text: string; bar: string; label: string }> = {
  low: { ring: "border-rose-300/50 text-rose-300", text: "text-rose-300", bar: "bg-rose-300", label: "Low confidence" },
  medium: { ring: "border-amber-300/50 text-amber-300", text: "text-amber-300", bar: "bg-amber-300", label: "Medium confidence" },
  high: { ring: "border-emerald-300/50 text-emerald-300", text: "text-emerald-300", bar: "bg-emerald-300", label: "High confidence" },
};

const DIMENSION_STYLES: Record<string, string> = {
  blueprint: "bg-cyan-300",
  knowledge: "bg-violet-300",
  configuration: "bg-emerald-300",
  troubleshooting: "bg-amber-300",
  timed: "bg-rose-300",
};

/**
 * Multi-dimensional exam readiness (learn-and-pass phase). Replaces the single
 * percentage with: blueprint coverage, knowledge, configuration, troubleshooting,
 * and timed-exam scores; a confidence level; the weakest objectives; and an
 * explicit checklist of remaining requirements before "exam-ready" is claimed.
 */
export default function ReadinessReport({
  mastery,
  skills,
  examResults = {},
}: {
  mastery: MasteryMap;
  skills?: SkillMap;
  examResults?: Record<string, { pct: number; passed: boolean; at: number }>;
}) {
  const report = getReadinessReportV2(mastery, skills ?? {}, examResults);
  const confidence = CONFIDENCE_STYLES[report.confidence];
  const metCount = report.remaining.filter((requirement) => requirement.met).length;

  return (
    <section className="mt-6 rounded-xl border border-slate-800 bg-slate-900/60 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-8">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">Exam readiness</p>
          <div className="mt-4 flex items-center gap-5">
            <div className={`flex h-24 w-24 shrink-0 flex-col items-center justify-center rounded-full border-4 ${confidence.ring} bg-slate-950`}>
              <span className="text-2xl font-black">{report.examReady ? "✓" : metCount}/{report.remaining.length}</span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">met</span>
            </div>
            <div className="min-w-0">
              <p className={`text-xl font-black ${report.examReady ? "text-emerald-300" : confidence.text}`}>{report.examReady ? "Exam-ready" : confidence.label}</p>
              <p className="mt-1 max-w-md text-sm leading-6 text-slate-400">{report.verdictCopy}</p>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {report.dimensions.map((dimension) => (
              <div key={dimension.key}>
                <div className="flex items-baseline justify-between gap-3 text-xs">
                  <span className="truncate font-bold text-slate-300">{dimension.label}</span>
                  <span className="shrink-0 tabular-nums text-slate-500">{dimension.score}%</span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-800">
                  <div className={`h-full rounded-full ${DIMENSION_STYLES[dimension.key] ?? "bg-slate-600"}`} style={{ width: `${dimension.score}%` }} />
                </div>
                <p className="mt-1 text-[10px] leading-4 text-slate-600">{dimension.copy}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {report.weakest.length > 0 && (
        <p className="mt-5 border-t border-slate-800 pt-4 text-sm text-slate-400">
          Weakest: <span className="text-amber-200">{report.weakest.map((objective) => `${objective.objectiveId} ${objective.label}`).join(" · ")}</span>
        </p>
      )}

      <div className="mt-5 border-t border-slate-800 pt-4">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Remaining requirements before exam-ready</p>
        <ul className="mt-3 space-y-2">
          {report.remaining.map((requirement) => (
            <li className="flex items-start gap-3 rounded-lg border border-slate-800 bg-slate-950/50 px-4 py-3" key={requirement.id}>
              <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold ${requirement.met ? "border-emerald-300 bg-emerald-300 text-slate-950" : "border-slate-600 text-slate-500"}`}>
                {requirement.met ? "✓" : "•"}
              </span>
              <div className="min-w-0">
                <p className={`text-sm font-bold ${requirement.met ? "text-emerald-200" : "text-slate-200"}`}>{requirement.label}</p>
                {!requirement.met && <p className="mt-0.5 text-xs leading-5 text-slate-500">{requirement.action}</p>}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
