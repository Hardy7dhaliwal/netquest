"use client";

import { useState } from "react";
import {
  advanceRescue,
  answerRescueCheckpoint,
  currentRescueStep,
  revealRescueAnswer,
  runRescueCommand,
  startRescue,
  type RescueDefinition,
  type RescueState,
} from "@/lib/rescue";
import { ConsolePanel } from "@/components/console-panel";

/**
 * Modal walkthrough for a rescue mini-lesson. Self-contained: owns its own
 * RescueState via the engine, renders the current step (explain / checkpoint /
 * typed CLI), supports the mercy reveal, and ends with the "back in the
 * mission" tip. Purely presentational — no scoring or persistence.
 */
export default function RescuePanel({ rescue, onClose }: { rescue: RescueDefinition; onClose: () => void }) {
  const [state, setState] = useState<RescueState>(startRescue);
  const step = currentRescueStep(state, rescue);
  const complete = state.status === "complete";
  const stepNumber = Math.min(state.stepIndex + 1, rescue.steps.length);
  const canReveal = state.attempts >= 1 && !state.revealed;

  return (
    <div aria-label={rescue.title} aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm" role="dialog">
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-cyan-300/25 bg-slate-900 shadow-2xl shadow-cyan-950/40">
        <div className="flex items-start justify-between gap-4 border-b border-slate-800 px-6 py-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">
              Mini-lesson · {complete ? rescue.steps.length : stepNumber} of {rescue.steps.length} steps
            </p>
            <h2 className="mt-1 text-xl font-black tracking-tight">{rescue.title}</h2>
            <p className="mt-1 text-sm leading-6 text-slate-400">{rescue.teaches}</p>
          </div>
          <button className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:border-slate-500 hover:text-white" onClick={onClose} type="button">
            Close
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-6">
          {complete ? (
            <div className="rounded-xl border border-emerald-300/30 bg-emerald-300/10 p-6 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-300 text-xl text-slate-950">✓</div>
              <p className="mt-4 text-xs font-bold uppercase tracking-[0.2em] text-emerald-300">Rescue complete</p>
              <p className="mt-2 text-lg font-bold">You are ready to finish the mission.</p>
              <div className="mt-4 rounded-lg border border-amber-300/25 bg-amber-300/10 p-4 text-left text-sm leading-6 text-amber-100">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-200">Back in the mission</p>
                <p className="mt-2">{rescue.tip}</p>
              </div>
              <button className="mt-6 w-full rounded-lg bg-emerald-300 px-4 py-3 text-sm font-black text-slate-950 transition hover:bg-emerald-200" onClick={onClose} type="button">
                Close &amp; back to the mission
              </button>
            </div>
          ) : !step ? null : step.kind === "explain" ? (
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">{step.title}</p>
              <p className="mt-3 text-sm leading-7 text-slate-300">{step.body}</p>
              <button className="mt-5 w-full rounded-lg bg-cyan-300 px-4 py-3 text-sm font-black text-slate-950 transition hover:bg-cyan-200" onClick={() => setState(advanceRescue(state, rescue))} type="button">
                Continue
              </button>
            </div>
          ) : step.kind === "checkpoint" ? (
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">{step.title}</p>
              <p className="mt-3 text-sm leading-7 text-slate-200">{step.prompt}</p>
              {!state.revealed && (
                <div className="mt-4 grid gap-3">
                  {step.options.map((option) => (
                    <button
                      className={`rounded-xl border p-4 text-left transition hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-cyan-300/70 ${state.lastAnswerCorrect === false && state.checkpointAnswer === option.value ? "border-rose-300/50 bg-rose-300/5" : "border-slate-700 bg-slate-950/70 hover:border-cyan-300/50"}`}
                      key={option.value}
                      onClick={() => setState(answerRescueCheckpoint(state, rescue, option.value))}
                      type="button"
                    >
                      <p className="text-sm font-bold">{option.title}</p>
                      {option.note && <p className="mt-1 text-xs leading-5 text-slate-500">{option.note}</p>}
                    </button>
                  ))}
                </div>
              )}
              {state.lastAnswerCorrect === false && (
                <div className="mt-4 rounded-lg border border-rose-300/25 bg-rose-300/10 p-4 text-sm leading-6 text-rose-200">{step.wrongGuidance}</div>
              )}
              {state.revealed && state.lastAnswerCorrect === true && (
                <div className="mt-4 rounded-lg border border-emerald-300/25 bg-emerald-300/10 p-4 text-sm leading-6 text-emerald-200">{step.explain}</div>
              )}
              <div className="mt-4 flex items-center justify-between gap-3">
                {state.lastAnswerCorrect === true ? (
                  <button className="ml-auto rounded-lg bg-emerald-300 px-4 py-2 text-xs font-black text-slate-950 transition hover:bg-emerald-200" onClick={() => setState(advanceRescue(state, rescue))} type="button">
                    Continue
                  </button>
                ) : (
                  <button
                    className="rounded-lg border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-300 transition enabled:hover:border-slate-500 enabled:hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                    disabled={!canReveal}
                    onClick={() => setState(revealRescueAnswer(state, rescue))}
                    title={canReveal ? "Show the answer and explanation" : "Answer once to unlock the reveal"}
                    type="button"
                  >
                    Show me the answer
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">{step.title}</p>
              <p className="mt-3 text-sm leading-7 text-slate-300">
                Type the command on <span className="font-mono text-cyan-200">{step.device}</span> to practice the fix.
              </p>
              <div className="mt-4">
                <ConsolePanel
                  key={`${rescue.id}-${state.stepIndex}`}
                  deviceName={step.device}
                  prompt={step.prompt}
                  history={state.cliHistory}
                  onRun={(command) => setState(runRescueCommand(state, rescue, command))}
                  inputId={`rescue-cli-${rescue.id}`}
                  completions={[step.command]}
                  emptyText={
                    <p className="text-slate-600">
                      Type the command below to practice the fix. Type <span className="text-cyan-300">help</span> for a hint.
                    </p>
                  }
                />
              </div>
              <div className="mt-4 flex items-center justify-between gap-3">
                {state.revealed ? (
                  <p className="rounded-lg border border-amber-300/25 bg-amber-300/10 px-4 py-2 font-mono text-xs text-amber-100">
                    Try typing: {step.command}
                  </p>
                ) : (
                  <button
                    className="rounded-lg border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-300 transition enabled:hover:border-slate-500 enabled:hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                    disabled={!canReveal}
                    onClick={() => setState(revealRescueAnswer(state, rescue))}
                    title={canReveal ? "Reveal the exact command" : "Try a command once to unlock the reveal"}
                    type="button"
                  >
                    Show me the command
                  </button>
                )}
              </div>
            </div>
          )}

          {!complete && step && (step.kind === "checkpoint" || step.kind === "cli") && (
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>
                {state.attempts} wrong attempt{state.attempts === 1 ? "" : "s"}
              </span>
              {state.attempts < 1 && <span className="text-slate-600">Answer once to unlock the reveal</span>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
