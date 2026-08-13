"use client";

import { useEffect, useRef, useState } from "react";
import { Wordmark } from "@/components/wordmark";
import {
  advanceExam,
  answerExam,
  buildExam,
  EXAM_SPECS,
  finishExam,
  isExpired,
  scoreExam,
  secondsRemaining,
  startExam,
  type ExamKind,
  type ExamQuestion,
  type ExamSession,
} from "@/lib/exams";

const EXAM_ORDER: ExamKind[] = ["diagnostic", "mock-a", "mock-b"];

/**
 * The Exam Hall — diagnostic + two full-length mocks aligned to the blueprint
 * domain weights. Timed mode with a live countdown; the score report breaks
 * down performance by domain and objective with remediation links back to the
 * missions. A pass on a timed mock also feeds the timed-mastery dimension.
 */
export default function ExamHall({
  examResults,
  onRecordResult,
  onOpenArc,
  onExit,
}: {
  examResults: Record<string, { pct: number; passed: boolean; at: number }>;
  onRecordResult: (kind: ExamKind, pct: number, passed: boolean, objectiveIds: string[]) => void;
  onOpenArc: (arcId: string) => void;
  onExit: () => void;
}) {
  const [active, setActive] = useState<ExamKind | null>(null);
  const [session, setSession] = useState<ExamSession | null>(null);
  const [questions, setQuestions] = useState<ExamQuestion[]>([]);
  const [seed, setSeed] = useState("");
  const [now, setNow] = useState(Date.now());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordedRef = useRef(false);

  const report = session && session.phase === "done" && questions.length ? scoreExam(session, questions) : null;

  useEffect(() => {
    if (active && session && session.phase !== "done") {
      timerRef.current = setInterval(() => setNow(Date.now()), 1000);
      return () => {
        if (timerRef.current) clearInterval(timerRef.current);
      };
    }
  }, [active, session]);

  // Auto-submit when time expires.
  useEffect(() => {
    if (session && !session.phase.endsWith("done") && isExpired(session, now)) {
      setSession(finishExam(session));
    }
  }, [session, now]);

  // Record the result exactly once when the exam reaches done (button or timer).
  useEffect(() => {
    if (session && session.phase === "done" && questions.length && !recordedRef.current) {
      recordedRef.current = true;
      const result = scoreExam(session, questions);
      onRecordResult(session.kind, result.pct, result.passed, [...new Set(questions.flatMap((q) => q.objectiveIds))]);
    }
  }, [session, questions, onRecordResult]);

  function begin(kind: ExamKind) {
    const nextSeed = `${kind}:v${Math.floor(Math.random() * 1e6)}`;
    recordedRef.current = false;
    setSeed(nextSeed);
    setQuestions(buildExam(kind, nextSeed));
    setSession(startExam(kind, nextSeed));
    setActive(kind);
    setNow(Date.now());
  }

  function exit() {
    if (timerRef.current) clearInterval(timerRef.current);
    setActive(null);
    setSession(null);
    setQuestions([]);
    onExit();
  }

  // ─── Picker screen ────────────────────────────────────────────────────────
  if (!active || !session) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100">
        <header className="border-b border-slate-800/80 px-5 py-4 sm:px-8">
          <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-4">
            <Wordmark onHome={exit} track="Exam hall" />
            <button className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:border-slate-500 hover:text-white" onClick={exit} type="button">Back to dashboard</button>
          </div>
        </header>
        <div className="mx-auto max-w-4xl p-5 sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-cyan-300">Exam hall</p>
          <p className="mt-2 text-sm text-slate-400">Mixed-domain, timed exams aligned to the real ENCOR domain weights. A pass on a timed mock counts toward your timed-mastery and exam-readiness gates.</p>
          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            {EXAM_ORDER.map((kind) => {
              const spec = EXAM_SPECS[kind];
              const best = examResults[kind];
              return (
                <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5" key={kind}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-bold">{spec.title}</p>
                      <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                        {spec.questionCount} questions{spec.timeLimitSec > 0 ? ` · ${Math.round(spec.timeLimitSec / 60)} min timed` : " · untimed"}
                      </p>
                    </div>
                    {best && (
                      <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold tabular-nums ${best.passed ? "border-emerald-300/40 bg-emerald-300/10 text-emerald-200" : "border-amber-300/40 bg-amber-300/10 text-amber-200"}`}>
                        Best {best.pct}%
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-xs leading-5 text-slate-400">{spec.subtitle}</p>
                  <p className="mt-1 text-[10px] text-slate-600">Pass mark: {spec.passPct}%</p>
                  <button className="mt-4 w-full rounded-lg bg-cyan-300 px-4 py-2 text-xs font-black text-slate-950 transition hover:bg-cyan-200" onClick={() => begin(kind)} type="button">
                    {best ? "Retake" : "Start"} {spec.title}
                  </button>
                </div>
              );
            })}
          </div>

          <p className="mx-auto mt-8 max-w-3xl rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-[11px] leading-5 text-slate-500">
            NetQuest is not affiliated with or endorsed by Cisco Systems. These practice exams are blueprint-aligned study aids — not real Cisco exam items. Cisco may change the exam at any time; Cisco Press and the official exam blueprint remain the authority. Passing here does not guarantee certification results.
          </p>
        </div>
      </main>
    );
  }

  // ─── Score report ─────────────────────────────────────────────────────────
  if (report) {
    const spec = EXAM_SPECS[session.kind];
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100">
        <header className="border-b border-slate-800/80 px-5 py-4 sm:px-8">
          <div className="mx-auto flex max-w-4xl items-center justify-between gap-4">
            <Wordmark onHome={exit} track="Exam hall" />
            <span className="text-xs font-semibold text-slate-500">Mixed-domain practice exam</span>
          </div>
        </header>
        <div className="mx-auto max-w-4xl p-5 sm:p-8">
          <div className={`rounded-2xl border p-6 sm:p-8 ${report.passed ? "border-emerald-300/30 bg-emerald-300/5" : "border-rose-300/30 bg-rose-300/5"}`}>
            <div className="flex flex-wrap items-center gap-6">
              <div className={`flex h-24 w-24 shrink-0 flex-col items-center justify-center rounded-full border-4 ${report.passed ? "border-emerald-300 bg-slate-950 text-emerald-200" : "border-rose-300 bg-slate-950 text-rose-200"}`}>
                <span className="text-2xl font-black">{report.pct}%</span>
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">{spec.title} · {report.seed.split(":")[1]}</p>
                <p className="mt-2 text-2xl font-black">{report.passed ? "Passed — well done!" : "Not passed yet"}</p>
                <p className="mt-1 text-sm text-slate-400">{report.correct} of {report.total} correct · pass mark {spec.passPct}%</p>
              </div>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {report.byDomain.map((domain) => (
                <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4" key={domain.domainId}>
                  <div className="flex items-baseline justify-between gap-2 text-xs">
                    <span className="font-bold capitalize text-slate-300">{domain.domainId}</span>
                    <span className="tabular-nums text-slate-500">{domain.correct}/{domain.total}</span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-800">
                    <div className={`h-full rounded-full ${domain.pct >= spec.passPct ? "bg-emerald-300" : "bg-rose-300"}`} style={{ width: `${domain.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {report.weakObjectives.length > 0 && (
            <div className="mt-6 rounded-xl border border-slate-800 bg-slate-900/60 p-5">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-300">Weakest areas · remediation</p>
              <ul className="mt-3 space-y-2">
                {report.remediation.slice(0, 6).map((link) => (
                  <li className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-950/60 px-4 py-3" key={link.objectiveId}>
                    <div className="min-w-0">
                      <code className="font-mono text-xs font-bold text-amber-200">{link.objectiveId}</code>
                      <span className="ml-2 text-xs text-slate-400">{link.objectiveLabel}</span>
                    </div>
                    <button className="rounded-lg border border-amber-300/40 px-3 py-1.5 text-xs font-bold text-amber-200 transition hover:bg-amber-300/10" onClick={() => onOpenArc(link.arcId)} type="button">
                      Review {link.arcTitle}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
            <button className="rounded-lg border border-slate-700 px-4 py-2 text-xs font-bold text-slate-300 transition hover:border-slate-500 hover:text-white" onClick={exit} type="button">Back to dashboard</button>
            <button className="rounded-lg bg-cyan-300 px-5 py-2.5 text-xs font-black text-slate-950 transition hover:bg-cyan-200" onClick={() => begin(session.kind)} type="button">
              Retake with a new question mix
            </button>
          </div>
        </div>
      </main>
    );
  }

  // ─── Live exam ────────────────────────────────────────────────────────────
  const question = questions[session.index];
  const remaining = secondsRemaining(session, now);
  const spec = EXAM_SPECS[session.kind];
  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800/80 px-5 py-4 sm:px-8">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-4">
          <div>
            <Wordmark onHome={exit} track="Exam hall" />
            <h1 className="mt-2 text-xl font-bold">{spec.title}</h1>
          </div>
          <div className="flex items-center gap-4">
            {spec.timeLimitSec > 0 && (
              <span className={`rounded-full border px-3 py-1.5 font-mono text-sm font-bold tabular-nums ${remaining <= 60 ? "border-rose-300/50 bg-rose-300/10 text-rose-200" : "border-slate-700 text-slate-300"}`}>
                {minutes}:{`${seconds}`.padStart(2, "0")}
              </span>
            )}
            <button className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:border-slate-500 hover:text-white" onClick={exit} type="button">Quit exam</button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-3xl p-5 sm:p-8">
        <div className="flex items-center justify-between gap-4">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Question {session.index + 1} of {questions.length}</p>
          <span className="rounded-full border border-slate-800 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">{question.domainId} domain</span>
        </div>

        <div className="mt-6 rounded-xl border border-slate-800 bg-slate-900/70 p-6">
          <h2 className="text-lg font-bold leading-7">{question.prompt}</h2>
          <div aria-label={`Answer for question ${session.index + 1}`} className="mt-6 grid gap-3" role="group">
            {question.options.map((option) => {
              const picked = session.answers[session.index] === option.value;
              const isCorrect = option.value === question.correct;
              const answered = session.phase === "feedback";
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
                  onClick={() => setSession(answerExam(session, option.value))}
                  type="button"
                >
                  <p className="text-sm font-bold">{option.title}</p>
                  {option.note && <p className="mt-1 text-xs leading-5 text-slate-500">{option.note}</p>}
                </button>
              );
            })}
          </div>

          {session.phase === "feedback" && (
            <div className="mt-5 rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-sm leading-6" aria-live="polite">
              <p className={`font-bold ${session.answers[session.index] === question.correct ? "text-emerald-300" : "text-rose-300"}`}>
                {session.answers[session.index] === question.correct ? "Correct" : "Not quite"} — {question.explain}
              </p>
              <p className="mt-2 text-xs text-slate-500">Objectives: {question.objectiveIds.join(", ")}</p>
            </div>
          )}
        </div>

        {session.phase === "feedback" && (
          <button className="mt-5 w-full rounded-lg bg-cyan-300 px-4 py-3 text-sm font-black text-slate-950 transition hover:bg-cyan-200" onClick={() => setSession(advanceExam(session, questions.length))} type="button">
            {session.index === questions.length - 1 ? "Finish exam" : "Next question"} →
          </button>
        )}
      </div>
    </main>
  );
}
