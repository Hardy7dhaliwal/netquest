import type { LabTemplate } from "./labs";
import { LAB_TEMPLATES_EXTRA } from "./lab-templates-extra";
import { LAB_TEMPLATES_EXTRA2 } from "./lab-templates-extra2";
import { LAB_TEMPLATES_EXTRA3 } from "./lab-templates-extra3";

/**
 * The starter lab catalog. Each lab has at least two variants that change
 * addressing, interface names, the symptom, and the distractor set. Steps are
 * the same shape for every variant; outputs interpolate the variant's values.
 *
 * Simulator limits: outputs are curated text, not a live device. For
 * real-device behavior (exact timers, counters, platform quirks), practice
 * the same fixes on Cisco Modeling Labs (CML), EVE-NG, or a Cisco DevNet
 * sandbox device.
 */
export const LAB_TEMPLATES: LabTemplate[] = [
  {
    id: "lab-ospf-adjacency",
    title: "OSPF adjacency that won't form",
    objectiveIds: ["3.2.b"],
    skill: "troubleshoot",
    simulatorNote: "Timers are fixed values here; on real IOS the dead timer defaults to 4× the hello. Confirm with show ip ospf interface on a CML or DevNet sandbox device.",
    scenario: "Two routers should form an OSPF adjacency but the neighbor state never reaches FULL.",
    variants: [
      {
        id: "a",
        label: "Variant A · 10.1.0.0/30",
        symptom: "R2 sees R1 stuck in EXSTART — LSAs never exchange.",
        addressing: "R1 Gi0/0 = 10.1.0.1/30, R2 Gi0/0 = 10.1.0.2/30, area 0",
        interfaces: "GigabitEthernet0/0 on both routers",
        distractors: ["network 10.1.0.0 0.0.0.255 area 0", "ip ospf network broadcast", "ip ospf priority 100"],
        values: { neighborIp: "10.1.0.2", neighborId: "172.16.0.2", iface: "GigabitEthernet0/0" },
      },
      {
        id: "b",
        label: "Variant B · 172.16.5.0/29",
        symptom: "R2 reports R1 in TWO-WAY but never progresses — the DR election is fine, LSAs aren't.",
        addressing: "R1 Gi0/2 = 172.16.5.1/29, R2 Gi0/2 = 172.16.5.2/29, area 0",
        interfaces: "GigabitEthernet0/2 on both routers",
        distractors: ["no ip ospf network", "ip ospf dead-interval 40", "network 172.16.5.0 0.0.0.7 area 1"],
        values: { neighborIp: "172.16.5.2", neighborId: "10.0.0.2", iface: "GigabitEthernet0/2" },
      },
    ],
    steps: [
      {
        kind: "inspect",
        title: "Inspect the adjacency",
        prompt: "Run the command that shows OSPF neighbor state.",
        commands: ["show ip ospf neighbor", "show ip ospf neighbor detail"],
        output: (variant) =>
          `Neighbor ID     Pri   State           Dead Time   Address         Interface\n${variant.values!.neighborId}      1     EXSTART/DR      00:00:38    ${variant.values!.neighborIp}        ${variant.values!.iface}`,
        wrongHint: "Check the neighbor state table — the command is show ip ospf neighbor.",
        explain: "EXSTART (or TWO-WAY that stalls) points at a database-description problem, classically an MTU mismatch.",
      },
      {
        kind: "diagnose",
        title: "Diagnose the fault",
        prompt: "The neighbor is stuck at EXSTART while the far end shows the same. Which is the most likely cause?",
        options: [
          { value: "mtu", title: "MTU mismatch between the two interfaces", note: "DD packets are silently dropped when too large" },
          { value: "area", title: "Both routers are in different OSPF areas", note: "That would prevent even TWO-WAY" },
          { value: "network", title: "The network statement uses the wrong wildcard", note: "A wrong wildcard usually stops the adjacency at DOWN/INIT" },
        ],
        correct: "mtu",
        wrongHint: "Look at where the state machine stalls: EXSTART/EXCHANGE is where DD packets are negotiated — that's MTU territory.",
        explain: "An MTU mismatch leaves DD packets oversized and dropped, freezing the exchange at EXSTART. Check ip mtu on the interface.",
      },
      {
        kind: "configure",
        title: "Apply the fix",
        prompt: "Set the interface to an IP MTU of 1400 (the current mismatch is 1500 vs 1400).",
        acceptedCommands: ["ip mtu 1400"],
        appliedOutput: (variant) =>
          `R1(config-if)# ip mtu 1400\nR1(config-if)#\n%OSPF-5-ADJCHG: Process 1, Nbr ${variant.values!.neighborId} on ${variant.values!.iface} from EXSTART to FULL, Done`,
        wrongHint: "The fix is an interface command — ip mtu <value>. Not an OSPF or network command.",
        explain: "Matching ip mtu on both ends lets the DD exchange complete and the adjacency reach FULL.",
      },
      {
        kind: "verify",
        title: "Verify the adjacency",
        prompt: "Confirm the neighbor is now FULL.",
        commands: ["show ip ospf neighbor", "show ip ospf neighbor detail"],
        output: (variant) =>
          `Neighbor ID     Pri   State           Dead Time   Address         Interface\n${variant.values!.neighborId}      1     FULL/DR          00:00:38    ${variant.values!.neighborIp}        ${variant.values!.iface}`,
        wrongHint: "Run show ip ospf neighbor again — the state column should read FULL.",
        explain: "FULL/DR confirms the adjacency formed and LSAs are being exchanged.",
      },
    ],
  },
  {
    id: "lab-nat-pat",
    title: "PAT overload not translating",
    objectiveIds: ["3.3.b"],
    skill: "configure",
    simulatorNote: "Translation counts here are fixed; real devices show live hit counts. Use a DevNet CSR1000v sandbox (or CML/EVE-NG) to watch counters climb as hosts browse.",
    scenario: "LAN hosts can ping the gateway but not the internet — NAT is configured but nothing translates.",
    variants: [
      {
        id: "a",
        label: "Variant A · 192.168.1.0/24",
        symptom: "show ip nat translations is empty; the WAN interface is Gi0/1 at 203.0.113.10.",
        addressing: "Inside LAN 192.168.1.0/24, outside WAN 203.0.113.10/30",
        interfaces: "Gi0/0 = inside, Gi0/1 = outside",
        distractors: ["ip nat inside source list 1 pool GLOBAL", "ip nat inside source static 192.168.1.10 203.0.113.10", "ip access-list standard 10 permit any"],
        values: { insideIf: "GigabitEthernet0/0", outsideIf: "GigabitEthernet0/1", wanIp: "203.0.113.10", lanHost: "192.168.1.10", lanSubnet: "192.168.1.0" },
      },
      {
        id: "b",
        label: "Variant B · 10.10.10.0/24",
        symptom: "Hosts reach the internet intermittently — some flows translate, others don't; the WAN is Gi0/3 at 198.51.100.5.",
        addressing: "Inside LAN 10.10.10.0/24, outside WAN 198.51.100.5/30",
        interfaces: "Gi0/2 = inside, Gi0/3 = outside",
        distractors: ["ip nat inside source list 10 pool PUBLIC overload", "ip nat outside source list 10 interface gi0/3 overload", "no ip nat inside"],
        values: { insideIf: "GigabitEthernet0/2", outsideIf: "GigabitEthernet0/3", wanIp: "198.51.100.5", lanHost: "10.10.10.10", lanSubnet: "10.10.10.0" },
      },
    ],
    steps: [
      {
        kind: "inspect",
        title: "Inspect translations",
        prompt: "Show the current NAT translation table.",
        commands: ["show ip nat translations", "show ip nat translation"],
        output: () => "Pro  Inside global      Inside local       Outside local      Outside global\n---  ---                 ---                ---                ---\n(no translations)",
        wrongHint: "The command is show ip nat translations.",
        explain: "An empty table means the traffic isn't matching any NAT rule — or the inside/outside direction is wrong.",
      },
      {
        kind: "diagnose",
        title: "Diagnose the fault",
        prompt: "Hosts cannot reach the internet and no translations appear. Which is the most likely cause?",
        options: [
          { value: "direction", title: "The inside/outside commands are missing or reversed on the interfaces", note: "NAT only applies to traffic crossing correctly-marked interfaces" },
          { value: "pool", title: "The public pool is exhausted", note: "That would show some translations and port-exhaustion errors" },
          { value: "acl", title: "The ACL permits everything, including the WAN subnet", note: "Over-permission wouldn't produce an empty table" },
        ],
        correct: "direction",
        wrongHint: "An empty translation table while hosts send traffic points at interface direction — ip nat inside / ip nat outside.",
        explain: "Without ip nat inside on the LAN interface and ip nat outside on the WAN, the router never considers the traffic translatable.",
      },
      {
        kind: "configure",
        title: "Apply the fix",
        prompt: "Mark the LAN interface as NAT inside, the WAN interface as NAT outside, then enable overload on the WAN interface address.",
        acceptedCommands: (variant) => [
          `interface ${variant.values!.insideIf.toLowerCase().replace(/gigabitethernet/, "gi")} ip nat inside`,
          `interface ${variant.values!.insideIf.toLowerCase().replace(/gigabitethernet/, "g")} ip nat inside`,
          `interface ${variant.values!.outsideIf.toLowerCase().replace(/gigabitethernet/, "gi")} ip nat outside`,
          `interface ${variant.values!.outsideIf.toLowerCase().replace(/gigabitethernet/, "g")} ip nat outside`,
          `interface ${variant.values!.insideIf} ip nat inside`,
          `interface ${variant.values!.outsideIf} ip nat outside`,
        ],
        appliedOutput: (variant) =>
          `R1(config)# interface ${variant.values!.insideIf}\nR1(config-if)# ip nat inside\nR1(config-if)# interface ${variant.values!.outsideIf}\nR1(config-if)# ip nat outside\nR1(config-if)# exit\nR1(config)# ip nat inside source list 10 interface ${variant.values!.outsideIf} overload\nR1(config)#`,
        wrongHint: "Two things are needed: ip nat inside/outside on the right interfaces, and ip nat inside source list <acl> interface <wan> overload.",
        explain: "Correct interface direction plus an overload rule tied to the WAN interface address makes all LAN traffic share one public IP.",
      },
      {
        kind: "verify",
        title: "Verify the translation",
        prompt: "Confirm a translation now exists for the LAN host.",
        commands: ["show ip nat translations"],
        output: (variant) =>
          `Pro  Inside global      Inside local       Outside local      Outside global\ntcp  ${variant.values!.wanIp}:51234  ${variant.values!.lanHost}:51234  8.8.8.8:80          8.8.8.8:80\n---  ${variant.values!.wanIp}        ${variant.values!.lanHost}       ---                ---`,
        wrongHint: "Run show ip nat translations — you should see an entry for the host's local address.",
        explain: "A translation entry proves inside/outside direction and the overload rule are working together.",
      },
    ],
  },
  {
    id: "lab-trunk-vlan",
    title: "VLAN missing across the trunk",
    objectiveIds: ["3.1.a"],
    skill: "troubleshoot",
    simulatorNote: "Real switches also show per-VLAN traffic counters; here the output is simplified to the allowed list, which is the crux of this fault. Practice on CML, EVE-NG, or a DevNet switch sandbox for live counters.",
    scenario: "Two access switches are trunked together. PCs in a VLAN can't reach the server on the other switch.",
    variants: [
      {
        id: "a",
        label: "Variant A · VLAN 30",
        symptom: "VLAN 30 is absent from the trunk's allowed list on SW1; Gi0/1 is the trunk.",
        addressing: "SW1 Gi0/1 ↔ SW2 Gi0/1; PC-Sales in VLAN 30 on SW1, server in VLAN 30 on SW2",
        interfaces: "GigabitEthernet0/1 on both switches",
        distractors: ["switchport mode access", "no switchport", "switchport trunk native vlan 30"],
        values: { iface: "Gi0/1", vlan: "30", allowed: "1,10,20" },
      },
      {
        id: "b",
        label: "Variant B · VLAN 120",
        symptom: "VLAN 120 is missing from SW2's VLAN database even though the trunk allows it.",
        addressing: "SW1 Gi0/2 ↔ SW2 Gi0/2; PC-Admin in VLAN 120 on SW2, server in VLAN 120 on SW1",
        interfaces: "GigabitEthernet0/2 on both switches",
        distractors: ["switchport trunk allowed vlan add 130", "switchport trunk encapsulation dot1q", "switchport mode dynamic desirable"],
        values: { iface: "Gi0/2", vlan: "120", allowed: "1,10,110" },
      },
    ],
    steps: [
      {
        kind: "inspect",
        title: "Inspect the trunk",
        prompt: "Show the trunk's allowed VLAN list.",
        commands: ["show interfaces trunk", "show interface trunk"],
        output: (variant) =>
          `Port        Mode         Encapsulation  Status        Native vlan\n${variant.values!.iface}       on           802.1q         trunking      1\n\nPort        Vlans allowed on trunk\n${variant.values!.iface}       ${variant.values!.allowed}`,
        wrongHint: "The trunk inspector is show interfaces trunk.",
        explain: "The target VLAN is not on the allowed list — traffic for it is pruned at the trunk.",
      },
      {
        kind: "diagnose",
        title: "Diagnose the fault",
        prompt: "The allowed list shows other VLANs but the target VLAN must cross the trunk. What is wrong?",
        options: [
          { value: "allowed", title: "The target VLAN was pruned from the allowed list", note: "Only the listed VLANs are carried" },
          { value: "native", title: "The native VLAN is wrong", note: "Native VLAN affects untagged frames, not the allowed set" },
          { value: "mode", title: "The trunk is in access mode", note: "It reports trunking — the mode is fine" },
        ],
        correct: "allowed",
        wrongHint: "The allowed list is exactly the gate — a missing VLAN cannot cross the trunk.",
        explain: "switchport trunk allowed vlan sets the carried set; anything else is pruned at the link.",
      },
      {
        kind: "configure",
        title: "Apply the fix",
        prompt: "Add the target VLAN to the allowed list on the trunk interface.",
        acceptedCommands: ["switchport trunk allowed vlan add 30", "switchport trunk allowed vlan add 120"],
        appliedOutput: (variant) => `SW1(config-if)# switchport trunk allowed vlan add ${variant.values!.vlan}\nSW1(config-if)#`,
        wrongHint: "The command is switchport trunk allowed vlan add <vlan> — an add, not a re-set that would drop the others.",
        explain: "add appends the VLAN without disturbing the existing list.",
      },
      {
        kind: "verify",
        title: "Verify the fix",
        prompt: "Confirm the target VLAN now appears in the allowed list.",
        commands: ["show interfaces trunk"],
        output: (variant) => `Port        Vlans allowed on trunk\n${variant.values!.iface}       ${variant.values!.allowed},${variant.values!.vlan}`,
        wrongHint: "Re-run show interfaces trunk — the allowed list should include the target VLAN.",
        explain: "The VLAN in the allowed list means the trunk now carries the traffic.",
      },
    ],
  },
  {
    id: "lab-iacl",
    title: "Infrastructure ACL letting probes through",
    objectiveIds: ["5.2.a"],
    skill: "configure",
    simulatorNote: "ACL behavior here is text-based; on a real router verify with show access-lists counters and live probes. A CML or EVE-NG lab with two hosts is ideal to see the deny counters climb.",
    scenario: "An edge router's management loopback is reachable from the internet. An iACL exists but external probes still succeed.",
    variants: [
      {
        id: "a",
        label: "Variant A · loopback 0",
        symptom: "Internet hosts can still ping the loopback; the iACL allows SSH from the NOC but denies everything else — and it isn't applied.",
        addressing: "Edge Gi0/1 faces the internet; Loopback0 = 10.255.0.1; NOC subnet 10.99.0.0/24",
        interfaces: "GigabitEthernet0/1 (internet-facing)",
        distractors: ["access-list 150 permit icmp any any", "ip access-group 150 out", "ip access-group 150 in on loopback0"],
        values: { iface: "GigabitEthernet0/1", acl: "150", mgmtIp: "10.255.0.1", noc: "10.99.0.0" },
      },
      {
        id: "b",
        label: "Variant B · loopback 7",
        symptom: "The iACL is applied outbound on the WAN interface instead of inbound, so traffic to the router is never filtered.",
        addressing: "Edge Gi0/3 faces the ISP; Loopback7 = 172.31.255.1; NOC subnet 10.50.0.0/16",
        interfaces: "GigabitEthernet0/3 (ISP-facing)",
        distractors: ["access-list 170 permit tcp any any eq ssh", "no ip access-group", "access-list 170 deny ip any host 172.31.255.1"],
        values: { iface: "GigabitEthernet0/3", acl: "170", mgmtIp: "172.31.255.1", noc: "10.50.0.0" },
      },
    ],
    steps: [
      {
        kind: "inspect",
        title: "Inspect the ACL",
        prompt: "Show the configured access lists and where they are applied.",
        commands: ["show access-lists", "show ip access-lists", "show ip interface gi0/1"],
        output: (variant) =>
          `Extended IP access list ${variant.values!.acl}\n    10 permit tcp ${variant.values!.noc} 0.0.0.255 host ${variant.values!.mgmtIp} eq ssh\n    20 deny ip any host ${variant.values!.mgmtIp}\n    30 permit ip any any\n\n(not applied to any interface)`,
        wrongHint: "Run show access-lists and check the interface with show ip interface.",
        explain: "The ACL is well-formed but it is not attached inbound to the internet-facing interface.",
      },
      {
        kind: "diagnose",
        title: "Diagnose the fault",
        prompt: "The ACL allows NOC SSH, denies the management IP, permits the rest. Why do internet probes still succeed?",
        options: [
          { value: "notapplied", title: "The ACL isn't applied inbound on the internet-facing interface", note: "An unapplied ACL filters nothing" },
          { value: "order", title: "The deny comes after the permit any", note: "The permit any is last, so order is actually correct" },
          { value: "mgmt", title: "The ACL doesn't reference the management IP", note: "It references the exact host — that part is right" },
        ],
        correct: "notapplied",
        wrongHint: "Check the application — an ACL with no ip access-group on the right interface in the right direction does nothing.",
        explain: "The iACL must be applied inbound on the interface facing the internet to filter traffic toward the router's own addresses.",
      },
      {
        kind: "configure",
        title: "Apply the fix",
        prompt: "Apply the ACL inbound on the internet-facing interface.",
        acceptedCommands: ["ip access-group 150 in", "ip access-group 170 in"],
        appliedOutput: (variant) => `R1(config)# interface ${variant.values!.iface}\nR1(config-if)# ip access-group ${variant.values!.acl} in\nR1(config-if)#`,
        wrongHint: "Apply it inbound on the internet-facing interface: ip access-group <acl> in.",
        explain: "Inbound application on the WAN interface filters traffic before it can reach the router's infrastructure addresses.",
      },
      {
        kind: "verify",
        title: "Verify the fix",
        prompt: "Confirm the ACL is now attached and count hits for the deny entry.",
        commands: ["show ip interface gi0/1", "show access-lists"],
        output: (variant) =>
          `${variant.values!.iface}\n  Inbound  access list is ${variant.values!.acl}\n\nExtended IP access list ${variant.values!.acl}\n    20 deny ip any host ${variant.values!.mgmtIp} (12 matches)`,
        wrongHint: "Run show ip interface and show access-lists — the ACL should show inbound and match counters.",
        explain: "Inbound attachment plus rising deny counters proves external probes are now dropped.",
      },
    ],
  },
  ...LAB_TEMPLATES_EXTRA,
  ...LAB_TEMPLATES_EXTRA2,
  ...LAB_TEMPLATES_EXTRA3,
];
