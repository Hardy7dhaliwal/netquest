"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { BADGE_XP, getBadgeStatus } from "./badges";
import { ENCOR_MISSION_ARCS } from "./encor-catalog";
import { nextCardState, type CardState } from "./flashcards";
import {
  getWeakObjectives,
  recordMissionResult as recordMastery,
  recordQuizResult as recordQuizMastery,
  type MasteryMap,
} from "./mastery";

export type QuizResult = { correct: number; total: number; perfect: boolean };

type ProgressData = {
  xp: number;
  streak: number;
  weakTopics: string[];
  completedMissions: string[];
  mastery: MasteryMap;
  quizResults: Record<string, QuizResult>;
  cardReviews: Record<string, CardState>;
  /** Badge ids earned so far (each awards BADGE_XP exactly once). */
  badges: string[];
};

export const INITIAL_PROGRESS: ProgressData = {
  xp: 0,
  streak: 0,
  weakTopics: ["VLANs and trunks"],
  completedMissions: [],
  mastery: {},
  quizResults: {},
  cardReviews: {},
  badges: [],
};

type ProgressState = ProgressData & {
  completeReview: () => void;
  awardMission: (missionId: string, xp?: number) => void;
  /** Record a mission completion's wrong-attempt count to raise per-objective mastery. */
  recordMissionResult: (missionId: string, attempts: number) => void;
  /** Award quiz XP (25 perfect / 10 otherwise, once per arc) and a mastery bump. */
  recordQuizResult: (arcId: string, correct: number, total: number) => void;
  /** SM-2-lite flashcard review: 5 XP when a due card is remembered. */
  reviewFlashcard: (cardId: string, remembered: boolean) => void;
  /** Award newly earned badges (+BADGE_XP each); a no-op when none are new. */
  syncBadges: () => void;
  reset: () => void;
};

export function getLevel(xp: number) {
  return Math.floor(xp / 500) + 1;
}

export const useProgressStore = create<ProgressState>()(
  persist(
    (set) => ({
      ...INITIAL_PROGRESS,
      completeReview: () =>
        set((state) => ({ xp: state.xp + 5, streak: state.streak + 1 })),
      awardMission: (missionId, xp = 150) =>
        set((state) =>
          state.completedMissions.includes(missionId)
            ? state
            : {
                xp: state.xp + xp,
                streak: state.streak + 1,
                completedMissions: [...state.completedMissions, missionId],
              },
        ),
      recordMissionResult: (missionId, attempts) =>
        set((state) => {
          const arc = ENCOR_MISSION_ARCS.find((candidate) => candidate.id === missionId);
          if (!arc) return state;
          const mastery = recordMastery(state.mastery, arc.objectiveIds, attempts);
          const weakTopics = getWeakObjectives(mastery).slice(0, 3).map((objective) => objective.label);
          return { ...state, mastery, weakTopics };
        }),
      recordQuizResult: (arcId, correct, total) =>
        set((state) => {
          const arc = ENCOR_MISSION_ARCS.find((candidate) => candidate.id === arcId);
          if (!arc || total <= 0) return state;
          const perfect = correct === total;
          const firstCompletion = !state.quizResults[arcId];
          return {
            ...state,
            mastery: recordQuizMastery(state.mastery, arc.objectiveIds, correct, total),
            quizResults: { ...state.quizResults, [arcId]: { correct, total, perfect } },
            xp: firstCompletion ? state.xp + (perfect ? 25 : 10) : state.xp,
          };
        }),
      reviewFlashcard: (cardId, remembered) =>
        set((state) => {
          const now = Date.now();
          const prev = state.cardReviews[cardId];
          const wasDue = !prev || prev.due <= now;
          const next = nextCardState(prev, remembered, now);
          return {
            ...state,
            cardReviews: { ...state.cardReviews, [cardId]: next },
            xp: remembered && wasDue ? state.xp + 5 : state.xp,
          };
        }),
      syncBadges: () =>
        set((state) => {
          const earned = getBadgeStatus(state)
            .filter((entry) => entry.earned)
            .map((entry) => entry.badge.id);
          const fresh = earned.filter((id) => !state.badges.includes(id));
          // Returning the same state reference keeps zustand from notifying.
          if (fresh.length === 0) return state;
          return {
            ...state,
            badges: [...state.badges, ...fresh],
            xp: state.xp + fresh.length * BADGE_XP,
          };
        }),
      reset: () => set(INITIAL_PROGRESS),
    }),
    {
      name: "netquest-progress",
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: (state) => ({
        xp: state.xp,
        streak: state.streak,
        weakTopics: state.weakTopics,
        completedMissions: state.completedMissions,
        mastery: state.mastery,
        quizResults: state.quizResults,
        cardReviews: state.cardReviews,
        badges: state.badges,
      }),
      merge: (persisted, current) => ({
        ...current,
        ...(persisted as Partial<ProgressData>),
        completedMissions: (persisted as Partial<ProgressData>).completedMissions ?? current.completedMissions,
        // Old saves predate mastery/quizzes/cards/badges — start with empty maps.
        mastery: (persisted as Partial<ProgressData>).mastery ?? current.mastery,
        quizResults: (persisted as Partial<ProgressData>).quizResults ?? current.quizResults,
        cardReviews: (persisted as Partial<ProgressData>).cardReviews ?? current.cardReviews,
        badges: (persisted as Partial<ProgressData>).badges ?? current.badges,
      }),
    },
  ),
);
