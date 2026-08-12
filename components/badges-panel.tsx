"use client";

import { BADGE_XP, type BadgeStatus } from "@/lib/badges";

/** Dashboard badge shelf: earned badges in full color, locked ones with progress. */
export default function BadgesPanel({ statuses }: { statuses: BadgeStatus[] }) {
  const earnedCount = statuses.filter((entry) => entry.earned).length;
  const sorted = [...statuses].sort((a, b) => Number(b.earned) - Number(a.earned) || b.progress - a.progress);

  return (
    <section className="mt-6 rounded-xl border border-slate-800 bg-slate-900/60 p-5 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">Badges</p>
          <p className="mt-1 text-sm text-slate-400">
            {earnedCount} of {statuses.length} earned · +{BADGE_XP} XP each
          </p>
        </div>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {sorted.map(({ badge, progress, earned }) => (
          <div
            className={`rounded-xl border p-4 transition ${earned ? "border-amber-300/30 bg-amber-300/5 hover:border-amber-300/50" : "border-slate-800 bg-slate-950/60"}`}
            key={badge.id}
          >
            <div className="flex items-start gap-3">
              <span className={`text-2xl leading-none ${earned ? "" : "opacity-40 grayscale"}`}>{badge.icon}</span>
              <div className="min-w-0">
                <p className={`text-sm font-bold ${earned ? "text-slate-100" : "text-slate-400"}`}>{badge.title}</p>
                <p className="mt-1 text-[11px] leading-4 text-slate-500">{badge.description}</p>
              </div>
            </div>
            {earned ? (
              <p className="mt-3 text-[11px] font-black uppercase tracking-[0.15em] text-emerald-300">✓ Earned</p>
            ) : (
              <div className="mt-3">
                <div className="h-1 overflow-hidden rounded-full bg-slate-800">
                  <div className="h-full rounded-full bg-cyan-300/70" style={{ width: `${(progress / badge.target) * 100}%` }} />
                </div>
                <p className="mt-1.5 text-[11px] text-slate-500">
                  {progress}/{badge.target} · +{BADGE_XP} XP
                </p>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
