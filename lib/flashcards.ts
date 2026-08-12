import { ENCOR_MISSION_ARCS } from "./encor-catalog";
import { RESCUES } from "./rescues";
import { ARC_TO_MISSION } from "./quiz";

/**
 * Flashcards with a lightweight SM-2 scheduler (curriculum "Required Content Per
 * Mission Arc" #8). Cards are derived from the rescue catalog: checkpoints become
 * recall questions, CLI steps become command-recall cards.
 */

export type Flashcard = {
  id: string;
  /** Shown first — the question or the command prompt. */
  front: string;
  /** Revealed on flip — the answer or the exact command. */
  back: string;
  arcId: string;
};

/** SM-2-lite state per card. `due` is an epoch-ms timestamp; 0 means brand new. */
export type CardState = {
  ease: number;
  /** Review interval in days; 0 means due again now. */
  interval: number;
  due: number;
};

export const DAY_MS = 86_400_000;

const MISSION_TO_ARC: Record<string, string> = Object.fromEntries(
  Object.entries(ARC_TO_MISSION).map(([arcId, mission]) => [mission, arcId]),
);

/** Every checkpoint and CLI step across the rescue catalog, as a flashcard. */
export function getFlashcardDeck(): Flashcard[] {
  const cards: Flashcard[] = [];
  for (const rescue of RESCUES) {
    const arcId = MISSION_TO_ARC[rescue.mission];
    rescue.steps.forEach((step, index) => {
      const id = `${rescue.id}-${index}`;
      if (step.kind === "checkpoint") {
        const correct = step.options.find((option) => option.value === step.correct);
        cards.push({
          id,
          front: step.prompt,
          back: `${correct?.title ?? step.correct} — ${step.explain}`,
          arcId,
        });
      } else if (step.kind === "cli") {
        cards.push({
          id,
          front: `${step.title} — type the exact command`,
          back: `${step.command} — ${step.explain}`,
          arcId,
        });
      }
    });
  }
  return cards;
}

/** A card is due when it has never been reviewed or its due time has passed. */
export function isDue(card: CardState | undefined, now: number): boolean {
  return !card || card.due <= now;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** SM-2-lite: success grows the interval × ease; failure resets to due-now. */
export function nextCardState(prev: CardState | undefined, remembered: boolean, now: number): CardState {
  if (!prev) {
    return remembered
      ? { ease: 2.0, interval: 1, due: now + DAY_MS }
      : { ease: 1.7, interval: 0, due: now };
  }
  const ease = clamp(prev.ease + (remembered ? 0.1 : -0.2), 1.3, 2.5);
  const interval = remembered ? (prev.interval === 0 ? 1 : Math.round(prev.interval * ease)) : 0;
  const due = interval === 0 ? now : now + interval * DAY_MS;
  return { ease, interval, due };
}

export function dueCards(deck: Flashcard[], reviews: Record<string, CardState>, now: number): Flashcard[] {
  return deck.filter((card) => isDue(reviews[card.id], now));
}
