import type { QuizQuestion } from "./quiz";

/**
 * Extra assessment questions per arc (boss battles / daily challenge / quizzes).
 *
 * The rescue `checkpoint` steps already form the core bank, but the smallest
 * arcs held as few as one question — too short for an Elite (8-question) boss
 * fight. These questions top every arc up to 8+, covering adjacent ENCOR facts
 * without duplicating the checkpoint topics. All content matches the facts the
 * missions teach and standard Cisco documentation.
 */
export const EXTRA_QUIZ_QUESTIONS: Record<string, QuizQuestion[]> = {
  // ─── VLAN That Vanished (3.1.a) ───────────────────────────────────────────
  "vlan-that-vanished": [
    {
      id: "x-vlan-1",
      prompt: "What does the 802.1Q tag inside a frame tell the receiving switch?",
      options: [
        { value: "vlan-id", title: "Which VLAN the frame belongs to", note: "The tag is the frame's VLAN label on a trunk" },
        { value: "encrypt", title: "That the frame is encrypted", note: "802.1Q does no encryption" },
        { value: "ttl", title: "The frame's time-to-live", note: "TTL lives in the IP header, not the tag" },
      ],
      correct: "vlan-id",
      explain: "The 802.1Q tag carries the VLAN ID, so the far switch knows which VLAN a trunked frame belongs to.",
      wrongGuidance: "802.1Q is a labeling mechanism — it marks VLAN membership, it never encrypts or manages TTLs.",
    },
    {
      id: "x-vlan-2",
      prompt: "A brand-new trunk is configured on an interface. By default, which VLANs is it allowed to carry?",
      options: [
        { value: "all", title: "All VLANs (1–4094)", note: "The default allowed list is everything" },
        { value: "none", title: "None until you add them", note: "That would require an explicit allowed-vlan command" },
        { value: "vlan1", title: "Only VLAN 1", note: "VLAN 1 is the default native VLAN, not a limit" },
      ],
      correct: "all",
      explain: "A trunk's allowed list defaults to all VLANs — you prune with switchport trunk allowed vlan remove when needed.",
      wrongGuidance: "The default is permissive: all VLANs. The allowed-vlan command is what narrows the list.",
    },
    {
      id: "x-vlan-3",
      prompt: "Untagged frames arriving on a trunk are assumed to belong to which VLAN?",
      options: [
        { value: "native", title: "The native VLAN", note: "Untagged traffic maps to the native VLAN (VLAN 1 by default)" },
        { value: "dropped", title: "Dropped immediately", note: "Untagged frames are still carried — as native traffic" },
        { value: "highest", title: "The highest-numbered VLAN", note: "There is no such rule" },
      ],
      correct: "native",
      explain: "Frames without a tag are assigned to the trunk's native VLAN — 1 by default — and cross untagged.",
      wrongGuidance: "The native VLAN is exactly the mechanism for untagged frames on a trunk — they are not dropped.",
    },
    {
      id: "x-vlan-4",
      prompt: "Which command shows the native VLAN and the allowed-VLAN list for an inter-switch link?",
      options: [
        { value: "trunk", title: "show interfaces trunk", note: "Lists mode, native VLAN, and allowed VLANs" },
        { value: "vlan-brief", title: "show vlan brief", note: "Shows the VLAN database, not trunk details" },
        { value: "status", title: "show interfaces status", note: "Shows admin/oper state only" },
      ],
      correct: "trunk",
      explain: "show interfaces trunk is the trunk inspector: native VLAN, allowed list, and which VLANs are active on the link.",
      wrongGuidance: "show vlan brief is the VLAN database and show interfaces status is link state — the trunk's allowed list lives in show interfaces trunk.",
    },
    {
      id: "x-vlan-5",
      prompt: "Before adding VLAN 20 to the allowed list, which mode must the inter-switch interface be placed in?",
      options: [
        { value: "trunk", title: "switchport mode trunk", note: "Only trunk mode carries many VLANs" },
        { value: "access", title: "switchport mode access", note: "Access mode serves one VLAN to one device" },
        { value: "none", title: "No mode is needed", note: "An interface defaults to dynamic auto — not a trunk" },
      ],
      correct: "trunk",
      explain: "A link only carries multiple VLANs in trunk mode; access mode strips the link to a single VLAN.",
      wrongGuidance: "Access ports serve end devices with one VLAN. To carry VLAN 10 and 20 between switches, the link must be a trunk.",
    },
    {
      id: "x-vlan-6",
      prompt: "VLAN 20 is allowed on the trunk but does not exist on SW2. What happens to SW2's access-port users in VLAN 20?",
      options: [
        { value: "no-local", title: "No traffic — the VLAN must exist locally first", note: "A missing VLAN has no local ports to receive the frames" },
        { value: "works", title: "Traffic still flows normally", note: "The receiving switch must know the VLAN" },
        { value: "sw1-only", title: "Only SW1 needs the VLAN", note: "Both switches need it in their VLAN databases" },
      ],
      correct: "no-local",
      explain: "The trunk can carry VLAN 20, but until VLAN 20 exists on SW2, no local access port can belong to it and frames have nowhere to go.",
      wrongGuidance: "A VLAN must exist in each switch's VLAN database for that switch to serve it — the trunk alone is not enough.",
    },
    {
      id: "x-vlan-7",
      prompt: "VLAN 20 must no longer cross the trunk. Which command removes it from the allowed list?",
      options: [
        { value: "remove", title: "switchport trunk allowed vlan remove 20", note: "The inverse of add — prunes the list" },
        { value: "add", title: "switchport trunk allowed vlan add 20", note: "add would put VLAN 20 back on the list" },
        { value: "no-vlan", title: "no vlan 20 in global config", note: "That deletes the VLAN locally — it does not prune the trunk" },
      ],
      correct: "remove",
      explain: "switchport trunk allowed vlan remove 20 takes VLAN 20 off the trunk's allowed list — the mirror image of the add command.",
      wrongGuidance: "add is the mission's fix and no vlan deletes the VLAN from the local database — pruning the trunk list is exactly what remove does.",
    },
    {
      id: "x-vlan-8",
      prompt: "Which encapsulation do modern 802.1Q trunks use to tag frames?",
      options: [
        { value: "dot1q", title: "802.1Q — the IEEE tag inside the frame", note: "The standard trunking encapsulation" },
        { value: "isl", title: "ISL — the old Cisco-proprietary wrapper", note: "ISL is legacy; modern Cisco trunks default to 802.1Q" },
        { value: "mpls", title: "MPLS labels", note: "MPLS is a WAN forwarding technique, not trunk tagging" },
      ],
      correct: "dot1q",
      explain: "IEEE 802.1Q inserts the VLAN tag inside the frame — the trunking standard since ISL was retired.",
      wrongGuidance: "ISL was the pre-standard Cisco wrapper and MPLS has nothing to do with trunk tagging — 802.1Q is the modern standard.",
    },
  ],

  // ─── The STP Storm (3.1.c) ────────────────────────────────────────────────
  "stp-storm": [
    {
      id: "x-stp-1",
      prompt: "A non-root switch has exactly one port that leads toward the root bridge. What is that port called?",
      options: [
        { value: "root-port", title: "The root port", note: "The best path toward the root" },
        { value: "designated", title: "A designated port", note: "Designated ports forward on each segment" },
        { value: "blocked", title: "A blocked port", note: "Blocked ports are the loop-breaking ones" },
      ],
      correct: "root-port",
      explain: "Every non-root switch picks one root port — the port with the best path to the root bridge.",
      wrongGuidance: "Designated ports are per-segment, and blocked ports break loops. The one path toward the root is the root port.",
    },
    {
      id: "x-stp-2",
      prompt: "RSTP converges much faster than classic STP mainly because…",
      options: [
        { value: "handshake", title: "It negotiates with proposal/agreement instead of waiting on timers", note: "A handshake, not a countdown" },
        { value: "timers", title: "Its timers are simply shorter", note: "RSTP still converged instantly even before the timer change" },
        { value: "no-bpdu", title: "It stops sending BPDUs", note: "RSTP sends BPDUs every hello — that is how it stays fast" },
      ],
      correct: "handshake",
      explain: "RSTP's proposal/agreement handshake lets a port move straight to forwarding, so convergence no longer depends on the 30s of classic timers.",
      wrongGuidance: "RSTP is fast because it actively handshakes (proposal/agreement), not because timers shrank or BPDUs stopped.",
    },
    {
      id: "x-stp-3",
      prompt: "In a converged classic-STP topology, what is the default state of a port that is neither the root port nor designated?",
      options: [
        { value: "blocking", title: "Blocking", note: "No forwarding, no learning — the loop breaker" },
        { value: "listening", title: "Listening", note: "Listening is a 15-second transitional state" },
        { value: "learning", title: "Learning", note: "Learning is also transitional, and it learns MACs" },
      ],
      correct: "blocking",
      explain: "Blocked ports are the stable steady-state for redundant links — they receive BPDUs but forward nothing.",
      wrongGuidance: "Listening and learning are temporary transitions on the way to forwarding. The stable non-forwarding state is blocking.",
    },
    {
      id: "x-stp-4",
      prompt: "BPDU Guard has err-disabled an access port. What happens by default?",
      options: [
        { value: "stays-down", title: "It stays down until manually re-enabled or errdisable recovery is configured", note: "The port does not heal itself" },
        { value: "auto", title: "It re-enables automatically after 30 seconds", note: "Auto-recovery requires errdisable recovery" },
        { value: "next-bpdu", title: "It re-enables on the next BPDU", note: "A BPDU is exactly what caused the shutdown" },
      ],
      correct: "stays-down",
      explain: "An err-disabled port stays down until an administrator issues shutdown / no shutdown, or errdisable recovery is configured.",
      wrongGuidance: "Err-disable is a lockdown, not a blip — recovery is manual or via the errdisable recovery feature, never automatic by default.",
    },
    {
      id: "x-stp-5",
      prompt: "A port that should be the root port is instead blocking despite a superior root path. Which STP protection is most likely responsible?",
      options: [
        { value: "root-guard", title: "Root guard — the port rejected a superior BPDU claim", note: "Root guard prevents the port from becoming the root path" },
        { value: "bpdu-guard", title: "BPDU guard", note: "BPDU guard err-disables on any BPDU — this port is still up" },
        { value: "loop-guard", title: "Loop guard", note: "Loop guard blocks when BPDUs stop arriving, not on superior claims" },
      ],
      correct: "root-guard",
      explain: "Root guard forces a port to be non-root: when a superior BPDU arrives, the port goes to root-inconsistent (blocking) instead of becoming the root path.",
      wrongGuidance: "BPDU guard shuts the port down entirely and loop guard reacts to silence — the root-inconsistent block is root guard's signature.",
    },
    {
      id: "x-stp-6",
      prompt: "In MST, what does each spanning-tree instance map to?",
      options: [
        { value: "vlan-group", title: "A configured group of VLANs", note: "MST groups many VLANs into one instance" },
        { value: "one-vlan", title: "Exactly one VLAN", note: "That is PVST+ behavior, not MST" },
        { value: "one-port", title: "One physical port", note: "Instances span the whole region, not a port" },
      ],
      correct: "vlan-group",
      explain: "MST runs one instance per mapping group (e.g. instance 1 → VLANs 1-10), drastically cutting BPDU and state overhead versus per-VLAN PVST+.",
      wrongGuidance: "One-instance-per-VLAN is PVST+. MST's whole point is fewer instances covering groups of VLANs.",
    },
  ],

  // ─── The Bundled Bottleneck (3.1.b) ───────────────────────────────────────
  "bundled-bottleneck": [
    {
      id: "x-ec-1",
      prompt: "Which protocol is the IEEE standard for EtherChannel negotiation?",
      options: [
        { value: "lacp", title: "LACP", note: "IEEE 802.3ad — the open standard" },
        { value: "pagp", title: "PAgP", note: "Cisco-proprietary (Port Aggregation Protocol)" },
        { value: "dtp", title: "DTP", note: "DTP negotiates trunking, not bundles" },
      ],
      correct: "lacp",
      explain: "LACP (802.3ad) is the standards-based negotiation protocol; PAgP is Cisco's proprietary alternative.",
      wrongGuidance: "DTP is for trunk negotiation and PAgP is Cisco-only — the IEEE-standard channel protocol is LACP.",
    },
    {
      id: "x-ec-2",
      prompt: "What does spanning tree see when an EtherChannel bundles two physical links?",
      options: [
        { value: "one-logical", title: "One logical link", note: "The bundle is a single STP port — no loop" },
        { value: "two-parallel", title: "Two parallel paths it must block", note: "That would defeat the purpose" },
        { value: "one-per-vlan", title: "A separate channel per VLAN", note: "STP sees the Port-Channel, not per-VLAN channels" },
      ],
      correct: "one-logical",
      explain: "EtherChannel presents the bundle as one logical interface to STP, so two links add bandwidth without creating a loop.",
      wrongGuidance: "The whole point of the bundle is that STP treats it as ONE port — no blocking, no loop.",
    },
    {
      id: "x-ec-3",
      prompt: "How does an EtherChannel spread traffic across its member links?",
      options: [
        { value: "hash", title: "A hash of source/destination addresses", note: "Flows stick to one link via the hash" },
        { value: "byte-round", title: "Byte-by-byte round robin", note: "That would fragment conversations" },
        { value: "per-packet", title: "Per-packet load balancing", note: "Cisco channels hash flows, not packets" },
      ],
      correct: "hash",
      explain: "A deterministic hash (src/dst IP or MAC, depending on layer) pins each flow to one member link — no reordering.",
      wrongGuidance: "Channels hash flows to a member link; per-packet or per-byte spreading would scramble TCP conversations.",
    },
    {
      id: "x-ec-4",
      prompt: "Both ends run channel-group 1 mode on (no negotiation). Will the bundle form?",
      options: [
        { value: "yes", title: "Yes — on forces the bundle", note: "mode on bypasses negotiation entirely" },
        { value: "no", title: "No — LACP is required", note: "LACP is only needed for negotiated bundles" },
        { value: "pagp", title: "Only if one side is PAgP", note: "mode on is negotiation-free" },
      ],
      correct: "yes",
      explain: "mode on statically bundles the links — no LACP/PAgP PDUs are exchanged, both ends just join the channel.",
      wrongGuidance: "on means 'no negotiation, just bundle' — the one risk is a silent mismatch if the far end is not configured the same way.",
    },
    {
      id: "x-ec-5",
      prompt: "One member link of a healthy EtherChannel fails. What happens to the traffic?",
      options: [
        { value: "redistribute", title: "It is redistributed over the remaining members", note: "The bundle stays up, reduced to the remaining bandwidth" },
        { value: "stop", title: "All traffic stops until the bundle rebuilds", note: "The channel only needs one member to stay up" },
        { value: "po-down", title: "The Port-Channel interface goes down", note: "The logical interface stays up while any member lives" },
      ],
      correct: "redistribute",
      explain: "A member failure just reduces capacity — the hashed flows re-spread across the surviving links and the bundle keeps working.",
      wrongGuidance: "EtherChannel is resilient by design: one dead member shrinks the pipe but never kills the channel.",
    },
    {
      id: "x-ec-6",
      prompt: "Two member links are configured identically, but the bundle still won't form. One side runs channel-group 1 mode active. What must the far end run?",
      options: [
        { value: "active-passive", title: "active or passive (both are LACP-compatible)", note: "active/active and active/passive both negotiate" },
        { value: "passive-passive", title: "passive only", note: "passive/passive never negotiates — no one initiates" },
        { value: "on", title: "mode on only", note: "on works, but the question is about LACP negotiation" },
      ],
      correct: "active-passive",
      explain: "LACP forms when at least one side is active; passive/passive never negotiates because neither side sends LACPDUs first.",
      wrongGuidance: "passive-passive is the classic 'both ends wait forever' failure — one side must be active to kick off LACP.",
    },
    {
      id: "x-ec-7",
      prompt: "A member link fails to join the channel because its speed differs from the others. What does the switch do?",
      options: [
        { value: "excludes", title: "Excludes that link from the bundle and keeps the rest up", note: "Members must match in speed and duplex" },
        { value: "all-down", title: "Tears down the entire channel", note: "A mismatched member only excludes itself" },
        { value: "autonegotiates", title: "Auto-adjusts the bundle to two speeds", note: "Channels require uniform members" },
      ],
      correct: "excludes",
      explain: "EtherChannel members must share speed and duplex; a mismatched link is simply excluded rather than breaking the whole bundle.",
      wrongGuidance: "The bundle tolerates a bad member by dropping it — uniformity is enforced per member, not per bundle.",
    },
  ],

  // ─── Area Zero Hero (3.2.b) ───────────────────────────────────────────────
  "area-zero-hero": [
    {
      id: "x-ospf-1",
      prompt: "R1 has hello timer 10s and R2 has hello timer 30s on the same segment. What happens to their OSPF adjacency?",
      options: [
        { value: "never", title: "It never forms", note: "Hello/dead timers must match" },
        { value: "slow", title: "It forms, just slowly", note: "A mismatch blocks the adjacency, period" },
        { value: "auto", title: "It forms — timers auto-adjust", note: "OSPF does not negotiate timers" },
      ],
      correct: "never",
      explain: "OSPF neighbors must agree on hello and dead timers; a mismatch leaves the adjacency stuck at Init/Down.",
      wrongGuidance: "Timers are non-negotiable in OSPF — mismatch means no adjacency, not a slower one.",
    },
    {
      id: "x-ospf-2",
      prompt: "On a multi-access Ethernet segment, which routers establish FULL adjacencies with every other router?",
      options: [
        { value: "dr-bdr", title: "The DR and the BDR", note: "Everyone forms FULL with DR/BDR; the rest stay 2-WAY" },
        { value: "all", title: "Every router with every router", note: "That would flood the segment with adjacencies" },
        { value: "none", title: "Only routers in area 0", note: "Area 0 is not what drives the elections" },
      ],
      correct: "dr-bdr",
      explain: "The designated router (DR) and backup designated router (BDR) are the FULL-adjacency hubs; other routers stay Two-Way between themselves.",
      wrongGuidance: "DR/BDR election exists precisely to avoid full-mesh adjacencies on broadcast segments.",
    },
    {
      id: "x-ospf-3",
      prompt: "The statement network 172.16.0.0 0.0.0.255 area 0 — which prefix does the wildcard mask enable OSPF on?",
      options: [
        { value: "24", title: "172.16.0.0/24", note: "0.0.0.255 wildcard = the last octet is any" },
        { value: "16", title: "172.16.0.0/16", note: "That would be wildcard 0.0.255.255" },
        { value: "8", title: "172.0.0.0/8", note: "That would be wildcard 0.255.255.255" },
      ],
      correct: "24",
      explain: "A wildcard mask of 0.0.0.255 matches any host in 172.16.0.0/24 — the last octet is 'any'.",
      wrongGuidance: "Convert the wildcard to its inverse: 0.0.0.255 means the last octet varies, so this is a /24.",
    },
    {
      id: "x-ospf-4",
      prompt: "A point-to-point serial link between two OSPF routers needs adjacency with no DR election. Which network type avoids the election?",
      options: [
        { value: "ptp", title: "point-to-point (or ip ospf network point-to-point)", note: "No DR/BDR on a two-router segment" },
        { value: "broadcast", title: "broadcast", note: "The default Ethernet type — it elects a DR/BDR" },
        { value: "nbma", title: "non-broadcast", note: "NBMA also elects and needs neighbor statements" },
      ],
      correct: "ptp",
      explain: "The point-to-point network type skips DR/BDR election entirely — the standard choice for serial and tunnel links.",
      wrongGuidance: "broadcast and NBMA both elect a DR/BDR; point-to-point (or its explicit override) is the no-election type.",
    },
    {
      id: "x-ospf-5",
      prompt: "passive-interface default + passive-interface except-type commands on an OSPF process do what?",
      options: [
        { value: "selective", title: "Make every interface passive except the ones explicitly enabled", note: "The 'except' list re-enables adjacencies" },
        { value: "all", title: "Make every interface passive permanently", note: "That would break all adjacencies" },
        { value: "routing", title: "Only affect redistribution", note: "Passive is about adjacency formation, not redistribution" },
      ],
      correct: "selective",
      explain: "passive-interface default suppresses hellos everywhere; the except form re-enables them on the listed interfaces only.",
      wrongGuidance: "The pair is a whitelist: default = passive everywhere, except = the interfaces that still form adjacencies.",
    },
    {
      id: "x-ospf-6",
      prompt: "Which command summarizes the routes an area advertises into area 0 at the ABR?",
      options: [
        { value: "range", title: "area 1 range 10.0.0.0 255.255.0.0", note: "The ABR-level summarizer" },
        { value: "summary", title: "summary-address 10.0.0.0 255.255.0.0", note: "That is for external (redistributed) routes" },
        { value: "network", title: "network 10.0.0.0 0.0.255.255 area 1", note: "That enables OSPF — it does not summarize" },
      ],
      correct: "range",
      explain: "area <id> range <prefix> <mask> summarizes inter-area routes at the ABR; summary-address is the external-route counterpart.",
      wrongGuidance: "summary-address applies to redistributed/external routes — inter-area summarization is the area range command.",
    },
    {
      id: "x-ospf-7",
      prompt: "A router is stuck in TWO-WAY with a neighbor on an Ethernet segment. Is this a fault?",
      options: [
        { value: "normal", title: "No — Two-Way is normal between non-DR/BDR neighbors on broadcast segments", note: "Only the DR/BDR reach FULL on multi-access links" },
        { value: "fault", title: "Yes — all neighbors must reach FULL", note: "FULL is only required with the DR/BDR" },
        { value: "timer", title: "Yes — it means the dead timer is wrong", note: "A timer mismatch would stall earlier at INIT" },
      ],
      correct: "normal",
      explain: "On broadcast multi-access segments, non-DR/BDR neighbors stay Two-Way with each other; FULL is only with the DR and BDR.",
      wrongGuidance: "Two-Way is the healthy steady state between regular neighbors on Ethernet — misdiagnosing it wastes time.",
    },
  ],

  // ─── The Edge Has Opinions (3.2.a/c/d) ────────────────────────────────────
  "edge-has-opinions": [
    {
      id: "x-edge-1",
      prompt: "When BGP compares two paths to the same destination, which attribute is examined first?",
      options: [
        { value: "weight", title: "Weight", note: "Cisco-proprietary, highest wins, checked first" },
        { value: "med", title: "MED", note: "MED is a tiebreaker much later in the process" },
        { value: "as-path", title: "AS path length", note: "AS path is compared after weight and local preference" },
      ],
      correct: "weight",
      explain: "Best-path selection starts with weight (Cisco-proprietary), then local preference, then AS path, origin, MED, and so on.",
      wrongGuidance: "Order matters in BGP: weight first, then local preference, then AS path — MED is a late tiebreaker.",
    },
    {
      id: "x-edge-2",
      prompt: "Setting a higher local preference on a route influences which direction of traffic?",
      options: [
        { value: "outbound", title: "Outbound — which egress path your AS uses", note: "Local preference is announced to iBGP peers" },
        { value: "inbound", title: "Inbound — which entry outsiders pick", note: "Inbound choices use MED / AS-path prepending" },
        { value: "both", title: "Both directions equally", note: "Local preference only shapes outbound exit selection" },
      ],
      correct: "outbound",
      explain: "Local preference tells routers inside the AS which exit to prefer — it shapes outbound traffic, not how outsiders enter.",
      wrongGuidance: "Local preference is the outbound tool; MED and AS-path prepending are the inbound tools.",
    },
    {
      id: "x-edge-3",
      prompt: "Which two factors dominate the default EIGRP composite metric?",
      options: [
        { value: "bw-delay", title: "Bandwidth and delay", note: "The two defaults in the classic K-value metric" },
        { value: "hop-mtu", title: "Hop count and MTU", note: "Hop count is RIP; MTU is not a metric factor" },
        { value: "cost", title: "Cost and reliability", note: "Cost is OSPF's metric" },
      ],
      correct: "bw-delay",
      explain: "EIGRP's default metric weighs the lowest bandwidth and the accumulated delay along the path.",
      wrongGuidance: "Hop count belongs to distance-vector RIP and cost to link-state OSPF — EIGRP's default pair is bandwidth plus delay.",
    },
    {
      id: "x-edge-4",
      prompt: "An eBGP session shows state Active. What does that most likely mean?",
      options: [
        { value: "no-peer", title: "The router is trying to reach a peer it cannot connect to", note: "Active = actively seeking the TCP connection" },
        { value: "up", title: "The session is fully established", note: "Established is the up state — Active is not" },
        { value: "password", title: "The password was accepted", note: "Password success moves the session forward to OpenSent" },
      ],
      correct: "no-peer",
      explain: "Active means BGP is actively trying to open the TCP session to a peer that isn't answering — a classic reachability or multihop problem.",
      wrongGuidance: "Active is the 'can't reach my peer' state — the session only reaches Established after the TCP handshake completes.",
    },
    {
      id: "x-edge-5",
      prompt: "Two eBGP paths reach the same prefix: path A has AS path length 3 and MED 50; path B has AS path length 5 and MED 20. Which is preferred?",
      options: [
        { value: "shorter-as", title: "Path A — AS path length beats MED", note: "AS path is compared before MED" },
        { value: "lower-med", title: "Path B — the lower MED wins", note: "MED is a later tiebreaker" },
        { value: "tie", title: "They tie — need a tiebreaker", note: "The AS paths differ, so no tie exists" },
      ],
      correct: "shorter-as",
      explain: "BGP best-path compares AS path length before MED, so path A (shorter AS path) wins regardless of its higher MED.",
      wrongGuidance: "Order matters: weight → local pref → AS path → origin → MED. MED only matters when the AS path length is equal.",
    },
  ],

  // ─── Gateway at Dawn (1.1.a/b, 3.3.c) ─────────────────────────────────────
  "gateway-at-dawn": [
    {
      id: "x-gateway-1",
      prompt: "What is the well-known virtual MAC that HSRP group 1 answers with?",
      options: [
        { value: "hsrp-mac", title: "0000.0c07.ac01", note: "0000.0c07.acXX — the HSRP virtual MAC range" },
        { value: "vrrp-mac", title: "0000.5e00.0101", note: "That is VRRP's virtual MAC range" },
        { value: "real-mac", title: "The active router's burned-in MAC", note: "HSRP never uses the physical MAC — VRRP does" },
      ],
      correct: "hsrp-mac",
      explain: "HSRP uses virtual MACs 0000.0c07.acXX — group 1 answers as 0000.0c07.ac01 regardless of which router is active.",
      wrongGuidance: "0000.5e00.01xx is VRRP's range, and using the real MAC is a VRRP trait — HSRP owns 0000.0c07.acXX.",
    },
    {
      id: "x-gateway-2",
      prompt: "Hosts ARP for the HSRP virtual IP. Who replies?",
      options: [
        { value: "active", title: "Only the Active router", note: "The Active owns the virtual IP/MAC and forwards traffic" },
        { value: "both", title: "Both routers", note: "The standby never answers for the virtual IP" },
        { value: "standby", title: "The Standby router", note: "The standby only watches — it forwards nothing" },
      ],
      correct: "active",
      explain: "The Active router answers ARP for the virtual IP with the virtual MAC and carries the traffic; the standby is the hot spare.",
      wrongGuidance: "One router is Active at a time — it alone answers for the virtual IP, so hosts see a single gateway.",
    },
    {
      id: "x-gateway-3",
      prompt: "GW1 (priority 110) fails, GW2 (priority 100) becomes Active, then GW1 returns. Preempt is NOT configured. What happens?",
      options: [
        { value: "waits", title: "GW1 stays Standby until GW2 fails", note: "Without preempt, roles do not flip back" },
        { value: "reclaims", title: "GW1 immediately becomes Active", note: "That is exactly what preempt would do" },
        { value: "tie", title: "They re-run the election", note: "Election only happens at startup or on failure" },
      ],
      correct: "waits",
      explain: "Without preempt, a returning higher-priority router stays in Standby — it takes over only when the current Active fails.",
      wrongGuidance: "Preempt is the command that lets the higher-priority router reclaim the role; without it, GW1 patiently waits.",
    },
    {
      id: "x-gateway-4",
      prompt: "In HSRP, what does the Standby state mean for that router?",
      options: [
        { value: "backup", title: "It is a fully functional backup, ready to take over", note: "The hot-spare state" },
        { value: "down", title: "It has failed", note: "Down is a different state entirely" },
        { value: "forwarding", title: "It is forwarding traffic for the virtual IP", note: "Only the Active forwards" },
      ],
      correct: "backup",
      explain: "Standby means the router monitors the Active and is ready to assume the virtual IP the moment the Active stops.",
      wrongGuidance: "Standby is a healthy hot-spare state — it forwards nothing but is one heartbeat away from taking over.",
    },
    {
      id: "x-gateway-5",
      prompt: "In VRRP, the router with the highest priority in a virtual router group is called the…",
      options: [
        { value: "master", title: "Master", note: "VRRP terminology — the master forwards traffic" },
        { value: "active", title: "Active", note: "Active is HSRP's term" },
        { value: "standby", title: "Standby", note: "Standby is HSRP's backup term" },
      ],
      correct: "master",
      explain: "VRRP elects a Master (the term HSRP would call Active); the rest are Backups. Terminology differs, job is the same.",
      wrongGuidance: "Active/Standby is HSRP vocabulary — VRRP says Master/Backup, and the highest priority wins either way.",
    },
  ],

  // ─── Edge Services (1.4, 3.3.a/b/d) ───────────────────────────────────────
  "edge-services": [
    {
      id: "x-edge-services-1",
      prompt: "Which DSCP value marks voice for expedited forwarding (EF)?",
      options: [
        { value: "ef46", title: "EF = 46", note: "Voice's gold-standard per-hop behavior" },
        { value: "af41", title: "AF41 = 34", note: "AF4 is a video/data class, not voice" },
        { value: "cs0", title: "CS0 = 0", note: "CS0 is best-effort" },
      ],
      correct: "ef46",
      explain: "EF (46) is the standard DSCP for voice — a single strict-priority class for real-time traffic.",
      wrongGuidance: "AF41 (34) belongs to video/data classes and CS0 (0) is best-effort — voice uses EF (46).",
    },
    {
      id: "x-edge-services-2",
      prompt: "NTP synchronizes network devices over which protocol and port?",
      options: [
        { value: "udp123", title: "UDP 123", note: "The classic NTP port" },
        { value: "tcp443", title: "TCP 443", note: "HTTPS — not NTP" },
        { value: "udp514", title: "UDP 514", note: "That is syslog" },
      ],
      correct: "udp123",
      explain: "NTP runs over UDP port 123 — devices query and receive time from their configured servers.",
      wrongGuidance: "443 is HTTPS and 514 is syslog — NTP's well-known port is UDP 123.",
    },
    {
      id: "x-edge-services-3",
      prompt: "In NAT terminology, which side of the router is the 'inside'?",
      options: [
        { value: "lan", title: "The private LAN side", note: "The addresses NAT translates away from" },
        { value: "wan", title: "The public WAN side", note: "That is the outside" },
        { value: "dmz", title: "The DMZ", note: "A DMZ is a separate zone, not the inside" },
      ],
      correct: "lan",
      explain: "Inside = the private network whose source addresses get translated; outside = the public side they are translated to.",
      wrongGuidance: "Inside is where the private addresses live and get translated; outside is the public realm they exit into.",
    },
    {
      id: "x-edge-services-4",
      prompt: "Which multicast mechanism stops a packet from looping back toward its source?",
      options: [
        { value: "rpf", title: "The RPF check — the packet must arrive on the interface toward the source", note: "Reverse Path Forwarding is the loop guard" },
        { value: "igmp", title: "IGMP joining", note: "IGMP signals receivers — it does not prevent loops" },
        { value: "msdp", title: "MSDP peering", note: "MSDP shares sources between RPs" },
      ],
      correct: "rpf",
      explain: "Every multicast router runs an RPF check: if a packet for (S,G) didn't arrive on the interface that leads back to S, it is dropped — that's the loop prevention.",
      wrongGuidance: "RPF is the multicast loop guard. IGMP handles receiver signaling and MSDP links RPs — neither does RPF's job.",
    },
    {
      id: "x-edge-services-5",
      prompt: "IGMPv3 enables SSM. What does the host report include that earlier versions lacked?",
      options: [
        { value: "source", title: "The specific source (S,G) it wants to receive", note: "IGMPv3 reports carry the source list" },
        { value: "group-only", title: "Only the group address", note: "That is IGMPv1/v2 behavior" },
        { value: "rp", title: "The rendezvous point address", note: "RPs are a PIM concept, not in the IGMP report" },
      ],
      correct: "source",
      explain: "IGMPv3 membership reports include the source(s) the host wants (S,G), which is exactly what Source-Specific Multicast builds on — no RP needed.",
      wrongGuidance: "Group-only reports are v1/v2; the (S,G) source awareness of v3 is what unlocks SSM and removes the RP.",
    },
    {
      id: "x-edge-services-6",
      prompt: "When do two PIM domains need MSDP between their rendezvous points?",
      options: [
        { value: "source-sharing", title: "So RPs learn about sources in the other domain", note: "MSDP advertises active sources between RPs" },
        { value: "rpf", title: "To perform the RPF check", note: "RPF is local to each router" },
        { value: "igmp", title: "To join receivers to groups", note: "IGMP does the joining at the edge" },
      ],
      correct: "source-sharing",
      explain: "MSDP lets one domain's RP advertise its active sources to another domain's RP, so receivers can build trees to sources they'd otherwise never learn about.",
      wrongGuidance: "MSDP is the source-discovery bridge between PIM domains — RPF and IGMP are separate, local mechanisms.",
    },
  ],

  // ─── Tunnel Vision (2.2.a/b) ──────────────────────────────────────────────
  "tunnel-vision": [
    {
      id: "x-tunnel-1",
      prompt: "GRE-encapsulated IP packets are identified by which IP protocol number?",
      options: [
        { value: "47", title: "47 — GRE", note: "The protocol number the outer header carries" },
        { value: "50", title: "50 — ESP", note: "ESP is the IPsec encryption protocol" },
        { value: "51", title: "51 — AH", note: "AH is IPsec authentication, not GRE" },
      ],
      correct: "47",
      explain: "GRE has its own IP protocol number, 47 — how intermediate routers and the far end recognize a GRE packet.",
      wrongGuidance: "50 (ESP) and 51 (AH) belong to IPsec — GRE is IP protocol 47.",
    },
    {
      id: "x-tunnel-2",
      prompt: "Why tunnel routing-protocol traffic over GRE rather than a plain IPsec tunnel?",
      options: [
        { value: "multicast", title: "GRE carries multicast and broadcast; IPsec is unicast-IP only", note: "Routing protocols need multicast neighbors" },
        { value: "encrypts", title: "GRE encrypts the payload", note: "GRE does no encryption — IPsec adds that" },
        { value: "faster", title: "GRE is inherently faster", note: "Speed is not the differentiator" },
      ],
      correct: "multicast",
      explain: "GRE is a generic encapsulator that happily carries multicast, broadcast, and non-IP payloads — IPsec alone cannot transport OSPF/EIGRP hellos.",
      wrongGuidance: "GRE wraps and carries; it does not encrypt. The reason to use it is multicast/broadcast support — which IPsec lacks.",
    },
    {
      id: "x-tunnel-3",
      prompt: "The isakmp policy and the pre-shared key establish which part of an IPsec VPN?",
      options: [
        { value: "phase1", title: "IKE phase 1 — the keying channel", note: "Phase 1 authenticates peers and builds the ISAKMP SA" },
        { value: "phase2", title: "IKE phase 2 — the data protection", note: "Phase 2 uses the phase-1 channel to set up IPsec SAs" },
        { value: "gre", title: "The GRE tunnel itself", note: "GRE is built separately from IPsec keying" },
      ],
      correct: "phase1",
      explain: "IKE phase 1 (isakmp policy + keys) authenticates the peers and establishes the protected keying channel that phase 2 uses.",
      wrongGuidance: "Phase 2 needs the phase-1 channel to negotiate IPsec SAs — the isakmp policy is the phase-1 foundation.",
    },
    {
      id: "x-tunnel-4",
      prompt: "crypto ipsec transform-set TS esp-aes esp-sha-hmac defines what?",
      options: [
        { value: "phase2", title: "Phase-2 protection — encryption and integrity for the data", note: "What the IPsec SAs actually use" },
        { value: "phase1", title: "Phase-1 authentication", note: "Phase 1 uses the isakmp policy, not the transform set" },
        { value: "tunnel", title: "The tunnel interface settings", note: "The transform set is not interface config" },
      ],
      correct: "phase2",
      explain: "A transform set names the encryption (esp-aes) and integrity (esp-sha-hmac) algorithms that protect the data in phase 2.",
      wrongGuidance: "Phase 1 is the isakmp policy's job — the transform set describes how the data itself is encrypted and hashed.",
    },
    {
      id: "x-tunnel-5",
      prompt: "For GRE-over-IPsec, which traffic should the crypto map's access list match?",
      options: [
        { value: "gre-flow", title: "The GRE flow between the WAN endpoints", note: "Encrypt the outer tunnel — the inner IPs ride inside" },
        { value: "inner-subnets", title: "The private subnets behind the tunnels", note: "The inner IPs are hidden inside the GRE payload" },
        { value: "all", title: "Everything, including management traffic", note: "The map should only match the tunnel flow" },
      ],
      correct: "gre-flow",
      explain: "The crypto ACL must match the GRE packets (protocol 47) between the WAN addresses — encrypting the tunnel carries the private traffic inside.",
      wrongGuidance: "Match the outer GRE flow, not the inner private IPs — they are payload, invisible to the crypto map.",
    },
  ],

  // ─── The Fabric Express (2.1.a/b/c, 2.3.b) ────────────────────────────────
  "fabric-express": [
    {
      id: "x-fabric-1",
      prompt: "Which feature moves a running VM from one ESXi host to another with zero downtime?",
      options: [
        { value: "vmotion", title: "vMotion", note: "Live migration across hosts on shared storage" },
        { value: "ha", title: "vSphere HA", note: "HA restarts VMs after a host failure — downtime involved" },
        { value: "snapshot", title: "A snapshot", note: "Snapshots capture state, they do not migrate" },
      ],
      correct: "vmotion",
      explain: "vMotion migrates a live VM between hosts by transferring memory state while the VM keeps running.",
      wrongGuidance: "HA is for failure restart and snapshots freeze state — live, zero-downtime movement is vMotion.",
    },
    {
      id: "x-fabric-2",
      prompt: "VirtualBox and VMware Workstation run on top of a host operating system. What kind of hypervisors are they?",
      options: [
        { value: "type2", title: "Type 2 (hosted)", note: "An application on a host OS" },
        { value: "type1", title: "Type 1 (bare-metal)", note: "Type 1 owns the hardware — ESXi, KVM" },
        { value: "container", title: "Containers", note: "Containers share the kernel; these are full VMs" },
      ],
      correct: "type2",
      explain: "Type 2 hypervisors are hosted — they run as applications on a conventional OS, unlike bare-metal ESXi or KVM.",
      wrongGuidance: "Bare-metal means no host OS beneath — VirtualBox and Workstation clearly sit on one, so they are Type 2.",
    },
    {
      id: "x-fabric-3",
      prompt: "Which statement correctly contrasts a container and a VM?",
      options: [
        { value: "own-os", title: "A VM runs its own guest OS; a container shares the host kernel", note: "That is the core difference" },
        { value: "shared", title: "Both share the host kernel", note: "Only containers do" },
        { value: "no-os", title: "A VM needs no operating system", note: "A VM always boots a guest OS" },
      ],
      correct: "own-os",
      explain: "VMs virtualize hardware and boot a full guest OS; containers virtualize the OS itself, sharing the host kernel.",
      wrongGuidance: "Sharing the kernel is the container's trait — VMs carry their own guest OS on virtual hardware.",
    },
    {
      id: "x-fabric-4",
      prompt: "VXLAN transports Ethernet frames inside which outer encapsulation?",
      options: [
        { value: "udp-ip", title: "UDP/IP (port 4789) over the IP underlay", note: "The standard VXLAN port" },
        { value: "tcp", title: "TCP 443", note: "That is HTTPS — VXLAN is UDP" },
        { value: "gre", title: "GRE only", note: "VXLAN chose UDP for entropy and ECMP" },
      ],
      correct: "udp-ip",
      explain: "A VTEP wraps each frame in a VXLAN header carried in UDP (destination port 4789) inside IP.",
      wrongGuidance: "VXLAN rides UDP/4789 over IP — that is what gives it the entropy for ECMP load balancing.",
    },
  ],

  // ─── The Campus Fabric (1.3.a/b, 2.3.a) ───────────────────────────────────
  "campus-fabric": [
    {
      id: "x-campus-1",
      prompt: "Which SD-Access node connects the fabric to external networks such as the WAN or a legacy core?",
      options: [
        { value: "border", title: "The border node", note: "The fabric's gateway to the outside" },
        { value: "edge", title: "The edge node", note: "Edges serve the wired endpoints" },
        { value: "control", title: "The control plane node", note: "It hosts the mapping database" },
      ],
      correct: "border",
      explain: "Fabric border nodes face outward — they connect the fabric to WAN, campus core, or non-fabric domains.",
      wrongGuidance: "Edges host endpoints and the control plane holds mappings — leaving the fabric is the border node's job.",
    },
    {
      id: "x-campus-2",
      prompt: "Where do wired endpoint hosts physically connect in an SD-Access fabric?",
      options: [
        { value: "edge", title: "Fabric edge nodes", note: "Access switches that register and forward for their hosts" },
        { value: "border", title: "Border nodes", note: "Borders face external networks" },
        { value: "control", title: "Control plane nodes", note: "That is the mapping brain, not the access layer" },
      ],
      correct: "edge",
      explain: "Fabric edge nodes are the access-layer switches: they register host EIDs and do the encapsulation/decapsulation.",
      wrongGuidance: "Borders and control-plane nodes have other jobs — endpoints plug into fabric edge nodes.",
    },
    {
      id: "x-campus-3",
      prompt: "Which encapsulation carries the SD-Access data plane between fabric nodes?",
      options: [
        { value: "vxlan", title: "VXLAN", note: "The fabric's data-plane overlay" },
        { value: "mpls", title: "MPLS", note: "MPLS is a WAN service, not the SDA data plane" },
        { value: "gre", title: "Plain GRE", note: "SDA uses VXLAN encapsulation" },
      ],
      correct: "vxlan",
      explain: "SD-Access uses VXLAN (over UDP) as its data-plane encapsulation between fabric nodes.",
      wrongGuidance: "The fabric data plane is VXLAN — GRE is for traditional tunnels, MPLS is a WAN technology.",
    },
    {
      id: "x-campus-4",
      prompt: "Which routing protocol is the common choice for the SD-Access underlay?",
      options: [
        { value: "isis", title: "IS-IS", note: "Cisco's recommended fabric underlay" },
        { value: "bgp", title: "BGP only", note: "BGP is the control-plane topic for overlay mapping, not the underlay IGP" },
        { value: "rip", title: "RIPv2", note: "Not a modern fabric underlay" },
      ],
      correct: "isis",
      explain: "The recommended SD-Access underlay IGP is IS-IS — Cisco designs the fabric underlay around it.",
      wrongGuidance: "BGP is involved in the overlay control plane, not the underlay routing — the underlay IGP is IS-IS.",
    },
    {
      id: "x-campus-5",
      prompt: "Which protocol provides SD-Access's control plane — the EID-to-RLOC mapping service?",
      options: [
        { value: "lisp", title: "LISP", note: "Map-server/map-resolver on the control plane node" },
        { value: "vxlan", title: "VXLAN", note: "VXLAN is the data plane" },
        { value: "netconf", title: "NETCONF", note: "NETCONF is management, not mapping" },
      ],
      correct: "lisp",
      explain: "LISP runs on the control plane node as map-server and map-resolver, holding the EID-to-RLOC database.",
      wrongGuidance: "VXLAN carries the data and NETCONF manages the devices — mapping identity to location is LISP's role.",
    },
  ],

  // ─── SD-WAN: The WAN Overlay (1.2.a/b) ────────────────────────────────────
  "sdwan-overlay": [
    {
      id: "x-sdwan-1",
      prompt: "Which component is the centralized management and analytics plane of Catalyst SD-WAN?",
      options: [
        { value: "vmanage", title: "vManage (SD-WAN Manager)", note: "Dashboards, config templates, monitoring" },
        { value: "vsmart", title: "vSmart (SD-WAN Controller)", note: "vSmart handles control-plane policy" },
        { value: "vedge", title: "vEdge", note: "vEdge devices are the forwarding routers" },
      ],
      correct: "vmanage",
      explain: "vManage is the management plane — the single pane of glass for templates, policies, monitoring, and analytics.",
      wrongGuidance: "vSmart is the control plane and vEdges forward traffic — management and analytics live in vManage.",
    },
    {
      id: "x-sdwan-2",
      prompt: "OMP route reflection and centralized control-plane policy run on which component?",
      options: [
        { value: "vsmart", title: "vSmart (SD-WAN Controller)", note: "The OMP route reflector" },
        { value: "vmanage", title: "vManage (SD-WAN Manager)", note: "Management, not route reflection" },
        { value: "vbond", title: "vBond (SD-WAN Validator)", note: "vBond orchestrates onboarding" },
      ],
      correct: "vsmart",
      explain: "vSmart is the control plane: it reflects OMP routes between vEdges and applies centralized policy.",
      wrongGuidance: "vManage manages and vBond validates/onboards — OMP route reflection is vSmart's role.",
    },
    {
      id: "x-sdwan-3",
      prompt: "Which component authenticates and orchestrates the onboarding of new vEdge devices?",
      options: [
        { value: "vbond", title: "vBond (SD-WAN Validator)", note: "The first contact for a booting vEdge" },
        { value: "vmanage", title: "vManage (SD-WAN Manager)", note: "vManage manages after onboarding" },
        { value: "vsmart", title: "vSmart (SD-WAN Controller)", note: "vSmart controls after the control plane is up" },
      ],
      correct: "vbond",
      explain: "vBond is the orchestrator/validator — a new vEdge contacts it first for authentication and to learn the other components.",
      wrongGuidance: "vManage manages and vSmart controls — the device that says 'who are you, and where is everyone?' is vBond.",
    },
    {
      id: "x-sdwan-4",
      prompt: "In an OMP route, what does the TLOC identify?",
      options: [
        { value: "transport", title: "The transport locator — the WAN endpoint that can reach the prefix", note: "System-IP, color, and encapsulation of the forwarding tunnel" },
        { value: "prefix", title: "The prefix itself", note: "The prefix is the route; the TLOC is where to send it" },
        { value: "session", title: "The OMP session ID", note: "OMP sessions are between components, not the locator" },
      ],
      correct: "transport",
      explain: "A TLOC (Transport Locator) names the WAN transport endpoint — system-IP + color + encapsulation — that can deliver to the prefix.",
      wrongGuidance: "The TLOC is the 'where' — the tunnel endpoint on the WAN transport — not the prefix or the session.",
    },
  ],

  // ─── The Signal Detective (4.1–4.6) ───────────────────────────────────────
  "signal-detective": [
    {
      id: "x-signal-1",
      prompt: "Ping already proved a host is reachable. What additional information does traceroute provide?",
      options: [
        { value: "path", title: "The path of hops the packets take", note: "Every router along the route, hop by hop" },
        { value: "bandwidth", title: "Link bandwidth", note: "Traceroute never measures bandwidth" },
        { value: "config", title: "The device configuration", note: "That is a show command, not a probe" },
      ],
      correct: "path",
      explain: "traceroute reveals the hop-by-hop path and per-hop delay — the route, not just reachability.",
      wrongGuidance: "Ping is the 'can you hear me', traceroute is the 'show me the route' — bandwidth needs a different tool.",
    },
    {
      id: "x-signal-2",
      prompt: "You need statistics about flows — who talked to whom, how many bytes — not the raw packets. Which tool?",
      options: [
        { value: "netflow", title: "NetFlow", note: "Flow records, not packet captures" },
        { value: "span", title: "SPAN", note: "SPAN mirrors actual packets" },
        { value: "sla", title: "IP SLA", note: "IP SLA runs synthetic probes, not flow stats" },
      ],
      correct: "netflow",
      explain: "NetFlow summarizes conversations into flow records (src, dst, ports, bytes) — perfect for usage and behavior analysis.",
      wrongGuidance: "SPAN hands you full packet copies and IP SLA probes the network — flow-level statistics are NetFlow's job.",
    },
    {
      id: "x-signal-3",
      prompt: "A debug command is flooding the console. Which approach captures only what you need?",
      options: [
        { value: "conditional", title: "Conditional debug scoped to one neighbor or prefix", note: "debug ip ospf events condition + a neighbor filter" },
        { value: "all", title: "Leave the full debug running and scroll", note: "That floods the CPU and console" },
        { value: "logging", title: "Just raise logging console severity", note: "That suppresses, not targets, the output" },
      ],
      correct: "conditional",
      explain: "Conditional debugging (e.g. debug ip ospf events condition interface g0/0) limits output to the exact object under investigation — CPU-safe and readable.",
      wrongGuidance: "Full debugs are CPU-heavy and unreadable; conditional debug is the targeted, safe approach.",
    },
    {
      id: "x-signal-4",
      prompt: "Which monitoring pair is the classic 'push events, poll counters' setup?",
      options: [
        { value: "syslog-snmp", title: "Syslog pushes events; SNMP polls counters/traps", note: "The standard device-monitoring duo" },
        { value: "netflow-only", title: "NetFlow for both", note: "NetFlow is flow data, not device health" },
        { value: "ping-only", title: "Ping for both", note: "Ping proves reachability, not device health" },
      ],
      correct: "syslog-snmp",
      explain: "Syslog delivers event messages (interface flaps, auth failures) to a collector; SNMP polls metrics and pushes traps on thresholds.",
      wrongGuidance: "NetFlow tracks flows and ping tracks reachability — event push + counter poll is syslog + SNMP.",
    },
    {
      id: "x-signal-5",
      prompt: "A capture device sits across a routed core from the switch being monitored. Which mirroring option reaches it?",
      options: [
        { value: "erspan", title: "ERSPAN — encapsulated in GRE to cross routers", note: "The routed option" },
        { value: "span", title: "Local SPAN", note: "SPAN is same-switch only" },
        { value: "rspan", title: "RSPAN", note: "RSPAN needs L2 connectivity for its session VLAN" },
      ],
      correct: "erspan",
      explain: "ERSPAN wraps mirrored traffic in GRE so it can traverse routed (L3) networks — local SPAN and RSPAN are L2-bound.",
      wrongGuidance: "SPAN is local and RSPAN rides a session VLAN across L2 — crossing a routed core is exactly ERSPAN's job.",
    },
  ],

  // ─── Lock the Control Plane (5.1.a–5.4.d) ─────────────────────────────────
  "lock-the-control-plane": [
    {
      id: "x-lock-1",
      prompt: "A router authenticates against its local username database. Where are those credentials checked?",
      options: [
        { value: "local", title: "On the router itself", note: "The local running config holds the database" },
        { value: "server", title: "On a central AAA server", note: "That would be RADIUS/TACACS+ instead" },
        { value: "nvram", title: "In NVRAM only", note: "Username databases live in the running config" },
      ],
      correct: "local",
      explain: "Local authentication checks the username database stored in the device's own configuration.",
      wrongGuidance: "A central AAA server is what 'local' avoids — local means the check happens on the device.",
    },
    {
      id: "x-lock-2",
      prompt: "Which statement correctly contrasts RADIUS and TACACS+?",
      options: [
        { value: "tacacs-body", title: "TACACS+ encrypts the whole body and separates authentication/authorization; RADIUS encrypts only the password", note: "The two protocols' real differences" },
        { value: "radius-all", title: "RADIUS encrypts the entire packet", note: "RADIUS encrypts only the password field" },
        { value: "both-tcp", title: "Both run over TCP", note: "RADIUS uses UDP; TACACS+ uses TCP 49" },
      ],
      correct: "tacacs-body",
      explain: "TACACS+ (TCP 49) encrypts the entire payload and keeps auth, authorization, and accounting separate; RADIUS (UDP) encrypts only the password.",
      wrongGuidance: "RADIUS encrypts just the password and runs on UDP; full-body encryption plus separated functions is TACACS+.",
    },
    {
      id: "x-lock-3",
      prompt: "MACsec protects traffic at which layer?",
      options: [
        { value: "l2", title: "Layer 2 — encrypts frames between directly connected devices", note: "Port-to-port link encryption" },
        { value: "l3", title: "Layer 3 — encrypts IP packets end to end", note: "That is IPsec's job" },
        { value: "auth-only", title: "It only authenticates, never encrypts", note: "MACsec both authenticates and encrypts" },
      ],
      correct: "l2",
      explain: "MACsec (802.1AE) provides encryption and integrity at Layer 2, protecting each link between adjacent devices.",
      wrongGuidance: "End-to-end IP encryption is IPsec; MACsec is the Layer 2 link-security answer, and it does encrypt.",
    },
    {
      id: "x-lock-4",
      prompt: "CoPP protects a router by rate-limiting which plane?",
      options: [
        { value: "control", title: "The control plane — traffic destined to the CPU", note: "service-policy control-plane polices CPU-bound traffic" },
        { value: "data", title: "The data plane — transit forwarding", note: "Data-plane policing is a different feature" },
        { value: "mgmt", title: "Only the management plane", note: "CoPP covers routing protocols too, not just mgmt" },
      ],
      correct: "control",
      explain: "Control Plane Policing applies a policy to the control plane, rate-limiting CPU-bound traffic so floods can't starve routing and management processes.",
      wrongGuidance: "CoPP is explicitly a control-plane protection — data-plane policing is a separate feature with its own policies.",
    },
    {
      id: "x-lock-5",
      prompt: "A REST API rejects a request with 401. What does that status code mean?",
      options: [
        { value: "unauthorized", title: "Authentication failed — the token or credentials are wrong or missing", note: "401 = prove who you are" },
        { value: "forbidden", title: "Authorization failed — authenticated but not allowed", note: "That is 403" },
        { value: "notfound", title: "The resource does not exist", note: "That is 404" },
      ],
      correct: "unauthorized",
      explain: "401 means the request was unauthenticated or the credentials/token were rejected — fix the Authorization header or token before anything else.",
      wrongGuidance: "401 is an identity problem; 403 is a permissions problem and 404 is a missing resource — check the exact code.",
    },
    {
      id: "x-lock-6",
      prompt: "Endpoint security detects malware on a laptop mid-session. Which response capability contains the spread?",
      options: [
        { value: "edr", title: "EDR/NAC — quarantine the endpoint and block its network access", note: "Containment via posture and isolation" },
        { value: "firewall", title: "A perimeter firewall only", note: "East-west spread happens inside the perimeter" },
        { value: "logging", title: "Logging the alert", note: "Logging documents; containment stops the spread" },
      ],
      correct: "edr",
      explain: "Endpoint detection & response plus NAC quarantine the infected device and cut its network access — containment, not just detection.",
      wrongGuidance: "A perimeter firewall rarely sees internal east-west traffic, and logging alone does nothing to stop lateral movement.",
    },
  ],

  // ─── Automator Prime (6.1–6.7) ────────────────────────────────────────────
  "automator-prime": [
    {
      id: "x-automator-1",
      prompt: "RESTCONF can exchange interface data encoded in which formats?",
      options: [
        { value: "json-xml", title: "JSON and XML", note: "The RESTCONF media types" },
        { value: "xml-only", title: "XML only", note: "That is NETCONF's classic bias — RESTCONF also does JSON" },
        { value: "yaml", title: "YAML only", note: "YAML is not a RESTCONF wire format" },
      ],
      correct: "json-xml",
      explain: "RESTCONF supports both JSON and XML payloads — JSON is the popular choice for web automation.",
      wrongGuidance: "RESTCONF is RESTful and speaks JSON as well as XML — it is not XML-only like NETCONF's roots.",
    },
    {
      id: "x-automator-2",
      prompt: "NETCONF sessions run by default over which secure transport?",
      options: [
        { value: "ssh", title: "SSH (port 830)", note: "The NETCONF standard transport" },
        { value: "https", title: "HTTPS (443)", note: "That is RESTCONF's transport" },
        { value: "snmp", title: "SNMP (161)", note: "SNMP is a different management protocol" },
      ],
      correct: "ssh",
      explain: "NETCONF defaults to SSH on port 830 — the secure, standards-defined transport for its RPC sessions.",
      wrongGuidance: "HTTPS belongs to RESTCONF and SNMP is its own protocol — NETCONF rides SSH/830.",
    },
    {
      id: "x-automator-3",
      prompt: "What does Embedded Event Manager (EEM) let a device do?",
      options: [
        { value: "react", title: "React to events (syslog, timers, interfaces) by running applets", note: "Policy-based automation on the box" },
        { value: "replace", title: "Replace the CLI entirely", note: "EEM complements the CLI, it does not replace it" },
        { value: "learn", title: "Self-learn network behavior", note: "EEM is deterministic event→action, not ML" },
      ],
      correct: "react",
      explain: "EEM watches for events — syslog patterns, timer expirations, interface transitions — and runs predefined applets in response.",
      wrongGuidance: "EEM is event-driven automation, not a CLI replacement and not machine learning.",
    },
    {
      id: "x-automator-4",
      prompt: "A Python script raises KeyError: 'name' while processing an API response. What does this tell you?",
      options: [
        { value: "missing-key", title: "The 'name' key is absent from the dict — inspect the actual response structure", note: "KeyError means the key isn't there" },
        { value: "network", title: "The network request failed", note: "A network failure would raise a connection error, not KeyError" },
        { value: "json", title: "The JSON is invalid", note: "Invalid JSON raises JSONDecodeError, not KeyError" },
      ],
      correct: "missing-key",
      explain: "KeyError names the exact dict key that doesn't exist — the fix is to print the response and adjust the path, not to blame the network or the JSON format.",
      wrongGuidance: "KeyError is a structure bug in your code's assumption about the payload — different exceptions mean network or parse problems.",
    },
    {
      id: "x-automator-5",
      prompt: "Which of these is a valid JSON value?",
      options: [
        { value: "number-array", title: "[\"up\", 1, true, null]", note: "An array of string, number, boolean, and null — all valid JSON types" },
        { value: "single-quote", title: "{'status': 'up'}", note: "JSON requires double quotes on keys and strings" },
        { value: "trailing", title: "{\"a\": 1,}", note: "Trailing commas are invalid in JSON" },
      ],
      correct: "number-array",
      explain: "An array mixing a string, a number, a boolean, and null is perfectly valid JSON — the other two violate JSON's quoting and comma rules.",
      wrongGuidance: "Single quotes and trailing commas are the classic JSON killers — everything must be double-quoted with no dangling commas.",
    },
    {
      id: "x-automator-6",
      prompt: "A YANG tree shows container interfaces { list interface [key name] { leaf enabled } }. How do you address interface GigabitEthernet1's enabled leaf?",
      options: [
        { value: "path", title: "/interfaces/interface[name='GigabitEthernet1']/enabled", note: "List key in brackets, then the leaf" },
        { value: "flat", title: "/interfaces/interface/GigabitEthernet1/enabled", note: "The key must appear in brackets, not as a path segment" },
        { value: "leaf-only", title: "/enabled", note: "The tree's full hierarchy matters for the data path" },
      ],
      correct: "path",
      explain: "YANG instance identifiers walk the tree and select list entries by key in brackets — that exact path form is what NETCONF/RESTCONF use.",
      wrongGuidance: "The key goes in brackets after the list node; skipping the hierarchy or flattening the key changes the identifier.",
    },
    {
      id: "x-automator-7",
      prompt: "Ansible configures network devices with no software installed on them. How?",
      options: [
        { value: "agentless", title: "Agentless — it connects over SSH/NETCONF from the control node", note: "Push-based, no device agent" },
        { value: "agent", title: "An agent on every device pulls config", note: "That is the Puppet/Chef model" },
        { value: "tftp", title: "It TFTPs configs at boot", note: "Not how Ansible works" },
      ],
      correct: "agentless",
      explain: "Ansible is agentless: the control node opens SSH/NETCONF sessions and pushes the desired state, so no persistent software must live on the devices.",
      wrongGuidance: "Ansible's signature is exactly agentless push over SSH — agent-based pull is Puppet/Chef territory.",
    },
  ],
};
