/**
 * Cisco IOS-style command abbreviation support.
 *
 * Real IOS accepts any unambiguous abbreviation of a command keyword: `en` for
 * `enable`, `conf t` for `configure terminal`, `sh run` for `show
 * running-config`, `sh ip ospf ne` for `show ip ospf neighbor`. This module
 * reproduces that behavior for the commands NetQuest teaches, so the console
 * accepts the same short forms a real device would — no surprises when you sit
 * in front of actual gear.
 *
 * Two passes work together:
 *   1. A small explicit map for the short forms that are *ambiguous* but which
 *      IOS always resolves a specific way (`sh` → `show`, `int` → `interface`,
 *      `wr` → `write memory`), and for the show-int plural rule.
 *   2. A general prefix resolver: any other token that is an unambiguous
 *      prefix of exactly one known keyword expands to that keyword.
 *
 * The resolver is deliberately conservative, mirroring IOS:
 *   - An *ambiguous* prefix (matches 2+ keywords) is left untouched, so it
 *     falls through to `% Invalid input` instead of being silently guessed.
 *   - Unknown tokens (interface names, IPs, numbers, arguments, and non-IOS
 *     input like `esxcli …` or the Python/JSON REPL) pass through unchanged.
 *
 * Keywords are split into two vocabularies — words that can *start* a command
 * vs. words that follow one — so an abbreviation like `ne` resolves to
 * `neighbor` in `sh ip ospf ne` (where `network` never appears) while staying
 * ambiguous as a first token (where `network` and `neighbor` both exist).
 */

/** Explicit leading-token abbreviations (first word of the command). These
 * encode resolutions a naive prefix scan would get wrong: `sh` is ambiguous
 * between `show` and `shutdown`, `en` between `enable`/`end`/`encryption`,
 * and `wr` expands to the two-word `write memory`. */
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
 * Explicit sub-keyword abbreviations, expanded on any token after the first.
 * These are the unambiguous short forms IOS itself resolves (e.g. the `nei`
 * in `sh ip ospf nei`, the `sum` in `sh ip bgp sum`). Kept as overrides so a
 * future vocab collision can never silently change their meaning.
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

/** Keywords that can appear as the FIRST token of a command. */
const LEADING_WORDS = new Set([
  "enable", "end", "exit", "show", "configure", "ping", "traceroute",
  "interface", "router", "neighbor", "ip", "access-list", "username",
  "line", "vrf", "spanning-tree", "channel-group", "shutdown", "crypto",
  "monitor", "debug", "undebug", "restconf", "aaa", "radius", "address",
  "key", "login", "transport", "icmp-echo", "frequency", "encryption",
  "hash", "authentication", "group", "set", "match", "network", "area",
  "router-id", "redistribute", "switchport", "tunnel", "no", "write",
  "event", "action", "dot1x", "ntp", "ptp", "clock", "hostname", "cts",
]);

/**
 * Keywords that can appear after the first token. Deliberately excludes the
 * words that would make common short forms ambiguous:
 *   - `network`, `netconf`, `netconf-yang`, `neighbors`, `new-model` (so `ne` → `neighbor`)
 *   - `sparse-mode`, `dense-mode` (so `spa` → `spanning-tree`)
 * All of them still work when typed in full — they simply pass through.
 */
const SUB_WORDS = new Set([
  "terminal", "memory", "running-config", "brief", "interface", "interfaces",
  "trunk", "status", "switchport", "summary", "detail", "neighbor", "ospf",
  "bgp", "eigrp", "ipv6", "ip", "nat", "statistics", "translations",
  "translation", "inside", "outside", "in", "out", "source", "list", "overload", "standby",
  "vrrp", "version", "session", "sessions", "map-cache", "site", "vni",
  "peers", "nve", "vrf", "pim", "mroute", "rp", "mapping", "policy-map",
  "class-map", "route", "route-map", "topology", "access-lists", "access-list",
  "access-group", "permit", "deny", "tcp", "udp", "icmp", "gre", "host",
  "any", "eq", "etherchannel", "spanning-tree", "mst", "configuration",
  "lisp", "dot1x", "authentication", "service-policy", "crypto", "ca",
  "certificates", "ipsec", "isakmp", "sa", "cts", "role-based", "sgt-map",
  "counters", "sxp", "connections", "omp", "routes", "tlocs", "bfd",
  "control", "control-plane", "monitor", "sla", "restconf", "ntp", "ptp",
  "clock", "associations", "macsec", "mka", "logging", "login", "snmp",
  "community", "flow", "exporter", "record", "cache", "event", "manager",
  "history", "events", "policy", "available", "track", "definition",
  "forwarding", "address-family", "rd", "key", "address", "peer",
  "transform-set", "pre-share", "aes", "sha256", "esp-aes", "esp-sha-hmac",
  "group", "pae", "authenticator", "both", "system-auth-control", "server",
  "master", "broadcast", "domain", "priority1", "timezone", "applet",
  "syslog", "pattern", "cli", "command", "msg", "default",
  "local", "radius", "secret", "ssh", "ssl", "http", "secure-server",
  "multicast-routing", "igmp", "mtu", "adjust-mss", "prefix", "prefix-list",
  "ebgp-multihop", "guard", "root", "bpduguard", "enable", "priority",
  "region", "name", "instance", "mode", "native", "allowed", "vlan", "add",
  "remove", "encapsulation", "dot1q",  "erspan-id", "filter", "filter-list", "destination",
  "gigabitethernet0/1", "include", "section", "begin", "exclude", "cost",
  "dead-interval", "mtu-ignore", "schedule", "life", "forever", "start-time",
  "now", "aaa",
]);

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

/** Expand `token` if it is an unambiguous prefix of exactly one known keyword;
 * otherwise return it unchanged (ambiguous, unknown, or already exact). */
function resolveToken(token: string, words: ReadonlySet<string>): string {
  if (words.has(token)) return token;
  let match: string | null = null;
  for (const word of words) {
    if (word.startsWith(token)) {
      if (match !== null) return token; // ambiguous — leave for `% Invalid input`
      match = word;
    }
  }
  return match ?? token;
}

/**
 * Normalize an IOS command line: lowercase, collapse runs of whitespace, and
 * expand common abbreviations — including any unambiguous prefix — to their
 * full keyword form. Unknown tokens and non-IOS input (e.g. `esxcli …`,
 * `curl …`, Python) pass through unchanged.
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
      out.push(LEADING[tok] ?? resolveToken(tok, LEADING_WORDS));
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
    // Anywhere else (`show spanning-tree int gi0/5`, `monitor … source int
    // gi0/1`) `int` means the singular `interface`.
    if (tok === "int" || tok === "intf") {
      if (out[i - 1] === "show") {
        out.push(INTERFACE_KEYWORDS.has(next) ? "interfaces" : "interface");
        continue;
      }
      if (out[i - 1] === "ip" && out[i - 2] === "show") {
        out.push("interface");
        continue;
      }
      out.push("interface");
      continue;
    }

    out.push(TOKEN[tok] ?? resolveToken(tok, SUB_WORDS));
  }

  return out.join(" ");
}
