"use client";
import { Wordmark } from "@/components/wordmark";

import { arcTitle, quizScore, type QuizQuestion, type QuizSessionState } from "@/lib/quiz";

/**
 * Per-arc mini-quiz. The session state machine lives in lib/quiz.ts; this
 * component only renders it — question, options with immediate feedback, then
 * a score summary (25 XP perfect / 10 XP otherwise).
 */
export default function ArcQuiz({
  arcId,
  questions,
  session,
  onAnswer,
  onAdvance,
  onFinish,
  onExit,
  firstCompletion,
  xpAward,
}: {
  arcId: string;
  questions: QuizQuestion[];
  session: QuizSessionState;
  onAnswer: (value: string) => void;
  onAdvance: () => void;
  onFinish: () => void;
  onExit: () => void;
  /** True when this run is the arc's first completion (XP is awarded once). */
  firstCompletion: boolean;
  /** Actual XP this run will award (0 on re-quizzes). */
  xpAward: number;
}) {
  const question = questions[session.index];
  const answered = session.phase === "feedback";
  const score = quizScore(session, questions);
  const last = session.index === questions.length - 1;

  if (session.phase === "done" || !question) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-slate-100">
        <div className="w-full max-w-md rounded-2xl border border-emerald-300/30 bg-slate-900 p-8 text-center shadow-2xl shadow-emerald-950/40">
          <div className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full text-3xl text-slate-950 ${score.perfect ? "bg-emerald-300" : "bg-amber-300"}`}>{score.perfect ? "✓" : "★"}</div>
          <p className="mt-5 text-xs font-bold uppercase tracking-[0.25em] text-emerald-300">Quiz complete</p>
          <h2 className="mt-3 text-3xl font-black tracking-tight">{arcTitle(arcId)}</h2>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            {score.correct} of {score.total} correct{score.perfect ? " — perfect!" : " — review the explanations and try again for a perfect run."}
          </p>
          <div className="mt-6 rounded-xl border border-emerald-300/20 bg-emerald-300/5 py-4 text-xl font-black text-emerald-200">
            {xpAward > 0 ? `+${xpAward} XP` : firstCompletion ? "XP awarded on finish" : "Already completed — no XP this run"}
          </div>
          <button className="mt-6 w-full rounded-lg bg-emerald-300 px-4 py-3 text-sm font-bold text-slate-950 transition hover:bg-emerald-200" onClick={onFinish} type="button">Back to dashboard</button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800/80 px-5 py-4 sm:px-8">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-4">
          <div>
            <Wordmark onHome={onExit} track="Mini-quiz" />
            <h1 className="mt-2 text-xl font-bold">{arcTitle(arcId)}</h1>
          </div>
          <button className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:border-slate-500 hover:text-white" onClick={onExit} type="button">Quit quiz</button>
        </div>
      </header>

      <div className="mx-auto max-w-3xl p-5 sm:p-8">
        <div className="flex items-center justify-between gap-4">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Question {session.index + 1} of {questions.length}</p>
          <div className="flex gap-1.5">
            {questions.map((q, index) => (
              <span className={`h-1.5 w-6 rounded-full ${index < session.index ? "bg-emerald-300" : index === session.index ? "bg-cyan-300" : "bg-slate-800"}`} key={q.id} />
            ))}
          </div>
        </div>

        <div className="mt-6 rounded-xl border border-slate-800 bg-slate-900/70 p-6">
          <h2 className="text-lg font-bold leading-7">{question.prompt}</h2>

          <div aria-label={`Answer for question ${session.index + 1}`} className="mt-6 grid gap-3" role="group">
            {question.options.map((option) => {
              const picked = session.answers[session.index] === option.value;
              const isCorrect = option.value === question.correct;
              let style = "border-slate-700 bg-slate-950/70 hover:border-cyan-300/50";
              if (answered) {
                if (isCorrect) style = "border-emerald-300/60 bg-emerald-300/10";
                else if (picked) style = "border-rose-300/60 bg-rose-300/10";
                else style = "border-slate-800 bg-slate-950/50 opacity-50";
              }
              return (
                <button
                  aria-pressed={picked}
                  className={`rounded-xl border p-4 text-left transition ${answered ? "cursor-default" : "hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-cyan-300/70"} ${style}`}
                  disabled={answered}
                  key={option.value}
                  onClick={() => onAnswer(option.value)}
                  type="button"
                >
                  <p className="text-sm font-bold">{option.title}</p>
                  {option.note && <p className="mt-1 text-xs leading-5 text-slate-500">{option.note}</p>}
                  {answered && isCorrect && <p className="mt-2 text-xs font-bold text-emerald-300">✓ Correct</p>}
                  {answered && picked && !isCorrect && <p className="mt-2 text-xs font-bold text-rose-300">✗ Not quite</p>}
                </button>
              );
            })}
          </div>

          {answered && (
            <div className={`mt-5 rounded-xl border p-4 text-sm leading-6 ${session.answers[session.index] === question.correct ? "border-emerald-300/20 bg-emerald-300/5 text-emerald-200" : "border-rose-300/20 bg-rose-300/5 text-rose-200"}`} aria-live="polite">
              <p className="font-bold">{session.answers[session.index] === question.correct ? question.explain : question.wrongGuidance}</p>
              <p className="mt-2 text-slate-400">{question.explain}</p>
            </div>
          )}
        </div>

        {answered && (
          <button className="mt-5 w-full rounded-lg bg-cyan-300 px-4 py-3 text-sm font-black text-slate-950 transition hover:bg-cyan-200" onClick={onAdvance} type="button">
            {last ? "Finish quiz" : "Next question"} →
          </button>
        )}
      </div>
    </main>
  );
}
