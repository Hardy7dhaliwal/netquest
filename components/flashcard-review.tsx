"use client";

import { useState } from "react";
import { dueCards, type CardState, type Flashcard } from "@/lib/flashcards";

/**
 * Spaced-repetition review screen. Scheduling lives in lib/flashcards.ts
 * (SM-2-lite); this component renders the due deck: flip the card, then grade
 * yourself — Remembered schedules the next review and earns 5 XP.
 */
export default function FlashcardReview({
  cards,
  reviews,
  onReview,
  onExit,
}: {
  cards: Flashcard[];
  reviews: Record<string, CardState>;
  onReview: (cardId: string, remembered: boolean) => void;
  onExit: () => void;
}) {
  const due = dueCards(cards, reviews, Date.now());
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [remembered, setRemembered] = useState(0);
  const card = due[index];

  function grade(ok: boolean) {
    if (!card) return;
    onReview(card.id, ok);
    if (ok) setRemembered((count) => count + 1);
    setFlipped(false);
    setIndex((i) => i + 1);
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800/80 px-5 py-4 sm:px-8">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.25em] text-cyan-300">NetQuest · Flashcards</p>
            <h1 className="mt-2 text-xl font-bold">Spaced repetition review</h1>
          </div>
          <button className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:border-slate-500 hover:text-white" onClick={onExit} type="button">Back to dashboard</button>
        </div>
      </header>

      <div className="mx-auto max-w-3xl p-5 sm:p-8">
        {!card ? (
          <div className="rounded-2xl border border-emerald-300/30 bg-slate-900 p-10 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-300 text-3xl text-slate-950">✓</div>
            <p className="mt-5 text-xs font-bold uppercase tracking-[0.25em] text-emerald-300">{due.length === 0 ? "All caught up" : "Review complete"}</p>
            <h2 className="mt-3 text-2xl font-black">{due.length === 0 ? "No cards due right now." : "Nice work this session."}</h2>
            <p className="mt-3 text-sm leading-6 text-slate-400">
              {due.length === 0 ? "New cards are always due, so starting a fresh deck or coming back tomorrow will surface more." : `You remembered ${remembered} of ${due.length} cards — ${remembered * 5} XP earned.`}
            </p>
            {remembered > 0 && <div className="mt-6 rounded-xl border border-emerald-300/20 bg-emerald-300/5 py-4 text-xl font-black text-emerald-200">+{remembered * 5} XP</div>}
            <button className="mt-6 w-full rounded-lg bg-emerald-300 px-4 py-3 text-sm font-bold text-slate-950 transition hover:bg-emerald-200" onClick={onExit} type="button">Back to dashboard</button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-4">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Card {index + 1} of {due.length}</p>
              <div className="flex gap-1.5">
                {due.map((c, i) => (
                  <span className={`h-1.5 w-4 rounded-full ${i < index ? "bg-emerald-300" : i === index ? "bg-cyan-300" : "bg-slate-800"}`} key={c.id} />
                ))}
              </div>
            </div>

            <button
              className="mt-6 flex min-h-[280px] w-full flex-col items-center justify-center rounded-2xl border border-slate-700 bg-slate-900/70 p-8 text-center transition hover:border-cyan-300/40 focus:outline-none focus:ring-2 focus:ring-cyan-300/70"
              onClick={() => setFlipped((value) => !value)}
              type="button"
            >
              {!flipped ? (
                <>
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">Front</p>
                  <p className="mt-4 max-w-xl text-lg font-bold leading-7">{card.front}</p>
                </>
              ) : (
                <>
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-300">Back</p>
                  <p className="mt-4 max-w-xl text-base leading-7 text-emerald-100">{card.back}</p>
                </>
              )}
              <p className="mt-6 text-xs text-slate-500">{flipped ? "Tap to flip back" : "Tap to flip"}</p>
            </button>

            {flipped && (
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <button className="rounded-lg border border-rose-300/40 px-4 py-3 text-sm font-bold text-rose-200 transition hover:bg-rose-300/10" onClick={() => grade(false)} type="button">Forgot</button>
                <button className="rounded-lg bg-emerald-300 px-4 py-3 text-sm font-black text-slate-950 transition hover:bg-emerald-200" onClick={() => grade(true)} type="button">Remembered · +5 XP</button>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
