import { ENCOR_DOMAINS } from "./encor-catalog";
import { getMasterySummary, MASTERY_BANDS, objectiveScore, type MasteryMap } from "./mastery";

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
