"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { BADGE_XP, getBadgeStatus } from "./badges";
import { BOSS_XP, DAILY_XP, dateKey } from "./boss";
import { ENCOR_DOMAINS, ENCOR_MISSION_ARCS } from "./encor-catalog";
import { nextCardState, type CardState } from "./flashcards";
import {
  getWeakObjectives,
  recordBossResult as recordBossMastery,
  recordMissionResult as recordMastery,
  recordQuizResult as recordQuizMastery,
  type MasteryMap,
} from "./mastery";
import {
  recordLabSkill,
  recordMissionSkill,
  recordQuizSkill,
  recordTimedSkill,
  type SkillMap,
} from "./skills";
import { LAB_TEMPLATES } from "./lab-templates";
import type { ExamScoreHistory } from "./readiness";

export type QuizResult = { correct: number; total: number; perfect: boolean };

export type DailyState = {
  /** Calendar day (YYYY-MM-DD) this claim is for. */
  date: string;
  arcId: string;
  done: boolean;
};

export type BossRecords = {
  battles: number;
  victories: number;
  bestAccuracy: number;
};

export type SyncStatus = "idle" | "syncing" | "synced" | "error";

export type ProgressData = {
  xp: number;
  streak: number;
  weakTopics: string[];
  completedMissions: string[];
  mastery: MasteryMap;
  quizResults: Record<string, QuizResult>;
  cardReviews: Record<string, CardState>;
  /** Badge ids earned so far (each awards BADGE_XP exactly once). */
  badges: string[];
  /** Today's daily challenge, once claimed. */
  daily: DailyState | null;
  /** Calendar-day keys (YYYY-MM-DD) with a claimed daily challenge — the streak history. */
  dailyHistory: string[];
  /** Lifetime boss-battle stats. */
  bossRecords: BossRecords;
  /** When the store last converged with the cloud (ms epoch). */
  lastSyncedAt: number | null;
  syncStatus: SyncStatus;
  /** Human-readable sync state, e.g. an error detail. */
  syncMessage: string | null;
  /** Per-assessment-type mastery (recall/interpret/config/troubleshoot/timed). */
  skills: SkillMap;
  /** Best mock-exam / diagnostic results by exam kind. */
  examResults: ExamScoreHistory;
  /** Question ids already served per exam kind, so retakes draw fresh mixes. */
  examSeen: Record<string, string[]>;
  /** Lab completions keyed by lab id → completed variant ids. */
  labResults: Record<string, { variantIds: string[]; cleanRuns: number; lastRunAt: number }>;
};

/** The persistable data a cloud sync carries (syncStatus/message are transient UI). */
export type RemoteProgress = Omit<ProgressData, "syncStatus" | "syncMessage">;

export const INITIAL_PROGRESS: ProgressData = {
  xp: 0,
  streak: 0,
  weakTopics: ["VLANs and trunks"],
  completedMissions: [],
  mastery: {},
  quizResults: {},
  cardReviews: {},
  badges: [],
  daily: null,
  dailyHistory: [],
  bossRecords: { battles: 0, victories: 0, bestAccuracy: 0 },
  lastSyncedAt: null,
  syncStatus: "idle",
  syncMessage: null,
  skills: {},
  examResults: {},
  examSeen: {},
  labResults: {},
};

