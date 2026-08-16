/**
 * IOS-style console Tab completion.
 *
 * Real IOS Tab completes the keyword under the cursor from the command grammar
 * of the current mode: `sh<Tab>` → `show `, `show ip o<Tab>` → `show ip ospf `,
 * and it refuses to guess when the abbreviation is ambiguous. This module
 * reproduces that for the NetQuest consoles:
 *
 *   - The current (last) word completes against the tokens that appear at the
 *     same position across the *completion commands* the parent knows for the
 *     current step (e.g. the phase's accepted command list). That makes
 *     `int g<Tab>` finish `gi0/5` and `switchport trunk al<Tab>` finish
 *     `allowed` — exactly the commands the engine will accept.
 *   - Without a command list it falls back to the app's IOS keyword
 *     vocabulary (leading keywords for the first word, sub-keywords after),
 *     with the same explicit short-form map the console input uses, so
 *     `sh<Tab>` → `show ` and `en<Tab>` → `enable` even where the raw
 *     vocabularies are ambiguous (`sh` could be `shutdown`, `en` `end`).
 *   - Ambiguity otherwise extends to the longest shared prefix (shell-style);
 *     with nothing shared the input is left untouched so Enter can return
 *     `% Invalid input` rather than a silently guessed command.
 *   - `do <exec>…` from config mode shifts the inner command's positions by
 *     one, so `do sh<Tab>` completes `show`, not the mode command.
 */

import { IOS_LEADING_KEYWORDS, IOS_SUB_KEYWORDS, LEADING, TOKEN } from "./ios-abbrev";

/** Candidate tokens for a word position: position tokens from the parent's
 * command list first; the plain vocabulary only when no commands are known. */
function candidateTokens(completions: string[], position: number): Set<string> {
  const pool = new Set<string>();
  for (const command of completions) {
    const tokens = command.split(" ");
    if (tokens[position]) pool.add(tokens[position]);
  }
  // The cursor passed every known command's last word: offer any token.
  if (pool.size === 0) {
    for (const command of completions) {
      for (const token of command.split(" ")) pool.add(token);
    }
  }
  if (pool.size === 0) {
    for (const keyword of position === 0 ? IOS_LEADING_KEYWORDS : IOS_SUB_KEYWORDS) pool.add(keyword);
  }
  return pool;
}

/**
 * Complete the last word of `input` against the given completion commands.
 * Returns the input unchanged when nothing can be completed (no match,
 * ambiguous with no shared prefix, empty word, or empty input).
 */
export function iosTabComplete(input: string, completions: string[]): string {
  if (!input.trim()) return input;

  const lower = input.toLowerCase().replace(/\s+/g, " ");
  // `do <exec-command>`: the inner command's positions shift by one.
  const doShift = lower === "do" || lower.startsWith("do ") ? 1 : 0;

  const lastSpace = input.lastIndexOf(" ");
  const partial = lastSpace === -1 ? input.trim() : input.slice(lastSpace + 1);
  if (!partial) return input;

  // Word index of the partial token (0-based), shifted for `do`.
  const position = (lastSpace === -1 ? 0 : input.slice(0, lastSpace).trim().split(/\s+/).length) - doShift;
  if (position < 0) return input;

  const pool = candidateTokens(completions, position);
  let matches = [...pool].filter((token) => token.toLowerCase().startsWith(partial.toLowerCase()));

  // The app's explicit short-form rules (sh→show, en→enable, run→running-config,
  // wr→write memory…) win over an ambiguous raw-vocabulary match.
  const explicit = (position === 0 ? LEADING : TOKEN)[partial.toLowerCase()];
  if (explicit) matches = [explicit];
  else if (matches.length === 0) return input;

  const prefix = lastSpace === -1 ? "" : input.slice(0, lastSpace + 1);

  if (matches.length === 1) {
    const word = matches[0];
    // A trailing space only when the same command word is followed by more
    // keywords somewhere (e.g. `enable` stays bare, `show ` leaves room).
    const hasMore = completions.some(
      (command) => command.split(" ")[position] === word && command.split(" ").length > position + 1,
    );
    return `${prefix}${word}${hasMore ? " " : ""}`;
  }

  // Ambiguous: extend to the longest shared prefix (shell-style), if any.
  const lowerMatches = matches.map((token) => token.toLowerCase());
  let shared = partial.toLowerCase();
  const first = lowerMatches[0];
  let i = partial.length;
  while (i < first.length && lowerMatches.every((token) => token[i] === first[i])) {
    shared += first[i];
    i += 1;
  }
  if (i <= partial.length) return input;
  return `${prefix}${shared}`;
}