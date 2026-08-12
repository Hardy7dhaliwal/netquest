"use client";

import { useEffect, useRef, useState } from "react";
import { isVictory, VICTORY_ACCURACY } from "@/lib/boss";
import type { QuizQuestion } from "@/lib/quiz";

export type GauntletResult = { correct: number; total: number; accuracy: number; victory: boolean };

type Feedback = { picked: string | null; correct: boolean; timedOut: boolean };

type Accent = { text: string; bg: string; border: string };

type Props = {
  title: string;
  tagline: string;
  questions: QuizQuestion[];
  timePerQuestion: number;
  accent: Accent;
  xpVictory: number;
  xpDefeat: number;
  victoryLabel: string;
  defeatLabel: string;
  onComplete: (result: GauntletResult) => void;
  onClose: () => void;
};

type Phase = "intro" | "playing" | "feedback" | "result";

/** Timed multiple-choice runner shared by the daily challenge and boss battles. */
export default function Gauntlet({
  title,
  tagline,
  questions,
  timePerQuestion,
  accent,
  xpVictory,
  xpDefeat,
  victoryLabel,
  defeatLabel,
  onComplete,
  onClose,
}: Props) {
  const [phase, setPhase] = useState<Phase>("intro");
  const [index, setIndex] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(timePerQuestion);
  const [correctCount, setCorrectCount] = useState(0);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const finishedRef = useRef(false);
  // Locks the answer for a question once recorded, so a click landing on the
  // exact tick the timer expires can't double-record.
  const settledRef = useRef(false);

  const question = questions[index];
  const isLast = index >= questions.length - 1;

  function recordAnswer(picked: string | null, correct: boolean, timedOut: boolean) {
    if (phase !== "playing" || settledRef.current) return;
    settledRef.current = true;
    setCorrectCount((count) => count + (correct ? 1 : 0));
    setFeedback({ picked, correct, timedOut });
    setPhase("feedback");
  }

  function seeResults() {
    if (finishedRef.current) return;
    finishedRef.current = true;
    const total = questions.length;
    const correct = correctCount;
    const accuracy = total > 0 ? correct / total : 0;
    setPhase("result");
    onComplete({ correct, total, accuracy, victory: isVictory(accuracy) });
  }

  // Countdown while a question is live; expiring counts as a miss.
  useEffect(() => {
    if (phase !== "playing") return;
    if (secondsLeft <= 0) {
      recordAnswer(null, false, true);
      return;
    }
    const id = window.setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => window.clearTimeout(id);
    // recordAnswer is recreated per render; the guard prevents stale fire.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, secondsLeft]);

  // Lock body scroll while open and let Escape dismiss the modal — except
  // mid-question, so a stray keypress can't kill an in-flight battle.
  useEffect(() => {
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && phase !== "playing") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [phase, onClose]);

  function startBattle() {
    finishedRef.current = false;
    settledRef.current = false;
    setIndex(0);
    setCorrectCount(0);
    setFeedback(null);
    setSecondsLeft(timePerQuestion);
    setPhase("playing");
  }

  function nextQuestion() {
    setFeedback(null);
    settledRef.current = false;
    setSecondsLeft(timePerQuestion);
    setIndex((i) => i + 1);
    setPhase("playing");
  }

  const accuracy = questions.length > 0 ? Math.round((correctCount / questions.length) * 100) : 0;
  const victory = isVictory(questions.length > 0 ? correctCount / questions.length : 0);
  const timeLow = secondsLeft <= 5;

  return (
    <div aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm" role="dialog">
      <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl shadow-black/50">
        <div className="flex items-center justify-between gap-4 border-b border-slate-800 px-6 py-4">
          <div className="min-w-0">
            <p className={`text-xs font-black uppercase tracking-[0.2em] ${accent.text}`}>{title}</p>
            <p className="mt-0.5 truncate text-sm text-slate-400">{tagline}</p>
          </div>
          <button
            aria-label="Close"
            className="shrink-0 rounded-lg border border-slate-700 px-3 py-1.5 text-sm font-bold text-slate-400 transition hover:border-slate-500 hover:text-slate-200"
            onClick={onClose}
            type="button"
          >
            ✕
          </button>
        </div>

        {phase === "intro" && (
          <div className="px-6 py-10 text-center">
            <p className="text-4xl">⚔️</p>
            <h3 className="mt-4 text-2xl font-black">{title}</h3>
            <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-slate-400">{tagline}</p>
            <div className="mt-6 flex flex-wrap justify-center gap-2 text-xs font-bold">
              <span className={`rounded-full border px-3 py-1.5 ${accent.border} ${accent.text}`}>
                {questions.length} question{questions.length === 1 ? "" : "s"}
              </span>
              <span className="rounded-full border border-slate-700 px-3 py-1.5 text-slate-300">
                {timePerQuestion}s each
              </span>
              <span className="rounded-full border border-slate-700 px-3 py-1.5 text-slate-300">win at ≥{Math.round(VICTORY_ACCURACY * 100)}%</span>
            </div>
            <button
              className={`mt-8 rounded-lg px-6 py-3 text-sm font-black text-slate-950 transition hover:-translate-y-0.5 ${accent.bg}`}
              onClick={startBattle}
              type="button"
            >
              Start · +{xpVictory} XP
            </button>
          </div>
        )}

        {(phase === "playing" || phase === "feedback") && question && (
          <div className="px-6 py-6">
            <div className="flex items-center justify-between gap-4">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
                Question {index + 1} of {questions.length}
              </p>
              {phase === "playing" ? (
                <p className={`flex items-center gap-2 text-sm font-black tabular-nums ${timeLow ? "animate-pulse text-rose-400" : "text-slate-300"}`}>
                  <span className={`h-2 w-2 rounded-full ${timeLow ? "bg-rose-400" : "bg-slate-600"}`} />
                  {secondsLeft}s
                </p>
              ) : (
                <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Answered</p>
              )}
            </div>
            {phase === "playing" && (
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-800">
                <div
                  className={`h-full rounded-full transition-all duration-1000 ease-linear ${timeLow ? "bg-rose-400" : accent.bg}`}
                  style={{ width: `${(secondsLeft / timePerQuestion) * 100}%` }}
                />
              </div>
            )}
            <p className="mt-5 text-lg font-bold leading-7 text-slate-100">{question.prompt}</p>
            <div className="mt-5 space-y-3">
              {question.options.map((option) => {
                const picked = feedback?.picked === option.value;
                const isCorrectOption = feedback && option.value === question.correct;
                let className = "border-slate-700 bg-slate-950/60 hover:border-slate-500 hover:bg-slate-800/60";
                if (feedback) {
                  if (isCorrectOption) className = "border-emerald-300/60 bg-emerald-300/10";
                  else if (picked) className = "border-rose-300/60 bg-rose-300/10";
                  else className = "border-slate-800 bg-slate-950/40 opacity-60";
                }
                return (
                  <button
                    className={`w-full rounded-xl border px-4 py-3 text-left transition ${className} ${feedback ? "cursor-default" : "active:scale-[0.99]"}`}
                    disabled={Boolean(feedback)}
                    key={option.value}
                    onClick={() => recordAnswer(option.value, option.value === question.correct, false)}
                    type="button"
                  >
                    <span className="block text-sm font-bold text-slate-100">{option.title}</span>
                    {option.note && <span className="mt-0.5 block text-xs text-slate-400">{option.note}</span>}
                  </button>
                );
              })}
            </div>

            {feedback && (
              <div
                className={`mt-5 rounded-xl border p-4 ${feedback.correct ? "border-emerald-300/30 bg-emerald-300/5" : "border-rose-300/30 bg-rose-300/5"}`}
              >
                <p className={`text-sm font-black uppercase tracking-widest ${feedback.correct ? "text-emerald-300" : "text-rose-300"}`}>
                  {feedback.timedOut ? "⏱ Time's up!" : feedback.correct ? "✓ Correct" : "✗ Not quite"}
                </p>
                <p className="mt-1.5 text-sm leading-6 text-slate-300">
                  {feedback.correct ? question.explain : feedback.timedOut ? `${question.explain} The answer was: ${question.options.find((o) => o.value === question.correct)?.title}.` : `${question.wrongGuidance} ${question.explain}`}
                </p>
                <button
                  className={`mt-4 rounded-lg px-5 py-2 text-sm font-black text-slate-950 transition hover:-translate-y-0.5 ${accent.bg}`}
                  onClick={isLast ? seeResults : nextQuestion}
                  type="button"
                >
                  {isLast ? "See results" : "Next →"}
                </button>
              </div>
            )}
          </div>
        )}

        {phase === "result" && (
          <div className="px-6 py-10 text-center">
            <p className="text-5xl">{victory ? "🏆" : "💀"}</p>
            <h3 className={`mt-4 text-2xl font-black ${victory ? "text-emerald-300" : "text-rose-300"}`}>
              {victory ? victoryLabel : defeatLabel}
            </h3>
            <div className={`mx-auto mt-6 flex h-28 w-28 flex-col items-center justify-center rounded-full border-4 ${victory ? "border-emerald-300/60" : "border-rose-300/40"} bg-slate-950`}>
              <span className="text-3xl font-black tabular-nums">{accuracy}%</span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">accuracy</span>
            </div>
            <p className="mt-4 text-sm text-slate-400">
              {correctCount} of {questions.length} correct ·{" "}
              <span className={`font-bold ${victory ? "text-emerald-300" : "text-slate-300"}`}>
                +{victory ? xpVictory : xpDefeat} XP
              </span>
            </p>
            <p className="mx-auto mt-2 max-w-sm text-xs leading-5 text-slate-500">
              {victory
                ? "Victory under pressure — the objectives this battle covered just reached the Under Pressure mastery band."
                : "Keep at it — every answer with a clean slate is training. Defeats still award a consolation prize."}
            </p>
            <div className="mt-8 flex justify-center gap-3">
              <button
                className="rounded-lg border border-slate-700 px-5 py-2.5 text-sm font-bold text-slate-200 transition hover:border-slate-500"
                onClick={onClose}
                type="button"
              >
                Close
              </button>
              <button
                className={`rounded-lg px-5 py-2.5 text-sm font-black text-slate-950 transition hover:-translate-y-0.5 ${accent.bg}`}
                onClick={startBattle}
                type="button"
              >
                Fight again
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
