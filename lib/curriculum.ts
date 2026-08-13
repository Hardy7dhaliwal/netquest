import { ENCOR_DOMAINS, ENCOR_MISSION_ARCS, type EncorObjective } from "./encor-catalog";
import { getArcQuiz, ARC_TO_MISSION, type QuizQuestion } from "./quiz";
import { getFlashcardDeck, type Flashcard } from "./flashcards";

/**
 * Objective-level curriculum (PRD "learn and pass" phase).
 *
 * Each of the 47 blueprint objectives carries a teaching plan: teachable
 * subskills, a concise lesson, at least two guided scenarios, misconception
 * feedback, and a hands-on configuration/troubleshooting task where applicable.
 * Assessments and review cards are *derived* from the content that already
 * exists (per-arc quiz banks and the flashcard deck), so nothing is authored
 * twice and the counts in the coverage matrix are real evidence, not claims.
 *
 * Coverage states are computed from that evidence, not asserted:
 *   planned   — no playable mission arc, or no lesson authored
 *   partial   — some content exists, but a required piece is missing
 *   complete  — every required piece is present (lesson, ≥2 scenarios, ≥3
 *               assessments, ≥1 review card, misconception feedback)
 *   verified  — complete AND a deterministic engine test covers the objective
 *               AND the objective's quiz bank has ≥8 questions
 */

export type CurriculumStatus = "planned" | "partial" | "complete" | "verified";

export type ObjectivePlan = {
  objectiveId: string;
  /** Teachable subskills the broad objective splits into. */
  subskills: string[];
  /** Concise lesson/explanation for the objective. */
  lesson: string;
  /** At least two guided scenarios: situation + what the learner does. */
  scenarios: string[];
  /** Misconception feedback — the wrong mental model and the correction. */
  misconceptions: string[];
  /** Configuration or troubleshooting task, where applicable. */
  handsOn?: string;
};

/** Per-arc deterministic engine test file (the arc's mission test). */
export const ARC_TEST_FILES: Record<string, string> = {
  "vlan-that-vanished": "lib/mission.test.ts",
  "stp-storm": "lib/stp-mission.test.ts",
  "bundled-bottleneck": "lib/etherchannel-mission.test.ts",
  "area-zero-hero": "lib/ospf-mission.test.ts",
  "edge-has-opinions": "lib/edge-mission.test.ts",
  "gateway-at-dawn": "lib/gateway-mission.test.ts",
  "edge-services": "lib/edge-services-mission.test.ts",
  "tunnel-vision": "lib/tunnel-vision-mission.test.ts",
  "fabric-express": "lib/fabric-express-mission.test.ts",
  "campus-fabric": "lib/campus-fabric-mission.test.ts",
  "sdwan-overlay": "lib/sdwan-mission.test.ts",
  "signal-detective": "lib/signal-detective-mission.test.ts",
  "lock-the-control-plane": "lib/lock-control-plane-mission.test.ts",
  "automator-prime": "lib/automator-prime-mission.test.ts",
};

