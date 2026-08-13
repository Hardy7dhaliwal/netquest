import { ENCOR_DOMAINS } from "./encor-catalog";
import { getMasterySummary, MASTERY_BANDS, objectiveScore, type MasteryMap } from "./mastery";
import { getBlueprintCoverage, getCurriculumStatusMap } from "./curriculum";
import {
  hasRecentTimedSuccess,
  isIndependent as isSkillIndependent,
  objectiveState,
  primarySkill,
  skillAverage,
  weakObjectives as weakSkillObjectives,
  type SkillMap,
} from "./skills";

/**
 * Exam-readiness engine (PRD §19 exam-readiness reporting). Unlike coverage —
 * which asks "does a mission exist for this objective?" — readiness asks "how
 * well has the player practiced it?". Each objective contributes its mastery
 * score, each domain is weighted by its share of the exam, and the result is
 * a single 0-100 readiness figure plus a verdict band.
 */

export type ReadinessVerdict = "starting" | "developing" | "approaching" | "ready";

export type ReadinessBandBreakdown = {
  unseen: number;
  introduced: number;
  recognized: number;
  guided: number;
  independent: number;
};

export type DomainReadiness = {
  domainId: string;
  title: string;
  weight: number;
  /** Mean mastery of the domain's objectives, rounded. */
  average: number;
};

export type ExamReadiness = {
  readiness: number;
  verdict: ReadinessVerdict;
  verdictLabel: string;
  verdictCopy: string;
  bands: ReadinessBandBreakdown;
  domains: DomainReadiness[];
};

const VERDICTS: Record<ReadinessVerdict, { label: string; copy: string }> = {
  starting: { label: "Getting started", copy: "Play through the missions to build command of the blueprint." },
  developing: { label: "Developing", copy: "A solid base is forming — keep practicing and reviewing weak topics." },
  approaching: { label: "Approaching ready", copy: "Nearly there — top up the objectives still below Guided." },
  ready: { label: "Exam-ready", copy: "Independent across the board — take on boss battles to push your objectives toward Under Pressure (95)." },
};

export function getExamReadiness(mastery: MasteryMap): ExamReadiness {
  // Per-domain averages come from the shared mastery summary (same rounding).
  const domains: DomainReadiness[] = getMasterySummary(mastery).map(({ domain, average }) => ({
    domainId: domain.id,
    title: domain.title,
    weight: domain.weight,
    average,
  }));

  const totalWeight = ENCOR_DOMAINS.reduce((sum, domain) => sum + domain.weight, 0);
  const readiness = Math.round(
    domains.reduce((sum, entry) => sum + entry.average * entry.weight, 0) / Math.max(totalWeight, 1),
  );

  const bands: ReadinessBandBreakdown = { unseen: 0, introduced: 0, recognized: 0, guided: 0, independent: 0 };
  for (const domain of ENCOR_DOMAINS) {
    for (const objective of domain.objectives) {
      const score = objectiveScore(mastery, objective.id);
      if (score >= MASTERY_BANDS.independent) bands.independent += 1;
      else if (score >= MASTERY_BANDS.guided) bands.guided += 1;
      else if (score >= MASTERY_BANDS.recognized) bands.recognized += 1;
      else if (score > 0) bands.introduced += 1;
      else bands.unseen += 1;
    }
  }

  const verdict: ReadinessVerdict = readiness >= MASTERY_BANDS.independent ? "ready" : readiness >= MASTERY_BANDS.guided ? "approaching" : readiness >= MASTERY_BANDS.recognized ? "developing" : "starting";

  return { readiness, verdict, verdictLabel: VERDICTS[verdict].label, verdictCopy: VERDICTS[verdict].copy, bands, domains };
}

// ─── Multi-dimensional readiness (learn-and-pass phase) ─────────────────────

/** Best mock-exam percentage recorded, per exam kind. */
export type ExamScoreHistory = Record<string, { pct: number; passed: boolean; at: number }>;

