import { ENCOR_DOMAINS } from "./encor-catalog";
import { MASTERY_BANDS, objectiveScore, type MasteryMap } from "./mastery";

/**
 * Badge engine (PRD §12 "Gamification"). Badges are deterministic: each one
 * counts progress toward a target from the player's real data (missions, XP,
 * mastery, quizzes, flashcards, streak), so nothing can be gamed or guessed.
 * The PRD's named mission badges are included alongside milestone badges.
 */

export type BadgeSnapshot = {
  xp: number;
  streak: number;
  completedMissions: string[];
  mastery: MasteryMap;
  quizResults: Record<string, { correct: number; total: number; perfect: boolean }>;
  cardReviews: Record<string, unknown>;
};

export type BadgeDefinition = {
  id: string;
  title: string;
  description: string;
  icon: string;
  /** Progress count needed to earn the badge. */
  target: number;
  /** Current progress toward the target, capped at `target` by getBadgeStatus. */
  count: (snapshot: BadgeSnapshot) => number;
};

/** XP awarded the first time a badge is earned. */
export const BADGE_XP = 20;

/** Objectives at or above a mastery score. */
function objectivesAtOrAbove(mastery: MasteryMap, threshold: number): number {
  return ENCOR_DOMAINS.flatMap((domain) => domain.objectives).filter((objective) => objectiveScore(mastery, objective.id) >= threshold).length;
}

export const BADGES: BadgeDefinition[] = [
  // PRD §12 named badges.
  { id: "cli-apprentice", title: "CLI Apprentice", description: "Complete your first mission.", icon: "⌨️", target: 1, count: (s) => s.completedMissions.length },
  { id: "vlan-initiate", title: "VLAN Initiate", description: "Restore the VLAN that vanished.", icon: "🌉", target: 1, count: (s) => (s.completedMissions.includes("vlan-that-vanished") ? 1 : 0) },
  { id: "stp-survivor", title: "STP Survivor", description: "Survive The STP Storm.", icon: "🛡️", target: 1, count: (s) => (s.completedMissions.includes("stp-storm") ? 1 : 0) },
  { id: "ospf-neighbor", title: "OSPF Neighbor", description: "Reach FULL in Area Zero Hero.", icon: "🔄", target: 1, count: (s) => (s.completedMissions.includes("area-zero-hero") ? 1 : 0) },
  { id: "packet-detective", title: "Packet Detective", description: "Catch the culprit in The Signal Detective.", icon: "🔍", target: 1, count: (s) => (s.completedMissions.includes("signal-detective") ? 1 : 0) },
  { id: "troubleshooting-specialist", title: "Troubleshooting Specialist", description: "Fix five missions.", icon: "🔧", target: 5, count: (s) => s.completedMissions.length },
  // Milestone badges.
  { id: "network-operator", title: "Network Operator", description: "Complete ten missions.", icon: "🌐", target: 10, count: (s) => s.completedMissions.length },
  { id: "blueprint-complete", title: "Blueprint Complete", description: "Complete all 17 missions.", icon: "🏆", target: 17, count: (s) => s.completedMissions.length },
  { id: "centurion", title: "Centurion", description: "Earn 1,000 XP.", icon: "⚡", target: 1000, count: (s) => s.xp },
  { id: "marathoner", title: "Marathoner", description: "Earn 2,000 XP.", icon: "🏃", target: 2000, count: (s) => s.xp },
  { id: "quiz-ace", title: "Quiz Ace", description: "Hit a perfect quiz.", icon: "🎯", target: 1, count: (s) => Object.values(s.quizResults).filter((result) => result.perfect).length },
  { id: "quiz-master", title: "Quiz Master", description: "Five perfect quizzes.", icon: "🧠", target: 5, count: (s) => Object.values(s.quizResults).filter((result) => result.perfect).length },
  { id: "card-scholar", title: "Card Scholar", description: "Review 25 flashcards.", icon: "🗂️", target: 25, count: (s) => Object.keys(s.cardReviews).length },
  { id: "independent-operator", title: "Independent Operator", description: "Reach Independent (85) on 10 objectives.", icon: "🎓", target: 10, count: (s) => objectivesAtOrAbove(s.mastery, MASTERY_BANDS.independent) },
  { id: "exam-ready", title: "Exam Ready", description: "All 47 objectives at Guided (70) or better.", icon: "✅", target: ENCOR_DOMAINS.reduce((sum, domain) => sum + domain.objectives.length, 0), count: (s) => objectivesAtOrAbove(s.mastery, MASTERY_BANDS.guided) },
  { id: "week-warrior", title: "Week Warrior", description: "Build a 7-day streak.", icon: "🔥", target: 7, count: (s) => s.streak },
];

export type BadgeStatus = {
  badge: BadgeDefinition;
  /** Progress capped at the target. */
  progress: number;
  earned: boolean;
};

export function getBadgeStatus(snapshot: BadgeSnapshot): BadgeStatus[] {
  return BADGES.map((badge) => {
    const progress = Math.min(badge.count(snapshot), badge.target);
    return { badge, progress, earned: progress >= badge.target };
  });
}
