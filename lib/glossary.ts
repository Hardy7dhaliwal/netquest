export const GLOSSARY_CATEGORIES = ["Switching", "Routing", "CLI", "Concepts", "Tools"] as const;

export type GlossaryCategory = (typeof GLOSSARY_CATEGORIES)[number];

export type GlossaryEntry = {
  term: string;
  category: GlossaryCategory;
  /** One crisp, beginner-friendly sentence. */
  definition: string;
  /** Optional longer explanation, often tied to a specific NetQuest mission. */
  detail?: string;
  /** Alternate phrasings that should link to this term, e.g. "gateway" → "Default gateway". */
  aliases?: string[];
  /** Related terms the reader can jump to. */
  seeAlso?: string[];
};

/**
 * Built-in glossary of networking terms used across the NetQuest missions.
 * Every `seeAlso` reference must resolve to a term in this list (enforced by
 * lib/glossary.test.ts).
 */
export const GLOSSARY: GlossaryEntry[] = [
  {
    term: "VLAN",
    category: "Switching",
    definition: "A Virtual LAN — a way to divide one physical switch into several separate broadcast domains, so traffic in VLAN 10 never crosses into VLAN 20.",
    detail: "Access ports assign end devices to a single VLAN. Trunks carry many VLANs between switches. In \"The VLAN That Vanished\", VLAN 20 was missing from the trunk's allowed list, so Sales traffic stopped at the inter-switch link.",
    seeAlso: ["Access port", "Trunk", "802.1Q", "Broadcast domain"],
  },
  {
    term: "Access port",
    category: "Switching",
    definition: "A switch port that connects to a single end device (PC, printer, phone) and carries exactly one untagged VLAN — its access VLAN.",
    detail: "Think of it as a door with one label on it. If a PC sits on an access port in VLAN 20, its frames are only delivered to other members of VLAN 20.",
    seeAlso: ["VLAN", "Trunk"],
  },
  {
    term: "Trunk",
    category: "Switching",
    definition: "A link between switches (or a switch and a router) that carries many VLANs at once, tagging each frame so the far end knows which VLAN it belongs to.",
    detail: "Trunks are the highways between switches; VLANs are the lanes. A trunk only carries the VLANs on its allowed list — which is exactly the misconfiguration in \"The VLAN That Vanished\".",
    seeAlso: ["VLAN", "802.1Q"],
  },
  {
    term: "802.1Q",
    category: "Switching",
    definition: "The industry-standard VLAN tagging protocol: a trunk inserts a 4-byte tag into each frame so the receiving switch can place it in the right VLAN.",
    detail: "\"Tagged\" means the frame carries an 802.1Q tag; \"untagged\" means it doesn't — normal access-port traffic.",
    seeAlso: ["Trunk", "VLAN"],
  },
  {
    term: "Broadcast domain",
    category: "Concepts",
    definition: "The set of devices that receive each other's broadcast frames. A switch forwards a broadcast to every port in the same VLAN.",
    detail: "One VLAN equals one broadcast domain. Too many devices broadcasting at once is wasted traffic — left unchecked it can become a broadcast storm that makes a network unusable.",
    seeAlso: ["VLAN", "STP"],
  },
  {
    term: "MAC address",
    category: "Switching",
    definition: "A 48-bit hardware address burned into every network interface. Switches learn which MAC lives on which port and use that CAM table to forward frames.",
    detail: "Unlike IP addresses, MAC addresses don't change and aren't routable — they only matter on the local network.",
    seeAlso: ["Switch", "IP address"],
  },
  {
    term: "Switch",
    category: "Concepts",
    definition: "A Layer 2 device that forwards frames between ports based on destination MAC addresses, connecting the devices around it.",
    detail: "Switches connect PCs, printers, and servers in the same building. They work below IP addresses — they never look at them.",
    seeAlso: ["MAC address", "Router", "VLAN"],
  },
  {
    term: "Router",
    category: "Concepts",
    definition: "A Layer 3 device that forwards packets between different networks by consulting its routing table (the RIB).",
    detail: "Routers connect subnets to each other and to the outside world. A default gateway is simply the router interface on your subnet.",
    seeAlso: ["Default gateway", "Routing table", "IP address"],
  },
  {
    term: "IP address",
    category: "Concepts",
    definition: "A 32-bit (IPv4) logical address that identifies a device on a network — split into a network part and a host part.",
    detail: "Every device on a subnet shares the network part and has a unique host part. 10.20.0.1 is the gateway in the beginner missions.",
    seeAlso: ["Router", "Default gateway", "Subnet"],
  },
  {
    term: "Default gateway",
    category: "Concepts",
    definition: "The router's IP address on your subnet. Any packet bound for another network is handed to the gateway to forward.",
    detail: "When `ping 10.20.0.1` succeeds, the PC-to-gateway path — including every switch in between — is working end to end.",
    aliases: ["gateway"],
    seeAlso: ["Router", "IP address", "Ping"],
  },
  {
    term: "Subnet",
    category: "Concepts",
    definition: "A logical subdivision of an IP network. Devices in the same subnet talk directly; anything else goes through a router.",
    detail: "Subnets keep networks organized and small enough to manage — routers move traffic between them.",
    seeAlso: ["IP address", "Default gateway", "Router"],
  },
  {
    term: "CLI",
    category: "CLI",
    definition: "Command Line Interface — you control a device by typing text commands at a prompt instead of clicking through a GUI.",
    detail: "Every Cisco device is managed this way. Typing `help` lists the commands available in your current mode — it's always safe to ask.",
    seeAlso: ["EXEC modes", "Configuration mode"],
  },
  {
    term: "EXEC modes",
    category: "CLI",
    definition: "The two command levels: user EXEC (`>`) is basic and read-only; privileged EXEC (`#`) unlocks show and configuration commands. `enable` promotes you.",
    detail: "Look at the prompt: `SW1>` versus `SW1#`. Most useful commands require the `#`.",
    seeAlso: ["CLI", "Configuration mode", "Show commands"],
  },
  {
    term: "Configuration mode",
    category: "CLI",
    definition: "The mode where changes happen: `configure terminal` enters global configuration, then you drill into interfaces, VLANs, or routing protocols. `end` returns to privileged EXEC.",
    detail: "`exit` moves back one mode at a time; `end` jumps straight to privileged EXEC. Configuration changes take effect immediately.",
    aliases: ["config mode"],
    seeAlso: ["EXEC modes", "CLI"],
  },
  {
    term: "Show commands",
    category: "CLI",
    definition: "Read-only commands that inspect a device's current state: `show running-config`, `show vlan brief`, `show interfaces trunk`, `show ip bgp summary`.",
    detail: "Show commands never change anything — the fastest way to explore a device safely is to run them.",
    seeAlso: ["CLI", "EXEC modes"],
  },
  {
    term: "Ping",
    category: "Tools",
    definition: "A connectivity test that sends an ICMP Echo Request and waits for an Echo Reply — the network's version of ringing a doorbell.",
    detail: "A reply means the full round-trip path is up: the source, every switch and router in between, and the destination. No reply means a break somewhere along that path.",
    seeAlso: ["Default gateway", "ICMP"],
  },
  {
    term: "ICMP",
    category: "Tools",
    definition: "Internet Control Message Protocol — the protocol ping uses to test reachability and report network problems.",
    detail: "Ping is just ICMP in action: Echo Request out, Echo Reply back.",
    seeAlso: ["Ping"],
  },
  {
    term: "LACP",
    category: "Switching",
    definition: "Link Aggregation Control Protocol (802.3ad) — automatically negotiates an EtherChannel so switches bundle physical links into one logical link.",
    detail: "Both ends must agree on mode: active/active or active/passive forms the bundle; passive/passive never does — the trap in \"The Bundled Bottleneck\".",
    seeAlso: ["EtherChannel"],
  },
  {
    term: "EtherChannel",
    category: "Switching",
    definition: "Bundles up to 8 physical links into a single logical link for more bandwidth and redundancy: two 1 Gbps links become one 2 Gbps bundle.",
    detail: "The bundle looks like one interface to spanning tree, so it can't create a loop. The physical links inside a bundle must match in speed and duplex.",
    seeAlso: ["LACP", "STP"],
  },
  {
    term: "STP",
    category: "Switching",
    definition: "Spanning Tree Protocol — prevents loops by logically blocking redundant links, electing a root bridge and a single path to it for each segment.",
    detail: "Without STP, redundant links create broadcast storms and MAC-address flapping. BPDU Guard and Root Guard protect the port roles STP chose.",
    seeAlso: ["BPDU", "Bridge ID", "BPDU Guard", "Root Guard"],
  },
  {
    term: "BPDU",
    category: "Switching",
    definition: "Bridge Protocol Data Unit — the frames spanning tree exchanges to elect a root and pass along topology state.",
    detail: "If a BPDU shows up on an access port where none should be, someone plugged a switch in — that's what BPDU Guard shuts down.",
    seeAlso: ["STP", "BPDU Guard", "Bridge ID"],
  },
  {
    term: "Bridge ID",
    category: "Switching",
    definition: "Priority plus MAC address — the tie-breaker for root election. The switch with the lowest bridge ID becomes the root bridge.",
    detail: "32769 = priority 32768 + MAC suffix 1. In \"The STP Storm\", SW2's 24577 beats SW1's 32769, so SW2 wins the election.",
    seeAlso: ["STP", "BPDU"],
  },
  {
    term: "BPDU Guard",
    category: "Switching",
    definition: "A port-protection feature that err-disables an access port the moment a BPDU arrives, stopping a rogue switch from joining spanning tree.",
    detail: "Perfect for edge ports where only end devices should connect — a user's switch, not a PC, is what trips it.",
    seeAlso: ["STP", "BPDU", "Access port"],
  },
  {
    term: "Root Guard",
    category: "Switching",
    definition: "Protects designated ports from accepting a superior root claim — the port rejects BPDUs that would change the root instead of letting the network be hijacked.",
    detail: "Use it on ports facing other switches that must never become root.",
    seeAlso: ["STP", "BPDU"],
  },
  {
    term: "MST",
    category: "Switching",
    definition: "Multiple Spanning Tree — maps many VLANs to a smaller set of STP instances, cutting control traffic in networks with hundreds of VLANs.",
    detail: "PVST+ runs one spanning-tree instance per VLAN; MST groups VLANs into a few instances instead.",
    seeAlso: ["STP", "VLAN"],
  },
  {
    term: "OSPF",
    category: "Routing",
    definition: "Open Shortest Path First — a link-state IGP that builds a topology map of the network, runs SPF, and uses cost as its metric.",
    detail: "OSPF scales with areas: area 0 is the backbone every other area must touch. \"Area Zero Hero\" is about an adjacency that never reaches FULL.",
    seeAlso: ["OSPF adjacency", "Routing protocol", "Routing table"],
  },
  {
    term: "OSPF adjacency",
    category: "Routing",
    definition: "The neighbor relationship between OSPF routers, progressing Down → Init → Two-Way → ExStart → Exchange → Loading → FULL.",
    detail: "Two routers must agree on area, hello/dead timers, and network type to reach FULL. Getting stuck at an earlier state points to a specific mismatch.",
    seeAlso: ["OSPF"],
  },
  {
    term: "EIGRP",
    category: "Routing",
    definition: "Enhanced Interior Gateway Routing Protocol — Cisco's hybrid IGP. Its DUAL algorithm pre-computes backup paths (feasible successors) for near-instant failover.",
    detail: "Compared with OSPF in \"The Edge Has Opinions\": EIGRP fails over fast to a feasible successor; OSPF recalculates with SPF.",
    seeAlso: ["OSPF", "Routing protocol"],
  },
  {
    term: "Routing protocol",
    category: "Routing",
    definition: "Software that lets routers share what they know so each builds a complete picture of the network — OSPF and EIGRP are examples.",
    detail: "A router can run several at once; when they disagree, administrative distance breaks the tie.",
    seeAlso: ["OSPF", "EIGRP", "Routing table"],
  },
  {
    term: "Routing table",
    category: "Routing",
    definition: "The RIB — the router's list of known networks and the next hop for each, built from connected, static, and routing-protocol-learned routes.",
    detail: "The best path wins: longest prefix match first, then administrative distance, then metric.",
    seeAlso: ["Router", "Routing protocol"],
  },
  {
    term: "eBGP",
    category: "Routing",
    definition: "External BGP — sessions between different autonomous systems, for example your campus (AS 65100) and the ISP (AS 65001).",
    detail: "eBGP assumes peers are directly connected (TTL 1). When peers are two hops apart, `neighbor X ebgp-multihop 2` fixes it — the exact issue in \"The Edge Has Opinions\".",
    seeAlso: ["Routing protocol", "PBR"],
  },
  {
    term: "PBR",
    category: "Routing",
    definition: "Policy-Based Routing — a route-map that overrides the destination-based lookup for matching traffic, sending it to a specific next hop instead.",
    detail: "Applied inbound on an interface; `ip local policy` extends the same route-map to traffic the router generates itself.",
    seeAlso: ["Routing table", "eBGP"],
  },
];

