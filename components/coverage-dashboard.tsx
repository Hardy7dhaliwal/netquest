"use client";

import {
  ENCOR_DOMAINS,
  ENCOR_MISSION_ARCS,
  ENCOR_OBJECTIVE_COUNT,
  getCoverageByDomain,
  getWeightedCoverage,
} from "@/lib/encor-catalog";
import { bandLabel, getMasterySummary, objectiveScore, type MasteryMap } from "@/lib/mastery";
import { getObjectiveStatus, type CurriculumStatus } from "@/lib/curriculum";

/**
 * Curriculum coverage dashboard: per-domain progress bars against the 47 ENCOR
 * v1.2 blueprint objectives, counting objectives with a playable mission arc.
 * When a mastery map is provided, each objective also shows its mastery band.
 */
export default function CoverageDashboard({ mastery }: { mastery?: MasteryMap }) {
  const coverage = getCoverageByDomain();
  const totalCovered = coverage.reduce((sum, entry) => sum + entry.coveredObjectives.length, 0);
  const overallPct = Math.round((totalCovered / ENCOR_OBJECTIVE_COUNT) * 100);
  const weighted = Math.round(getWeightedCoverage());
  const remaining = ENCOR_OBJECTIVE_COUNT - totalCovered;
  const allObjectives = ENCOR_DOMAINS.flatMap((domain) => domain.objectives);
  const independentCount = mastery ? allObjectives.filter((objective) => objectiveScore(mastery, objective.id) >= 85).length : 0;
  const weakCount = mastery ? allObjectives.filter((objective) => objectiveScore(mastery, objective.id) >= 25 && objectiveScore(mastery, objective.id) < 70).length : 0;
  const summary = mastery ? getMasterySummary(mastery) : null;

  const plannedByDomain = new Map<string, string[]>();
  for (const arc of ENCOR_MISSION_ARCS) {
    if (arc.status !== "planned") continue;
    for (const domainId of arc.domains) {
      plannedByDomain.set(domainId, [...(plannedByDomain.get(domainId) ?? []), arc.title]);
    }
  }
  const plannedArcs = [...new Set([...plannedByDomain.values()].flat())];

  const STATUS_STYLES: Record<CurriculumStatus, string> = {
    verified: "border-emerald-300/40 bg-emerald-300/10 text-emerald-200",
    complete: "border-cyan-300/40 bg-cyan-300/10 text-cyan-200",
    partial: "border-amber-300/40 bg-amber-300/10 text-amber-200",
    planned: "border-slate-700 bg-slate-800/60 text-slate-400",
  };

  return (
    <section className="mt-10">
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-xs font-bold uppercase tracking-[0.25em] text-cyan-300">Exam coverage</p>
        <span className="h-px flex-1 bg-slate-800" />
        <span className="text-xs font-semibold text-slate-400">
          {totalCovered}/{ENCOR_OBJECTIVE_COUNT} objectives · {weighted}% of exam weight
        </span>
      </div>

      <div className="mt-4 rounded-xl border border-slate-800 bg-slate-900/60 p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="font-bold">ENCOR v1.2 blueprint</p>
            <p className="mt-1 text-sm text-slate-400">
              Every objective has a playable mission; status is evidence-based — verified means a complete teaching plan, an 8+ question bank, and a deterministic engine test.
            </p>
          </div>
          <span className="shrink-0 text-3xl font-black tabular-nums text-cyan-200">{overallPct}%</span>
        </div>
        <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-800">
          <div className="h-full rounded-full bg-cyan-300 transition-all" style={{ width: `${overallPct}%` }} />
        </div>
        {mastery && (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            <span className="font-semibold text-slate-400">Exam-readiness:</span>
            <span className="rounded-full border border-emerald-300/30 bg-emerald-300/10 px-2.5 py-0.5 font-bold text-emerald-200">{independentCount} at Independent</span>
            {weakCount > 0 ? (
              <span className="rounded-full border border-amber-300/30 bg-amber-300/10 px-2.5 py-0.5 font-bold text-amber-200">{weakCount} below Guided</span>
            ) : (
              <span className="rounded-full border border-cyan-300/30 bg-cyan-300/10 px-2.5 py-0.5 font-bold text-cyan-200">nothing below Guided</span>
            )}
          </div>
        )}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {coverage.map(({ domain, coveredObjectives }) => {
          const covered = coveredObjectives.length;
          const total = domain.objectives.length;
          const pct = Math.round((covered / total) * 100);
          const planned = plannedByDomain.get(domain.id) ?? [];
          const domainMastery = summary?.find((entry) => entry.domain.id === domain.id);
          return (
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5" key={domain.id}>                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-bold">{domain.title}</p>
                    <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">{domain.weight}% of exam</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {domainMastery && (
                      <span className="rounded-full border border-slate-700 px-2.5 py-1 text-[10px] font-bold tabular-nums text-slate-300" title="Average mastery across the domain's objectives">
                        {domainMastery.average}% mastery
                      </span>
                    )}
                    <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold tabular-nums ${covered > 0 ? "border-cyan-300/30 bg-cyan-300/10 text-cyan-200" : "border-slate-700 text-slate-500"}`}>
                      {covered}/{total} covered
                    </span>
                  </div>
                </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800">
                <div className={`h-full rounded-full transition-all ${covered > 0 ? "bg-cyan-300" : "bg-slate-700"}`} style={{ width: `${pct}%` }} />
              </div>

              {covered > 0 ? (
                <ul className="mt-4 space-y-2">
                  {coveredObjectives.map((objective) => {
                    const score = mastery ? objectiveScore(mastery, objective.id) : null;
                    const status = getObjectiveStatus(objective.id);
                    const chipColor =
                      score === null
                        ? ""
                        : score >= 85
                          ? "border-emerald-300/40 bg-emerald-300/10 text-emerald-200"
                          : score >= 70
                            ? "border-cyan-300/40 bg-cyan-300/10 text-cyan-200"
                            : score >= 50
                              ? "border-amber-300/40 bg-amber-300/10 text-amber-200"
                              : "border-slate-700 bg-slate-800/60 text-slate-400";
                    return (
                      <li className="flex items-start gap-2 text-xs leading-5" key={objective.id}>
                        <span className={`mt-0.5 shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold ${STATUS_STYLES[status]}`} title={`Curriculum: ${status}`}>
                          {status === "verified" ? "✓ verified" : status}
                        </span>
                        <span className="min-w-0 flex-1">
                          <code className="font-mono font-semibold text-cyan-200">{objective.id}</code>
                          <span className="ml-1.5 text-slate-400">{objective.label}</span>
                        </span>
                        {score !== null && score > 0 && (
                          <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold tabular-nums ${chipColor}`} title={bandLabel(score)}>
                            {bandLabel(score)}
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="mt-4 rounded-lg border border-dashed border-slate-700 px-3 py-2.5 text-xs leading-5 text-slate-600">
                  No playable missions yet{planned.length > 0 ? ` — planned: ${planned.join(", ")}.` : "."}
                </p>
              )}
            </div>
          );
        })}
      </div>

      <p className="mt-4 text-xs leading-5 text-slate-600">
        Coverage counts objectives taught by a playable mission arc. Remaining objectives are mapped to planned arcs: {plannedArcs.join(", ")}.
      </p>
    </section>
  );
}
