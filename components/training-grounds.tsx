"use client";

import { useState } from "react";
import {
  BOSS_QUESTIONS,
  BOSS_TIME_PER_QUESTION,
  BOSS_XP,
  DAILY_QUESTIONS,
  DAILY_TIME_PER_QUESTION,
  DAILY_XP,
  VICTORY_ACCURACY,
  getBossBattle,
  getBossFights,
  getDailyChallenge,
} from "@/lib/boss";
import { useProgressStore } from "@/lib/progress-store";
import Gauntlet, { type GauntletResult } from "./gauntlet";

type Active = { mode: "daily" } | { mode: "boss"; arcId: string; seed: string };

/** Daily challenge + boss battles — the under-pressure practice modes. */
export default function TrainingGrounds() {
  const [active, setActive] = useState<Active | null>(null);

  const daily = useProgressStore((s) => s.daily);
  const bossRecords = useProgressStore((s) => s.bossRecords);
  const claimDaily = useProgressStore((s) => s.claimDaily);
  const recordBossResult = useProgressStore((s) => s.recordBossResult);

  const challenge = getDailyChallenge();
  const claimedToday = daily?.date === challenge.date && daily.done;
  const fights = getBossFights();
  const bestPercent = Math.round(bossRecords.bestAccuracy * 100);

  const bossFight = active?.mode === "boss" ? fights.find((f) => f.arcId === active.arcId) : undefined;

  function handleComplete(result: GauntletResult) {
    if (!active) return;
    if (active.mode === "daily") {
      // Claim only — the gauntlet stays open so the result screen renders;
      // its Close button dismisses it (closing the modal would skip the result).
      claimDaily(challenge.arcId);
    } else {
      recordBossResult(active.arcId, result.victory, result.accuracy);
    }
  }

  return (
    <section className="mt-6 rounded-xl border border-slate-800 bg-slate-900/60 p-5 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">Training grounds</p>
          <p className="mt-1 text-sm text-slate-400">
            Answer under the clock. A battle won at ≥{Math.round(VICTORY_ACCURACY * 100)}% accuracy pushes that arc to
            the <span className="font-bold text-rose-300">Under Pressure</span> mastery band.
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs font-bold text-slate-400">
          <span>⚔ {bossRecords.battles} battle{bossRecords.battles === 1 ? "" : "s"}</span>
          <span className="text-emerald-300">{bossRecords.victories} win{bossRecords.victories === 1 ? "" : "s"}</span>
          <span>best {bestPercent}%</span>
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_2fr]">
        {/* Daily challenge */}
        <div
          className={`flex flex-col justify-between rounded-xl border p-5 ${claimedToday ? "border-emerald-300/30 bg-emerald-300/5" : "border-cyan-300/20 bg-cyan-300/5"}`}
        >
          <div>
            <p className={`text-xs font-bold uppercase tracking-[0.2em] ${claimedToday ? "text-emerald-300" : "text-cyan-300"}`}>
              Daily challenge
            </p>
            <p className="mt-2 font-bold">{claimedToday ? "Claimed — see you tomorrow!" : challenge.arcTitle}</p>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              {claimedToday
                ? `+${DAILY_XP} XP banked and a streak day kept. A fresh ${DAILY_QUESTIONS}-question warm-up drops at midnight.`
                : `${DAILY_QUESTIONS} questions from ${challenge.arcTitle}, ${DAILY_TIME_PER_QUESTION} seconds each — a new challenge every calendar day.`}
            </p>
          </div>
          <button
            className={`mt-4 rounded-lg px-4 py-2.5 text-sm font-black text-slate-950 transition hover:-translate-y-0.5 ${claimedToday ? "bg-slate-700 text-slate-200 hover:bg-slate-600" : "bg-cyan-300 hover:bg-cyan-200"}`}
            disabled={claimedToday}
            onClick={() => setActive({ mode: "daily" })}
            type="button"
          >
            {claimedToday ? "Done for today" : `Start · +${DAILY_XP} XP & a streak day`}
          </button>
        </div>

        {/* Boss fights */}
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Boss battles · one per arc</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {fights.map((fight) => (
              <button
                className="group rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-left transition hover:border-rose-300/40 hover:bg-rose-300/5"
                key={fight.arcId}
                onClick={() => setActive({ mode: "boss", arcId: fight.arcId, seed: String(Date.now()) })}
                type="button"
              >
                <p className="text-sm font-bold text-slate-100 transition group-hover:text-rose-200">{fight.title}</p>
                <p className="mt-1 text-[11px] text-slate-500">
                  {fight.questionCount} question{fight.questionCount === 1 ? "" : "s"} · {BOSS_TIME_PER_QUESTION}s each ·{" "}
                  <span className="font-bold text-rose-300/80">+{BOSS_XP.victory} XP win</span>
                </p>
              </button>
            ))}
          </div>
        </div>
      </div>

      {active?.mode === "daily" && (
        <Gauntlet
          accent={{ text: "text-cyan-300", bg: "bg-cyan-300", border: "border-cyan-300/40" }}
          defeatLabel="Challenge cleared"
          onClose={() => setActive(null)}
          onComplete={handleComplete}
          questions={challenge.questions}
          tagline={`${challenge.arcTitle} · keep the streak alive`}
          timePerQuestion={DAILY_TIME_PER_QUESTION}
          title="Daily challenge"
          victoryLabel="Challenge cleared"
          xpDefeat={DAILY_XP}
          xpVictory={DAILY_XP}
        />
      )}

      {active?.mode === "boss" && bossFight && (
        <Gauntlet
          accent={{ text: "text-rose-300", bg: "bg-rose-300", border: "border-rose-300/40" }}
          defeatLabel="The boss holds — for now"
          onClose={() => setActive(null)}
          onComplete={handleComplete}
          questions={getBossBattle(bossFight.arcId, active.seed)}
          tagline={`${bossFight.title} · ${BOSS_QUESTIONS} questions, ${BOSS_TIME_PER_QUESTION} seconds each`}
          timePerQuestion={BOSS_TIME_PER_QUESTION}
          title="Boss battle"
          victoryLabel="Boss defeated — Under Pressure mastery earned"
          xpDefeat={BOSS_XP.defeat}
          xpVictory={BOSS_XP.victory}
        />
      )}
    </section>
  );
}