export const CURRICULUM_PLANS: Record<string, ObjectivePlan> = {
  // ─── Architecture (15%) ───────────────────────────────────────────────────
  "1.1.a": {
    objectiveId: "1.1.a",
    subskills: ["Two-tier and three-tier designs", "Fabric designs", "Cloud integration"],
    lesson:
      "Enterprise designs balance scale, cost, and resilience. Two-tier (collapsed core) merges core and distribution for smaller sites; three-tier separates core, distribution, and access. Fabric designs (e.g. SD-Access) overlay logical segmentation on an IP underlay, and cloud integration extends the campus to IaaS/SaaS without losing policy control.",
    scenarios: [
      "A 40-port branch office needs a resilient design with a single wiring closet — compare two-tier vs three-tier and pick collapsed core.",
      "A campus grows to 8 wiring closets with a services core — justify a three-tier layout and where L3 routing should live.",
    ],
    misconceptions: [
      "Three-tier is always 'better' — for a small site it adds cost and delay with no resilience benefit.",
      "SD-Access replaces the physical design — it is an overlay; the underlay still needs sound L2/L3 design.",
    ],
    handsOn: "Sketch and justify a two-tier vs three-tier design for a given site size, stating where STP, routing, and services terminate.",
  },
  "1.1.b": {
    objectiveId: "1.1.b",
    subskills: ["Device redundancy (SSO, stack)", "First-hop redundancy (HSRP/VRRP)", "Link and path redundancy"],
    lesson:
      "High availability removes single points of failure. At Layer 3, FHRPs like HSRP and VRRP share a virtual gateway IP so a router failure is invisible to hosts. Device-level redundancy (SSO, stacking) keeps control-plane state across a failover, and redundant links/paths give the network time to converge.",
    scenarios: [
      "Hosts point at a single gateway that fails at 2am — which FHRP design keeps them online with zero reconfiguration?",
      "A switch stack loses one member — how do stacking and SSO differ in what survives the failure?",
    ],
    misconceptions: [
      "Redundant links alone give HA — without an FHRP or routing protocol, hosts with a static gateway still lose connectivity.",
      "HSRP and VRRP are the same thing — HSRP is Cisco-proprietary (Active/Standby), VRRP is IEEE (Master/Backup) and can use the real interface MAC.",
    ],
    handsOn: "Configure HSRP with priorities and preempt on a gateway pair and verify the virtual IP answers ARP from the Active router.",
  },
  "1.2.a": {
    objectiveId: "1.2.a",
    subskills: ["Control plane (vSmart, OMP)", "Management plane (vManage)", "Data plane (vEdge/cEdge)", "Orchestration (vBond)"],
    lesson:
      "Catalyst SD-WAN separates planes: vManage (SD-WAN Manager) is the management and analytics plane, vSmart (SD-WAN Controller) is the control plane and reflects OMP routes, vBond (SD-WAN Validator) orchestrates onboarding and authentication, and vEdge/cEdge devices form the data plane with TLOC-anchored tunnels.",
    scenarios: [
      "A new branch vEdge boots with no configuration — trace which component it contacts first and why.",
      "An OMP route is not appearing at a remote vEdge — which plane and which component do you inspect?",
    ],
    misconceptions: [
      "OMP replaces BGP entirely — OMP is the control-plane protocol between controllers and vEdges; BGP still runs at the service edge toward external networks.",
      "The data plane is vManage — vManage manages; vEdges forward over the IPsec tunnels.",
    ],
    handsOn: "From a vEdge console, interpret show control connections, show omp routes, and show omp tlocs to locate a missing route.",
  },
  "1.2.b": {
    objectiveId: "1.2.b",
    subskills: ["Transport independence", "Centralized policy", "Benefits and limitations"],
    lesson:
      "SD-WAN's benefits are transport independence (any WAN underlay), centralized policy, application-aware routing, and simpler branch onboarding. Limitations include the need for controller infrastructure, higher encryption overhead, and that policy is only as good as the underlay QoS you provision.",
    scenarios: [
      "A company wants to fail over MPLS to broadband transparently — does SD-WAN deliver this and what must the underlay provide?",
      "Management wants 'cloud on-ramp' for SaaS — what does SD-WAN add over a traditional DMVPN design?",
    ],
    misconceptions: [
      "SD-WAN makes the underlay irrelevant — you still need adequate bandwidth, latency, and QoS on each transport.",
      "SD-WAN is only for large enterprises — the value (and complexity) scales with the branch count.",
    ],
  },
  "1.3.a": {
    objectiveId: "1.3.a",
    subskills: ["Fabric roles (edge/border/control)", "Control plane (LISP)", "Data plane (VXLAN)", "Underlay routing"],
    lesson:
      "SD-Access separates identity (EID) from location (RLOC). Fabric edge nodes connect endpoints, border nodes connect the fabric to external networks, and the control plane node runs LISP map-server/map-resolver to answer EID-to-RLOC lookups. The data plane encapsulates traffic in VXLAN over an IS-IS underlay.",
    scenarios: [
      "A host sends its first packet — trace the LISP control-plane lookup and the resulting VXLAN encapsulation.",
      "Fabric traffic must reach a legacy non-fabric core — which node type bridges the two and how?",
    ],
    misconceptions: [
      "VXLAN is the control plane — VXLAN is the data plane; LISP is the control plane that answers 'where is this host?'.",
      "The underlay needs BGP — the recommended underlay IGP is IS-IS, with BGP involved only where required.",
    ],
    handsOn: "Trace a fabric packet: LISP map request for the destination EID, then the VXLAN-encapsulated data flow between edge nodes.",
  },
  "1.3.b": {
    objectiveId: "1.3.b",
    subskills: ["Interoperability with legacy campus", "Border and gateway integration", "Policy propagation"],
    lesson:
      "SD-Access interoperates with traditional campuses through border nodes that connect the fabric to legacy L2/L3 domains. Legacy devices keep their existing switching/routing; the fabric presents itself as a normal routed domain, and segmentation policy is preserved via SGTs where the legacy side supports them.",
    scenarios: [
      "A legacy access switch must connect to the fabric without being replaced — which design keeps it working and where do its users register?",
      "Users in a non-fabric VLAN need to reach fabric-hosted servers — how does the border bridge L2 and L3?",
    ],
    misconceptions: [
      "Everything must be fabric to get any benefit — borders were designed exactly for mixed-mode migration.",
      "SGTs survive the handoff automatically — the legacy domain must support SGT propagation or policy is lost at the boundary.",
    ],
  },
  "1.4": {
    objectiveId: "1.4",
    subskills: ["DSCP and PHBs", "Classification and marking", "Queuing and policy maps"],
    lesson:
      "QoS configs classify traffic, mark it (often with DSCP), and treat it in queues. Key PHBs: EF (46) for voice, AF classes (AF41=34 etc.) for assured forwarding, CS0/0 for best effort. A policy map ties class maps to actions like bandwidth, priority (strict), and WRED.",
    scenarios: [
      "Voice is being dropped under congestion — which class and queue action fixes it, and which DSCP should voice carry?",
      "A policy map shows class AF41 with bandwidth 30 — interpret what the config guarantees vs. what it doesn't.",
    ],
    misconceptions: [
      "Marking on the WAN edge is enough — you should trust/remark at the trust boundary; dropping is what actually happens under congestion.",
      "priority and bandwidth mean the same thing — priority is strict scheduling, bandwidth is a guaranteed minimum share.",
    ],
    handsOn: "Interpret a Cisco MQC config (class-map → policy-map → service-policy) and state the per-class treatment.",
  },

  // ─── Virtualization (10%) ─────────────────────────────────────────────────
  "2.1.a": {
    objectiveId: "2.1.a",
    subskills: ["Type 1 (bare-metal) hypervisors", "Type 2 (hosted) hypervisors"],
    lesson:
      "Type 1 hypervisors (ESXi, KVM, Hyper-V) run directly on hardware and partition it among VMs — the standard for servers. Type 2 hypervisors (VirtualBox, Workstation) run as applications on a host OS — fine for labs and desktops, but they add an OS layer and its overhead.",
    scenarios: [
      "A production server must host 20 VMs with minimal overhead — pick the hypervisor type and justify it.",
      "A student needs VMs on a laptop running Windows — which hypervisor type fits and what's the tradeoff?",
    ],
    misconceptions: [
      "Type 2 is 'a worse Type 1' — it's a different fit: hosted for convenience, bare-metal for density and isolation.",
      "KVM is Type 2 because Linux is underneath — KVM is Type 1: it turns Linux itself into the hypervisor.",
    ],
  },
  "2.1.b": {
    objectiveId: "2.1.b",
    subskills: ["VM anatomy (vCPU/RAM/vNIC/vDisk)", "vMotion and snapshots", "VM resource behavior"],
    lesson:
      "A virtual machine is a software computer: virtual CPUs, RAM, NICs, and disks backed by host hardware. vMotion live-migrates a running VM between hosts (zero downtime), snapshots capture state for rollback, and a VM's performance is bounded by what the host can actually provide.",
    scenarios: [
      "A VM must move to another host for maintenance with no downtime — which feature and what are the prerequisites?",
      "A VM is slow even though the guest shows idle CPU — where else should you look (host contention, vCPU overcommit)?",
    ],
    misconceptions: [
      "Adding vCPUs always makes a VM faster — overcommit and scheduling can make more vCPUs slower for latency-sensitive workloads.",
      "Snapshots are backups — a snapshot is a point-in-time delta, not a replaceable backup strategy.",
    ],
  },
  "2.1.c": {
    objectiveId: "2.1.c",
    subskills: ["Virtual switches (vSwitch)", "Port groups and VLANs", "Distributed switches"],
    lesson:
      "A virtual switch connects VMs to each other and to the physical network. Port groups define policy (VLAN tagging, security) for a set of ports, and a distributed switch (like vDS) centralizes configuration across many hosts so one policy object spans the cluster.",
    scenarios: [
      "VMs must be isolated by VLAN on the same host — where does the VLAN tag get applied?",
      "Two hosts must expose identical virtual-switch config — why is a distributed switch better than per-host vSwitches?",
    ],
    misconceptions: [
      "A vSwitch is a physical switch in software with full feature depth — it's a simple L2 forwarding element; L3 and most features live on the physical uplink.",
      "Port groups are just 'where VMs plug in' — they carry the VLAN and policy for every member.",
    ],
  },
  "2.2.a": {
    objectiveId: "2.2.a",
    subskills: ["VRF definition and import/export", "Route leaking and overlapping addresses", "VRF verification"],
    lesson:
      "A VRF is a separate routing and forwarding table on one router — interfaces assigned to a VRF only use that VRF's routes. Import/export route targets control which VPN routes enter the table, and route leaking (usually via import/export of specific routes) is how overlapping or shared prefixes are handled.",
    scenarios: [
      "Two customers use the same 10.0.0.0/24 — how does VRF keep them apart, and what must be true of the interfaces?",
      "A management VRF must reach the global table's default route — which mechanism leaks the route and how is it bounded?",
    ],
    misconceptions: [
      "VRF is the same as a VLAN — VRFs separate at Layer 3 (routing tables); VLANs separate at Layer 2 (broadcast domains).",
      "VRFs can't share any routes — selective import/export leaks exactly the routes you choose.",
    ],
    handsOn: "Configure vrf definition CUST-A with import/export route-target, assign interfaces, and verify with show ip vrf and show ip route vrf CUST-A.",
  },
  "2.2.b": {
    objectiveId: "2.2.b",
    subskills: ["GRE tunnels", "IPsec (IKE phase 1/2, transform sets)", "GRE-over-IPsec"],
    lesson:
      "GRE (IP protocol 47) encapsulates any payload — including multicast for routing protocols — over an IP tunnel. IPsec provides confidentiality/integrity via IKE (phase 1: isakmp policy + keys; phase 2: transform set + crypto map). GRE-over-IPsec combines them: GRE carries routing/multicast, IPsec protects the outer GRE flow.",
    scenarios: [
      "OSPF must run over a WAN tunnel — why GRE, and what does that mean for the crypto map's access list?",
      "A tunnel is up but payloads are dropped — where do you look: phase 1 SA, phase 2 SA, or the crypto ACL?",
    ],
    misconceptions: [
      "IPsec alone can carry OSPF — IPsec is unicast-only; GRE is what carries multicast and broadcast.",
      "The crypto ACL should match the inner private subnets — it must match the GRE (outer) flow; matching inner traffic breaks phase 2.",
    ],
    handsOn: "Configure GRE-over-IPsec: tunnel interface, isakmp policy + key, transform set, crypto map matched to the GRE flow, then verify both phases.",
  },
  "2.3.a": {
    objectiveId: "2.3.a",
    subskills: ["EID/RLOC split", "Map server / map resolver", "LISP control plane"],
    lesson:
      "LISP separates endpoint identifiers (EIDs) from routing locators (RLOCs). A map server registers EID-to-RLOC mappings; a map resolver answers queries. Instead of injecting every host prefix into the routing table, only RLOCs are routed — the control plane resolves EIDs on demand.",
    scenarios: [
      "A host moves buildings and changes RLOC — what updates in the LISP mapping system and what never changes?",
      "A new site registers its prefixes — trace map-register through the map server to the mapping database.",
    ],
    misconceptions: [
      "LISP routes traffic like a normal IGP — it's an overlay control plane; the underlay routes RLOCs.",
      "LISP requires every device to run it — only LISP-enabled nodes participate; the underlay is oblivious.",
    ],
  },
  "2.3.b": {
    objectiveId: "2.3.b",
    subskills: ["VXLAN encapsulation (UDP 4789)", "VTEP roles", "VNI = segment"],
    lesson:
      "VXLAN overlays L2 segments (VNIs, the VLAN equivalent) on an IP underlay. VTEPs (VXLAN tunnel endpoints) encapsulate frames in UDP (port 4789) and deliver them across the underlay, so a L2 segment can span sites. VNI numbering scales past the 4094-VLAN limit.",
    scenarios: [
      "Two distant switches must share one L2 segment — how do VTEPs and VNIs make that work over an L3 core?",
      "Multicast or head-end replication — compare how broadcast traffic is handled in a VXLAN fabric.",
    ],
    misconceptions: [
      "VXLAN replaces routing — it's a L2 extension; routing (and usually a control plane like EVPN/LISP) still decides where packets go.",
      "VXLAN adds no overhead — each frame gains a VXLAN header + UDP/IP, raising MTU requirements (typically 1550+).",
    ],
  },

  // ─── Infrastructure (30%) ─────────────────────────────────────────────────
  "3.1.a": {
    objectiveId: "3.1.a",
    subskills: ["802.1Q trunk operation", "Allowed and native VLANs", "Trunk failure diagnosis"],
    lesson:
      "Trunking carries many VLANs on one link by tagging frames with 802.1Q. The allowed list prunes VLANs from the trunk; the native VLAN (1 by default) crosses untagged. Trunk failures come from mismatched modes, pruned allowed lists, missing VLANs on the far switch, or native-VLAN mismatches.",
    scenarios: [
      "VLAN 20 crosses SW1's trunk but not SW2's — which commands show the allowed list on both ends, and what fix applies?",
      "Two trunks show different native VLANs — what breaks (hint: it's quiet, and it involves untagged frames), and how do you spot it?",
    ],
    misconceptions: [
      "A missing VLAN on the far switch still lets traffic through — the VLAN must exist locally for its access ports to work.",
      "The native VLAN must match — mismatched native VLANs silently merge broadcast domains (a VLAN-hopping risk).",
    ],
    handsOn: "Troubleshoot an inter-switch trunk: show interfaces trunk, identify the pruned allowed list, and fix it with switchport trunk allowed vlan add.",
  },
  "3.1.b": {
    objectiveId: "3.1.b",
    subskills: ["LACP/PAgP negotiation", "Channel formation requirements", "Failure diagnosis"],
    lesson:
      "EtherChannels bundle up to 8 physical links into one logical link. Negotiation is LACP (IEEE, active/passive) or PAgP (Cisco, desirable/auto); both ends must be compatible or use mode on. Members must match speed/duplex/VLAN config, or the channel drops links or fails to form.",
    scenarios: [
      "A bundle never forms — one side is active, the other is passive; does it work, and what does show etherchannel summary reveal?",
      "A member link keeps flapping out of the channel — which member attributes must match for the channel to stay healthy?",
    ],
    misconceptions: [
      "mode on works with any peer — it forces the channel but silently bundles even if the far end disagrees (no negotiation).",
      "Links just need to be up — mismatched VLAN membership or speed/duplex prevents or destabilizes the bundle.",
    ],
    handsOn: "Diagnose a stuck bundle: show etherchannel summary and show interfaces etherchannel, fix the LACP mode, and verify the Port-Channel is up.",
  },
  "3.1.c": {
    objectiveId: "3.1.c",
    subskills: ["RSTP operation", "MST regions, instances, and mapping", "Root guard and BPDU guard"],
    lesson:
      "RSTP converges fast via proposal/agreement. MST groups VLANs into instances to scale: switches in a region agree on a name, revision, and VLAN→instance map; a region boundary runs one spanning tree per instance. Root guard blocks a port from becoming the root's path (rejects superior BPDUs); BPDU guard err-disables a port that receives a BPDU where none should arrive (access ports). A mismatched region (different name, revision, or mapping) silently splits the region, so the same instance numbers diverge on either side of the boundary.",
    scenarios: [
      "A rogue switch with lower priority hijacks root — which guard stops it, and what does the port do?",
      "VLANs must be load-balanced across two uplinks — how does MST instance mapping achieve this?",
      "Two switches show different MST root bridges for the same instance despite identical-looking configs — which region attribute (name, revision, VLAN map) must match for them to share a region?",
    ],
    misconceptions: [
      "Root guard and BPDU guard are interchangeable — root guard protects against a new root via a port; BPDU guard shuts down ports receiving any BPDU.",
      "MST is 'RSTP for one VLAN' — MST runs one instance per mapping group of VLANs, not per VLAN.",
      "Only the region name matters for MST — the revision number and the VLAN→instance mapping must also match, or switches treat each other as different regions.",
    ],
    handsOn: "Configure MST region/instance mapping plus root guard and BPDU guard, and verify with show spanning-tree mst — then diagnose a region mismatch from the boundary report.",
  },
  "3.2.a": {
    objectiveId: "3.2.a",
    subskills: ["EIGRP DUAL and feasible successors", "OSPF SPF and cost", "Metric and convergence comparison"],
    lesson:
      "EIGRP is a hybrid protocol using DUAL: it pre-computes a feasible successor for instant failover and uses bandwidth+delay as its metric. OSPF is link-state: every router builds the full topology and runs SPF, using cost (reference BW / interface BW) as its metric. OSPF scales with areas; EIGRP is simpler in small routed designs.",
    scenarios: [
      "A link fails — which protocol converges without recomputation (feasible successor) and which must run SPF again?",
      "Two paths differ in bandwidth and delay — compute which wins under each protocol's metric.",
    ],
    misconceptions: [
      "OSPF and EIGRP use the same metric — EIGRP: bandwidth+delay composite; OSPF: cumulative interface cost.",
      "EIGRP is dead — it's still widely deployed and its DUAL failover is genuinely instant when a feasible successor exists.",
    ],
  },
  "3.2.b": {
    objectiveId: "3.2.b",
    subskills: ["Adjacency formation and states", "Areas and summarization", "Filtering and passive interfaces", "OSPFv3 (IPv6) configuration"],
    lesson:
      "OSPF adjacencies progress Down→Init→Two-Way→ExStart→Exchange→Loading→FULL and require matching area, hello/dead timers, and network type. Area 0 is the backbone. Summarization (area X range) and filtering (distribute-list, passive-interface) control route propagation and CPU load. OSPFv3 is the IPv6 incarnation: it runs inside ipv6 router ospf, uses link-local addresses for adjacencies, and enables per-process address families (address-family ipv6) — the LSA types and state machine carry over from OSPFv2.",
    scenarios: [
      "Two routers are stuck in ExStart/Exchange — which parameter mismatch is it (MTU) and how do you confirm?",
      "A redistributed network must be summarized at the ABR and hidden from one neighbor — which two commands?",
      "Two IPv6 routers never form an adjacency even though addresses are in the same subnet — what does OSPFv3 use for neighbor discovery (link-local) and which process command enables it?",
    ],
    misconceptions: [
      "Stuck in Two-Way is a failure — Two-Way is normal between non-DR neighbors on broadcast segments; FULL is expected only with the DR/BDR.",
      "passive-interface stops the router from sending anything — it suppresses hello updates on that interface while the network statement stays.",
      "OSPFv3 is configured exactly like OSPFv2 — OSPFv3 runs under ipv6 router ospf and forms adjacencies over link-local addresses; there is no per-interface network statement, the process enables interfaces directly.",
    ],
    handsOn: "Troubleshoot an OSPF adjacency stuck below FULL (timer/area/MTU), then configure a summary and a passive interface, and verify with show ip ospf neighbor. For OSPFv3, configure ipv6 router ospf + address-family and verify with show ipv6 ospf neighbor.",
  },
  "3.2.c": {
    objectiveId: "3.2.c",
    subskills: ["eBGP peering basics", "Neighbor states and multihop", "Best-path reasoning"],
    lesson:
      "eBGP peers directly connected ASes. The session climbs Idle→Connect→Active→OpenSent→OpenConfirm→Established. Default TTL is 1 (directly connected); ebgp-multihop raises it for indirect peers. Best-path selection starts with weight, then local preference, AS path, origin, MED, and tie-breakers.",
    scenarios: [
      "A peer two hops away never reaches Established — which eBGP attribute and command fix it?",
      "Two paths to the same prefix: one has lower MED, the other a shorter AS path — which is preferred, and in what order are they compared?",
    ],
    misconceptions: [
      "eBGP neighbors can be anywhere — the default TTL of 1 assumes a direct link; multihop must be explicit.",
      "MED decides most path choices — weight, local preference, and AS path all come before MED.",
    ],
    handsOn: "Bring up a directly connected eBGP session, verify with show ip bgp summary, and fix a two-hop peer with ebgp-multihop.",
  },
  "3.2.d": {
    objectiveId: "3.2.d",
    subskills: ["Route maps and set clauses", "PBR application", "Local policy"],
    lesson:
      "Policy-based routing uses route maps to override destination-based forwarding for matched traffic. A match clause selects traffic (ACL/prefix), set clauses choose the next hop/output interface, and the policy applies inbound on an interface or via ip local policy for locally generated traffic.",
    scenarios: [
      "Voice traffic must exit via a specific next hop regardless of the routing table — build the route map and apply it.",
      "A policy applied to an interface does nothing for router-generated pings — which additional command is missing?",
    ],
    misconceptions: [
      "PBR changes the routing table — it doesn't; it overrides the lookup per matched packet.",
      "PBR applies to traffic leaving the router by default — it's applied inbound on the ingress interface.",
    ],
    handsOn: "Configure a PBR route map (match voice ACL, set next-hop) and apply it inbound, then verify with show route-map.",
  },
  "3.3.a": {
    objectiveId: "3.3.a",
    subskills: ["NTP client/server and stratum", "PTP (IEEE 1588) roles and clock types", "Time sync verification"],
    lesson:
      "NTP synchronizes clocks over UDP 123; stratum ranks clock quality (1 = authoritative). Devices act as clients, servers, or peers. PTP (IEEE 1588) provides microsecond precision for industrial/AV networks using a grandmaster clock and boundary/transparent clocks. A grandmaster is the timing source (chosen by priority + clock quality); a boundary clock re-times sync on each hop; a transparent clock measures and corrects delay without re-timing. PTP configs name the domain, role, and priority — interpreting them means reading who is grandmaster and how accuracy is preserved hop-by-hop.",
    scenarios: [
      "Logs from two devices disagree on event times — which NTP settings and commands do you check (server, stratum, offset)?",
      "A real-time application needs sub-millisecond sync — why PTP instead of NTP, and what roles exist?",
      "A PTP network shows the same clock domain but two devices claim grandmaster — which PTP attribute (priority1/2, clock class) breaks the tie?",
    ],
    misconceptions: [
      "Higher stratum is better — lower stratum numbers are closer to the authoritative source and more accurate.",
      "NTP and PTP are interchangeable — NTP is millisecond-grade for IT; PTP is microsecond-grade for specialized networks.",
      "A boundary clock and a transparent clock do the same thing — a boundary clock re-times (a mini-grandmaster per hop); a transparent clock only measures and corrects transit delay.",
    ],
    handsOn: "Configure an NTP client to a server, verify with show ntp status/associations, interpret stratum and offset, and read a PTP config (domain, role, priority) to identify the grandmaster.",
  },
  "3.3.b": {
    objectiveId: "3.3.b",
    subskills: ["Static NAT and PAT (overload)", "Inside/outside semantics", "NAT verification and issues"],
    lesson:
      "NAT translates private inside addresses to public outside addresses. Static NAT maps one-to-one; PAT (overload) multiplexes many inside hosts on one public IP using ports. Inside/outside is per-interface: ip nat inside/outside must be right or translation silently fails.",
    scenarios: [
      "50 hosts share one public IP — which NAT type, and what does the translation table look like under load?",
      "A web server must be reachable from the internet at a fixed public IP — static NAT, and which interface commands are required?",
    ],
    misconceptions: [
      "ip nat inside/outside is optional — without correct interface direction, translations never form.",
      "PAT works for every protocol — anything without ports (some ICMP, IPsec ESP) needs special handling.",
    ],
    handsOn: "Configure PAT overload for a LAN, verify with show ip nat translations and show ip nat statistics, and add a static NAT for a server.",
  },
  "3.3.c": {
    objectiveId: "3.3.c",
    subskills: ["HSRP configuration", "VRRP configuration", "Preempt, priority, and verification"],
    lesson:
      "HSRP and VRRP share a virtual gateway IP. Priority picks the Active/Master (higher wins); preempt lets the higher-priority router reclaim the role when it returns. Hosts ARP for the virtual IP and the Active/Master answers with the virtual MAC — failover is invisible to them.",
    scenarios: [
      "The standby never takes over when the active dies — which missing command (preempt) or config error is to blame?",
      "Both routers show Active/Master — split-brain! Which traffic path is broken, and what usually causes it (no hello between them)?",
    ],
    misconceptions: [
      "Preempt is on by default — it isn't; without it, a returning router stays standby until the current active fails.",
      "HSRP and VRRP use the same virtual MAC scheme — HSRP: 0000.0c07.acXX; VRRP: 0000.5e00.01XX.",
    ],
    handsOn: "Configure HSRP with priority and preempt on two routers, force a failover, and verify show standby.",
  },
  "3.3.d": {
    objectiveId: "3.3.d",
    subskills: ["RPF checks", "PIM Sparse Mode and RPs", "IGMPv2/v3 and SSM", "Bidir PIM and MSDP"],
    lesson:
      "Multicast needs receivers (IGMP), a routing protocol (PIM), and loop prevention (RPF). PIM-SM builds shared trees via rendezvous points; SSM skips RPs using (S,G) with IGMPv3. Bidir PIM suits many-to-many. MSDP lets RPs learn sources across domains. RPF checks that multicast arrives on the interface back toward the source.",
    scenarios: [
      "Multicast flows only to directly attached receivers — which missing pieces (RP, PIM on all interfaces, IGMP) explain it?",
      "Two PIM domains need to share sources — which protocol (MSDP) and where does it run (between RPs)?",
    ],
    misconceptions: [
      "PIM alone delivers multicast — receivers must signal with IGMP, and every transit router needs PIM enabled on the path.",
      "SSM needs an RP — SSM (232/8) intentionally has no RP; it uses IGMPv3 (S,G) reports.",
    ],
    handsOn: "Troubleshoot a missing multicast flow: verify RPF via show ip mroute, confirm the RP with show ip pim rp mapping, and enable PIM/IGMP on the path.",
  },

  // ─── Network Assurance (10%) ──────────────────────────────────────────────
  "4.1": {
    objectiveId: "4.1",
    subskills: ["ping and traceroute", "debug and conditional debug", "SNMP v2c/v3 polling", "Syslog severity and forwarding"],
    lesson:
      "Assurance tools find where a network breaks: ping proves reachability, traceroute shows the path and per-hop delay, debug (ideally conditional) reveals protocol behavior, and SNMP/syslog provide ongoing health monitoring and event logs. Conditional debug avoids flooding the console by filtering to one neighbor or prefix. SNMP polls counters (get requests, communities for v2c or users for v3) and can push traps/informs; syslog streams severity-tagged events (0 emergency → 7 debug) to a collector — the pair is 'push events, poll counters'.",
    scenarios: [
      "Ping to a remote host works but an application times out — which tool isolates the path vs the endpoint?",
      "An OSPF neighbor flaps — which conditional debug captures only that neighbor without drowning the console?",
      "A NOC polls a router's interface counters but gets no response, while the device clearly forwards traffic — which SNMP element (community, version, or access-list) is the first thing to verify?",
    ],
    misconceptions: [
      "A successful ping means the whole path is fine — ping verifies ICMP; application traffic can still fail (MTU, ACL, QoS).",
      "debug is fine to leave on — debug is CPU-heavy; always use conditional debug and disable it when done.",
      "SNMP only means traps — SNMP does both polling (get/response, the NOC pulls counters) and pushing (traps, the device pushes events); syslog is the separate event-streaming channel.",
    ],
    handsOn: "Run ping and traceroute to locate a failure hop, use a conditional debug to capture OSPF events for a single neighbor, and verify an SNMP community answers a poll while syslog forwards events at severity 6.",
  },
  "4.2": {
    objectiveId: "4.2",
    subskills: ["Flow record / exporter / monitor", "Flexible NetFlow fields", "Verification"],
    lesson:
      "Flexible NetFlow builds flow records from configurable keys (IPs, ports, DSCP) and non-keys (counters). A flow exporter sends records (e.g. to a collector over UDP), a flow monitor references record+exporter, and it applies to an interface or the box. It answers 'who talked to whom, how much, when'.",
    scenarios: [
      "You need per-application traffic volumes — which NetFlow key fields make that possible?",
      "Records never reach the collector — which three pieces (record, exporter, monitor, application) must all exist and match?",
    ],
    misconceptions: [
      "NetFlow is a packet capture — it exports flow summaries (counters), not the packets themselves.",
      "Configuring a monitor is enough — it must be applied to an interface (ip flow monitor ... input) to start collecting.",
    ],
    handsOn: "Configure a Flexible NetFlow record + exporter + monitor, apply it to an interface, and verify with show flow monitor.",
  },
  "4.3": {
    objectiveId: "4.3",
    subskills: ["SPAN (local mirroring)", "RSPAN (remote VLAN)", "ERSPAN (over IP)"],
    lesson:
      "SPAN copies traffic from source ports/VLANs to a destination port for analysis. RSPAN carries mirrored traffic across switches over a dedicated VLAN; ERSPAN encapsulates it in GRE over IP, so it can cross routed networks. Only the destination gets the copy — the source is untouched.",
    scenarios: [
      "A capture device connects to a switch three hops away across a routed core — which of SPAN/RSPAN/ERSPAN fits?",
      "Monitoring TX and RX on an uplink to one port — configure the monitor session and state what the source sees.",
    ],
    misconceptions: [
      "SPAN copies traffic out of every port — only the configured destination receives the copy.",
      "RSPAN works over routed links — RSPAN needs L2 connectivity for its session VLAN; ERSPAN is the routed option.",
    ],
    handsOn: "Configure a local SPAN session (source Gi0/1 both, destination Gi0/24), verify with show monitor session, and explain when to escalate to ERSPAN.",
  },
  "4.4": {
    objectiveId: "4.4",
    subskills: ["IP SLA probes", "Thresholds and tracking", "Verification"],
    lesson:
      "IP SLA sends synthetic probes (ICMP echo, UDP jitter, HTTP) to measure latency, loss, jitter, and availability between a source and a target. Results can drive tracking objects used for static-route failover or HSRP priorities — the network reacts to measured conditions.",
    scenarios: [
      "A backup link must take over when the primary path degrades (not dies) — how do IP SLA + a tracked static route achieve this?",
      "Voice quality complaints on a link that 'passes ping' — which IP SLA operation measures jitter and MOS?",
    ],
    misconceptions: [
      "IP SLA measures real user traffic — it generates synthetic probes; it models, not observes, user experience.",
      "An IP SLA probe alone does anything — it only reacts when a tracking object consumes its reachability state.",
    ],
    handsOn: "Configure an ICMP-echo IP SLA with a threshold, track it, and tie it to a floating static route; verify with show ip sla statistics.",
  },
  "4.5": {
    objectiveId: "4.5",
    subskills: ["Catalyst Center roles", "AI-powered workflows", "Assurance and automation"],
    lesson:
      "Cisco Catalyst Center (formerly DNA Center) centralizes configuration, monitoring, and management. It automates provisioning (templates, intent), provides assurance (network health, AI/ML-driven insights like AI-Enhanced RRM and AI Network Analytics), and exposes REST APIs for programmatic control.",
    scenarios: [
      "A campus of 200 switches needs consistent provisioning — which Catalyst Center workflow (design → provision) applies?",
      "Wireless client counts drop at the same time daily — which assurance feature surfaces the pattern without manual log digging?",
    ],
    misconceptions: [
      "Catalyst Center replaces the CLI entirely — it manages intent and templates; CLI access remains for troubleshooting and edge cases.",
      "Assurance is just dashboards — the AI-powered workflows (AI-Enhanced RRM, AI Network Analytics) proactively tune and diagnose.",
    ],
  },
  "4.6": {
    objectiveId: "4.6",
    subskills: ["NETCONF (SSH, XML, RPC)", "RESTCONF (HTTPS, JSON/XML)", "Configuration and state data"],
    lesson:
      "NETCONF is an RPC protocol over SSH (port 830) exchanging XML; it has <get>, <get-config>, <edit-config>, and <lock>. RESTCONF is the RESTful sibling over HTTPS with JSON or XML and standard HTTP verbs (GET/PUT/POST/PATCH/DELETE). Both address YANG data models — the key difference is transport and payload style.",
    scenarios: [
      "A Python script must read interface state with a simple web call — RESTCONF GET with which URL structure and format?",
      "Transactional config changes with rollback needs — which NETCONF operations and why?",
    ],
    misconceptions: [
      "NETCONF and RESTCONF are interchangeable — NETCONF is SSH+XML RPC with rich operations; RESTCONF is HTTPS+JSON/XML REST.",
      "RESTCONF uses GET to change config — writes use PUT/POST/PATCH; GET is read-only.",
    ],
    handsOn: "Query interface state via RESTCONF (GET /restconf/data/Cisco-IOS-XE-interfaces-oper:interfaces) and edit config via NETCONF edit-config.",
  },

  // ─── Security (20%) ───────────────────────────────────────────────────────
  "5.1.a": {
    objectiveId: "5.1.a",
    subskills: ["Line passwords", "Local username database", "Authentication order (login local)"],
    lesson:
      "Line and local authentication secure device access. Lines (console/vty) can require passwords; login local checks a local username database; aaa authentication login default local centralizes it. Best practice: unique local usernames with secret (hashed) passwords and transport input ssh on the vty lines.",
    scenarios: [
      "Telnet works but SSH is refused — which vty command (transport input ssh) is missing?",
      "A shared line password on the console is the only protection — how do local usernames improve auditability?",
    ],
    misconceptions: [
      "login local and local authentication are different systems — login local literally uses the local username database.",
      "enable secret protects user logins — it protects the enable (privileged) level, not the user login itself.",
    ],
    handsOn: "Configure a local user with a hashed secret, login local on console and vty, and verify SSH access authenticates against the database.",
  },
  "5.1.b": {
    objectiveId: "5.1.b",
    subskills: ["AAA framework", "RADIUS vs TACACS+", "Authorization and accounting"],
    lesson:
      "AAA separates Authentication (who), Authorization (what they may do), and Accounting (what they did). RADIUS (UDP, encrypts only the password) is the common network-access choice; TACACS+ (TCP 49, encrypts the whole body) separates auth/authorization and is the device-admin choice. aaa new-model enables the framework.",
    scenarios: [
      "Different admins must get different privilege levels — which AAA protocol separates authorization per-user best (TACACS+)?",
      "WPA-Enterprise needs per-session accounting — which protocol (RADIUS) and which ports?",
    ],
    misconceptions: [
      "RADIUS and TACACS+ are interchangeable — RADIUS: UDP, password-only encryption; TACACS+: TCP, full-body encryption, separate auth/authz.",
      "aaa new-model only affects remote logins — it applies to console/vty alike once configured.",
    ],
    handsOn: "Configure aaa new-model with a TACACS+ server group, enable authentication and authorization, and verify login + accounting records.",
  },
  "5.2.a": {
    objectiveId: "5.2.a",
    subskills: ["iACL purpose and placement", "Management-plane filtering", "ACL verification"],
    lesson:
      "Infrastructure ACLs (iACLs) protect the network infrastructure itself — blocking external traffic to device addresses while allowing what management needs. Placed inbound at the network edge, an iACL filters traffic destined to routers/switches before it can tax the control plane or reach management services.",
    scenarios: [
      "Attackers probe your router IPs from the internet — which ACL, where applied, and what must stay permitted (BGP, SSH from NOC)?",
      "An iACL accidentally blocks OSPF — how do you verify and what's the syntax to permit protocol traffic explicitly?",
    ],
    misconceptions: [
      "An iACL on the WAN edge protects servers — iACLs protect infrastructure addresses; server protection is a different ACL tier.",
      "Any ACL placed outbound works the same — placement and direction change exactly which traffic is filtered and when.",
    ],
    handsOn: "Write an iACL permitting management (SSH, SNMP from a NOC subnet) and routing protocols, deny the rest to device IPs, apply it inbound at the edge, and verify with show access-lists.",
  },
  "5.2.b": {
    objectiveId: "5.2.b",
    subskills: ["Control-plane policing", "CoPP policy maps", "Classification and rate limits"],
    lesson:
      "Control Plane Policing (CoPP) protects the router's CPU by rate-limiting control-plane traffic. A class map matches traffic (routing protocols, management, everything-else), a policy map sets police rates (normal/exception), and service-policy control-plane applies it. Essential protocols stay under their threshold; floods get dropped.",
    scenarios: [
      "A CPU spike from control-plane floods — which CoPP class and police action protects routing protocols while still allowing them?",
      "SSH becomes unreachable during an attack — how does the management class in your CoPP policy explain it?",
    ],
    misconceptions: [
      "CoPP blocks control-plane traffic — it rate-limits; properly classified, legitimate protocol traffic is preserved.",
      "CoPP is only for edge routers — any device with reachable control-plane services benefits, and it should be verified in the lab first.",
    ],
    handsOn: "Build a CoPP policy (routing, management, default classes with police rates), apply service-policy control-plane, and verify with show policy-map control-plane.",
  },
  "5.3": {
    objectiveId: "5.3",
    subskills: ["API authentication (keys/tokens)", "Rate limiting and input validation", "Transport security"],
    lesson:
      "REST API security covers transport (TLS), authentication (API keys, OAuth tokens), authorization (scoped permissions), and hardening (rate limiting, input validation, least-privilege). Leaked keys, missing scopes, and unvalidated inputs are the classic API vulnerabilities.",
    scenarios: [
      "A script authenticates with a bearer token — what does the Authorization header look like, and how is the token scoped?",
      "An API endpoint accepts unbounded input — which hardening (rate limiting, validation) prevents abuse?",
    ],
    misconceptions: [
      "HTTPS alone makes an API secure — TLS protects transport; auth, scoping, and validation protect the API itself.",
      "API keys are enough for fine-grained control — keys grant broad access; scoped OAuth tokens or per-resource ACLs are finer.",
    ],
  },
  "5.4.a": {
    objectiveId: "5.4.a",
    subskills: ["Defense in depth", "Segmentation and zones", "Threat control placement"],
    lesson:
      "Network security design layers controls: perimeter firewalls, segmentation (VLANs, zones, SGTs), access control, and endpoint protection. Defense in depth means no single control is the whole answer — an attacker who crosses one layer meets the next.",
    scenarios: [
      "A data-center server tier must be reachable only from the app tier — which segmentation (zones/ACLs/SGTs) design fits?",
      "A single firewall is the only control — what layers would defense-in-depth add inside the network?",
    ],
    misconceptions: [
      "The firewall is the security — east-west traffic inside the network needs segmentation too.",
      "Segmentation is only about IP ACLs — SGTs and VRFs segment with identity, not just address lists.",
    ],
  },
  "5.4.b": {
    objectiveId: "5.4.b",
    subskills: ["EDR and endpoint posture", "802.1X and NAC", "AMP/malware defense"],
    lesson:
      "Endpoint security covers malware defense (Cisco Secure Endpoint/AMP), posture checks (NAC, 802.1X), and detection/response (EDR). 802.1X authenticates the device/user at the port before granting network access; posturing can quarantine non-compliant endpoints.",
    scenarios: [
      "A laptop with an outdated AV must not reach the network — which NAC/posture mechanism blocks or quarantines it?",
      "Malware is detected on one endpoint — how do AMP and EDR contain and trace the infection?",
    ],
    misconceptions: [
      "Endpoint security is just antivirus — modern defense adds EDR behavior detection and network enforcement.",
      "802.1X replaces firewalls — it controls admission at the port; it doesn't filter traffic between zones.",
    ],
  },
  "5.4.c": {
    objectiveId: "5.4.c",
    subskills: ["NGFW inspection", "Application and user awareness", "IPS and SSL inspection"],
    lesson:
      "Next-generation firewalls go beyond port/protocol filtering: they inspect application traffic (even over allowed ports), tie policy to users/groups, and integrate IPS and SSL/TLS inspection. This closes the gap where legacy firewalls 'allow 443 and hope'.",
    scenarios: [
      "A legacy firewall allows 443 and malware rides HTTPS — which NGFW features (app ID + SSL inspection + IPS) close it?",
      "Policy must vary by user group, not just subnet — how does an NGFW express that?",
    ],
    misconceptions: [
      "NGFWs are just faster firewalls — the difference is application/user awareness and inspection depth.",
      "SSL inspection is free — it requires the trust store/cert handling and carries performance cost.",
    ],
  },
  "5.4.d": {
    objectiveId: "5.4.d",
    subskills: ["TrustSec and SGTs", "SXP propagation", "MACsec (802.1AE) key agreement"],
    lesson:
      "TrustSec uses Security Group Tags (SGTs) to enforce policy by group membership end-to-end, propagated via SXP (SGT Exchange Protocol) where hardware doesn't carry tags in the frame. MACsec (802.1AE) encrypts and authenticates traffic hop-by-hop at Layer 2 between directly connected devices — link encryption, not end-to-end. MACsec peers use a pre-shared key or 802.1X-derived keys; both ends must agree on the key chain and cipher suite or the link never encrypts.",
    scenarios: [
      "Policy must follow a user's group across a network — how do SGTs and SXP deliver that vs static IP ACLs?",
      "Two switches must protect the link between them from eavesdropping — which technology (MACsec) and what does it NOT cover?",
      "Two switches with MACsec configured still pass plaintext — which agreement (key chain/psk, cipher suite) must match on both ends for the session to come up?",
    ],
    misconceptions: [
      "TrustSec and MACsec are the same — TrustSec is group-based policy (SGTs); MACsec is L2 link encryption.",
      "MACsec protects traffic end to end — it protects each hop; traffic is decrypted/re-encrypted at every device.",
      "MACsec needs no key agreement — both peers must share a key (psk or 802.1X-derived) and a compatible cipher suite or the session never activates.",
    ],
    handsOn: "Configure an SGT-to-group mapping and an SXP connection, then bring up a MACsec session between two switches with a shared key chain and verify with show mka sessions.",
  },

  // ─── Automation and AI (15%) ──────────────────────────────────────────────
  "6.1": {
    objectiveId: "6.1",
    subskills: ["Python scripts and components", "Data types and control flow", "Troubleshooting Python"],
    lesson:
      "Basic Python for networking: scripts with imports, variables, lists/dicts, loops, conditionals, and functions. NetDevOps scripts typically build a device list, loop over it, open an API/SSH session, and handle responses. Troubleshooting is reading tracebacks: the error names the line and the type of mistake.",
    scenarios: [
      "A script iterates devices and prints the response — identify the list/dict access and the loop shape.",
      "A script throws KeyError — what does the traceback tell you about the data structure, and how do you inspect it?",
    ],
    misconceptions: [
      "An empty response means the network is down — check the HTTP status and response body before blaming connectivity.",
      "print() output is the same as structured data — parse JSON; don't scrape human output.",
    ],
    handsOn: "Read a 15-line Python script that GETs device state, spot the bug, and state the fix (e.g. wrong dict key or missing timeout).",
  },
  "6.2": {
    objectiveId: "6.2",
    subskills: ["JSON syntax", "Valid vs invalid structures", "Parsing and constructing JSON"],
    lesson:
      "JSON is key/value data with six value types (object, array, string, number, boolean, null). Rules: keys in double quotes, strings in double quotes, no trailing commas, no comments. A single misplaced comma or single-quoted key makes the whole document invalid.",
    scenarios: [
      "A payload is rejected by an API — spot the JSON syntax error (trailing comma, single quotes, missing brace).",
      "Build a JSON object describing an interface — which values are strings vs numbers vs booleans?",
    ],
    misconceptions: [
      "Single quotes are fine in JSON — JSON requires double quotes for keys and strings.",
      "Trailing commas are harmless — they're invalid in JSON and break parsers.",
    ],
    handsOn: "Correct an invalid JSON payload (trailing comma, single-quoted key) and verify it parses; construct valid JSON for an interface config.",
  },
  "6.3": {
    objectiveId: "6.3",
    subskills: ["YANG modeling", "Data trees and leaves/lists", "YANG module usage"],
    lesson:
      "YANG is the data-modeling language that defines what a device exposes to NETCONF/RESTCONF. Modules declare containers, lists, and leaves in a tree; instances live under paths like /interfaces/interface[name=GigabitEthernet1]/enabled. Interpreting a YANG tree means reading the hierarchy and types.",
    scenarios: [
      "Given a YANG snippet, state the path to a leaf (e.g. interface enabled) and its type.",
      "Why does a RESTCONF URL contain the module name and list key in brackets?",
    ],
    misconceptions: [
      "YANG is a data format — it's a modeling language; the data is carried in JSON/XML per the model.",
      "Configuration and state are the same tree — YANG separates config data from operational state.",
    ],
    handsOn: "Interpret a YANG module snippet: identify containers, lists, keys, and leaves, and give the instance identifier path for one leaf.",
  },
  "6.4": {
    objectiveId: "6.4",
    subskills: ["Catalyst Center API", "SD-WAN Manager API", "Intent vs inventory APIs"],
    lesson:
      "Catalyst Center and SD-WAN Manager (vManage) expose REST APIs for automation. Catalyst Center offers intent APIs (provisioning, assurance) and inventory APIs; SD-WAN Manager exposes a Python SDK plus REST endpoints for devices, templates, and policies. Both authenticate with tokens and return JSON.",
    scenarios: [
      "A script must provision a site — which Catalyst Center intent API family (design, provisioning) is involved?",
      "Retrieve the device inventory from SD-WAN Manager — which endpoint/API client, and what does the response contain?",
    ],
    misconceptions: [
      "The APIs configure devices directly — they operate on the controller's intent/inventory; the controller pushes to devices.",
      "All endpoints use the same authentication — token acquisition differs (Basic → token for Catalyst Center; X-Auth-Token for vManage).",
    ],
  },
  "6.5": {
    objectiveId: "6.5",
    subskills: ["REST status codes", "Response payloads", "RESTCONF/Catalyst Center responses"],
    lesson:
      "Interpreting REST responses starts with the status code: 2xx success, 4xx client errors (400 bad request, 401 unauthorized, 404 not found), 5xx server errors. The payload (often JSON) carries the detail. RESTCONF adds ETags and its own error structures; Catalyst Center returns job IDs for long-running intent operations.",
    scenarios: [
      "A POST returns 401 — what does that imply about the token, and how do you fix it?",
      "A GET returns 404 — is the resource missing, the URL malformed, or the module path wrong?",
    ],
    misconceptions: [
      "200 means the change applied — for intent APIs, 202 + a job ID means 'accepted, track the job'.",
      "4xx means the server is broken — 4xx is the client's request; 5xx is the server.",
    ],
    handsOn: "Given a RESTCONF/API response (status + payload), interpret the outcome and state the next action (retry, fix auth, poll job).",
  },
  "6.6": {
    objectiveId: "6.6",
    subskills: ["EEM applet syntax", "Event definitions", "Actions and verification"],
    lesson:
      "Embedded Event Manager (EEM) runs applets when events fire. An applet declares an event (syslog pattern, interface state, timer, CLI) and actions (syslog, reload, cli command, switchport). Syntax: event manager applet NAME, event syslog pattern ..., action 1.0 cli command \"...\".",
    scenarios: [
      "A specific syslog message must trigger a show command capture — build the EEM applet (event + action).",
      "An applet never fires — what do you check (event pattern, severity, enable event manager)?",
    ],
    misconceptions: [
      "EEM replaces the CLI — EEM automates responses; the CLI is still the config interface.",
      "Applet actions run instantly with no parsing — actions are sequential and may need regex parsing of command output.",
    ],
    handsOn: "Write an EEM applet that reacts to a syslog pattern and captures a show command to syslog; verify with show event manager policy available.",
  },
  "6.7": {
    objectiveId: "6.7",
    subskills: ["Agent-based orchestration", "Agentless orchestration", "Trade-offs"],
    lesson:
      "Agent-based orchestration (e.g. Puppet/Chef agents) installs software on each device that pulls config and reports state; agentless (e.g. Ansible over SSH/NETCONF) pushes from a control node with no persistent agent. Agents offer richer state reporting; agentless is lighter and simpler to adopt.",
    scenarios: [
      "Devices can't host agents but SSH is available — which orchestration model fits (agentless) and why?",
      "Thousands of devices need continuous state enforcement — what does the agent model give you that push-only doesn't?",
    ],
    misconceptions: [
      "Ansible requires agents — Ansible is the classic agentless tool; it pushes over SSH/WinRM.",
      "Agentless can't report state — it can pull state on demand; it just has no resident daemon doing it continuously.",
    ],
  },
};

