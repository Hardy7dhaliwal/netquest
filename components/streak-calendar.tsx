"use client";

import { Fragment } from "react";
import { dateKey } from "@/lib/boss";
import { addDays, currentRun, longestRun } from "@/lib/streak";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
/** Nine weeks covers the last two months plus the current week. */
const WEEKS = 9;

function mondayOf(date: Date): Date {
  const offset = (date.getDay() + 6) % 7; // Mon = 0 … Sun = 6
  return addDays(date, -offset);
}

/** Rolling daily-challenge chain: one cell per day, claimed days lit. */
export default function StreakCalendar({ claimedDates }: { claimedDates: string[] }) {
  const today = new Date();
  const todayKey = dateKey(today);
  const claimed = new Set(claimedDates);
  const current = currentRun(claimedDates, today);
  const best = longestRun(claimedDates);

  const weeks = Array.from({ length: WEEKS }, (_, weekIndex) => {
    const weekStart = addDays(mondayOf(today), (weekIndex - (WEEKS - 1)) * 7);
    const days = Array.from({ length: 7 }, (_, dayIndex) => {
      const date = addDays(weekStart, dayIndex);
      const key = dateKey(date);
      return {
        key,
        claimed: claimed.has(key),
        isToday: key === todayKey,
        isFuture: date.getTime() > today.getTime(),
      };
    });
    return { weekStart, days };
  });

  return (
    <div className="mt-6 rounded-xl border border-slate-800 bg-slate-950/60 p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">Streak calendar</p>
          <p className="mt-1 text-sm text-slate-400">Claim the daily challenge each day to light up the chain.</p>
        </div>
        <div className="flex items-center gap-3 text-xs font-bold">
          <span className={current > 0 ? "text-emerald-300" : "text-slate-500"}>
            🔥 {current} day{current === 1 ? "" : "s"}
          </span>
          <span className="text-slate-500">best {best} day{best === 1 ? "" : "s"}</span>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto">
        <div className="grid w-max grid-cols-[auto_repeat(7,1rem)] items-center gap-x-1.5 gap-y-1.5">
          <span />
          {WEEKDAYS.map((name) => (
            <span className="text-center text-[10px] font-bold uppercase tracking-wider text-slate-600" key={name}>
              {name}
            </span>
          ))}
          {weeks.map(({ weekStart, days }, weekIndex) => (
            <Fragment key={weekIndex}>
              <span className="pr-1 text-right text-[10px] font-semibold tabular-nums text-slate-500">
                {weekStart.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
              </span>
              {days.map((day) => (
                <span
                  aria-label={day.claimed ? `${day.key}, claimed` : day.isFuture ? day.key : `${day.key}, missed`}
                  className={`size-4 rounded-[4px] transition-transform hover:scale-125 ${
                    day.claimed
                      ? "bg-emerald-300 shadow-[0_0_8px_rgba(110,231,183,0.4)]"
                      : day.isFuture
                        ? "bg-slate-800/50"
                        : "border border-slate-700/60 bg-slate-800/30"
                  } ${day.isToday ? "ring-2 ring-cyan-300/80 ring-offset-1 ring-offset-slate-950" : ""}`}
                  key={day.key}
                  title={
                    day.claimed
                      ? `${day.key} — daily challenge claimed`
                      : day.isFuture
                        ? day.key
                        : `${day.key} — missed`
                  }
                />
              ))}
            </Fragment>
          ))}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-4 text-[10px] text-slate-500">
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded-[3px] bg-emerald-300" /> claimed
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded-[3px] border border-slate-700/60 bg-slate-800/30" /> missed
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded-[3px] bg-slate-800/50" /> future
        </span>
        {current > 0 && <span className="ml-auto font-bold text-emerald-300/90">Don&apos;t break the chain.</span>}
      </div>
    </div>
  );
}
