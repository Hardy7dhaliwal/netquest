import { dateKey } from "./boss";

/**
 * Streak math for the daily-challenge calendar (PRD §14). A streak is
 * consecutive calendar days with a claimed challenge; a missed day breaks it.
 * The store keeps a generic activity streak for the stat cards — the calendar
 * derives its own runs from the claimed-day history so the picture it paints
 * always matches the cells it draws.
 */

const DAY_MS = 86_400_000;

/** Calendar-safe day arithmetic (setDate-based, so DST never shifts a day). */
export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

/** Longest unbroken run of claimed days, or 0 when none. */
export function longestRun(dateKeys: string[]): number {
  const days = [...new Set(dateKeys)]
    .map((key) => Date.parse(`${key}T00:00:00Z`))
    .sort((a, b) => a - b);
  let best = 0;
  let run = 0;
  let previous = 0;
  for (const day of days) {
    run = run > 0 && day === previous + DAY_MS ? run + 1 : 1;
    best = Math.max(best, run);
    previous = day;
  }
  return best;
}

/**
 * Length of the current unbroken run ending today — or yesterday while today
 * is still claimable, so a pending challenge keeps the chain alive until the
 * day ends.
 */
export function currentRun(dateKeys: string[], now: Date = new Date()): number {
  const claimed = new Set(dateKeys);
  let cursor = now;
  if (!claimed.has(dateKey(cursor))) cursor = addDays(cursor, -1);
  let run = 0;
  while (claimed.has(dateKey(cursor))) {
    run += 1;
    cursor = addDays(cursor, -1);
  }
  return run;
}