// ─── Derived content (evidence, not hand-claims) ────────────────────────────

/** Arc ids that teach a given objective (an objective lives in exactly one arc). */
export function arcForObjective(objectiveId: string): string | null {
  return ENCOR_MISSION_ARCS.find((arc) => arc.objectiveIds.includes(objectiveId))?.id ?? null;
}

/** Every assessment (quiz question) available for an objective, from its arc's bank. */
export function getObjectiveAssessments(objectiveId: string): QuizQuestion[] {
  const arcId = arcForObjective(objectiveId);
  return arcId ? getArcQuiz(arcId) : [];
}

/** Every review card available for an objective, from its arc's flashcard deck. */
export function getObjectiveReviewCards(objectiveId: string): Flashcard[] {
  const arcId = arcForObjective(objectiveId);
  if (!arcId) return [];
  return getFlashcardDeck().filter((card) => card.arcId === arcId);
}

export const MIN_SCENARIOS = 2;
export const MIN_ASSESSMENTS = 3;
export const MIN_REVIEW_CARDS = 1;
export const VERIFIED_QUIZ_BANK_MIN = 8;

/**
 * Evidence-based coverage state for one objective. Nothing is asserted by hand:
 * every state is derived from what actually exists (plan content, derived
 * assessments/review cards, a deterministic engine test, and bank size).
 */
