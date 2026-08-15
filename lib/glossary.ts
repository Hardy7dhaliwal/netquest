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

  // ─── Routing ───────────────────────────────────────────────────────────────
  {
    term: "BGP",
    category: "Routing",
    definition: "Border Gateway Protocol — the exterior routing protocol of the internet, exchanging routes between autonomous systems and choosing paths by attributes rather than a simple metric.",
    detail: "eBGP connects different ASes; iBGP connects routers inside one AS. 'The Edge Has Opinions' walks a real eBGP session, and the iBGP route-reflector lab practices cluster-list tie-breaking.",
    seeAlso: ["eBGP", "iBGP", "Autonomous system", "Best-path selection"],
  },
  {
    term: "iBGP",
    category: "Routing",
    definition: "Internal BGP — sessions between routers in the same autonomous system. iBGP never re-advertises a route learned from one iBGP peer to another, so it needs a full mesh or route reflectors.",
    detail: "That no-re-advertise rule (split-horizon) is exactly why a missing `route-reflector-client` leaves a client without the reflected path in the iBGP lab.",
    seeAlso: ["BGP", "Route reflector", "eBGP"],
  },
  {
    term: "Route reflector",
    category: "Routing",
    definition: "An iBGP router that re-advertises (reflects) routes between its clients, replacing the need for a full mesh of iBGP sessions.",
    detail: "A client's routes are reflected to every other client; `neighbor <client> route-reflector-client` marks a client.",
    seeAlso: ["iBGP", "Cluster list", "BGP"],
  },
  {
    term: "Cluster list",
    category: "Routing",
    definition: "A BGP attribute listing the cluster IDs a reflected route has passed through. A router drops a route whose cluster list contains its own ID, and the shortest list wins a best-path tie.",
    detail: "The loop-prevention half is what kills the backup path in the iBGP route-reflector lab when two reflectors share one cluster ID.",
    seeAlso: ["Route reflector", "Best-path selection", "BGP"],
  },
  {
    term: "Best-path selection",
    category: "Routing",
    definition: "The 13-step algorithm BGP uses to pick one route from many: weight, local preference, locally originated, AS path, origin, MED, eBGP-over-iBGP, IGP metric, multipath, oldest path, router ID, cluster list, then neighbor address.",
    detail: "Each step is tried in order; the first one that differs decides, and the rest are never reached.",
    seeAlso: ["BGP", "Weight", "AS path", "MED"],
  },
  {
    term: "Autonomous system",
    category: "Routing",
    definition: "A network under a single administrative control and routing policy, identified by an AS number (e.g., AS 65100).",
    detail: "eBGP is BGP between different ASes; iBGP is BGP within one.",
    seeAlso: ["BGP", "eBGP", "iBGP"],
  },
  {
    term: "AS path",
    category: "Routing",
    definition: "A BGP attribute listing the autonomous systems a route has traversed. Shorter AS paths are preferred, and the list also prevents routing loops.",
    seeAlso: ["BGP", "Best-path selection", "MED"],
  },
  {
    term: "MED",
    category: "Routing",
    definition: "Multi-Exit Discriminator — a BGP attribute suggesting to a neighboring AS which entry point to prefer; lower wins, and it is compared late in best-path selection.",
    detail: "MED cannot override a shorter AS path or a higher weight/local preference — a common misconception the quizzes test.",
    seeAlso: ["BGP", "AS path", "Local preference"],
  },
  {
    term: "Local preference",
    category: "Routing",
    definition: "A BGP attribute (highest wins) that selects the outbound exit point and is shared only between iBGP peers.",
    seeAlso: ["BGP", "MED", "Weight"],
  },
  {
    term: "Weight",
    category: "Routing",
    definition: "A Cisco-local BGP attribute (highest wins) that is the very first tie-breaker in best-path selection and never leaves the router.",
    detail: "Because weight is step 1, a weight set on the wrong neighbor beats even a shorter AS path — the fault in the 'eBGP prefers the wrong path' lab.",
    seeAlso: ["BGP", "Best-path selection", "Local preference"],
  },
  {
    term: "Administrative distance",
    category: "Routing",
    definition: "A 0–255 trust ranking a router uses to choose between routing sources advertising the same prefix; lower is better.",
    detail: "Connected=0, static=1, eBGP=20, EIGRP=90, OSPF=110, iBGP=200.",
    seeAlso: ["Routing table", "Routing protocol", "Static route"],
  },
  {
    term: "Route map",
    category: "Routing",
    definition: "A match/set policy with numbered permit/deny sequences, applied to routing updates, redistribution, or policy-based routing.",
    seeAlso: ["PBR", "BGP", "Routing protocol"],
  },
  {
    term: "Static route",
    category: "Routing",
    definition: "A route you configure by hand rather than learn from a routing protocol; administrative distance 1 by default.",
    seeAlso: ["Routing table", "Administrative distance"],
  },
  {
    term: "HSRP",
    category: "Routing",
    definition: "Hot Standby Router Protocol — a Cisco first-hop redundancy protocol where two routers share a virtual IP and MAC; priority elects the Active router and preempt lets a better router reclaim the role.",
    detail: "'The Gateway At Dawn' is HSRP in action: when GW1 dies, GW2 answers for the shared virtual gateway.",
    seeAlso: ["VRRP", "FHRP", "Default gateway"],
  },
  {
    term: "VRRP",
    category: "Routing",
    definition: "Virtual Router Redundancy Protocol — the standards-based first-hop redundancy protocol; the Master uses its real MAC address and preempts by default.",
    detail: "VRRP does the same job as HSRP but is vendor-neutral.",
    seeAlso: ["HSRP", "FHRP", "Default gateway"],
  },
  {
    term: "FHRP",
    category: "Routing",
    definition: "First-Hop Redundancy Protocol — the HSRP/VRRP/GLBP family that keeps a default gateway available even when one router fails.",
    seeAlso: ["HSRP", "VRRP", "Default gateway"],
  },
  {
    term: "VRF",
    category: "Routing",
    definition: "Virtual Routing and Forwarding — multiple independent routing tables on one device, isolating tenants or services from each other.",
    detail: "`vrf forwarding <name>` on an interface moves it into a VRF, which wipes its IP — so you re-add it, the trap in 'Tunnel Vision'.",
    seeAlso: ["Routing table", "VXLAN", "GRE"],
  },
  {
    term: "GRE",
    category: "Routing",
    definition: "Generic Routing Encapsulation — a tunnel that wraps packets in an outer IP header, carrying multicast and routing protocols that plain tunnels cannot; it adds no encryption by itself.",
    detail: "GRE is the private-overlay half; IPsec is the encrypted half — together they form GRE-over-IPsec.",
    seeAlso: ["IPsec", "Crypto map", "VRF"],
  },
  {
    term: "IPsec",
    category: "Routing",
    definition: "IP Security — a suite that encrypts and authenticates IP traffic so it can cross an untrusted network safely.",
    seeAlso: ["GRE", "Crypto map", "MACsec"],
  },
  {
    term: "Crypto map",
    category: "Routing",
    definition: "The IOS construct that binds IPsec settings to an interface and uses an ACL to select exactly which traffic to protect.",
    detail: "For GRE-over-IPsec the ACL must match the GRE flow (protocol 47) between WAN endpoints, not the inner subnets.",
    seeAlso: ["IPsec", "GRE", "ACL"],
  },
  {
    term: "LISP",
    category: "Routing",
    definition: "Locator/ID Separation Protocol — separates a device's identity (EID) from its location (RLOC), enabling mobility and scalable routing in SD-Access fabrics.",
    seeAlso: ["VXLAN", "SD-Access", "Underlay/overlay"],
  },
  {
    term: "Multicast",
    category: "Routing",
    definition: "One-to-many delivery: a source sends a stream once and the network copies it only to interested receivers.",
    seeAlso: ["PIM", "IGMP", "RPF"],
  },
  {
    term: "PIM",
    category: "Routing",
    definition: "Protocol Independent Multicast — builds the distribution trees that carry multicast between sources and receivers (Sparse-Mode uses a rendezvous point).",
    seeAlso: ["Multicast", "IGMP", "RPF"],
  },
  {
    term: "RPF",
    category: "Routing",
    definition: "Reverse Path Forwarding — the multicast loop guard: accept a packet only if it arrives on the interface that points back toward the source.",
    seeAlso: ["Multicast", "PIM"],
  },
  {
    term: "IGMP",
    category: "Routing",
    definition: "Internet Group Management Protocol — how hosts tell the router which multicast groups (and, in v3, which sources) they want.",
    seeAlso: ["Multicast", "PIM"],
  },
  {
    term: "SSM",
    category: "Routing",
    definition: "Source-Specific Multicast — receivers join a specific (source, group) pair, building a shortest-path tree with no rendezvous point.",
    seeAlso: ["Multicast", "IGMP", "PIM"],
  },
  {
    term: "Bidirectional PIM",
    category: "Routing",
    definition: "A PIM mode where all senders and receivers share one (*,G) tree through the rendezvous point — efficient for many-to-many traffic.",
    aliases: ["bidir PIM"],
    seeAlso: ["PIM", "Multicast", "MSDP"],
  },
  {
    term: "MSDP",
    category: "Routing",
    definition: "Multicast Source Discovery Protocol — lets rendezvous points in separate PIM-SM domains share active sources.",
    seeAlso: ["PIM", "Multicast"],
  },
  {
    term: "VXLAN",
    category: "Routing",
    definition: "Virtual eXtensible LAN — a MAC-in-UDP overlay that tunnels Layer 2 across a Layer 3 fabric using 24-bit VNIs; the data plane of SD-Access.",
    seeAlso: ["VTEP", "LISP", "SD-Access"],
  },
  {
    term: "VTEP",
    category: "Routing",
    definition: "VXLAN Tunnel Endpoint — the device that encapsulates and decapsulates VXLAN traffic at the edge of the overlay.",
    seeAlso: ["VXLAN", "Underlay/overlay"],
  },
  {
    term: "Underlay/overlay",
    category: "Routing",
    definition: "The underlay is the physical IP network that provides transport; the overlay is the logical tunnels (GRE, VXLAN, LISP, SD-WAN) built on top of it.",
    aliases: ["underlay", "overlay"],
    seeAlso: ["VXLAN", "GRE", "SD-WAN"],
  },

  // ─── Switching ─────────────────────────────────────────────────────────────
  {
    term: "PAgP",
    category: "Switching",
    definition: "Port Aggregation Protocol — Cisco's proprietary EtherChannel negotiation (desirable/auto), the sibling of the standards-based LACP.",
    seeAlso: ["EtherChannel", "LACP"],
  },
  {
    term: "SPAN",
    category: "Switching",
    definition: "Switched Port Analyzer — copies traffic from a port or VLAN to a monitor port where an analyzer can inspect it.",
    seeAlso: ["RSPAN/ERSPAN", "NetFlow"],
  },
  {
    term: "RSPAN/ERSPAN",
    category: "Switching",
    definition: "Remote SPAN — RSPAN carries mirrored traffic across a dedicated VLAN; ERSPAN tunnels it over IP to a remote analyzer.",
    seeAlso: ["SPAN", "GRE"],
  },

  // ─── Concepts ──────────────────────────────────────────────────────────────
  {
    term: "SD-WAN",
    category: "Concepts",
    definition: "Software-Defined WAN — an overlay that makes WAN transport-independent, with centralized policy and application-aware path selection across any mix of links.",
    detail: "Cisco's is Catalyst SD-WAN: vManage (now SD-WAN Manager) manages, vSmart controls, vBond (SD-WAN Validator) orchestrates, vEdge/cEdge forwards.",
    seeAlso: ["Underlay/overlay", "vSmart", "OMP"],
  },
  {
    term: "vManage",
    category: "Concepts",
    definition: "The SD-WAN management plane (now branded SD-WAN Manager) — the UI and APIs where policy and configuration live.",
    aliases: ["SD-WAN Manager"],
    seeAlso: ["SD-WAN", "vSmart", "vBond"],
  },
  {
    term: "vSmart",
    category: "Concepts",
    definition: "The SD-WAN control plane — reflects OMP routes and pushes policy to the edge devices.",
    seeAlso: ["SD-WAN", "OMP", "vManage"],
  },
  {
    term: "vBond",
    category: "Concepts",
    definition: "The SD-WAN orchestrator (now branded SD-WAN Validator) — authenticates devices and resolves their addresses so everything can find each other.",
    aliases: ["SD-WAN Validator"],
    seeAlso: ["SD-WAN", "vManage", "vEdge/cEdge"],
  },
  {
    term: "vEdge/cEdge",
    category: "Concepts",
    definition: "The SD-WAN data plane — the device that actually forwards traffic over the overlay (a physical vEdge appliance or a software cEdge on an IOS-XE router).",
    aliases: ["vEdge", "cEdge"],
    seeAlso: ["SD-WAN", "vSmart", "TLOC"],
  },
  {
    term: "OMP",
    category: "Concepts",
    definition: "Overlay Management Protocol — the SD-WAN control protocol that advertises prefixes together with their TLOC and attributes over a secure channel.",
    seeAlso: ["SD-WAN", "TLOC", "vSmart"],
  },
  {
    term: "TLOC",
    category: "Concepts",
    definition: "Transport Location — the SD-WAN tunnel endpoint, identified by system IP + color + encapsulation.",
    seeAlso: ["OMP", "SD-WAN", "BFD"],
  },
  {
    term: "BFD",
    category: "Concepts",
    definition: "Bidirectional Forwarding Detection — a fast liveness probe; SD-WAN uses it to watch TLOCs and fail over in milliseconds.",
    seeAlso: ["TLOC", "SD-WAN"],
  },
  {
    term: "SD-Access",
    category: "Concepts",
    definition: "Cisco's campus fabric — policy-based segmentation using VXLAN and LISP, automated and assured by Catalyst Center.",
    seeAlso: ["VXLAN", "LISP", "Catalyst Center"],
  },
  {
    term: "Control plane",
    category: "Concepts",
    definition: "The part of a device or network that makes decisions — routing protocols, BPDUs, OMP, ARP — as opposed to the data plane that forwards traffic.",
    detail: "CoPP exists to protect the control plane from being flooded.",
    seeAlso: ["CoPP", "Data plane", "SD-WAN"],
  },
  {
    term: "Data plane",
    category: "Concepts",
    definition: "The part of a device that actually moves packets or frames, separate from the control plane that decides how.",
    seeAlso: ["Control plane"],
  },
  {
    term: "Hypervisor",
    category: "Concepts",
    definition: "Software that runs virtual machines on physical hardware — Type 1 runs directly on the metal (ESXi, KVM); Type 2 runs on an OS.",
    seeAlso: ["Virtual machine", "Virtual switch"],
  },
  {
    term: "Virtual machine",
    category: "Concepts",
    definition: "A software-defined computer with its own OS and resources, running on top of a hypervisor.",
    seeAlso: ["Hypervisor", "Virtual switch"],
  },
  {
    term: "Virtual switch",
    category: "Concepts",
    definition: "A software Layer 2 switch inside a hypervisor that connects VMs to each other and the physical network (vSwitch / distributed switch).",
    seeAlso: ["Virtual machine", "Hypervisor", "VXLAN"],
  },
  {
    term: "NAT",
    category: "Concepts",
    definition: "Network Address Translation — rewrites private addresses to public addresses so internal hosts can reach the internet.",
    seeAlso: ["PAT", "IP address"],
  },
  {
    term: "PAT",
    category: "Concepts",
    definition: "Port Address Translation — NAT overload: many hosts share one public address, distinguished by source ports.",
    seeAlso: ["NAT"],
  },
  {
    term: "NTP",
    category: "Concepts",
    definition: "Network Time Protocol — synchronizes device clocks over UDP/123, important for accurate logs and authentication.",
    seeAlso: ["PTP", "Syslog"],
  },
  {
    term: "PTP",
    category: "Concepts",
    definition: "Precision Time Protocol — hardware-timestamped time sync that is far more accurate than NTP, using grandmaster/boundary/transparent clocks.",
    seeAlso: ["NTP"],
  },
  {
    term: "QoS",
    category: "Concepts",
    definition: "Quality of Service — the tools that prioritize, reserve, and police bandwidth so important traffic is treated better than best-effort.",
    seeAlso: ["DSCP", "Class map", "Policy map"],
  },
  {
    term: "DSCP",
    category: "Concepts",
    definition: "Differentiated Services Code Point — the 6-bit field in the IP header that marks a packet's class for QoS.",
    seeAlso: ["QoS", "Class map"],
  },
  {
    term: "Class map",
    category: "Concepts",
    definition: "A QoS construct that matches traffic (e.g., `match dscp ef`) so it can be treated.",
    seeAlso: ["QoS", "Policy map", "DSCP"],
  },
  {
    term: "Policy map",
    category: "Concepts",
    definition: "A QoS construct that applies actions — `priority` (strict low-latency queue) or `bandwidth` (guaranteed share) — to each class.",
    seeAlso: ["QoS", "Class map"],
  },
  {
    term: "TrustSec",
    category: "Concepts",
    definition: "Cisco's identity-based segmentation that tags traffic with Security Group Tags so policy follows the user regardless of IP address.",
    seeAlso: ["SGT", "SD-Access"],
  },
  {
    term: "SGT",
    category: "Concepts",
    definition: "Security Group Tag — the label TrustSec attaches to traffic so firewalls and fabric nodes can enforce identity-based policy.",
    seeAlso: ["TrustSec", "SD-Access"],
  },
  {
    term: "MACsec",
    category: "Concepts",
    definition: "802.1AE link-layer encryption between adjacent switches, protecting every frame hop-by-hop on the wire.",
    seeAlso: ["IPsec", "NGFW"],
  },
  {
    term: "NGFW",
    category: "Concepts",
    definition: "Next-Generation Firewall — an application-aware firewall that inspects traffic beyond just port and protocol.",
    seeAlso: ["ACL", "Defense in depth"],
  },
  {
    term: "NAC",
    category: "Concepts",
    definition: "Network Access Control — checks a device's identity and posture before letting it on the network.",
    seeAlso: ["802.1X", "Endpoint security"],
  },
  {
    term: "802.1X",
    category: "Concepts",
    definition: "Port-based access control — a switch port stays closed until the device authenticates against a RADIUS server.",
    seeAlso: ["NAC", "AAA", "RADIUS"],
  },
  {
    term: "Endpoint security",
    category: "Concepts",
    definition: "Protecting the devices themselves — antivirus, patching, host firewalls — the innermost layer of defense in depth.",
    seeAlso: ["NAC", "Defense in depth"],
  },
  {
    term: "Defense in depth",
    category: "Concepts",
    definition: "Layered security: endpoint, access, network, and application controls stacked so the failure of one layer does not expose everything.",
    seeAlso: ["Endpoint security", "NGFW", "CoPP"],
  },
  {
    term: "AAA",
    category: "Concepts",
    definition: "Authentication, Authorization, Accounting — the framework for controlling who logs in, what they can do, and recording it.",
    detail: "'Lock The Control Plane' replaces a weak local password with `aaa new-model` plus a RADIUS/TACACS+ server.",
    seeAlso: ["RADIUS", "TACACS+", "802.1X"],
  },
  {
    term: "RADIUS",
    category: "Concepts",
    definition: "An AAA protocol that authenticates users against a central server, encrypting only the password and combining authentication and authorization.",
    seeAlso: ["AAA", "TACACS+"],
  },
  {
    term: "TACACS+",
    category: "Concepts",
    definition: "Cisco's AAA protocol that encrypts the entire packet and separates authentication, authorization, and accounting.",
    seeAlso: ["AAA", "RADIUS"],
  },
  {
    term: "CoPP",
    category: "Concepts",
    definition: "Control Plane Policing — rate-limits traffic destined to the router's CPU so an attack cannot overwhelm the control plane.",
    seeAlso: ["Control plane", "ACL", "Infrastructure ACL"],
  },
  {
    term: "ACL",
    category: "Concepts",
    definition: "Access Control List — an ordered list of permit/deny rules that filters traffic by source, destination, port, and protocol.",
    seeAlso: ["CoPP", "Infrastructure ACL", "Crypto map"],
  },
  {
    term: "Infrastructure ACL",
    category: "Concepts",
    definition: "An ACL on the network edge that blocks unauthorized traffic to the routers and switches themselves, protecting the management and control planes.",
    aliases: ["iACL"],
    seeAlso: ["ACL", "CoPP"],
  },
  {
    term: "NETCONF",
    category: "Concepts",
    definition: "A network configuration protocol that reads and writes YANG-modeled data over SSH (port 830).",
    seeAlso: ["YANG", "RESTCONF", "Agent vs agentless"],
  },
  {
    term: "RESTCONF",
    category: "Concepts",
    definition: "A RESTful API that serves YANG data as JSON or XML over HTTPS (port 443).",
    seeAlso: ["NETCONF", "YANG", "JSON"],
  },
  {
    term: "YANG",
    category: "Concepts",
    definition: "A data-modeling language that defines the structure of what NETCONF and RESTCONF can read and write.",
    seeAlso: ["NETCONF", "RESTCONF"],
  },
  {
    term: "JSON",
    category: "Concepts",
    definition: "JavaScript Object Notation — a key/value data format used by REST APIs to exchange structured data.",
    seeAlso: ["REST API", "RESTCONF", "Python"],
  },
  {
    term: "REST API",
    category: "Concepts",
    definition: "An HTTP-based interface (GET/POST/PUT/DELETE) used by controllers like Catalyst Center and SD-WAN Manager.",
    seeAlso: ["JSON", "NETCONF", "RESTCONF"],
  },
  {
    term: "Python",
    category: "Concepts",
    definition: "The scripting language most network automation uses, with libraries like requests and netmiko for APIs and SSH.",
    seeAlso: ["JSON", "REST API"],
  },
  {
    term: "EEM",
    category: "Concepts",
    definition: "Embedded Event Manager — an IOS scripting feature that runs applets when an event (a syslog message, a timer, a CLI action) fires.",
    seeAlso: ["Python", "Syslog"],
  },
  {
    term: "Agent vs agentless",
    category: "Concepts",
    definition: "Agent-based management installs software on each device; agentless reaches devices over SSH/API (NETCONF, SNMP) with no installed agent.",
    seeAlso: ["NETCONF", "Catalyst Center"],
  },
  {
    term: "Catalyst Center",
    category: "Concepts",
    definition: "Cisco's network management and assurance controller (formerly DNA Center) that automates SD-Access and monitors health.",
    aliases: ["DNA Center"],
    seeAlso: ["SD-Access", "REST API", "NETCONF"],
  },
  {
    term: "Telemetry",
    category: "Concepts",
    definition: "Streaming operational data from devices in near real time instead of polling — the modern replacement for periodic SNMP.",
    seeAlso: ["NetFlow", "SNMP"],
  },

  // ─── Tools ─────────────────────────────────────────────────────────────────
  {
    term: "NetFlow",
    category: "Tools",
    definition: "Flow accounting — records who talked to whom (source, destination, ports, protocol) and exports the records, by default over UDP 2055.",
    seeAlso: ["Flexible NetFlow", "Telemetry", "SPAN"],
  },
  {
    term: "Flexible NetFlow",
    category: "Tools",
    definition: "NetFlow with customizable record formats and exporters, letting you collect exactly the fields you care about.",
    seeAlso: ["NetFlow"],
  },
  {
    term: "IP SLA",
    category: "Tools",
    definition: "Synthetic probes that measure latency, jitter, and packet loss on a schedule to baseline and alert on network health.",
    seeAlso: ["Ping", "Traceroute", "SNMP"],
  },
  {
    term: "SNMP",
    category: "Tools",
    definition: "Simple Network Management Protocol — polls devices for statistics; v2c uses a community string, v3 adds authentication and encryption.",
    seeAlso: ["Syslog", "Telemetry", "IP SLA"],
  },
  {
    term: "Syslog",
    category: "Tools",
    definition: "Device logging with severity levels from 0 (emergency) to 7 (debug) — the breadcrumb trail for troubleshooting.",
    seeAlso: ["SNMP", "Conditional debug"],
  },
  {
    term: "Traceroute",
    category: "Tools",
    definition: "Maps the path to a destination and measures each hop's latency by sending packets with increasing TTL values.",
    seeAlso: ["Ping", "IP SLA"],
  },
  {
    term: "Conditional debug",
    category: "Tools",
    definition: "Verbose, real-time diagnostics filtered to a specific feature or host so the output stays readable.",
    seeAlso: ["Syslog", "Show commands"],
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