type ProgressState = ProgressData & {
  completeReview: () => void;
  awardMission: (missionId: string, xp?: number) => void;
  /** Record a mission completion's wrong-attempt count to raise per-objective mastery + primary skill. */
  recordMissionResult: (missionId: string, attempts: number, variantId?: string) => void;
  /** Award quiz XP (25 perfect / 10 otherwise, once per arc) and a mastery + interpret/recall bump. */
  recordQuizResult: (arcId: string, correct: number, total: number, questionKind?: "recall" | "interpret") => void;
  /** SM-2-lite flashcard review: 5 XP when a due card is remembered. */
  reviewFlashcard: (cardId: string, remembered: boolean) => void;
  /** Award newly earned badges (+BADGE_XP each); a no-op when none are new. */
  syncBadges: () => void;
  /** Claim today's daily challenge (+DAILY_XP and a streak day); once per calendar day. */
  claimDaily: (arcId: string) => void;
  /** Finish a boss battle: XP (tier-based when passed), records, and under-pressure mastery on a win. */
  recordBossResult: (arcId: string, victory: boolean, accuracy: number, xp?: number) => void;
  /** Record a mock-exam score (drives the timed dimension) and timed skill on a pass. */
  recordExamResult: (kind: string, pct: number, passed: boolean, objectiveIds: string[]) => void;
  /** Remember the questions an exam served, so the next retake draws fresh ones. */
  recordExamSeen: (kind: string, ids: string[]) => void;
  /** Record a completed lab variant (drives configuration/troubleshooting skill + variant evidence). */
  recordLabResult: (labId: string, variantId: string, clean: boolean, skill: "configure" | "troubleshoot") => void;
  /** Apply a merged cloud snapshot; a no-op (same state ref) when nothing changed. */
  applyRemote: (remote: RemoteProgress) => void;
  /** Surface sync progress or errors in the UI. */
  setSyncStatus: (status: SyncStatus, message?: string | null) => void;
  reset: () => void;
};

export function getLevel(xp: number) {
  return Math.floor(xp / 500) + 1;
}

