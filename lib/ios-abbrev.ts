/**
 * Cisco IOS-style command abbreviation support.
 *
 * Real IOS accepts any unambiguous abbreviation of a command keyword: `en` for
 * `enable`, `conf t` for `configure terminal`, `sh run` for `show
 * running-config`, `int g0/1` for `interface g0/1`. This module reproduces the
 * common short forms for the commands NetQuest teaches, so the console accepts
 * the same abbreviations a real device would — no surprises when you sit in
 * front of actual gear.
 *
 * It is deliberately conservative: it only expands well-known abbreviations
 * and leaves unknown tokens untouched, so a mistyped command still returns
 * `% Invalid input` instead of being silently guessed.
 */

/** Leading-token abbreviations (the first word of the command). */
const LEADING: Record<string, string> = {
  en: "enable",
  sh: "show",
  conf: "configure",
  con: "configure",
  int: "interface",
  shut: "shutdown",
  // `wr` is the classic IOS "save the config" shortcut: write memory.
  wr: "write memory",
};

/**
 * Sub-keyword abbreviations, expanded on any token after the first. These are
 * the unambiguous short forms IOS itself resolves (e.g. the `nei` in
 * `sh ip ospf nei`, the `sum` in `sh ip bgp sum`).
 */
const TOKEN: Record<string, string> = {
  run: "running-config",
  running: "running-config",
  nei: "neighbor",
  sum: "summary",
  br: "brief",
  stand: "standby",
  ver: "version",
  stat: "statistics",
  trans: "translations",
  sess: "session",
  conn: "connections",
  // `no shut` → `no shutdown` (and `shut` already maps in LEADING).
  shut: "shutdown",
};

/**
 * Keywords that can follow `show int` and resolve to the plural `interfaces`
 * (`show interfaces trunk`). Anything else after `show int` is an interface
 * name, so it resolves to the singular `interface` (`show interface gi0/1`).
 */
const INTERFACE_KEYWORDS = new Set([
  "trunk",
  "status",
  "brief",
  "switchport",
  "summary",
  "count",
  "description",
]);

/**
 * Normalize an IOS command line: lowercase, collapse runs of whitespace, and
 * expand common abbreviations to their full keyword form. Unknown tokens and
 * non-IOS input (e.g. `esxcli …`, `curl …`) pass through unchanged.
 */
export function normalizeIosCommand(raw: string): string {
  const base = raw.trim().toLowerCase().replace(/\s+/g, " ");
  if (!base) return base;

  const tokens = base.split(" ");
  const out: string[] = [];

  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    const next = tokens[i + 1];

    if (i === 0) {
      out.push(LEADING[tok] ?? tok);
      continue;
    }

    // `conf t` / `conf term` / `configure t` → `configure terminal`
    if (out[0] === "configure" && (tok === "t" || tok === "term" || tok === "terminal")) {
      out.push("terminal");
      continue;
    }

    // `show int <keyword>` → `show interfaces <keyword>`; `show int <ifname>`
    // → `show interface <ifname>`. But `show ip int …` is always the singular
    // `interface` (`show ip interface brief`, `show ip interface gi0/1`).
    if (tok === "int" || tok === "intf") {
      if (out[i - 1] === "show") {
        out.push(INTERFACE_KEYWORDS.has(next) ? "interfaces" : "interface");
        continue;
      }
      if (out[i - 1] === "ip" && out[i - 2] === "show") {
        out.push("interface");
        continue;
      }
    }

    out.push(TOKEN[tok] ?? tok);
  }

  return out.join(" ");
}