export function getObjectiveStatus(objectiveId: string): CurriculumStatus {
  const plan = CURRICULUM_PLANS[objectiveId];
  const arcId = arcForObjective(objectiveId);
  const playable = arcId !== null && ARC_TO_MISSION[arcId] !== undefined;

  if (!plan || !plan.lesson || !playable) return "planned";

  const assessments = getObjectiveAssessments(objectiveId).length;
  const reviewCards = getObjectiveReviewCards(objectiveId).length;
  const hasScenarioEvidence = plan.scenarios.length >= MIN_SCENARIOS;
  const hasMisconceptionEvidence = plan.misconceptions.length >= 1;

  const complete =
    hasScenarioEvidence &&
    hasMisconceptionEvidence &&
    assessments >= MIN_ASSESSMENTS &&
    reviewCards >= MIN_REVIEW_CARDS;

  if (!complete) return "partial";

  const hasTest = arcId !== null && ARC_TEST_FILES[arcId] !== undefined;
  return hasTest && assessments >= VERIFIED_QUIZ_BANK_MIN ? "verified" : "complete";
}

/** Status of every objective, keyed by objective id. */
export function getCurriculumStatusMap(): Record<string, CurriculumStatus> {
  const map: Record<string, CurriculumStatus> = {};
  for (const domain of ENCOR_DOMAINS) {
    for (const objective of domain.objectives) {
      map[objective.id] = getObjectiveStatus(objective.id);
    }
  }
  return map;
}