export type ReadinessDimension = {
  key: string;
  label: string;
  /** 0-100 score. */
  score: number;
  /** Short human explanation of what this dimension measures. */
  copy: string;
};

export type ReadinessConfidence = "low" | "medium" | "high";

export type RemainingRequirement = {
  id: string;
  label: string;
  /** True when this requirement is already satisfied. */
  met: boolean;
  /** Specific action the learner still needs to take (when not met). */
  action: string;
};

export type WeakObjective = {
  objectiveId: string;
  label: string;
  domain: string;
  /** Score on the objective's primary skill. */
  score: number;
};

export type ReadinessReportV2 = {
  /** % of objectives with a complete/verified curriculum. */
  blueprintCoverage: number;
  /** Mean recall+interpret skill across practiced objectives. */
  knowledgeScore: number;
  /** Mean configuration skill. */
  configurationScore: number;
  /** Mean troubleshooting skill. */
  troubleshootingScore: number;
  /** Best mock-exam score (0-100). */
  timedExamScore: number;
  /** Best mock-exam kind ("none" when none taken). */
  bestExamKind: string | null;
  confidence: ReadinessConfidence;
  dimensions: ReadinessDimension[];
  weakest: WeakObjective[];
  remaining: RemainingRequirement[];
  /** Strict gate: only true when every requirement is met. */
  examReady: boolean;
  /** Summary sentence for the UI. */
  verdictCopy: string;
};

const EXAM_READY_THRESHOLDS = {
  /** Blueprint objectives at complete/verified share. */
  coveragePct: 100,
  /** Every objective must be Independent on its primary skill. */
  independentAll: true,
  /** A mock exam must be passed at this percentage. */
  mockPassPct: 70,
  /** Timed success must be recent (see skills.TIMED_RECENCY_MS). */
  recentTimed: true,
  /** No Infrastructure or Security objective below this primary-skill score. */
  noHighRiskBelow: 70,
} as const;

function mean(scores: number[]): number {
  const present = scores.filter((score) => score > 0);
  return present.length ? Math.round(present.reduce((sum, score) => sum + score, 0) / present.length) : 0;
}