/**
 * A token produced by {@link tokenizeGlossaryText}: plain text, code (backtick
 * delimited), or a recognized glossary term ready to be linked.
 */
export type GlossaryToken =
  | { type: "text"; value: string }
  | { type: "code"; value: string }
  | { type: "term"; value: string; term: string };

const CANONICAL_TERMS = new Map<string, string>();
for (const entry of GLOSSARY) {
  CANONICAL_TERMS.set(entry.term.toLowerCase(), entry.term);
  for (const alias of entry.aliases ?? []) {
    CANONICAL_TERMS.set(alias.toLowerCase(), entry.term);
  }
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Longest pattern first so "OSPF adjacency" wins over "OSPF" at the same spot.
const LINK_PATTERNS = GLOSSARY.flatMap((entry) => [entry.term, ...(entry.aliases ?? [])]).sort((a, b) => b.length - a.length);

// Plural-friendly: each pattern may end in "s" (VLANs, trunks) or "es" (switches,
// IP addresses). Backtick code spans are split out first, so command text is
// never auto-linked.
const TERM_PATTERN = new RegExp(`\\b(?:${LINK_PATTERNS.map((pattern) => `${escapeRegex(pattern)}(?:s|es)?`).join("|")})\\b`, "gi");

function canonicalTermFor(matched: string): string | null {
  const lower = matched.toLowerCase();
  const candidates = [lower];
  if (lower.endsWith("es")) candidates.push(lower.slice(0, -2));
  if (lower.endsWith("s")) candidates.push(lower.slice(0, -1));
  for (const candidate of candidates) {
    const term = CANONICAL_TERMS.get(candidate);
    if (term) return term;
  }
  return null;
}

/**
 * Splits mission text into tokens: glossary terms to link, backtick-delimited
 * code to style, and plain text in between. Used by the inline glossary links.
 */
export function tokenizeGlossaryText(text: string): GlossaryToken[] {
  const tokens: GlossaryToken[] = [];
  text.split("`").forEach((segment, index) => {
    if (index % 2 === 1) {
      if (segment) tokens.push({ type: "code", value: segment });
      return;
    }
    if (!segment) return;
    const parts = segment.split(TERM_PATTERN);
    const matches = segment.match(TERM_PATTERN) ?? [];
    parts.forEach((part, i) => {
      if (part) tokens.push({ type: "text", value: part });
      const matched = matches[i];
      if (matched) {
        const term = canonicalTermFor(matched);
        if (term) tokens.push({ type: "term", value: matched, term });
      }
    });
  });
  return tokens;
}
