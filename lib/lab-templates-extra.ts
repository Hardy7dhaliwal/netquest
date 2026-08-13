import type { LabTemplate } from "./labs";

/**
 * Gap-topic labs (PRD "content gaps to deepen"). Each covers a blueprint
 * objective that previously had no hands-on lab: eBGP (3.2.c), first-hop
 * redundancy (3.3.c), Flexible NetFlow (4.2), SPAN/RSPAN/ERSPAN (4.3),
 * AAA (5.1.b), CoPP (5.2.b), and NETCONF/RESTCONF (4.6).
 *
 * Every lab keeps the inspect → diagnose → configure → verify loop with two
 * variants that change the addressing, interfaces, symptoms, and distractors.
 * Where the two variants are different protocols (HSRP vs VRRP, NETCONF vs
 * RESTCONF) the accepted show commands and fixes are variant-aware functions.
 */
export const LAB_TEMPLATES_EXTRA: LabTemplate[] = [
  {
    id: "lab-ebgp",
    title: "eBGP session stuck in Active",
    objectiveIds: ["3.2.c"],
    skill: "troubleshoot",
    simulatorNote: "BGP timers and holdtimes are fixed values here; on real IOS the keepalive/hold defaults are 60/180 seconds and wrong-AS notifications appear in show logging. Reproduce on a CML or DevNet CSR1000v sandbox to watch the full state machine.",
    scenario: "Two routers in different ASNs should peer over a directly connected link, but the eBGP session never leaves the Active state.",
    variants: [
      {
        id: "a",
        label: "Variant A · AS 65001 ↔ AS 65002",
        symptom: "R1 shows the neighbor 10.1.0.2 stuck in Active with %BGP-3-NOTIFICATION logs about the wrong AS.",
        addressing: "R1 Gi0/0 = 10.1.0.1/30 (AS 65001), R2 Gi0/0 = 10.1.0.2/30 (AS 65002)",
        interfaces: "GigabitEthernet0/0 on both routers",
        distractors: ["neighbor 10.1.0.2 ebgp-multihop 2", "network 10.1.0.0 mask 255.255.255.252", "neighbor 10.1.0.2 update-source loopback0"],
        values: { peerIp: "10.1.0.2", localAsn: "65001", peerAsn: "65002", wrongAsn: "65003", iface: "GigabitEthernet0/0" },
      },
      {
        id: "b",
        label: "Variant B · AS 65100 ↔ AS 65101",
        symptom: "R1 reports 172.16.0.2 cycling Active/Idle — the remote-as on R1 doesn't match R2's ASN.",
        addressing: "R1 Gi0/2 = 172.16.0.1/30 (AS 65100), R2 Gi0/2 = 172.16.0.2/30 (AS 65101)",
        interfaces: "GigabitEthernet0/2 on both routers",
        distractors: ["neighbor 172.16.0.2 ebgp-multihop 5", "neighbor 172.16.0.2 password cisco123", "network 172.16.0.0 mask 255.255.255.252"],
        values: { peerIp: "172.16.0.2", localAsn: "65100", peerAsn: "65101", wrongAsn: "65099", iface: "GigabitEthernet0/2" },
      },
    ],
    steps: [
      {
        kind: "inspect",
        title: "Inspect the BGP session",
        prompt: "Show the BGP neighbor state.",
        commands: ["show ip bgp summary", "show ip bgp neighbors"],
        output: (variant) =>
          `BGP router identifier ${variant.values!.localAsn}.0.0.1, local AS number ${variant.values!.localAsn}\nNeighbor        V    AS MsgRcvd MsgSent   TblVer  InQ OutQ Up/Down  State/PfxRcd\n${variant.values!.peerIp}    4 ${variant.values!.wrongAsn}       0       0        1    0    0    never  Active`,
        wrongHint: "The neighbor table is shown by show ip bgp summary.",
        explain: "Active means R1 keeps trying to connect but the session is rejected — typically because the remote-as doesn't match the peer's real ASN.",
      },
      {
        kind: "diagnose",
        title: "Diagnose the fault",
        prompt: "The session is stuck in Active and BGP logs an AS mismatch. What is the most likely cause?",
        options: [
          { value: "asn", title: "The remote-as configured on R1 doesn't match R2's ASN", note: "BGP refuses to peer across an AS mismatch" },
          { value: "multihop", title: "The neighbor needs ebgp-multihop", note: "These are directly connected — multihop is not required" },
          { value: "network", title: "The network statement doesn't advertise the link subnet", note: "No advertised prefix wouldn't prevent the session from establishing" },
        ],
        correct: "asn",
        wrongHint: "Look at the AS column in show ip bgp summary — the neighbor shows a different AS than the peer actually runs.",
        explain: "With directly connected eBGP, an Active session plus AS-mismatch notifications means the remote-as statement is wrong.",
      },
      {
        kind: "configure",
        title: "Apply the fix",
        prompt: "Correct the remote-as so it matches the peer's actual ASN.",
        acceptedCommands: (variant) => [`neighbor ${variant.values!.peerIp} remote-as ${variant.values!.peerAsn}`],
        appliedOutput: (variant) => `R1(config)# router bgp ${variant.values!.localAsn}\nR1(config-router)# neighbor ${variant.values!.peerIp} remote-as ${variant.values!.peerAsn}\nR1(config-router)#\n%BGP-5-ADJCHANGE: neighbor ${variant.values!.peerIp} Up`,
        wrongHint: "The fix is on the neighbor statement: neighbor <ip> remote-as <peer-asn> — not a network or multihop command.",
        explain: "Pointing remote-as at the peer's real ASN lets the TCP session and BGP OPEN exchange succeed.",
      },
      {
        kind: "verify",
        title: "Verify the session",
        prompt: "Confirm the neighbor is now Established.",
        commands: ["show ip bgp summary", "show ip bgp neighbors"],
        output: (variant) =>
          `BGP router identifier ${variant.values!.localAsn}.0.0.1, local AS number ${variant.values!.localAsn}\nNeighbor        V    AS MsgRcvd MsgSent   TblVer  InQ OutQ Up/Down  State/PfxRcd\n${variant.values!.peerIp}    4 ${variant.values!.peerAsn}      12      14        5    0    0 00:00:56        1`,
        wrongHint: "Re-run show ip bgp summary — the state column should read Established with a prefix count.",
        explain: "Established with the correct ASN confirms the eBGP adjacency is up and prefixes are exchanged.",
      },
    ],
  },
  {
    id: "lab-hsrp-vrrp",
    title: "First-hop failover never happens",
    objectiveIds: ["3.3.c"],
    skill: "troubleshoot",
    simulatorNote: "HSRP/VRRP timers are fixed values here; on real devices the default HSRP hold is 3× the hello and VRRP master advertisement is 1 second. Confirm behavior on a CML or EVE-NG pair of routers.",
    scenario: "Two routers share a virtual gateway IP for redundancy. When the active router fails, the standby should take over — but it never does.",
    variants: [
      {
        id: "a",
        label: "Variant A · HSRP group 10",
        symptom: "R2 has the higher priority (150) but R1 stays Active forever — even after R1 is reloaded, R2 won't seize the role.",
        addressing: "Virtual IP 10.1.1.254 on Gi0/0; R1 priority 100, R2 priority 150 (group 10)",
        interfaces: "GigabitEthernet0/0 on both routers",
        distractors: ["standby 10 ip 10.1.1.253", "standby 10 timers 5 15", "standby 10 track gi0/1 20"],
        values: { group: "10", vip: "10.1.1.254", iface: "GigabitEthernet0/0", showCmd: "show standby", proto: "standby", priority: "150" },
      },
      {
        id: "b",
        label: "Variant B · VRRP group 1",
        symptom: "R2 advertises the higher priority but R1 remains Master — after the Master is restored, R2 never takes back over.",
        addressing: "Virtual IP 172.16.1.254 on Gi0/2; R1 priority 100, R2 priority 200 (group 1)",
        interfaces: "GigabitEthernet0/2 on both routers",
        distractors: ["vrrp 1 ip 172.16.1.253", "vrrp 1 timers advertise 3", "vrrp 1 track gi0/3 30"],
        values: { group: "1", vip: "172.16.1.254", iface: "GigabitEthernet0/2", showCmd: "show vrrp", proto: "vrrp", priority: "200" },
      },
    ],
    steps: [
      {
        kind: "inspect",
        title: "Inspect the redundancy group",
        prompt: "Show the current role and priority of the group.",
        commands: (variant) => [variant.values!.showCmd, `${variant.values!.showCmd} brief`],
        output: (variant) =>
          `${variant.values!.showCmd} — group ${variant.values!.group}\n  State is Active (on R1, priority 100)\n  Virtual IP address is ${variant.values!.vip}\n  Active router is local, Standby router is 192.0.2.2, Priority ${variant.values!.priority} (configured)`,
        wrongHint: "The group state table is shown by show standby (HSRP) or show vrrp (VRRP).",
        explain: "R2 has the higher priority yet R1 stays Active — the missing piece is preemption.",
      },
      {
        kind: "diagnose",
        title: "Diagnose the fault",
        prompt: "R2 advertises a higher priority but never becomes Active/Master. What is the most likely cause?",
        options: [
          { value: "preempt", title: "Preempt is not configured on R2", note: "Without preempt, a higher-priority router only takes over when the active fails — and here even that isn't seizing" },
          { value: "priority", title: "R2's priority is actually lower", note: "The output shows R2's priority is higher" },
          { value: "vip", title: "The virtual IP is wrong", note: "The virtual IP is reachable — the group is functioning, just not failing over" },
        ],
        correct: "preempt",
        wrongHint: "The higher-priority router needs preempt to seize the role when the current Active/Master returns or reloads.",
        explain: "priority alone isn't enough: without preempt, R2 will not take over from a lower-priority Active that is still announcing.",
      },
      {
        kind: "configure",
        title: "Apply the fix",
        prompt: "Enable preemption on R2 for the group.",
        acceptedCommands: (variant) => [
          `${variant.values!.proto} ${variant.values!.group} preempt`,
          `${variant.values!.proto} ${variant.values!.group} priority ${variant.values!.priority} preempt`,
        ],
        appliedOutput: (variant) =>
          `R2(config)# interface ${variant.values!.iface}\nR2(config-if)# ${variant.values!.proto} ${variant.values!.group} preempt\nR2(config-if)#\n%${variant.values!.proto.toUpperCase()}-6-STATECHANGE: ${variant.values!.iface} Grp ${variant.values!.group} state Standby -> Active`,
        wrongHint: "The fix is a single preempt command on the group — not a timer, track, or virtual-IP change.",
        explain: "Preempt lets the higher-priority router take over as soon as it sees a lower-priority Active, enabling true failover.",
      },
      {
        kind: "verify",
        title: "Verify failover",
        prompt: "Confirm R2 is now the Active/Master.",
        commands: (variant) => [variant.values!.showCmd, `${variant.values!.showCmd} brief`],
        output: (variant) =>
          `${variant.values!.showCmd} — group ${variant.values!.group}\n  State is Active (on R2, priority 150 configured)\n  Virtual IP address is ${variant.values!.vip}\n  Active router is local`,
        wrongHint: "Re-run show standby (or show vrrp) — R2 should now report Active/Master.",
        explain: "With preempt enabled, R2's higher priority immediately seizes the virtual gateway role.",
      },
    ],
  },
  {
    id: "lab-netflow",
    title: "NetFlow records never exported",
    objectiveIds: ["4.2"],
    skill: "configure",
    simulatorNote: "Flow counts here are fixed; on real IOS XE the cache fills with live flows and exporter counters climb. Verify with show flow monitor and show flow exporter on a DevNet sandbox or CML.",
    scenario: "Flexible NetFlow is configured and the exporter reaches the collector, but the collector receives zero records.",
    variants: [
      {
        id: "a",
        label: "Variant A · Gi0/1 · exporter 10.1.1.5:9996",
        symptom: "show flow exporter shows the collector reachable, but no flows are ever sent.",
        addressing: "Ingress interface Gi0/1; collector 10.1.1.5 UDP 9996; monitor FLEX-A",
        interfaces: "GigabitEthernet0/1 (ingress)",
        distractors: ["flow exporter FLEX-A destination 10.1.1.5 transport udp 2055", "flow record FLEX-A match ipv4 destination address", "flow monitor FLEX-A exporter FLEX-A"],
        values: { iface: "GigabitEthernet0/1", exporter: "FLEX-A", monitor: "FLEX-A", collector: "10.1.1.5" },
      },
      {
        id: "b",
        label: "Variant B · Gi0/3 · exporter 172.16.1.10:2055",
        symptom: "The exporter and record exist but the collector at 172.16.1.10 sees nothing.",
        addressing: "Ingress interface Gi0/3; collector 172.16.1.10 UDP 2055; monitor FLOW-B",
        interfaces: "GigabitEthernet0/3 (ingress)",
        distractors: ["flow exporter FLOW-B destination 172.16.1.10 transport udp 9996", "flow record FLOW-B match ipv4 protocol", "flow monitor FLOW-B exporter FLOW-B"],
        values: { iface: "GigabitEthernet0/3", exporter: "FLOW-B", monitor: "FLOW-B", collector: "172.16.1.10" },
      },
    ],
    steps: [
      {
        kind: "inspect",
        title: "Inspect the flow configuration",
        prompt: "Show the flow exporter and flow monitor definitions.",
        commands: ["show flow exporter", "show flow monitor", "show flow record"],
        output: (variant) =>
          `Flow Exporter ${variant.values!.exporter}:\n  Destination IP address: ${variant.values!.collector}\n  Transport protocol: UDP\n  Source interface: (not set)\n  Export statistics:\n    Number of Flows exported: 0\n\nFlow Monitor ${variant.values!.monitor}:\n  Description: user defined\n  Exporter: ${variant.values!.exporter}\n  Cache type: Normal\n  Statistics:\n    Number of flows added: 0\n  (monitor is NOT applied to any interface)`,
        wrongHint: "The exporter/monitor config is shown by show flow exporter and show flow monitor.",
        explain: "The monitor is defined but never attached to an interface — without an ingress application it collects nothing.",
      },
      {
        kind: "diagnose",
        title: "Diagnose the fault",
        prompt: "The exporter is reachable and the monitor exists, yet zero flows are collected. What is wrong?",
        options: [
          { value: "notapplied", title: "The flow monitor is not applied to the ingress interface", note: "A monitor that isn't attached to an interface never sees traffic" },
          { value: "collector", title: "The collector IP or port is wrong", note: "The exporter output shows the collector is configured and reachable" },
          { value: "record", title: "The flow record is missing fields", note: "A record with no match fields still collects — this isn't the failure" },
        ],
        correct: "notapplied",
        wrongHint: "The inspect output says the monitor is NOT applied to any interface — that's the whole story.",
        explain: "Flexible NetFlow only starts collecting when the flow monitor is attached with flow monitor <name> input on the ingress interface.",
      },
      {
        kind: "configure",
        title: "Apply the fix",
        prompt: "Apply the flow monitor to the ingress interface.",
        acceptedCommands: (variant) => [
          `interface ${variant.values!.iface} flow monitor ${variant.values!.monitor} input`,
          `flow monitor ${variant.values!.monitor} input`,
          `interface ${variant.values!.iface.toLowerCase().replace(/gigabitethernet/, "gi")} flow monitor ${variant.values!.monitor} input`,
        ],
        appliedOutput: (variant) =>
          `R1(config)# interface ${variant.values!.iface}\nR1(config-if)# flow monitor ${variant.values!.monitor} input\nR1(config-if)#\n%FLOW-5-EXPORTED: Flow export to ${variant.values!.collector} started`,
        wrongHint: "The fix is on the ingress interface: flow monitor <name> input.",
        explain: "Attaching the monitor input lets the device classify every ingress packet into the flow cache.",
      },
      {
        kind: "verify",
        title: "Verify flow export",
        prompt: "Confirm the cache is now filling and flows are being exported.",
        commands: ["show flow monitor", "show flow exporter", "show flow monitor cache"],
        output: (variant) =>
          `Flow Monitor ${variant.values!.monitor}:\n  Exporter: ${variant.values!.exporter}\n  Cache type: Normal\n  Statistics:\n    Number of flows added: 284\n    Number of flows exported: 276\n  Active flows: 8`,
        wrongHint: "Re-run show flow monitor — the 'flows added/exported' counters should be climbing.",
        explain: "Rising add/export counters prove the monitor is collecting and the exporter is shipping records.",
      },
    ],
  },
  {
    id: "lab-span",
    title: "SPAN session captures nothing",
    objectiveIds: ["4.3"],
    skill: "troubleshoot",
    simulatorNote: "SPAN behavior here is text-based; on real switches use show monitor session to see both source and destination operational states. Practice on a CML or EVE-NG switch pair for live counters.",
    scenario: "A SPAN session should mirror a source interface to an analyzer, but the analyzer receives no traffic at all.",
    variants: [
      {
        id: "a",
        label: "Variant A · session 1 · Gi0/1 → Gi0/2",
        symptom: "monitor session 1 exists with source Gi0/1, but the analyzer on Gi0/2 sees nothing.",
        addressing: "Source Gi0/1 (access, VLAN 30), destination Gi0/2 on the same switch",
        interfaces: "GigabitEthernet0/1 (source), GigabitEthernet0/2 (destination)",
        distractors: ["monitor session 1 source interface gi0/2", "monitor session 1 filter vlan 30", "monitor session 1 source vlan 30"],
        values: { session: "1", srcIface: "GigabitEthernet0/1", dstIface: "GigabitEthernet0/2", vlan: "30" },
      },
      {
        id: "b",
        label: "Variant B · session 2 · Gi0/3 → Gi0/11",
        symptom: "monitor session 2 mirrors Gi0/3 to Gi0/11 but the analyzer port stays silent.",
        addressing: "Source Gi0/3 (access, VLAN 120), destination Gi0/11 on the same switch",
        interfaces: "GigabitEthernet0/3 (source), GigabitEthernet0/11 (destination)",
        distractors: ["monitor session 2 source interface gi0/11", "monitor session 2 filter vlan 120", "monitor session 2 source vlan 120"],
        values: { session: "2", srcIface: "GigabitEthernet0/3", dstIface: "GigabitEthernet0/11", vlan: "120" },
      },
    ],
    steps: [
      {
        kind: "inspect",
        title: "Inspect the SPAN session",
        prompt: "Show the monitor session configuration.",
        commands: (variant) => [`show monitor session ${variant.values!.session}`, "show monitor", "show monitor session all"],
        output: (variant) =>
          `Session ${variant.values!.session}\n--------- \nType : Local Session\nSource Ports :\n    RX Only:      None\n    TX Only:      None\n    Both:         ${variant.values!.srcIface}\nDestination Ports : None\nFilter VLANs : None`,
        wrongHint: "The session is shown by show monitor session <n>.",
        explain: "The source is defined but the destination port is missing — a SPAN session with no destination mirrors nothing.",
      },
      {
        kind: "diagnose",
        title: "Diagnose the fault",
        prompt: "The session has a source but the analyzer gets nothing. What is the most likely cause?",
        options: [
          { value: "nodest", title: "The destination port is not configured in the session", note: "A SPAN session needs a destination to send mirrored frames to" },
          { value: "vlan", title: "The source VLAN filter excludes the traffic", note: "There is no filter configured — the whole port is mirrored" },
          { value: "direction", title: "The source is mirroring the wrong direction", note: "The source is set to Both, so RX and TX are covered" },
        ],
        correct: "nodest",
        wrongHint: "Look at the inspect output — 'Destination Ports : None' is the smoking gun.",
        explain: "Without a destination interface, the session never delivers mirrored frames to the analyzer.",
      },
      {
        kind: "configure",
        title: "Apply the fix",
        prompt: "Add the analyzer port as the session destination.",
        acceptedCommands: (variant) => [
          `monitor session ${variant.values!.session} destination interface ${variant.values!.dstIface}`,
          `monitor session ${variant.values!.session} destination interface ${variant.values!.dstIface.toLowerCase().replace(/gigabitethernet/, "gi")}`,
        ],
        appliedOutput: (variant) =>
          `SW1(config)# monitor session ${variant.values!.session} destination interface ${variant.values!.dstIface}\nSW1(config)#\n%SPAN-5-SPAN_SESSION_ACTIVE: Session ${variant.values!.session} is now active`,
        wrongHint: "The fix is on the session: monitor session <n> destination interface <port>.",
        explain: "Declaring the destination activates the session and starts mirroring frames to the analyzer.",
      },
      {
        kind: "verify",
        title: "Verify the session",
        prompt: "Confirm the session is active with both source and destination.",
        commands: (variant) => [`show monitor session ${variant.values!.session}`, "show monitor session all"],
        output: (variant) =>
          `Session ${variant.values!.session}\n--------- \nType : Local Session\nStatus : Admin Enabled\nSource Ports :\n    Both:         ${variant.values!.srcIface}\nDestination Ports : ${variant.values!.dstIface}\nFilter VLANs : None`,
        wrongHint: "Re-run show monitor session — the destination should be listed and the status active.",
        explain: "A populated destination plus Admin Enabled confirms SPAN is mirroring traffic.",
      },
    ],
  },
  {
    id: "lab-aaa",
    title: "AAA login fails when the server is down",
    objectiveIds: ["5.1.b"],
    skill: "configure",
    simulatorNote: "Authentication behavior here is text-based; on real IOS XE use debug aaa authentication and test aaa to trace server fallback. Practice RADIUS/TACACS+ flows on CML or a DevNet sandbox.",
    scenario: "AAA is configured against a central server. The server goes down for maintenance — and now every login fails, even though local users exist.",
    variants: [
      {
        id: "a",
        label: "Variant A · RADIUS 10.1.1.5",
        symptom: "With the RADIUS server unreachable, console and VTY logins fail entirely — no local fallback.",
        addressing: "RADIUS server 10.1.1.5 key Cisco123; local users configured; method list 'default'",
        interfaces: "VTY lines 0-4, console 0",
        distractors: ["aaa authentication login default local", "aaa new-model", "radius-server host 10.1.1.5 key Cisco123"],
        values: { server: "10.1.1.5", proto: "radius", list: "default", fix: "aaa authentication login default group radius local" },
      },
      {
        id: "b",
        label: "Variant B · TACACS+ 172.16.1.5",
        symptom: "TACACS+ is unreachable and users cannot log in, although the local database has valid accounts.",
        addressing: "TACACS+ server 172.16.1.5 key NetQuestKey; local users configured; method list 'default'",
        interfaces: "VTY lines 0-4, console 0",
        distractors: ["aaa authentication login default local", "tacacs-server host 172.16.1.5 key NetQuestKey", "aaa new-model"],
        values: { server: "172.16.1.5", proto: "tacacs+", list: "default", fix: "aaa authentication login default group tacacs+ local" },
      },
    ],
    steps: [
      {
        kind: "inspect",
        title: "Inspect the AAA configuration",
        prompt: "Show the AAA authentication method lists.",
        commands: ["show running-config | include aaa authentication", "show aaa method-lists", "show running-config | section aaa"],
        output: (variant) => `aaa new-model\naaa authentication login ${variant.values!.list} group ${variant.values!.proto}\naaa authentication enable default enable`,
        wrongHint: "The method lists are shown by show aaa method-lists or show running-config | include aaa authentication.",
        explain: "The method list tries the remote server only — there is no 'local' fallback when the server is unreachable.",
      },
      {
        kind: "diagnose",
        title: "Diagnose the fault",
        prompt: "Users exist locally, but login fails whenever the central server is unreachable. What is wrong?",
        options: [
          { value: "nofallback", title: "The method list has no local fallback", note: "A list of just 'group radius/tacacs+' fails closed when the server is down" },
          { value: "users", title: "The local users are misconfigured", note: "The local database has valid accounts — the problem is the method list" },
          { value: "server", title: "The server address or key is wrong", note: "The server is simply down for maintenance — the config matches" },
        ],
        correct: "nofallback",
        wrongHint: "The inspect output shows only 'group radius/tacacs+' — no 'local' at the end of the list.",
        explain: "AAA method lists are tried in order; appending 'local' makes the device fall back to its local database when the server is unreachable.",
      },
      {
        kind: "configure",
        title: "Apply the fix",
        prompt: "Add local as the fallback in the method list.",
        acceptedCommands: (variant) => [`aaa authentication login ${variant.values!.list} group ${variant.values!.proto} local`],
        appliedOutput: (variant) => `R1(config)# ${variant.values!.fix}\nR1(config)#\n%AAA-5-AUTHEN_FALLBACK: local authentication used for login (server ${variant.values!.server} unreachable)`,
        wrongHint: "The fix is the full method list — group <radius|tacacs+> first, then local as the fallback.",
        explain: "With 'local' appended, authentication succeeds against the local database when the central server is unreachable.",
      },
      {
        kind: "verify",
        title: "Verify the fallback",
        prompt: "Confirm the method list now includes local.",
        commands: ["show aaa method-lists", "show running-config | include aaa authentication"],
        output: (variant) => `Authentication Method Lists:\n  login: ${variant.values!.list}\n    Method 1: group ${variant.values!.proto}\n    Method 2: local`,
        wrongHint: "Re-run show aaa method-lists — the login list should show group <proto> followed by local.",
        explain: "The ordered list now fails over to local authentication when the server is unreachable.",
      },
    ],
  },
  {
    id: "lab-copp",
    title: "CoPP dropping routing protocols",
    objectiveIds: ["5.2.b"],
    skill: "troubleshoot",
    simulatorNote: "Police rates and drop counters are fixed values here; on real IOS XE use show policy-map control-plane to watch real-time counters. Verify tuning on a CML or DevNet router before production.",
    scenario: "Control Plane Policing was applied to protect the CPU, but OSPF adjacencies started flapping and management access became flaky.",
    variants: [
      {
        id: "a",
        label: "Variant A · ACL 110",
        symptom: "OSPF neighbors flap — the CoPP routing class matches only BGP, so OSPF falls into class-default and gets dropped.",
        addressing: "CoPP policy on the edge router; class ROUTING matches ACL 110 (BGP only); class-default police 8000",
        interfaces: "Control-plane service-policy on the router",
        distractors: ["policy-map COPP class ROUTING police cir 8000", "class-map match-any ROUTING match protocol ospf", "service-policy input COPP"],
        values: { acl: "110", protos: "BGP only", missing: "ospf" },
      },
      {
        id: "b",
        label: "Variant B · ACL 120",
        symptom: "EIGRP adjacencies flap — the routing class matches only OSPF, so EIGRP traffic is policed by class-default.",
        addressing: "CoPP policy on the distribution router; class ROUTING matches ACL 120 (OSPF only); class-default police 8000",
        interfaces: "Control-plane service-policy on the router",
        distractors: ["policy-map COPP class ROUTING police cir 8000", "class-map match-any ROUTING match protocol eigrp", "service-policy input COPP"],
        values: { acl: "120", protos: "OSPF only", missing: "eigrp" },
      },
    ],
    steps: [
      {
        kind: "inspect",
        title: "Inspect the CoPP policy",
        prompt: "Show the control-plane policy and its class matches.",
        commands: ["show policy-map control-plane", "show class-map", "show access-lists"],
        output: (variant) =>
          `Control Plane\n  Service-policy input: COPP\n    Class-map: ROUTING (match-all)\n      Match: access-group ${variant.values!.acl} (${variant.values!.protos})\n      police cir 64000 bc 1500\n        conformed 541, exceeded 0\n    Class-map: class-default\n      Match: any\n      police cir 8000 bc 1500\n        conformed 128430, exceeded 9821 (dropped)`,
        wrongHint: "The policy classes and drop counters are shown by show policy-map control-plane.",
        explain: "Routing-protocol traffic that isn't matched by the ROUTING class falls into class-default — whose low police rate drops it.",
      },
      {
        kind: "diagnose",
        title: "Diagnose the fault",
        prompt: "The routing protocol flaps and class-default shows dropped packets. What is the most likely cause?",
        options: [
          { value: "unmatched", title: "The routing protocol isn't matched by the ROUTING class", note: "Unmatched routing traffic is policed by class-default and dropped" },
          { value: "rate", title: "The ROUTING class police rate is too low", note: "ROUTING is policed at 64000 — the drops are in class-default" },
          { value: "applied", title: "The policy isn't applied to the control plane", note: "show policy-map control-plane proves it is applied" },
        ],
        correct: "unmatched",
        wrongHint: "The drop counters are in class-default, not in ROUTING — the protocol is falling through the match.",
        explain: "CoPP classifies by match; any routing traffic the class-map doesn't match is policed by class-default, causing flaps.",
      },
      {
        kind: "configure",
        title: "Apply the fix",
        prompt: "Extend the routing class's ACL so the routing protocol is matched and spared from class-default.",
        acceptedCommands: (variant) => [`access-list ${variant.values!.acl} permit ${variant.values!.missing} any any`, `ip access-list extended ${variant.values!.acl} permit ${variant.values!.missing} any any`],
        appliedOutput: (variant) =>
          `R1(config)# access-list ${variant.values!.acl} permit ${variant.values!.missing} any any\nR1(config)#\n%${variant.values!.missing.toUpperCase()}-5-ADJCHG: Process 1, Nbr 192.0.2.2 on GigabitEthernet0/1 from DOWN to FULL, Done`,
        wrongHint: "Add the missing routing protocol to the class's ACL: access-list <n> permit <ospf|eigrp> any any.",
        explain: "Matching the routing protocol in the ROUTING class moves it under the high-rate police, away from the draconian class-default.",
      },
      {
        kind: "verify",
        title: "Verify the fix",
        prompt: "Confirm routing traffic now matches the ROUTING class and class-default drops stop climbing.",
        commands: ["show policy-map control-plane", "show access-lists"],
        output: (variant) =>
          `Control Plane\n  Service-policy input: COPP\n    Class-map: ROUTING (match-all)\n      Match: access-group ${variant.values!.acl}\n      police cir 64000\n        conformed 1291, exceeded 0\n    Class-map: class-default\n      Match: any\n      police cir 8000\n        conformed 128431, exceeded 9821 (no new drops)`,
        wrongHint: "Re-run show policy-map control-plane — routing packets should now count under ROUTING, not class-default.",
        explain: "Routing traffic counted in the ROUTING class with no new class-default drops confirms the protocol is protected.",
      },
    ],
  },
  {
    id: "lab-netconf-restconf",
    title: "Controller can't manage the device",
    objectiveIds: ["4.6"],
    skill: "configure",
    simulatorNote: "Management-protocol behavior here is text-based; on real IOS XE verify with show netconf-yang sessions or the RESTCONF GET. Practice against a DevNet sandbox device for authentic responses.",
    scenario: "A network controller (Catalyst Center / SD-WAN Manager) should manage the router via a northbound API, but its session or queries fail.",
    variants: [
      {
        id: "a",
        label: "Variant A · NETCONF session refused",
        symptom: "The controller's NETCONF session over SSH/830 is refused — netconf-yang is not enabled on the router.",
        addressing: "Router with SSH enabled; NETCONF over port 830 from controller 10.2.1.5",
        interfaces: "Management via SSH/830",
        distractors: ["username controller privilege 15 secret NetQuest123", "ip ssh version 2", "aaa authentication login default local"],
        values: { proto: "netconf-yang", enableCmd: "netconf-yang", showCmd: "show netconf-yang sessions" },
      },
      {
        id: "b",
        label: "Variant B · RESTCONF 404",
        symptom: "RESTCONF queries return 404 — restconf is not enabled, so /restconf/data isn't served.",
        addressing: "Router with HTTP(S) enabled; RESTCONF from controller 172.20.1.5",
        interfaces: "Management via HTTPS/443",
        distractors: ["username controller privilege 15 secret NetQuest123", "ip http secure-server", "aaa authentication login default local"],
        values: { proto: "restconf", enableCmd: "restconf", showCmd: "show running-config | include restconf" },
      },
    ],
    steps: [
      {
        kind: "inspect",
        title: "Inspect the management protocol",
        prompt: "Check whether the northbound management protocol is enabled.",
        commands: (variant) => [variant.values!.showCmd, "show running-config | include netconf", "show running-config | include restconf"],
        output: (variant) =>
          `R1# ${variant.values!.showCmd}\nR1#\n(no ${variant.values!.proto} configuration found)`,
        wrongHint: "The protocol state is shown by show netconf-yang sessions or show running-config | include restconf.",
        explain: "Neither NETCONF nor RESTCONF is enabled — the controller has nothing to connect to.",
      },
      {
        kind: "diagnose",
        title: "Diagnose the fault",
        prompt: "SSH/HTTPS work, but the controller's management session fails. What is the most likely cause?",
        options: [
          { value: "notenabled", title: "The management protocol is not enabled on the device", note: "NETCONF/RESTCONF must be explicitly enabled before the controller can use them" },
          { value: "port", title: "The controller uses the wrong port", note: "The ports are the standard ones — the protocol simply isn't on" },
          { value: "aaa", title: "AAA rejects the controller's credentials", note: "The failure happens before authentication — nothing is listening" },
        ],
        correct: "notenabled",
        wrongHint: "The inspect output shows no netconf/restconf configuration — the feature was never enabled.",
        explain: "IOS XE ships with NETCONF/RESTCONF disabled; you must enable them globally before a controller can manage the device.",
      },
      {
        kind: "configure",
        title: "Apply the fix",
        prompt: "Enable the northbound management protocol globally.",
        acceptedCommands: (variant) => [variant.values!.enableCmd],
        appliedOutput: (variant) =>
          variant.values!.proto === "netconf-yang"
            ? `R1(config)# netconf-yang\nR1(config)#\n%NETCONF-5-SERVER_START: NETCONF server started on port 830`
            : `R1(config)# restconf\nR1(config)#\n%RESTCONF-5-SERVER_START: RESTCONF server started on port 443`,
        wrongHint: "The fix is a single global command: netconf-yang or restconf.",
        explain: "Enabling the protocol starts the management server so the controller's session or REST queries succeed.",
      },
      {
        kind: "verify",
        title: "Verify the management session",
        prompt: "Confirm the controller can now reach the device.",
        commands: (variant) => [variant.values!.showCmd, "show netconf-yang sessions"],
        output: (variant) =>
          variant.values!.proto === "netconf-yang"
            ? `R1# show netconf-yang sessions\nR1#\nID  Transport  Host            Port  User\n--  ---------  ---------------  ----  -----\n10  NETCONF    10.2.1.5         830   controller\n`
            : `R1# show running-config | include restconf\nrestconf\nR1#`,
        wrongHint: "Re-run the show command — you should see an active session (NETCONF) or the enabled line (RESTCONF).",
        explain: "An established NETCONF session — or the restconf line in running-config — proves the controller can now manage the device.",
      },
    ],
  },
];