/** Multi-dimensional readiness used by the report panel. */
export function getReadinessReportV2(
  mastery: MasteryMap,
  skills: SkillMap,
  examHistory: ExamScoreHistory = {},
  now: number = Date.now(),
): ReadinessReportV2 {
  const coverage = getBlueprintCoverage();
  const statusMap = getCurriculumStatusMap();
  const blueprintCoverage = Math.round(((coverage.complete + coverage.verified) / coverage.total) * 100);

  const allObjectives = ENCOR_DOMAINS.flatMap((domain) => domain.objectives);
  const knowledgeScore = mean([skillAverage(skills, "recall"), skillAverage(skills, "interpret")]);
  const configurationScore = skillAverage(skills, "configure");
  const troubleshootingScore = skillAverage(skills, "troubleshoot");

  const bestExam = Object.values(examHistory).sort((a, b) => b.pct - a.pct)[0];
  const timedExamScore = bestExam?.pct ?? 0;
  const bestExamKind = bestExam ? Object.keys(examHistory).find((kind) => examHistory[kind] === bestExam) ?? null : null;

  // Weakest objectives by primary-skill score (only ones below Guided count).
  const weak = weakSkillObjectives(skills, allObjectives, MASTERY_BANDS.guided)
    .slice(0, 5)
    .map((objective) => {
      const domain = ENCOR_DOMAINS.find((d) => d.objectives.includes(objective));
      return {
        objectiveId: objective.id,
        label: objective.label,
        domain: domain?.title ?? "",
        score: objectiveState(skills, objective.id).scores[primarySkill(objective.interaction)],
      };
    });

  const dimensions: ReadinessDimension[] = [
    { key: "blueprint", label: "Blueprint coverage", score: blueprintCoverage, copy: "Objectives with a complete, verified teaching plan." },
    { key: "knowledge", label: "Knowledge", score: knowledgeScore, copy: "Recall and output-interpretation across practiced objectives." },
    { key: "configuration", label: "Configuration", score: configurationScore, copy: "Hands-on config skill from missions and lab variants." },
    { key: "troubleshooting", label: "Troubleshooting", score: troubleshootingScore, copy: "Diagnosing faults from real outputs and symptoms." },
    { key: "timed", label: "Timed exam", score: timedExamScore, copy: "Best mixed mock-exam performance under time pressure." },
  ];

  // Requirements checklist (explicit remaining work before 'ready').
  const allIndependent = allObjectives.every((objective) => isSkillIndependent(skills, objective));
  const allCovered = statusMap && Object.values(statusMap).every((status) => status === "complete" || status === "verified");
  const mockPassed = Object.values(examHistory).some((entry) => entry.passed && entry.pct >= EXAM_READY_THRESHOLDS.mockPassPct);
  const recentTimed = allObjectives.some((objective) => hasRecentTimedSuccess(skills, objective.id, now));
  const highRisk = ENCOR_DOMAINS.filter((domain) => domain.id === "infrastructure" || domain.id === "security").flatMap((domain) =>
    domain.objectives.filter((objective) => objectiveState(skills, objective.id).scores[primarySkill(objective.interaction)] < EXAM_READY_THRESHOLDS.noHighRiskBelow),
  );

  const remaining: RemainingRequirement[] = [
    {
      id: "coverage",
      label: "Complete curriculum coverage",
      met: allCovered,
      action: "Every objective needs a complete teaching plan (lesson, scenarios, assessments, review cards).",
    },
    {
      id: "independent",
      label: "Independent mastery on every objective",
      met: allIndependent,
      action: "Reach Independent (2 clean runs across 2 variants) on every objective's primary skill.",
    },
    {
      id: "mock",
      label: "Pass a full-length mixed mock exam",
      met: mockPassed,
      action: `Score at least ${EXAM_READY_THRESHOLDS.mockPassPct}% on a timed mock exam (A or B).`,
    },
    {
      id: "timed",
      label: "Recent success under time pressure",
      met: recentTimed,
      action: "Pass a timed assessment (mock exam or boss battle) within the last 30 days.",
    },
    {
      id: "highrisk",
      label: "No high-risk weak areas in Infrastructure or Security",
      met: highRisk.length === 0,
      action: highRisk.length
        ? `Still below ${EXAM_READY_THRESHOLDS.noHighRiskBelow}: ${highRisk.slice(0, 4).map((o) => o.id).join(", ")}.`
        : "Every Infrastructure and Security objective is at or above the safe threshold.",
    },
  ];

  const examReady = remaining.every((requirement) => requirement.met);
  const metCount = remaining.filter((requirement) => requirement.met).length;
  const confidence: ReadinessConfidence = examReady ? "high" : metCount >= 3 ? "medium" : "low";
  const verdictCopy = examReady
    ? "You meet every readiness requirement — complete verified coverage, Independent mastery, a passing timed mock, and no high-risk weak areas."
    : `${metCount} of ${remaining.length} exam-readiness requirements met. Focus on the unmet requirements below.`;

  return {
    blueprintCoverage,
    knowledgeScore,
    configurationScore,
    troubleshootingScore,
    timedExamScore,
    bestExamKind,
    confidence,
    dimensions,
    weakest: weak,
    remaining,
    examReady,
    verdictCopy,
  };
}

/** Legacy single-number wrapper (used where a % is enough). */
export function getReadinessV2Percent(report: ReadinessReportV2): number {
  const weights = [0.2, 0.2, 0.25, 0.2, 0.15];
  const scores = [report.blueprintCoverage, report.knowledgeScore, report.configurationScore, report.troubleshootingScore, report.timedExamScore];
  return Math.round(scores.reduce((sum, score, index) => sum + score * weights[index], 0));
}
