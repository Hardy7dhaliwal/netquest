export type EncorDomainId = "architecture" | "virtualization" | "infrastructure" | "assurance" | "security" | "automation";

export type EncorObjective = {
  id: string;
  label: string;
  interaction: "inspect" | "predict" | "configure" | "troubleshoot" | "interpret" | "code";
};

export type EncorMissionArc = {
  id: string;
  title: string;
  domains: EncorDomainId[];
  objectiveIds: string[];
  coverage: "partial" | "planned";
  status: "complete" | "available" | "planned";
};

export const STP_OBJECTIVE_IDS = ["3.1.c"] as const;

export type EncorDomain = {
  id: EncorDomainId;
  title: string;
  weight: number;
  objectives: EncorObjective[];
};

export const ENCOR_DOMAINS: EncorDomain[] = [
  {
    id: "architecture",
    title: "Architecture",
    weight: 15,
    objectives: [
      { id: "1.1.a", label: "Enterprise design: two-tier, three-tier, fabric, and cloud", interaction: "predict" },
      { id: "1.1.b", label: "High availability: redundancy, FHRP, and SSO", interaction: "predict" },
      { id: "1.2.a", label: "Catalyst SD-WAN control and data planes", interaction: "inspect" },
      { id: "1.2.b", label: "Catalyst SD-WAN benefits and limitations", interaction: "interpret" },
      { id: "1.3.a", label: "SD-Access control and data planes", interaction: "inspect" },
      { id: "1.3.b", label: "Traditional campus interoperability with SD-Access", interaction: "predict" },
      { id: "1.4", label: "Interpret QoS configurations", interaction: "interpret" },
    ],
  },
  {
    id: "virtualization",
    title: "Virtualization",
    weight: 10,
    objectives: [
      { id: "2.1.a", label: "Type 1 and Type 2 hypervisors", interaction: "interpret" },
      { id: "2.1.b", label: "Virtual machines", interaction: "inspect" },
      { id: "2.1.c", label: "Virtual switching", interaction: "inspect" },
      { id: "2.2.a", label: "VRF", interaction: "configure" },
      { id: "2.2.b", label: "GRE and IPsec tunneling", interaction: "configure" },
      { id: "2.3.a", label: "LISP", interaction: "inspect" },
      { id: "2.3.b", label: "VXLAN", interaction: "inspect" },
    ],
  },
  {
    id: "infrastructure",
    title: "Infrastructure",
    weight: 30,
    objectives: [
      { id: "3.1.a", label: "Troubleshoot static and dynamic 802.1Q trunking", interaction: "troubleshoot" },
      { id: "3.1.b", label: "Troubleshoot static and dynamic EtherChannels", interaction: "troubleshoot" },
      { id: "3.1.c", label: "Configure and verify RSTP, MST, root guard, and BPDU guard", interaction: "configure" },
      { id: "3.2.a", label: "Compare EIGRP and OSPF routing concepts", interaction: "interpret" },
      { id: "3.2.b", label: "Configure and verify OSPF areas, adjacency, filtering, and summarization", interaction: "configure" },
      { id: "3.2.c", label: "Configure and verify directly connected eBGP", interaction: "configure" },
      { id: "3.2.d", label: "Describe Policy-Based Routing", interaction: "interpret" },
      { id: "3.3.a", label: "Interpret NTP and PTP configurations", interaction: "interpret" },
      { id: "3.3.b", label: "Configure and verify NAT/PAT", interaction: "configure" },
      { id: "3.3.c", label: "Configure first-hop redundancy with HSRP and VRRP", interaction: "configure" },
      { id: "3.3.d", label: "Describe multicast: RPF check, PIM SM, IGMP v2/v3, SSM, bidir PIM, and MSDP", interaction: "inspect" },
    ],
  },
  {
    id: "assurance",
    title: "Network Assurance",
    weight: 10,
    objectives: [
      { id: "4.1", label: "Diagnose with debug, traceroute, ping, SNMP, and syslog", interaction: "troubleshoot" },
      { id: "4.2", label: "Configure and verify Flexible NetFlow", interaction: "configure" },
      { id: "4.3", label: "Configure and verify SPAN, RSPAN, and ERSPAN", interaction: "configure" },
      { id: "4.4", label: "Configure and verify IP SLA", interaction: "configure" },
      { id: "4.5", label: "Describe Cisco Catalyst Center (formerly DNA Center): config, monitoring, and management via traditional and AI-powered workflows", interaction: "inspect" },
      { id: "4.6", label: "Configure and verify NETCONF and RESTCONF", interaction: "configure" },
    ],
  },
  {
    id: "security",
    title: "Security",
    weight: 20,
    objectives: [
      { id: "5.1.a", label: "Lines and local user authentication", interaction: "configure" },
      { id: "5.1.b", label: "AAA authentication and authorization", interaction: "configure" },
      { id: "5.2.a", label: "Infrastructure ACLs", interaction: "configure" },
      { id: "5.2.b", label: "Control Plane Policing", interaction: "configure" },
      { id: "5.3", label: "REST API security", interaction: "interpret" },
      { id: "5.4.a", label: "Network security design components", interaction: "predict" },
      { id: "5.4.b", label: "Endpoint security", interaction: "inspect" },
      { id: "5.4.c", label: "Next-generation firewalls", interaction: "inspect" },
      { id: "5.4.d", label: "TrustSec and MACsec", interaction: "inspect" },
    ],
  },
  {
    id: "automation",
    title: "Automation and Artificial Intelligence",
    weight: 15,
    objectives: [
      { id: "6.1", label: "Interpret basic Python components and scripts", interaction: "code" },
      { id: "6.2", label: "Construct valid JSON", interaction: "code" },
      { id: "6.3", label: "Describe data modeling and YANG", interaction: "interpret" },
      { id: "6.4", label: "Describe Cisco Catalyst Center and SD-WAN Manager APIs", interaction: "inspect" },
      { id: "6.5", label: "Interpret REST API response codes and payloads using Cisco Catalyst Center and RESTCONF", interaction: "interpret" },
      { id: "6.6", label: "Construct EEM applets", interaction: "code" },
      { id: "6.7", label: "Compare agent and agentless orchestration tools", interaction: "interpret" },
    ],
  },
];

