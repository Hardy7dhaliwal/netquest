import type { EncorDomainId } from "./encor-catalog";

/**
 * Multi-domain mixed exam items (exam-only bank).
 *
 * The per-arc quiz pools are single-domain by construction (each question
 * inherits its arc's primary domain), so real ENCOR-style items that blend two
 * domains — e.g. a CoPP policy breaking BGP, or an OSPF adjacency failing
 * inside a VXLAN underlay — were missing from the mock exams. This bank fills
 * that gap: every question spans ≥2 domains and is attributed to objectives
 * from both, so a miss routes remediation into both areas.
 *
 * Each question's FIRST listed domain is its primary domain for exam assembly
 * (the domain whose weighted quota it consumes); all listed domains appear in
 * the score report and the objective rollup. `remediationArcId` points at the
 * best-fit mission arc for the Review link on a miss.
 */
export type ExamBankQuestion = {
  id: string;
  prompt: string;
  options: { value: string; title: string; note?: string }[];
  correct: string;
  explain: string;
  wrongGuidance: string;
  /** Two or more domains this mixed item exercises (first = primary). */
  domainIds: EncorDomainId[];
  /** Objectives across both domains (all must exist in the catalog). */
  objectiveIds: string[];
  /** Best-fit mission arc for remediation links. */
  remediationArcId: string;
};