/** Resolve objective ids to their catalog definitions (for skill mapping). */
function objectivesFor(ids: string[]) {
  const all = ENCOR_DOMAINS.flatMap((domain) => domain.objectives);
  return ids.map((id) => all.find((objective) => objective.id === id)!).filter(Boolean);
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
      recordMissionResult: (missionId, attempts, variantId) =>
        set((state) => {
          const arc = ENCOR_MISSION_ARCS.find((candidate) => candidate.id === missionId);
          if (!arc) return state;
          const objectives = objectivesFor(arc.objectiveIds);
          const mastery = recordMastery(state.mastery, arc.objectiveIds, attempts);
          const skills = recordMissionSkill(state.skills, objectives, attempts, variantId ?? null);
          const weakTopics = getWeakObjectives(mastery).slice(0, 3).map((objective) => objective.label);
          return { ...state, mastery, skills, weakTopics };
        }),
      recordQuizResult: (arcId, correct, total, questionKind = "interpret") =>
        set((state) => {
          const arc = ENCOR_MISSION_ARCS.find((candidate) => candidate.id === arcId);
          if (!arc || total <= 0) return state;
          const perfect = correct === total;
          const firstCompletion = !state.quizResults[arcId];
          const objectives = objectivesFor(arc.objectiveIds);
          return {
            ...state,
            mastery: recordQuizMastery(state.mastery, arc.objectiveIds, correct, total),
            skills: recordQuizSkill(state.skills, objectives, questionKind, correct, total),
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
      claimDaily: (arcId) =>
        set((state) => {
          const today = dateKey(new Date());
          if (state.daily?.date === today && state.daily.done) return state;
          return {
            ...state,
            daily: { date: today, arcId, done: true },
            dailyHistory: state.dailyHistory.includes(today)
              ? state.dailyHistory
              : [...state.dailyHistory, today],
            xp: state.xp + DAILY_XP,
            streak: state.streak + 1,
          };
        }),
      recordBossResult: (arcId, victory, accuracy, xp) =>
        set((state) => {
          const arc = ENCOR_MISSION_ARCS.find((candidate) => candidate.id === arcId);
          if (!arc) return state;
          const objectives = objectivesFor(arc.objectiveIds);
          const mastery = victory ? recordBossMastery(state.mastery, arc.objectiveIds, true) : state.mastery;
          const skills = recordTimedSkill(state.skills, objectives, accuracy, victory);
          const awarded = xp ?? (victory ? BOSS_XP.victory : BOSS_XP.defeat);
          return {
            ...state,
            mastery,
            skills,
            weakTopics: victory ? getWeakObjectives(mastery).slice(0, 3).map((objective) => objective.label) : state.weakTopics,
            bossRecords: {
              battles: state.bossRecords.battles + 1,
              victories: state.bossRecords.victories + (victory ? 1 : 0),
              bestAccuracy: Math.max(state.bossRecords.bestAccuracy, accuracy),
            },
            xp: state.xp + awarded,
          };
        }),
      recordExamResult: (kind, pct, passed, objectiveIds) =>
        set((state) => {
          const objectives = objectivesFor(objectiveIds);
          const skills = recordTimedSkill(state.skills, objectives, pct / 100, passed);
          return {
            ...state,
            skills,
            examResults: {
              ...state.examResults,
              [kind]: { pct, passed, at: Date.now() },
            },
          };
        }),
      recordExamSeen: (kind, ids) =>
        set((state) => {
          const seen = new Set(state.examSeen[kind] ?? []);
          for (const id of ids) seen.add(id);
          // Bounded per kind: a few full retake cycles is plenty of variety.
          return {
            ...state,
            examSeen: { ...state.examSeen, [kind]: [...seen].slice(0, 400) },
          };
        }),
      recordLabResult: (labId, variantId, clean, skill) =>
        set((state) => {
          const template = LAB_TEMPLATES.find((candidate) => candidate.id === labId);
          if (!template) return state;
          const objectives = objectivesFor(template.objectiveIds);
          const skills = recordLabSkill(state.skills, objectives, skill, clean, variantId);
          const existing = state.labResults[labId];
          return {
            ...state,
            skills,
            labResults: {
              ...state.labResults,
              [labId]: {
                variantIds: [...new Set([...(existing?.variantIds ?? []), variantId])],
                cleanRuns: (existing?.cleanRuns ?? 0) + (clean ? 1 : 0),
                lastRunAt: Date.now(),
              },
            },
          };
        }),
      applyRemote: (remote) =>
        set((state) => {
          const { lastSyncedAt, ...data } = remote;
          const current = {
            xp: state.xp,
            streak: state.streak,
            weakTopics: state.weakTopics,
            completedMissions: state.completedMissions,
            mastery: state.mastery,
            quizResults: state.quizResults,
            cardReviews: state.cardReviews,
            badges: state.badges,
            daily: state.daily,
            dailyHistory: state.dailyHistory,
            bossRecords: state.bossRecords,
            skills: state.skills,
            examResults: state.examResults,
            examSeen: state.examSeen,
            labResults: state.labResults,
          };
          // Returning the same reference when nothing changed keeps zustand
          // from notifying, so a converged sync can't loop with auto-sync.
          if (JSON.stringify(data) === JSON.stringify(current)) {
            if (state.lastSyncedAt === lastSyncedAt) return state;
            return { ...state, lastSyncedAt, syncStatus: "synced", syncMessage: null };
          }
          return { ...state, ...data, lastSyncedAt, syncStatus: "synced", syncMessage: null };
        }),
      setSyncStatus: (status, message = null) =>
        set((state) => ({ ...state, syncStatus: status, syncMessage: message })),
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
        daily: state.daily,
        dailyHistory: state.dailyHistory,
        bossRecords: state.bossRecords,
        skills: state.skills,
        examResults: state.examResults,
        examSeen: state.examSeen,
        labResults: state.labResults,
        lastSyncedAt: state.lastSyncedAt,
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
        daily: (persisted as Partial<ProgressData>).daily ?? current.daily,
        // Old saves predate the streak history — start empty.
        dailyHistory: (persisted as Partial<ProgressData>).dailyHistory ?? current.dailyHistory,
        bossRecords: (persisted as Partial<ProgressData>).bossRecords ?? current.bossRecords,
        // Old saves predate skills/exams/labs — start empty.
        skills: (persisted as Partial<ProgressData>).skills ?? current.skills,
        examResults: (persisted as Partial<ProgressData>).examResults ?? current.examResults,
        // Old saves predate per-kind seen-question tracking — start empty.
        examSeen: (persisted as Partial<ProgressData>).examSeen ?? current.examSeen,
        labResults: (persisted as Partial<ProgressData>).labResults ?? current.labResults,
        lastSyncedAt: (persisted as Partial<ProgressData>).lastSyncedAt ?? current.lastSyncedAt,
      }),
    },
  ),
);