export const ENCOR_MISSION_ARCS: EncorMissionArc[] = [
  { id: "vlan-that-vanished", title: "The VLAN That Vanished", domains: ["infrastructure"], objectiveIds: ["3.1.a"], coverage: "partial", status: "complete" },
  { id: "stp-storm", title: "The STP Storm", domains: ["infrastructure"], objectiveIds: [...STP_OBJECTIVE_IDS], coverage: "partial", status: "available" },
  { id: "bundled-bottleneck", title: "The Bundled Bottleneck", domains: ["infrastructure"], objectiveIds: ["3.1.b"], coverage: "partial", status: "available" },
  { id: "area-zero-hero", title: "Area Zero Hero", domains: ["infrastructure"], objectiveIds: ["3.2.b"], coverage: "partial", status: "available" },
  { id: "edge-has-opinions", title: "The Edge Has Opinions", domains: ["infrastructure"], objectiveIds: ["3.2.a", "3.2.c", "3.2.d"], coverage: "partial", status: "available" },
  { id: "gateway-at-dawn", title: "Gateway at Dawn", domains: ["architecture", "infrastructure"], objectiveIds: ["1.1.a", "1.1.b", "3.3.c"], coverage: "partial", status: "available" },
  { id: "edge-services", title: "Edge Services", domains: ["architecture", "infrastructure"], objectiveIds: ["1.4", "3.3.a", "3.3.b", "3.3.d"], coverage: "partial", status: "available" },
  { id: "tunnel-vision", title: "Tunnel Vision", domains: ["virtualization", "architecture"], objectiveIds: ["2.2.a", "2.2.b"], coverage: "partial", status: "available" },
  { id: "fabric-express", title: "The Fabric Express", domains: ["virtualization"], objectiveIds: ["2.1.a", "2.1.b", "2.1.c", "2.3.b"], coverage: "partial", status: "available" },
  { id: "campus-fabric", title: "The Campus Fabric", domains: ["architecture", "virtualization"], objectiveIds: ["1.3.a", "1.3.b", "2.3.a"], coverage: "partial", status: "available" },
  { id: "sdwan-overlay", title: "SD-WAN: The WAN Overlay", domains: ["architecture"], objectiveIds: ["1.2.a", "1.2.b"], coverage: "partial", status: "available" },
  { id: "signal-detective", title: "The Signal Detective", domains: ["assurance"], objectiveIds: ["4.1", "4.2", "4.3", "4.4", "4.5", "4.6"], coverage: "partial", status: "available" },
  { id: "lock-the-control-plane", title: "Lock the Control Plane", domains: ["security"], objectiveIds: ["5.1.a", "5.1.b", "5.2.a", "5.2.b", "5.3", "5.4.a", "5.4.b", "5.4.c", "5.4.d"], coverage: "partial", status: "available" },
  { id: "automator-prime", title: "Automator Prime", domains: ["automation"], objectiveIds: ["6.1", "6.2", "6.3", "6.4", "6.5", "6.6", "6.7"], coverage: "partial", status: "available" },
];

export const ENCOR_OBJECTIVE_COUNT = ENCOR_DOMAINS.reduce((total, domain) => total + domain.objectives.length, 0);

export function getDomain(id: EncorDomainId) {
  return ENCOR_DOMAINS.find((domain) => domain.id === id);
}

export type EncorDomainCoverage = {
  domain: EncorDomain;
  /** Objectives of this domain that have a playable mission arc. */
  coveredObjectives: EncorObjective[];
};

/** Objective ids taught by a playable mission arc (complete or available). */
export function getPlayableObjectiveIds(): Set<string> {
  return new Set(
    ENCOR_MISSION_ARCS.filter((arc) => arc.status === "complete" || arc.status === "available").flatMap((arc) => arc.objectiveIds),
  );
}

/** Per-domain coverage of the 47 blueprint objectives by playable missions. */
export function getCoverageByDomain(): EncorDomainCoverage[] {
  const playable = getPlayableObjectiveIds();
  return ENCOR_DOMAINS.map((domain) => ({
    domain,
    coveredObjectives: domain.objectives.filter((objective) => playable.has(objective.id)),
  }));
}

/**
 * Percentage of the total exam weight covered by playable missions, weighted by
 * each domain's blueprint share (e.g. 30% of Infrastructure × 7/11 objectives).
 */
export function getWeightedCoverage(): number {
  const coverage = getCoverageByDomain();
  return coverage.reduce((sum, entry) => sum + entry.domain.weight * (entry.coveredObjectives.length / entry.domain.objectives.length), 0);
}
