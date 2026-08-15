"use client";

export type NextMission = { title: string; onOpen: () => void };

/**
 * "Next mission" call-to-action shown on a mission's completion banner so a
 * player can continue their path in one click instead of bouncing back to the
 * dashboard and then re-finding the next mission. Renders nothing when there
 * is no next mission (the finale, or a replay with nothing left unplayed).
 */
export function NextMissionButton({ next }: { next: NextMission | null | undefined }) {
  if (!next) return null;
  return (
    <button
      className="mt-4 rounded-lg bg-cyan-300 px-4 py-2 text-sm font-bold text-slate-950 transition hover:bg-cyan-200 focus:outline-none focus:ring-2 focus:ring-cyan-300 focus:ring-offset-2 focus:ring-offset-slate-950"
      onClick={next.onOpen}
      type="button"
    >
      Next mission: {next.title} <span aria-hidden="true">→</span>
    </button>
  );
}
