/**
 * Plain-language "concept primers" for every mission. Where the incident brief
 * tells the story and the field note assumes expertise, the primer answers the
 * beginner's first question: what IS this technology, and why does it exist?
 * `terms` are glossary entries surfaced as clickable chips (lib/glossary.test
 * enforces that every primer term resolves to a glossary entry).
 */
export type MissionPrimerEntry = {
  /** What the mission's technology is and the problem it solves, in plain words. */
  what: string;
  /** Glossary terms surfaced as clickable chips under the primer. */
  terms: string[];
};

export const MISSION_PRIMERS: Record<string, MissionPrimerEntry> = {
  "console-basics": {
    what: "Networking gear is run from a command-line interface (CLI): you type words instead of clicking. This mission teaches the five commands that open every door — how to ask for help, reach privileged mode, enter configuration, and inspect a device.",
    terms: ["CLI", "EXEC modes", "Configuration mode", "Show commands"],
  },
  "show-and-ping": {
    what: "Show commands ask a device to print its current state — interfaces, VLANs, routing. Ping is a tiny \"are you there?\" test packet. Together they let you read a network and prove a path actually works.",
    terms: ["Show commands", "Ping", "ICMP"],
  },
  "packet-trail": {
    what: "A packet is a parcel of data travelling between devices. Switches move it hop by hop, VLANs separate traffic into virtual rooms, and trunks are the hallways between switches. This is the story of one packet's journey.",
    terms: ["Switch", "VLAN", "Trunk", "MAC address"],
  },
  "vlan-that-vanished": {
    what: "A VLAN is a virtual network carved out of a switch — devices in it act like they're on their own private wire. Trunks carry many VLANs between switches; if a trunk forgets to allow a VLAN, that VLAN's traffic stops at the border.",
    terms: ["VLAN", "Trunk", "Access port", "Default gateway"],
  },
  "stp-storm": {
    what: "In a loop, frames bounce between switches forever, doubling every hop until the network drowns (a broadcast storm). Spanning Tree Protocol (STP) stops this by electing one root bridge and blocking redundant links — keeping exactly one active path.",
    terms: ["STP", "BPDU", "Bridge ID", "BPDU Guard", "Root Guard", "MST"],
  },
  "bundled-bottleneck": {
    what: "Two cables between switches can carry twice the traffic — but only if the switches treat them as one logical link. EtherChannel bundles ports; LACP is the protocol that negotiates the bundle automatically. Both ends must agree to start the handshake.",
    terms: ["EtherChannel", "LACP", "PAgP"],
  },
  "area-zero-hero": {
    what: "Routers don't know every path by heart — they run a routing protocol (OSPF) to share routes with neighbors. Neighbors must agree on the same area; area 0 is the backbone that connects everything else.",
    terms: ["OSPF", "OSPF adjacency", "Routing protocol", "Routing table"],
  },
  "edge-has-opinions": {
    what: "The edge is your network's front door to the internet. eBGP is how separate organizations (autonomous systems) exchange routes. PBR lets the edge send special traffic down a different path than the routing table would choose.",
    terms: ["eBGP", "BGP", "PBR", "Route map", "Autonomous system"],
  },
  "gateway-at-dawn": {
    what: "Hosts need a default gateway to leave their subnet — normally one router. If it dies, everyone is stranded. HSRP and VRRP make two routers share one virtual gateway address, so the standby takes over instantly when the active fails.",
    terms: ["HSRP", "VRRP", "FHRP", "Default gateway"],
  },
  "edge-services": {
    what: "A whole LAN usually has one public IP for thousands of devices. NAT and PAT quietly rewrite addresses so private devices can share it. NTP keeps every device's clock honest, and QoS decides which traffic goes first when the WAN is full.",
    terms: ["NAT", "PAT", "NTP", "QoS", "DSCP"],
  },
  "tunnel-vision": {
    what: "A VRF is a separate routing table inside one router — guests and staff can share the box without seeing each other. GRE wraps packets in a tunnel across the internet; IPsec locks the tunnel so nobody can read what's inside.",
    terms: ["VRF", "GRE", "IPsec", "Crypto map"],
  },
  "fabric-express": {
    what: "Servers now run many virtual machines on one physical box. A hypervisor is the software that hosts them; each VM's traffic flows through a virtual switch inside it. VXLAN lets those virtual networks stretch across many physical switches — VTEPs wrap and unwrap the traffic.",
    terms: ["Hypervisor", "Virtual machine", "Virtual switch", "VXLAN", "VTEP"],
  },
  "sdwan-overlay": {
    what: "SD-WAN is a management layer on top of any WAN transport. The pieces split by job: vManage manages, vSmart decides routes (OMP), vBond validates, vEdge forwards. TLOCs are the transport endpoints; BFD watches link health.",
    terms: ["SD-WAN", "vManage", "vSmart", "vBond", "vEdge/cEdge", "OMP", "TLOC", "BFD"],
  },
  "signal-detective": {
    what: "When the network misbehaves you need evidence. Ping proves reachability, traceroute shows the path, show interface reveals link errors. NetFlow records flows, SPAN mirrors packets for analysis, IP SLA probes latency on a schedule — and NETCONF/RESTCONF let you configure programmatically.",
    terms: ["Ping", "Traceroute", "NetFlow", "SPAN", "IP SLA", "Conditional debug"],
  },
  "campus-fabric": {
    what: "SD-Access turns the campus into a fabric with three jobs: edge nodes serve the hosts, border nodes face the outside, and control plane nodes keep the mapping database. LISP is that database — it maps endpoints (EIDs) to tunnel endpoints (RLOCs).",
    terms: ["SD-Access", "LISP", "Control plane", "Data plane"],
  },
  "lock-the-control-plane": {
    what: "Every way into a router is a door: VTY lines, the CPU, even the REST API. This mission locks them one by one — local usernames, AAA against a central server, ACLs, CoPP for the CPU — and layers them so one failure isn't fatal.",
    terms: ["AAA", "RADIUS", "ACL", "Infrastructure ACL", "CoPP", "REST API", "Defense in depth", "NAC"],
  },
  "automator-prime": {
    what: "Typing on 500 devices is a job for code. Python scripts talk to devices over NETCONF and RESTCONF, payloads travel as JSON against YANG models, controllers expose REST APIs, and EEM applets run on the box itself when events fire.",
    terms: ["Python", "NETCONF", "RESTCONF", "JSON", "YANG", "REST API", "EEM"],
  },
};
