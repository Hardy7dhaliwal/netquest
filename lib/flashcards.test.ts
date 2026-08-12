import { describe, expect, it } from "vitest";
import { ENCOR_MISSION_ARCS } from "./encor-catalog";
import { DAY_MS, dueCards, getFlashcardDeck, isDue, nextCardState } from "./flashcards";

describe("flashcard engine", () => {
  it("derives at least one card for every playable arc", () => {
    const deck = getFlashcardDeck();
    expect(deck.length).toBeGreaterThan(0);
    for (const arc of ENCOR_MISSION_ARCS) {
      if (arc.status !== "available" && arc.status !== "complete") continue;
      expect(deck.filter((card) => card.arcId === arc.id).length, `${arc.id} has no cards`).toBeGreaterThan(0);
    }
  });

  it("gives every card a front, a back, and a unique id", () => {
    const deck = getFlashcardDeck();
    expect(new Set(deck.map((card) => card.id)).size).toBe(deck.length);
    for (const card of deck) {
      expect(card.front.length).toBeGreaterThan(0);
      expect(card.back.length).toBeGreaterThan(0);
    }
  });

  it("treats brand-new cards as due and scheduled ones per their due time", () => {
    const now = Date.now();
    expect(isDue(undefined, now)).toBe(true);
    expect(isDue({ ease: 2.0, interval: 1, due: now + DAY_MS }, now)).toBe(false);
    expect(isDue({ ease: 2.0, interval: 1, due: now - 1 }, now)).toBe(true);
  });

  it("grows the interval on success and resets on failure", () => {
    const now = Date.now();
    const remembered = nextCardState(undefined, true, now);
    expect(remembered.interval).toBe(1);
    expect(remembered.due).toBe(now + DAY_MS);
    expect(remembered.ease).toBe(2.0);

    const again = nextCardState(remembered, true, now);
    expect(again.interval).toBe(Math.round(1 * 2.1));

    const forgot = nextCardState(again, false, now);
    expect(forgot.interval).toBe(0);
    expect(forgot.due).toBe(now);
    expect(forgot.ease).toBeLessThan(again.ease);
  });

  it("clamps ease between 1.3 and 2.5", () => {
    let state = { ease: 2.5, interval: 30, due: 0 };
    state = nextCardState(state, true, 0);
    expect(state.ease).toBe(2.5);
    for (let i = 0; i < 10; i += 1) {
      state = nextCardState(state, false, 0);
    }
    expect(state.ease).toBe(1.3);
  });

  it("filters the deck to due cards", () => {
    const deck = getFlashcardDeck();
    const now = Date.now();
    const reviews: Record<string, { ease: number; interval: number; due: number }> = {};
    // Schedule the first card in the future, leave the rest new.
    reviews[deck[0].id] = { ease: 2.0, interval: 1, due: now + DAY_MS };
    const due = dueCards(deck, reviews, now);
    expect(due.length).toBe(deck.length - 1);
    expect(due.some((card) => card.id === deck[0].id)).toBe(false);
  });
});
