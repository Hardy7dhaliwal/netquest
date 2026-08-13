"use client";

import { useEffect, useState } from "react";
import { Wordmark } from "@/components/wordmark";
import { LAB_TEMPLATES } from "@/lib/lab-templates";
import {
  advanceLab,
  answerLabDiagnose,
  getLabVariant,
  revealLabAnswer,
  runLabCommand,
  startLab,
  type LabState,
  type LabTemplate,
} from "@/lib/labs";

const PROMPTS: Record<string, string> = {
  R1: "R1#",
  SW1: "SW1#",
};

/**
 * Hands-on lab console. Every lab runs inspect → diagnose → configure →
 * verify with authored variants (different addressing, interfaces, symptoms,
 * distractors). Alternate valid commands are accepted; wrong commands give
 * targeted feedback. Simulator limits are labeled on each lab card.
 */
export default function LabsPanel({
  labResults,
  onRecordResult,
  onExit,
  preselect,
}: {
  labResults: Record<string, { variantIds: string[]; cleanRuns: number; lastRunAt: number }>;
  onRecordResult: (labId: string, variantId: string, clean: boolean, skill: "configure" | "troubleshoot") => void;
  onExit: () => void;
  /** Launch straight into a lab+variant (used by adaptive review). */
  preselect?: { labId: string; variantId: string } | null;
}) {
  const [template, setTemplate] = useState<LabTemplate | null>(null);
  const [state, setState] = useState<LabState | null>(null);
  const [command, setCommand] = useState("");

  // Adaptive review hands off a specific lab+variant: jump straight in.
  useEffect(() => {
    if (!preselect || template) return;
    const t = LAB_TEMPLATES.find((candidate) => candidate.id === preselect.labId);
    if (t) beginLab(t, preselect.variantId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preselect]);

  function beginLab(t: LabTemplate, variantId: string) {
    setTemplate(t);
    setState(startLab(t, variantId));
  }

  function exit() {
    setTemplate(null);
    setState(null);
    onExit();
  }

  function finish() {
    if (!template || !state || state.status !== "complete") return;
    onRecordResult(template.id, state.variantId, state.clean, template.skill);
    exit();
  }

  // ─── Lab picker ───────────────────────────────────────────────────────────
  if (!template || !state) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100">
        <header className="border-b border-slate-800/80 px-5 py-4 sm:px-8">
          <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-4">
            <Wordmark onHome={exit} track="Hands-on labs" />
            <button className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:border-slate-500 hover:text-white" onClick={exit} type="button">Back to dashboard</button>
          </div>
        </header>
        <div className="mx-auto max-w-4xl p-5 sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-cyan-300">Hands-on labs</p>
          <p className="mt-2 text-sm text-slate-400">Each lab follows the real loop the exam tests: inspect the device, diagnose the fault, configure the fix (alternate commands accepted), verify the result. Variants change the addressing and symptoms — repeated clean runs across variants build Independent mastery.</p>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {LAB_TEMPLATES.map((t) => {
              const completed = labResults[t.id]?.variantIds ?? [];
              return (
                <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5" key={t.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-bold">{t.title}</p>
                      <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                        {t.objectiveIds.join(", ")} · {t.skill}
                      </p>
                    </div>
                    {completed.length > 0 && (
                      <span className="shrink-0 rounded-full border border-emerald-300/40 bg-emerald-300/10 px-2.5 py-1 text-[10px] font-bold text-emerald-200">
                        {completed.length}/{t.variants.length} variants
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-xs leading-5 text-slate-400">{t.scenario}</p>
                  <p className="mt-2 rounded-lg border border-amber-300/20 bg-amber-300/5 px-3 py-2 text-[10px] leading-4 text-amber-200/80">{t.simulatorNote}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {t.variants.map((variant) => (
                      <button
                        className={`rounded-lg border px-3 py-1.5 text-xs font-bold transition ${completed.includes(variant.id) ? "border-emerald-300/50 text-emerald-200 hover:bg-emerald-300/10" : "border-cyan-300/50 text-cyan-200 hover:bg-cyan-300/10"}`}
                        key={variant.id}
                        onClick={() => beginLab(t, variant.id)}
                        type="button"
                      >
                        {completed.includes(variant.id) ? "✓ " : ""}{variant.label}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          <p className="mx-auto mt-8 max-w-3xl rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-[11px] leading-5 text-slate-500">
            These are text-simulated labs with fixed outputs — real IOS/XE behavior differs. For realistic device practice, rebuild the same scenarios on Cisco Modeling Labs (CML), EVE-NG, or a Cisco DevNet sandbox before the real exam.
          </p>
        </div>
      </main>
    );
  }

  // ─── Lab in progress ──────────────────────────────────────────────────────
  const variant = getLabVariant(template, state.variantId);
  const step = template.steps[state.stepIndex];
  const completed = state.status === "complete";

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800/80 px-5 py-4 sm:px-8">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-4">
          <div>
            <Wordmark onHome={exit} track="Hands-on labs" />
            <h1 className="mt-2 text-xl font-bold">{template.title}</h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="rounded-full border border-slate-700 px-3 py-1 text-xs font-semibold text-slate-300">{variant.label}</span>
            <button className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:border-slate-500 hover:text-white" onClick={exit} type="button">Quit lab</button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-4xl gap-5 p-5 sm:p-8 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-5">
          {/* Variant context */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-5">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-rose-300">Symptom</p>
            <p className="mt-2 text-sm leading-6 text-slate-300">{variant.symptom}</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <p className="rounded-lg bg-slate-950/60 px-3 py-2 font-mono text-[11px] leading-5 text-slate-400"><span className="text-cyan-300">Addressing</span> · {variant.addressing}</p>
              <p className="rounded-lg bg-slate-950/60 px-3 py-2 font-mono text-[11px] leading-5 text-slate-400"><span className="text-cyan-300">Interfaces</span> · {variant.interfaces}</p>
            </div>
          </div>

          {/* Current step */}
          {!completed && step && (
            <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-5">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">Step {state.stepIndex + 1} of {template.steps.length} · {step.kind}</p>
                <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase ${state.clean ? "border-emerald-300/30 bg-emerald-300/10 text-emerald-200" : "border-amber-300/30 bg-amber-300/10 text-amber-200"}`}>
                  {state.clean ? "clean run" : "hints used"}
                </span>
              </div>
              <h2 className="mt-3 text-lg font-bold leading-7">{step.title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">{step.prompt}</p>

              {step.kind === "diagnose" && (
                <div className="mt-5 grid gap-3">
                  {step.options!.map((option) => (
                    <button
                      className={`rounded-xl border p-4 text-left transition hover:-translate-y-0.5 ${state.checkpointAnswer === option.value ? "border-rose-300/60 bg-rose-300/10" : "border-slate-700 bg-slate-950/70 hover:border-cyan-300/50"}`}
                      disabled={state.lastAnswerCorrect === true}
                      key={option.value}
                      onClick={() => setState(answerLabDiagnose(state, template, option.value))}
                      type="button"
                    >
                      <p className="text-sm font-bold">{option.title}</p>
                      {option.note && <p className="mt-1 text-xs leading-5 text-slate-500">{option.note}</p>}
                      {state.lastAnswerCorrect === false && state.checkpointAnswer === option.value && <p className="mt-2 text-xs font-bold text-rose-300">✗ Not the cause</p>}
                    </button>
                  ))}
                </div>
              )}

              {step.kind !== "diagnose" && (
                <form
                  className="mt-5"
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (!command.trim()) return;
                    setState(runLabCommand(state, template, command));
                    setCommand("");
                  }}
                >
                  <label className="sr-only" htmlFor="lab-command">Enter a command</label>
                  <div className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 focus-within:border-cyan-300/70">
                    <span className="font-mono text-xs text-cyan-300">{PROMPTS.R1}</span>
                    <input autoComplete="off" className="min-w-0 flex-1 bg-transparent font-mono text-xs text-slate-100 outline-none placeholder:text-slate-700" id="lab-command" onChange={(event) => setCommand(event.target.value)} placeholder="type a command" value={command} />
                    <button className="text-xs font-bold text-cyan-300 hover:text-cyan-100" type="submit">Run</button>
                  </div>
                </form>
              )}

              {state.attempts > 0 && !completed && (
                <button className="mt-3 text-xs font-bold text-amber-300 hover:text-amber-200" onClick={() => setState(revealLabAnswer(state, template))} type="button">
                  Show me the answer
                </button>
              )}

              {step.kind === "diagnose" && state.lastAnswerCorrect === true && (
                <button className="mt-4 w-full rounded-lg bg-cyan-300 px-4 py-2.5 text-xs font-black text-slate-950 transition hover:bg-cyan-200" onClick={() => setState(advanceLab(state, template))} type="button">
                  Continue →
                </button>
              )}
            </div>
          )}

          {/* CLI history */}
          <div className="rounded-xl border border-slate-800 bg-[#030914]">
            <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Console</p>
              <span className="text-[10px] text-slate-600">simulated output · deterministic</span>
            </div>
            <div className="max-h-72 space-y-3 overflow-y-auto p-4 font-mono text-xs leading-5" aria-live="polite">
              {state.cliHistory.length === 0 && <p className="text-slate-600">Run an inspect command to see the device state.</p>}
              {state.cliHistory.map((entry, index) => (
                <div key={`${entry.input}-${index}`}>
                  <p><span className="text-cyan-300">{entry.prompt}</span> <span className="text-slate-200">{entry.input}</span></p>
                  {entry.output && <pre className="mt-1 whitespace-pre-wrap text-slate-400">{entry.output}</pre>}
                </div>
              ))}
            </div>
          </div>

          {/* Event log */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Lab log</p>
            <div className="mt-2 space-y-1.5" aria-live="polite">
              {state.eventLog.map((entry, index) => (
                <p className={`text-xs leading-5 ${entry.tone === "success" ? "text-emerald-200" : entry.tone === "error" ? "text-rose-200" : "text-slate-400"}`} key={`${entry.message}-${index}`}>
                  {entry.message}
                </p>
              ))}
            </div>
          </div>
        </div>

        {/* Progress rail */}
        <aside className="space-y-4">
          <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-5">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Progress</p>
            <ol className="mt-4 space-y-3">
              {template.steps.map((s, index) => {
                const done = index < state.stepIndex || state.status === "complete";
                const active = index === state.stepIndex && state.status !== "complete";
                return (
                  <li className="flex items-start gap-3 text-xs" key={s.title}>
                    <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-[10px] ${done ? "border-emerald-300 bg-emerald-300 text-slate-950" : active ? "border-cyan-300 text-cyan-300" : "border-slate-700 text-transparent"}`}>{done ? "✓" : index + 1}</span>
                    <div>
                      <p className={done ? "text-slate-300" : active ? "font-bold text-cyan-200" : "text-slate-500"}>{s.title}</p>
                      <p className="text-[10px] uppercase tracking-wider text-slate-600">{s.kind}</p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
          {completed && (
            <button className="w-full rounded-lg bg-emerald-300 px-4 py-3 text-sm font-black text-slate-950 transition hover:bg-emerald-200" onClick={finish} type="button">
              Finish lab {state.clean ? "· clean run" : "· hints used"}
            </button>
          )}
        </aside>
      </div>
    </main>
  );
}