export type CoverageMatrixRow = {
  objective: EncorObjective;
  domain: string;
  status: CurriculumStatus;
  subskills: string[];
  scenarioCount: number;
  assessmentCount: number;
  reviewCardCount: number;
  hasLesson: boolean;
  misconceptionCount: number;
  handsOn: string | null;
  arcId: string | null;
  testFiles: string[];
};

/**
 * Auditable coverage matrix: one row per objective linking the objective to
 * its actual content (lesson, scenarios, assessments, review cards, hands-on)
 * and the deterministic test files that exercise it.
 */
export function getCoverageMatrix(): CoverageMatrixRow[] {
  const rows: CoverageMatrixRow[] = [];
  for (const domain of ENCOR_DOMAINS) {
    for (const objective of domain.objectives) {
      const plan = CURRICULUM_PLANS[objective.id];
      const arcId = arcForObjective(objective.id);
      rows.push({
        objective,
        domain: domain.title,
        status: getObjectiveStatus(objective.id),
        subskills: plan?.subskills ?? [],
        scenarioCount: plan?.scenarios.length ?? 0,
        assessmentCount: getObjectiveAssessments(objective.id).length,
        reviewCardCount: getObjectiveReviewCards(objective.id).length,
        hasLesson: Boolean(plan?.lesson),
        misconceptionCount: plan?.misconceptions.length ?? 0,
        handsOn: plan?.handsOn ?? null,
        arcId,
        testFiles: arcId && ARC_TEST_FILES[arcId] ? [ARC_TEST_FILES[arcId]] : [],
      });
    }
  }
  return rows;
}

/** Blueprint-wide coverage: share of objectives at complete or verified. */
export function getBlueprintCoverage(): { complete: number; verified: number; partial: number; planned: number; total: number } {
  const rows = getCoverageMatrix();
  return {
    complete: rows.filter((row) => row.status === "complete").length,
    verified: rows.filter((row) => row.status === "verified").length,
    partial: rows.filter((row) => row.status === "partial").length,
    planned: rows.filter((row) => row.status === "planned").length,
    total: rows.length,
  };
}
