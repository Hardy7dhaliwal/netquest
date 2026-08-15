/**
 * Real IOS `do <exec-command>`: from any configuration mode, run an EXEC
 * command (a `show`, `ping`, etc.) without leaving the mode. The console stays
 * on the config prompt, the echoed input keeps the `do` prefix, and only the
 * inner command's output is shown — exactly how IOS lets you peek at state
 * mid-configuration.
 */

/** Configuration (sub)modes where `do` is valid. EXEC modes (`user`, `exec`,
 * `privileged`) and non-IOS shells (`repl`) are deliberately excluded. */
const CONFIG_MODES = new Set([
  "config",
  "interface",
  "config-if",
  "config-router",
  "config-vrf",
  "config-isakmp",
  "config-crypto-map",
]);

type CliHistoryEntry = { input: string; output: string; prompt: string };

/**
 * Attempt to run a `do` command. Returns the updated state (mode preserved,
 * history entry re-labeled with the `do` input and the config prompt), or
 * `null` when the input isn't a `do` command or the console isn't in a
 * configuration mode — in which case the caller should fall through to its
 * normal command matching.
 *
 * `dispatchExec` runs the inner command as if the console were in privileged
 * EXEC; it is expected to be the engine's own command runner (recursion is
 * safe because the inner command never starts with `do`).
 */
export function tryRunDo<S extends { cliMode: string; cliHistory: CliHistoryEntry[] }>(
  state: S,
  rawCommand: string,
  configPrompt: string,
  dispatchExec: (state: S, command: string) => S,
): S | null {
  const trimmed = rawCommand.trim();
  if (!/^do\s+/i.test(trimmed) || !CONFIG_MODES.has(state.cliMode)) return null;
  const inner = trimmed.slice(2).trim();
  if (!inner) return null;

  const result = dispatchExec({ ...state, cliMode: "privileged" } as S, inner);
  // A `do` that just reads state leaves the console in the (forced) privileged
  // mode — restore the real config mode. If the inner command tripped a phase
  // transition, the engine resets the console for the next phase (e.g. "user");
  // respect that reset rather than dragging a stale config mode along.
  const nextMode = result.cliMode === "privileged" ? state.cliMode : result.cliMode;
  const history = result.cliHistory.map((entry, i) =>
    i === result.cliHistory.length - 1
      ? { ...entry, input: rawCommand, prompt: configPrompt }
      : entry,
  );
  return { ...result, cliMode: nextMode, cliHistory: history } as S;
}