export const EXAM_BANK_QUESTIONS: ExamBankQuestion[] = [
  // ─── Architecture (primary) ───────────────────────────────────────────────
  {
    id: "eb-arch-1",
    prompt: "A two-tier campus runs HSRP on the distribution pair with the priority of the Active switch tracked against an IP SLA probe to the WAN. When the WAN uplink degrades, the probe fails, the Active decrements its priority, and the Standby takes over. Which two features are working together?",
    options: [
      { value: "tracking", title: "HSRP object tracking + IP SLA", note: "The probe is the trigger, tracking is the reaction" },
      { value: "hsrp-vrrp", title: "HSRP + VRRP on the same interface", note: "Only one FHRP is active on a virtual IP" },
      { value: "ntp-snmp", title: "NTP + SNMP", note: "Neither influences HSRP role changes" },
    ],
    correct: "tracking",
    explain: "IP SLA generates the failure signal, HSRP object tracking reacts by lowering the Active's priority so the Standby preempts and takes over — the standard two-tier HA pattern.",
    wrongGuidance: "HSRP and VRRP are alternatives, not partners, and NTP/SNMP are unrelated to role changes — the pair is IP SLA + HSRP tracking.",
    domainIds: ["architecture", "assurance"],
    objectiveIds: ["1.1.b", "4.4"],
    remediationArcId: "gateway-at-dawn",
  },
  {
    id: "eb-arch-2",
    prompt: "Which statement correctly pairs the SD-Access control plane with its data plane?",
    options: [
      { value: "lisp-vxlan", title: "LISP handles the control plane (mapping system); VXLAN carries the data plane", note: "EID-to-RLOC mapping vs. encapsulation" },
      { value: "vxlan-lisp", title: "VXLAN is the control plane; LISP is the data plane", note: "That inverts the two roles" },
      { value: "ospf-mpls", title: "OSPF is the control plane; MPLS is the data plane", note: "OSPF/MPLS is a WAN pattern, not the fabric" },
    ],
    correct: "lisp-vxlan",
    explain: "SD-Access separates the planes: LISP answers 'where is this endpoint' (EID-to-RLOC mapping), and VXLAN encapsulates the traffic between fabric nodes.",
    wrongGuidance: "The control/data split is LISP-for-mapping and VXLAN-for-carriage — swapping them, or importing OSPF/MPLS, is wrong.",
    domainIds: ["architecture", "virtualization"],
    objectiveIds: ["1.3.a", "2.3.b"],
    remediationArcId: "campus-fabric",
  },
  {
    id: "eb-arch-3",
    prompt: "An automation script queries the Catalyst SD-WAN Manager (vManage) API to pull OMP routes. What must the script do before the first request?",
    options: [
      { value: "auth", title: "Authenticate and obtain an API token (the jSID cookie) from the login endpoint", note: "The API is token-gated" },
      { value: "ssh", title: "SSH into the vSmart controller first", note: "The API is the interface, not SSH" },
      { value: "omp", title: "Open an OMP session to a vEdge", note: "OMP is a data-plane protocol, not an API concern" },
    ],
    correct: "auth",
    explain: "The SD-WAN Manager API requires a session token — scripts POST credentials to the login endpoint, keep the jSID cookie, and pass it on every call.",
    wrongGuidance: "The whole point of the northbound API is to skip SSH and OMP sessions — the first step is token authentication.",
    domainIds: ["architecture", "automation"],
    objectiveIds: ["1.2.a", "6.4"],
    remediationArcId: "sdwan-overlay",
  },

  // ─── Virtualization (primary) ─────────────────────────────────────────────
  {
    id: "eb-virt-1",
    prompt: "Two hosts in the same VNI cannot reach each other even though the VXLAN tunnel endpoints are up. `show nve vni` lists the VNI, but the hosts' VLAN never appears. What is missing on the VTEP?",
    options: [
      { value: "mapping", title: "The VLAN-to-VNI mapping on the NVE interface", note: "The VNI is not wired to the local VLAN yet" },
      { value: "trunk", title: "An 802.1Q trunk to the hosts", note: "Access ports can carry one VLAN without a trunk" },
      { value: "vrf", title: "A VRF per tenant", note: "VRFs segment routing, they don't bridge a VLAN into a VNI" },
    ],
    correct: "mapping",
    explain: "A VTEP only bridges a VLAN into a VNI when `vni <id> vlan <vlan>` maps them on the NVE — the VNI existing in the table isn't enough.",
    wrongGuidance: "The VNI was created but never bound to the local VLAN — that mapping (not a trunk or a VRF) is what joins the two.",
    domainIds: ["virtualization", "infrastructure"],
    objectiveIds: ["2.3.b", "3.1.a"],
    remediationArcId: "fabric-express",
  },
  {
    id: "eb-virt-2",
    prompt: "A compromised VM on a vSwitch port group can sniff traffic from its neighbor VMs on the same host. Which hardening closes that hole?",
    options: [
      { value: "policy", title: "Restrict the port-group security policy — disable promiscuous mode and forged transmits", note: "The vSwitch policy is the enforcement point" },
      { value: "macsec", title: "Enable MACsec on the VMs", note: "MACsec protects links, it doesn't stop port-group sniffing" },
      { value: "vlans", title: "Put the VMs in the same VLAN", note: "That makes the problem worse, not better" },
    ],
    correct: "policy",
    explain: "vSwitch port groups expose promiscuous-mode / MAC-address-change / forged-transmit toggles — hardening them prevents a VM from promiscuously capturing or impersonating neighbors.",
    wrongGuidance: "MACsec is for link encryption and sharing a VLAN invites the sniffing — the fix is the port-group security policy.",
    domainIds: ["virtualization", "security"],
    objectiveIds: ["2.1.c", "5.4.b"],
    remediationArcId: "fabric-express",
  },

  // ─── Infrastructure (primary) ─────────────────────────────────────────────
  {
    id: "eb-infra-1",
    prompt: "Two directly connected routers stay stuck in EXSTART on their OSPF adjacency, and `show interfaces` reveals the two ends have different MTUs. Which fix resolves the adjacency?",
    options: [
      { value: "mtu", title: "Align the interface MTUs (or use ip ospf mtu-ignore on one side)", note: "DD packets are silently dropped when oversized" },
      { value: "timers", title: "Match the hello/dead timers", note: "Timer mismatches stall at INIT, not EXSTART" },
      { value: "cost", title: "Raise the interface cost on one side", note: "Cost affects routing, not adjacency state" },
    ],
    correct: "mtu",
    explain: "On a point-to-point link OSPF negotiates the MTU via Database Description packets; a mismatch drops the DDs and the adjacency stalls at EXSTART/EXCHANGE until the MTUs match or mtu-ignore is set.",
    wrongGuidance: "EXSTART + MTU mismatch is the classic signature — timers would stall earlier (INIT/DOWN) and cost never blocks adjacency.",
    domainIds: ["infrastructure", "assurance"],
    objectiveIds: ["3.2.b", "4.1"],
    remediationArcId: "area-zero-hero",
  },
  {
    id: "eb-infra-2",
    prompt: "An eBGP session flaps every 60 seconds. `show ip bgp summary` shows the neighbor bouncing between Established and Connect, and the control-plane policy on the router's management interface polices TCP 179. What is the likely root cause?",
    options: [
      { value: "copp", title: "CoPP is policing BGP's TCP port below its keepalive rate", note: "Control-plane policing must permit BGP" },
      { value: "router-id", title: "The router-id changed mid-session", note: "That would reset once, not flap every 60s" },
      { value: "multihop", title: "The neighbor needs ebgp-multihop", note: "A directly connected peer doesn't need multihop" },
    ],
    correct: "copp",
    explain: "A mis-scoped CoPP policy that drops or polices tcp/179 starves the keepalives, so the session keeps timing out — BGP traffic must be permitted (and not excessively policed) in the control-plane class.",
    wrongGuidance: "The 60-second cadence matches BGP's hold timer — the control-plane police rate starving keepalives is the classic cause, not router-id or multihop.",
    domainIds: ["infrastructure", "security"],
    objectiveIds: ["3.2.c", "5.2.b"],
    remediationArcId: "edge-has-opinions",
  },
  {
    id: "eb-infra-3",
    prompt: "A VXLAN underlay runs OSPF on a broadcast segment. A leaf shows TWO-WAY with every other leaf instead of FULL. Is this a fault?",
    options: [
      { value: "normal", title: "No — on broadcast segments only the DR and BDR reach FULL with everyone", note: "Non-DR/BDR leaves stay Two-Way among themselves" },
      { value: "fault", title: "Yes — every adjacency must reach FULL", note: "That only applies to the DR/BDR pair" },
      { value: "mtu", title: "Yes — it means the underlay MTU is wrong", note: "An MTU issue would stall at EXSTART" },
    ],
    correct: "normal",
    explain: "On any broadcast multi-access segment (including a VXLAN underlay), the DR and BDR hold FULL adjacencies while the rest stay Two-Way with each other — healthy behavior.",
    wrongGuidance: "FULL-with-everyone is a point-to-point expectation; broadcast segments deliberately limit FULL to the DR/BDR to cut adjacency count.",
    domainIds: ["infrastructure", "virtualization"],
    objectiveIds: ["3.2.b", "2.3.b"],
    remediationArcId: "area-zero-hero",
  },
  {
    id: "eb-infra-4",
    prompt: "Both core switches in a collapsed-core design report as HSRP Active, so the virtual gateway flaps. A VLAN ACL on the inter-switch link denies HSRP hellos. Which command reveals what is happening?",
    options: [
      { value: "standby", title: "show standby brief — both peers will show as Active", note: "Each switch believes it is the only one" },
      { value: "vrrp", title: "show vrrp", note: "The design runs HSRP, not VRRP" },
      { value: "ping", title: "ping to the virtual IP", note: "The virtual IP is not a physical peer address" },
    ],
    correct: "standby",
    explain: "When HSRP hellos are blocked, neither peer hears the other, so each promotes itself to Active — `show standby brief` shows both in Active, pointing straight at the denied hellos.",
    wrongGuidance: "The signature is two Actives in show standby brief; VRRP is the wrong protocol and the virtual IP is not pingable as a peer.",
    domainIds: ["infrastructure", "architecture"],
    objectiveIds: ["3.3.c", "1.1.b"],
    remediationArcId: "gateway-at-dawn",
  },

  // ─── Network Assurance (primary) ──────────────────────────────────────────
  {
    id: "eb-assurance-1",
    prompt: "A monitoring script polls interface counters over RESTCONF every five minutes, but the requests start returning 401 after an hour. How should the script handle this?",
    options: [
      { value: "reauth", title: "Re-authenticate to get a fresh token, then retry the request", note: "REST tokens expire by design" },
      { value: "ignore", title: "Ignore 401s — the counters are still readable", note: "401 means the request was rejected outright" },
      { value: "snmp", title: "Switch the script to SNMPv1", note: "The fix is token lifecycle, not a different protocol" },
    ],
    correct: "reauth",
    explain: "RESTCONF/API tokens expire (often after an hour); a robust script detects the 401, refreshes its token, and retries — the standard pattern for token-based northbound APIs.",
    wrongGuidance: "401 is a definitive rejection — ignoring it or swapping to unauthenticated SNMP misses the real answer: refresh and retry.",
    domainIds: ["assurance", "automation"],
    objectiveIds: ["4.1", "6.5"],
    remediationArcId: "signal-detective",
  },
  {
    id: "eb-assurance-2",
    prompt: "A SPAN session captures nothing. `show monitor session 1` lists a source interface but no destination. Which command completes the session?",
    options: [
      { value: "destination", title: "monitor session 1 destination interface <port>", note: "A session with no destination has nowhere to send copies" },
      { value: "rspan", title: "Configure it as an RSPAN session", note: "RSPAN is for remote switches, not a missing local destination" },
      { value: "source", title: "Add a second source interface", note: "Sources are not the problem — the destination is" },
    ],
    correct: "destination",
    explain: "Every SPAN session needs both a source (traffic to copy) and a destination (the analyzer port that receives the copies) — a session with only a source captures nothing.",
    wrongGuidance: "The clue is in the output: the session has a source but no destination port — adding one completes it.",
    domainIds: ["assurance", "infrastructure"],
    objectiveIds: ["4.3", "3.1.a"],
    remediationArcId: "signal-detective",
  },

  // ─── Security (primary) ───────────────────────────────────────────────────
  {
    id: "eb-sec-1",
    prompt: "A Python script provisions switches through the Catalyst Center API and starts returning 401 mid-run. What should the script do?",
    options: [
      { value: "token", title: "Obtain a fresh X-Auth-Token from the /dna/system/api/v1/auth/token endpoint and retry", note: "Catalyst Center tokens expire and must be refreshed" },
      { value: "snmp", title: "Fall back to SNMPv3 community strings", note: "Credentials aside, the API is the integration surface" },
      { value: "restart", title: "Restart the entire provisioning job", note: "A restart hits the same expired token" },
    ],
    correct: "token",
    explain: "Catalyst Center API calls carry an X-Auth-Token that expires; a well-written script re-authenticates against the token endpoint and retries the failed call with the new token.",
    wrongGuidance: "The 401 is an expired-token signal — re-auth and retry beats SNMP fallback or a blind restart.",
    domainIds: ["security", "automation"],
    objectiveIds: ["5.3", "6.4"],
    remediationArcId: "lock-the-control-plane",
  },
  {
    id: "eb-sec-2",
    prompt: "An NGFW sits between the campus and the WAN, and OSPF adjacencies across it fail. The security policy does not mention OSPF. What is the most likely cause and fix?",
    options: [
      { value: "ospf-policy", title: "The firewall drops OSPF (IP protocol 89) in its default policy — permit OSPF between the router interfaces", note: "Routing adjacencies need their protocol through the path" },
      { value: "ospf-auth", title: "OSPF needs authentication on both sides", note: "Authentication would fail with an explicit error, not silently at the firewall" },
      { value: "eigrp", title: "Switch the campus to EIGRP", note: "The firewall would drop EIGRP (protocol 88) just the same" },
    ],
    correct: "ospf-policy",
    explain: "Stateful firewalls inspect IP protocols — OSPF's protocol 89 must be explicitly permitted (and often the firewall participates or the neighbors are defined) or hellos never cross.",
    wrongGuidance: "The absence of an OSPF rule in a default-deny policy is the smoking gun; changing routing protocols or adding auth doesn't fix a missing permit.",
    domainIds: ["security", "infrastructure"],
    objectiveIds: ["5.4.c", "3.2.b"],
    remediationArcId: "lock-the-control-plane",
  },
  {
    id: "eb-sec-3",
    prompt: "In SD-Access, group-based policy is enforced with security group tags (SGTs). Where does the SGT travel between fabric nodes?",
    options: [
      { value: "vxlan-header", title: "Inside the VXLAN header, alongside the encapsulated frame", note: "The fabric data plane carries the tag" },
      { value: "arp", title: "In ARP replies only", note: "ARP carries no SGT information" },
      { value: "radius", title: "In the RADIUS accounting packets", note: "RADIUS is how endpoints authenticate, not how the data plane tags flow" },
    ],
    correct: "vxlan-header",
    explain: "SD-Access extends VXLAN to carry the SGT in the header (group-based policy), so fabric nodes can enforce contracts between SGTs in the data path.",
    wrongGuidance: "RADIUS authenticates and assigns the tag at onboarding; the SGT itself rides in the VXLAN header as traffic crosses the fabric.",
    domainIds: ["security", "architecture"],
    objectiveIds: ["5.4.d", "1.3.a"],
    remediationArcId: "campus-fabric",
  },

  // ─── Automation (primary) ─────────────────────────────────────────────────
  {
    id: "eb-auto-1",
    prompt: "An EEM applet is supposed to log when the uplink goes down, but it never fires. The applet's regex expects %LINK-3-UPDOWN, while the platform emits %LINEPROTO-5-UPDOWN. What is wrong?",
    options: [
      { value: "pattern", title: "The applet's syslog pattern doesn't match the messages the platform actually sends", note: "EEM only fires on matching syslog" },
      { value: "queue", title: "The EEM policy queue is full", note: "A full queue would affect all applets, not just this one" },
      { value: "priority", title: "The applet priority is too low", note: "Priority orders simultaneous policies; it does not gate firing" },
    ],
    correct: "pattern",
    explain: "An EEM applet keyed to a syslog pattern only fires when a message matching that regex arrives — %LINK and %LINEPROTO messages are different events, so the applet never triggers.",
    wrongGuidance: "The mismatch between the expected and the actual syslog message is the whole story — the regex must match what the platform emits.",
    domainIds: ["automation", "assurance"],
    objectiveIds: ["6.6", "4.1"],
    remediationArcId: "automator-prime",
  },
  {
    id: "eb-auto-2",
    prompt: "An automation tool manages ESXi hosts through the VMware collection without installing anything on the hypervisors themselves. Which orchestration model is this?",
    options: [
      { value: "agentless", title: "Agentless — it connects via SSH or the hypervisor's API", note: "No software is installed on the managed host" },
      { value: "agent-based", title: "Agent-based — a plugin is embedded in each ESXi host", note: "That is the opposite of what the scenario describes" },
      { value: "hybrid", title: "A hybrid model that needs both", note: "This scenario explicitly uses neither an agent nor a plugin" },
    ],
    correct: "agentless",
    explain: "Agentless orchestration drives the managed device through its native interfaces (SSH, API); agent-based tools install a component on each target. VMware collection + no install = agentless.",
    wrongGuidance: "No installation on the hypervisor is the defining trait of agentless — agent-based models install components by definition.",
    domainIds: ["automation", "virtualization"],
    objectiveIds: ["6.7", "2.1.a"],
    remediationArcId: "automator-prime",
  },
];
