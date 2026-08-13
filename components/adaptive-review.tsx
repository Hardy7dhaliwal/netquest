"use client";

import { Wordmark } from "@/components/wordmark";
import type { ReviewItem, ReviewLabItem, ReviewQuestionItem } from "@/lib/review";

/**
 * Adaptive review session — a spaced-repetition queue built from the player's
 * weakest due objectives (lib/review.ts). Question items are answered inline
 * with immediate feedback (each correct answer is recorded for +5 XP and an
 * SM-2-lite schedule stretch); lab items hand off to the labs panel for the
 * real inspect → diagnose → configure → verify loop and are acknowledged on
 * return.
 */
export default function AdaptiveReview({
  items,
  index,
  answers,
  onAnswer,
  onAdvance,
  onLaunchLab,
  onExit,
  onFinish,
}: {
  items: ReviewItem[];
  /** Position in the queue (lifted so lab handoffs don't reset progress). */
  index: number;
  /** itemId → chosen value, for feedback + the summary. */
  answers: Record<string, string>;
  /** Record one question result (schedule + skill + XP live in the store). */
  onAnswer: (item: ReviewQuestionItem, value: string) => void;
  onAdvance: () => void;
  onLaunchLab: (item: ReviewLabItem) => void;
  onExit: () => void;
  onFinish: () => void;
}) {
  const item = items[index];
  const done = !item;
  const questionItems = items.filter((i) => i.kind === "question") as ReviewQuestionItem[];
  const correctCount = questionItems.filter((i) => answers[i.id] === i.correct).length;

  function answer(value: string) {
    if (item?.kind !== "question" || answers[item.id]) return;
    onAnswer(item, value);
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800/80 px-5 py-4 sm:px-8">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-4">
          <div>
            <Wordmark onHome={onExit} track="Adaptive review" />
            <h1 className="mt-2 text-xl font-bold">Adaptive review</h1>
          </div>
          <button className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:border-slate-500 hover:text-white" onClick={onExit} type="button">
            Back to dashboard
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-3xl p-5 sm:p-8">
        {done ? (
          <div className="rounded-2xl border border-emerald-300/30 bg-slate-900 p-10 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-300 text-3xl text-slate-950">✓</div>
            <p className="mt-5 text-xs font-bold uppercase tracking-[0.25em] text-emerald-300">{items.length === 0 ? "All caught up" : "Review complete"}</p>
            <h2 className="mt-3 text-2xl font-black">{items.length === 0 ? "No weak objectives due right now." : "Weak spots revisited."}</h2>
            <p className="mt-3 text-sm leading-6 text-slate-400">
              {items.length === 0
                ? "New weak spots surface as you practice, or come back tomorrow when scheduled objectives are due again."
                : `You answered ${correctCount} of ${questionItems.length} questions correctly and earned ${correctCount * 5} XP. Missed objectives are rescheduled for sooner; correct ones stretch out.`}
            </p>
            {correctCount > 0 && <div className="mt-6 rounded-xl border border-emerald-300/20 bg-emerald-300/5 py-4 text-xl font-black text-emerald-200">+{correctCount * 5} XP</div>}
            <button className="mt-6 w-full rounded-lg bg-emerald-300 px-4 py-3 text-sm font-bold text-slate-950 transition hover:bg-emerald-200" onClick={onFinish} type="button">
              Back to dashboard
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-4">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">
                Item {index + 1} of {items.length} · {item.kind === "lab" ? "hands-on lab" : "question"}
              </p>
              <span className="rounded-full border border-slate-800 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">{item.domain} · weak spot</span>
            </div>

            {item.kind === "question" ? (
              <QuestionCard item={item} picked={answers[item.id]} onAnswer={answer} onNext={onAdvance} last={index === items.length - 1} />
            ) : (
              <LabCard item={item} onLaunch={() => onLaunchLab(item)} onSkip={onAdvance} last={index === items.length - 1} />
            )}

            <div className="mt-5 flex gap-1.5">
              {items.map((i, dotIndex) => (
                <span
                  className={`h-1.5 flex-1 rounded-full ${dotIndex < index ? "bg-emerald-300" : dotIndex === index ? "bg-cyan-300" : "bg-slate-800"}`}
                  key={i.id}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </main>
  );
}

function QuestionCard({
  item,
  picked,
  onAnswer,
  onNext,
  last,
}: {
  item: ReviewQuestionItem;
  picked?: string;
  onAnswer: (value: string) => void;
  onNext: () => void;
  last: boolean;
}) {
  const answered = picked !== undefined;
  return (
    <div className="mt-6 rounded-xl border border-slate-800 bg-slate-900/70 p-6">
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{item.objectiveId} · {item.objectiveLabel}</p>
      <h2 className="mt-2 text-lg font-bold leading-7">{item.prompt}</h2>

      <div aria-label={`Answer for ${item.questionId}`} className="mt-6 grid gap-3" role="group">
        {item.options.map((option) => {
          const isCorrect = option.value === item.correct;
          const isPicked = picked === option.value;
          let style = "border-slate-700 bg-slate-950/70 hover:border-cyan-300/50";
          if (answered) {
            if (isCorrect) style = "border-emerald-300/60 bg-emerald-300/10";
            else if (isPicked) style = "border-rose-300/60 bg-rose-300/10";
            else style = "border-slate-800 bg-slate-950/50 opacity-50";
          }
          return (
            <button
              aria-pressed={isPicked}
              className={`rounded-xl border p-4 text-left transition ${answered ? "cursor-default" : "hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-cyan-300/70"} ${style}`}
              disabled={answered}
              key={option.value}
              onClick={() => onAnswer(option.value)}
              type="button"
            >
              <p className="text-sm font-bold">{option.title}</p>
              {option.note && <p className="mt-1 text-xs leading-5 text-slate-500">{option.note}</p>}
            </button>
          );
        })}
      </div>

      {answered && (
        <div className={`mt-5 rounded-xl border p-4 text-sm leading-6 ${picked === item.correct ? "border-emerald-300/20 bg-emerald-300/5 text-emerald-200" : "border-rose-300/20 bg-rose-300/5 text-rose-200"}`} aria-live="polite">
          <p className="font-bold">{picked === item.correct ? "Correct" : item.wrongGuidance}</p>
          <p className="mt-2 text-slate-400">{item.explain}</p>
        </div>
      )}

      {answered && (
        <button className="mt-5 w-full rounded-lg bg-cyan-300 px-4 py-3 text-sm font-black text-slate-950 transition hover:bg-cyan-200" onClick={onNext} type="button">
          {last ? "Finish review" : "Next item"} →
        </button>
      )}
    </div>
  );
}

function LabCard({ item, onLaunch, onSkip, last }: { item: ReviewLabItem; onLaunch: () => void; onSkip: () => void; last: boolean }) {
  return (
    <div className="mt-6 rounded-xl border border-slate-800 bg-slate-900/70 p-6">
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{item.objectiveId} · {item.objectiveLabel}</p>
      <h2 className="mt-2 text-lg font-bold leading-7">{item.labTitle}</h2>
      <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-cyan-300">{item.variantLabel} · hands-on</p>

      <div className="mt-4 rounded-xl border border-rose-300/20 bg-rose-300/5 p-4">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-rose-300">Symptom</p>
        <p className="mt-1 text-sm leading-6 text-slate-300">{item.symptom}</p>
      </div>
      <p className="mt-3 rounded-lg border border-amber-300/20 bg-amber-300/5 px-3 py-2 text-[10px] leading-4 text-amber-200/80">{item.simulatorNote}</p>

      <div className="mt-5 grid gap-3">
        <button className="w-full rounded-lg bg-cyan-300 px-4 py-3 text-sm font-black text-slate-950 transition hover:bg-cyan-200" onClick={onLaunch} type="button">
          Run this lab →
        </button>
        <button className="w-full rounded-lg border border-slate-700 px-4 py-2.5 text-xs font-bold text-slate-300 transition hover:border-slate-500 hover:text-white" onClick={onSkip} type="button">
          {last ? "Skip · finish review" : "Skip this lab"}
        </button>
      </div>
      <p className="mt-3 text-[10px] leading-4 text-slate-600">Completing the lab (clean or with hints) counts variant evidence toward this objective's Independent band.</p>
    </div>
  );
}
