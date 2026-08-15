/**
 * Realistic IOS `?` help. Real IOS `?` lists the command keywords available at
 * the current mode level — it never prints the exact command-and-arguments a
 * task expects. This module reproduces that behavior for the mission consoles,
 * so typing `?` shows what you *can* run in the current mode without giving
 * away the answer to the current step (that stays behind `help`, the app's
 * explicit hint affordance).
 */

type HelpCommand = { cmd: string; desc: string };

function formatHelp(title: string, commands: HelpCommand[]): string {
  const width = Math.max(...commands.map((c) => c.cmd.length));
  const rows = commands.map((c) => `  ${c.cmd.padEnd(width + 2)}${c.desc}`);
  return [title + ":", ...rows].join("\n");
}

const USER_EXEC: HelpCommand[] = [
  { cmd: "enable", desc: "Turn on privileged commands" },
  { cmd: "exit", desc: "Exit from the EXEC" },
  { cmd: "ping", desc: "Send echo messages" },
  { cmd: "show", desc: "Show running system information" },
  { cmd: "traceroute", desc: "Trace route to destination" },
  { cmd: "help", desc: "Show a hint for this step" },
];

const PRIVILEGED: HelpCommand[] = [
  { cmd: "configure terminal", desc: "Enter global configuration mode" },
  { cmd: "show", desc: "Show running system information" },
  { cmd: "ping", desc: "Send echo messages" },
  { cmd: "traceroute", desc: "Trace route to destination" },
  { cmd: "end", desc: "Return to privileged EXEC" },
  { cmd: "exit", desc: "Return to user EXEC" },
  { cmd: "help", desc: "Show a hint for this step" },
];

const CONFIG: HelpCommand[] = [
  { cmd: "interface", desc: "Configure an interface" },
  { cmd: "router", desc: "Enter a routing process" },
  { cmd: "ip", desc: "Global IP configuration" },
  { cmd: "access-list", desc: "Define an access list" },
  { cmd: "username", desc: "Configure a local user" },
  { cmd: "line", desc: "Configure terminal lines" },
  { cmd: "vrf", desc: "Define a VRF instance" },
  { cmd: "end", desc: "Return to privileged EXEC" },
  { cmd: "exit", desc: "Return to privileged EXEC" },
  { cmd: "help", desc: "Show a hint for this step" },
];

const CONFIG_IF: HelpCommand[] = [
  { cmd: "ip", desc: "Interface IP configuration" },
  { cmd: "shutdown", desc: "Shut down the interface" },
  { cmd: "switchport", desc: "Set switching mode characteristics" },
  { cmd: "channel-group", desc: "EtherChannel configuration" },
  { cmd: "spanning-tree", desc: "Spanning-tree configuration" },
  { cmd: "tunnel", desc: "Tunnel interface configuration" },
  { cmd: "vrf", desc: "Assign a VRF to the interface" },
  { cmd: "end", desc: "Return to privileged EXEC" },
  { cmd: "exit", desc: "Return to global configuration" },
  { cmd: "help", desc: "Show a hint for this step" },
];

const CONFIG_ROUTER: HelpCommand[] = [
  { cmd: "network", desc: "Enable routing on an interface" },
  { cmd: "area", desc: "OSPF area configuration" },
  { cmd: "router-id", desc: "Set the router ID" },
  { cmd: "neighbor", desc: "Neighbor configuration" },
  { cmd: "redistribute", desc: "Redistribute routes" },
  { cmd: "end", desc: "Return to privileged EXEC" },
  { cmd: "exit", desc: "Return to global configuration" },
  { cmd: "help", desc: "Show a hint for this step" },
];

const CONFIG_VRF: HelpCommand[] = [
  { cmd: "rd", desc: "Route distinguisher" },
  { cmd: "address-family", desc: "Enter an address family" },
  { cmd: "end", desc: "Return to privileged EXEC" },
  { cmd: "exit", desc: "Return to global configuration" },
  { cmd: "help", desc: "Show a hint for this step" },
];

const CONFIG_ISAKMP: HelpCommand[] = [
  { cmd: "encryption", desc: "Set the IKE encryption algorithm" },
  { cmd: "hash", desc: "Set the IKE integrity algorithm" },
  { cmd: "authentication", desc: "Set the IKE authentication method" },
  { cmd: "group", desc: "Set the Diffie-Hellman group" },
  { cmd: "end", desc: "Return to privileged EXEC" },
  { cmd: "exit", desc: "Return to global configuration" },
  { cmd: "help", desc: "Show a hint for this step" },
];

const CONFIG_CRYPTO_MAP: HelpCommand[] = [
  { cmd: "set", desc: "Set crypto map attributes" },
  { cmd: "match", desc: "Match an access list" },
  { cmd: "end", desc: "Return to privileged EXEC" },
  { cmd: "exit", desc: "Return to global configuration" },
  { cmd: "help", desc: "Show a hint for this step" },
];

const REPL: HelpCommand[] = [
  { cmd: "import", desc: "Import a Python module" },
  { cmd: "print", desc: "Print a value" },
  { cmd: "exit", desc: "Return to privileged EXEC" },
  { cmd: "help", desc: "Show a hint for this step" },
];

const MODE_TITLES: Record<string, string> = {
  exec: "Exec commands",
  user: "Exec commands",
  privileged: "Privileged EXEC commands",
  config: "Global configuration commands",
  interface: "Interface configuration commands",
  "config-if": "Interface configuration commands",
  "config-router": "Router configuration commands",
  "config-vrf": "VRF configuration commands",
  "config-isakmp": "ISAKMP policy configuration commands",
  "config-crypto-map": "Crypto map configuration commands",
  repl: "Python/JSON shell",
};

const MODE_COMMANDS: Record<string, HelpCommand[]> = {
  exec: USER_EXEC,
  user: USER_EXEC,
  privileged: PRIVILEGED,
  config: CONFIG,
  interface: CONFIG_IF,
  "config-if": CONFIG_IF,
  "config-router": CONFIG_ROUTER,
  "config-vrf": CONFIG_VRF,
  "config-isakmp": CONFIG_ISAKMP,
  "config-crypto-map": CONFIG_CRYPTO_MAP,
  repl: REPL,
};

/** IOS-style `?` output for a given CLI mode (falls back to user EXEC). */
export function iosHelpForMode(mode: string): string {
  const commands = MODE_COMMANDS[mode] ?? USER_EXEC;
  const title = MODE_TITLES[mode] ?? "Exec commands";
  return formatHelp(title, commands);
}
