import type { LabTemplate } from "./labs";

/**
 * Depth-expansion labs — the exam-favorite topics that were already taught but
 * deserved hands-on practice: multicast RP failures (3.3.d), eBGP best-path
 * selection with weight (3.2.c), and QoS strict-priority queueing (1.4).
 *
 * Same engine contract as the rest of the catalog: two variants per lab
 * (different addressing/interfaces/symptoms/distractors), inspect →
 * diagnose → configure → verify, alternate commands accepted, and every fix
 * is variant-aware so a variant B fix never passes on variant A.
 */
export const LAB_TEMPLATES_EXTRA4: LabTemplate[] = [
  {
    id: "lab-multicast-rp",
    title: "Multicast flow never reaches receivers",
    objectiveIds: ["3.3.d"],
    skill: "troubleshoot",
    simulatorNote: "Multicast state here is text-based; on real IOS XE use show ip mroute, show ip pim rp mapping, and show ip pim neighbor to trace the tree. Practice a PIM-SM design with an RP on CML, EVE-NG, or a DevNet sandbox.",
    scenario: "A video source sends to group 239.1.1.10 and receivers are joined, but the flow never arrives — the rendezvous point problem.",
    variants: [
      {
        id: "a",
        label: "Variant A · no RP mapping",
        symptom: "show ip pim rp mapping lists nothing for 239.1.1.10 — the static RP was never configured, so no shared tree can be built.",
        addressing: "Source 10.1.0.10 → group 239.1.1.10; RP should be loopback 192.0.2.10 on R3",
        interfaces: "GigabitEthernet0/0 (transit), Loopback0 (RP)",
        distractors: ["ip igmp version 3", "ip pim dense-mode", "ip multicast-routing" ],
        values: { rpIp: "192.0.2.10", group: "239.1.1.10", fix: "ip pim rp-address 192.0.2.10", badRp: "none", transit: "GigabitEthernet0/0", rpfNbr: "10.1.0.2", outIface: "GigabitEthernet0/2" },
      },
      {
        id: "b",
        label: "Variant B · RP points at an unreachable address",
        symptom: "show ip pim rp mapping lists 203.0.113.1 for 239.1.1.10, but that address is unreachable — the real RP is 203.0.113.9 on R3.",
        addressing: "Source 172.16.0.10 → group 239.1.1.10; correct RP is 203.0.113.9, mapped to 203.0.113.1 by mistake",
        interfaces: "GigabitEthernet0/2 (transit), Loopback0 (RP)",
        distractors: ["ip igmp version 2", "ip pim sparse-mode", "ip multicast-routing"],
        values: { rpIp: "203.0.113.9", group: "239.1.1.10", fix: "ip pim rp-address 203.0.113.9", badRp: "203.0.113.1", transit: "GigabitEthernet0/2", rpfNbr: "172.16.0.2", outIface: "GigabitEthernet0/4" },
      },
    ],
    steps: [
      {
        kind: "inspect",
        title: "Inspect the multicast state",
        prompt: "Show the RP mapping and the multicast route table.",
        commands: ["show ip pim rp mapping", "show ip mroute", "show ip pim neighbor"],
        output: (variant) =>
          variant.values!.badRp === "none"
            ? `PIM Group-to-RP Mappings\n  (no mappings for group ${variant.values!.group})\n\nIP Multicast Routing Table\n(*, ${variant.values!.group}), 00:00:00/stopped — no RP, no tree\n`
            : `PIM Group-to-RP Mappings\n  ${variant.values!.group}: ${variant.values!.badRp} (unreachable — no route to RP)\n\nIP Multicast Routing Table\n(*, ${variant.values!.group}), 00:00:00/stopped — RP unreachable, no tree\n`,
        wrongHint: "The RP mapping is shown by show ip pim rp mapping.",
        explain: "Without a reachable RP there is no rendezvous point to join, so the shared tree never forms and receivers get nothing.",
      },
      {
        kind: "diagnose",
        title: "Diagnose the fault",
        prompt: "Receivers are joined and PIM is running on the path, yet the group has no tree. What is wrong?",
        options: [
          { value: "rp", title: "The RP is missing or unreachable", note: "No (or a bad) RP mapping means no shared tree" },
          { value: "pim", title: "PIM isn't enabled on the transit path", note: "show ip pim neighbor would be empty — it isn't" },
          { value: "igmp", title: "Receivers aren't sending IGMP joins", note: "The receivers are joined — the failure is upstream" },
        ],
        correct: "rp",
        wrongHint: "The inspect output shows the RP problem directly: no mapping at all, or a mapping to an unreachable address.",
        explain: "PIM-SM builds the shared tree via the RP; a missing or unreachable RP mapping leaves the group with no tree regardless of joins and PIM state.",
      },
      {
        kind: "configure",
        title: "Apply the fix",
        prompt: "Point the group at the reachable RP address.",
        acceptedCommands: (variant) => [variant.values!.fix],
        appliedOutput: (variant) =>
          `R1(config)# ip pim rp-address ${variant.values!.rpIp}\nR1(config)#\n%PIM-5-RP_CHANGE: RP for ${variant.values!.group} changed to ${variant.values!.rpIp}`,
        wrongHint: "The fix is ip pim rp-address <reachable-rp> — not an IGMP or PIM-mode command.",
        explain: "Registering the reachable RP lets the shared tree build: sources register with the RP and receivers join toward it.",
      },
      {
        kind: "verify",
        title: "Verify the tree",
        prompt: "Confirm the RP mapping resolves and the mroute is now active.",
        commands: ["show ip pim rp mapping", "show ip mroute"],
        output: (variant) =>
          `PIM Group-to-RP Mappings\n  ${variant.values!.group}: ${variant.values!.rpIp} (reachable)\n\nIP Multicast Routing Table\n(*, ${variant.values!.group}), 00:04:12/00:02:55, RP ${variant.values!.rpIp}, flags: SJC\n  Incoming interface: ${variant.values!.transit}, RPF nbr ${variant.values!.rpfNbr}\n  Outgoing interface list: ${variant.values!.outIface}, Forwarding\n`,
        wrongHint: "Re-run show ip pim rp mapping and show ip mroute — the RP should be reachable and the tree active.",
        explain: "A reachable RP plus an active (*,G) entry with forwarding state confirms the multicast flow now reaches the receivers.",
      },
    ],
  },
  {
    id: "lab-bgp-weight",
    title: "eBGP prefers the wrong path",
    objectiveIds: ["3.2.c"],
    skill: "troubleshoot",
    simulatorNote: "Best-path output here is simplified; on real IOS XE use show ip bgp <prefix> to see the full attribute table. Confirm weight behavior on a DevNet CSR1000v or CML lab.",
    scenario: "Two eBGP peers advertise the same prefix. The network should egress via the shorter AS path, but the router keeps marking the other path as best.",
    variants: [
      {
        id: "a",
        label: "Variant A · weight on the wrong neighbor",
        symptom: "Path via 192.0.2.2 (AS 65002) is the desired egress, but the path via 192.0.2.1 (AS 65001 65003) has weight 1000 and wins — the weight was set on the wrong neighbor.",
        addressing: "R1 peers: 192.0.2.1 (AS 65001) and 192.0.2.2 (AS 65002); prefix 10.1.0.0/24",
        interfaces: "GigabitEthernet0/0 → 192.0.2.1, GigabitEthernet0/1 → 192.0.2.2",
        distractors: ["bgp always-compare-med", "neighbor 192.0.2.1 route-map SET-MED in", "network 10.1.0.0 mask 255.255.255.0"],
        values: { preferredPeer: "192.0.2.2", wrongPeer: "192.0.2.1", prefix: "10.1.0.0/24", fix: "neighbor 192.0.2.2 weight 1000" },
      },
      {
        id: "b",
        label: "Variant B · weight on the wrong neighbor",
        symptom: "The path via 198.51.100.1 (AS 64501 64503) has weight 1000 from a stale config and wins, but egress should prefer the direct path via 198.51.100.2 (AS 64502).",
        addressing: "R1 peers: 198.51.100.1 (AS 64501) and 198.51.100.2 (AS 64502); prefix 172.16.0.0/24",
        interfaces: "GigabitEthernet0/3 → 198.51.100.1, GigabitEthernet0/4 → 198.51.100.2",
        distractors: ["bgp always-compare-med", "neighbor 198.51.100.1 route-map SET-MED in", "maximum-paths 2"],
        values: { preferredPeer: "198.51.100.2", wrongPeer: "198.51.100.1", prefix: "172.16.0.0/24", fix: "neighbor 198.51.100.2 weight 1000" },
      },
    ],
    steps: [
      {
        kind: "inspect",
        title: "Inspect the BGP table",
        prompt: "Show the BGP table entry for the prefix.",
        commands: (variant) => ["show ip bgp", `show ip bgp ${variant.values!.prefix}`],
        output: (variant) =>
          `BGP table version is 14, local router ID is 10.255.0.1\nStatus codes: s suppressed, d damped, h history, * valid, > best, i - internal\n\n   Network          Next Hop            Metric LocPrf Weight Path\n*> ${variant.values!.prefix.padEnd(13)} ${variant.values!.wrongPeer}                   0    100   1000 ${variant.id === "a" ? "65001 65003" : "64501 64503"} i\n*                   ${variant.values!.preferredPeer}                  0    100      0 ${variant.id === "a" ? "65002" : "64502"} i\n`,
        wrongHint: "The BGP table is shown by show ip bgp — look for the '>' marker and the weight/AS-path columns.",
        explain: "The '>' marks the best path; here it is the longer-AS-path entry because weight 1000 sits on the wrong neighbor and weight outranks AS path.",
      },
      {
        kind: "diagnose",
        title: "Diagnose the fault",
        prompt: "The shorter-AS path via the preferred peer should win, but the other path holds '>'. What is wrong?",
        options: [
          { value: "weight", title: "Weight is set on the wrong neighbor, or not set on the preferred one", note: "Weight is compared before AS path length" },
          { value: "med", title: "MED is misconfigured", note: "MED is compared after AS path — it can't override a shorter path" },
          { value: "peer-down", title: "The preferred peer is down", note: "Both paths are present and valid (*)" },
        ],
        correct: "weight",
        wrongHint: "The '>' path wins via weight (the highest-priority attribute) — fix where weight is applied, not MED or adjacency.",
        explain: "BGP compares weight first: the path from the neighbor holding weight 1000 wins regardless of AS path, so the weight must be (re)assigned to the preferred peer.",
      },
      {
        kind: "configure",
        title: "Apply the fix",
        prompt: "Give the preferred peer the higher weight so its path becomes best.",
        acceptedCommands: (variant) => [variant.values!.fix],
        appliedOutput: (variant) =>
          `R1(config)# router bgp 65000\nR1(config-router)# ${variant.values!.fix}\nR1(config-router)#\n%BGP-5-ADJCHANGE: neighbor ${variant.values!.preferredPeer} weight changed`,
        wrongHint: "The fix is neighbor <preferred-ip> weight 1000 under router bgp — not MED or multipath commands.",
        explain: "Weight is Cisco-local and checked first: assigning it to the preferred peer makes its path best immediately.",
      },
      {
        kind: "verify",
        title: "Verify the best path",
        prompt: "Confirm the '>' marker moved to the preferred peer's path.",
        commands: (variant) => ["show ip bgp", `show ip bgp ${variant.values!.prefix}`],
        output: (variant) =>
          `BGP table version is 15, local router ID is 10.255.0.1\n\n   Network          Next Hop            Metric LocPrf Weight Path\n*  ${variant.values!.prefix.padEnd(13)} ${variant.values!.wrongPeer}                   0    100   1000 ${variant.id === "a" ? "65001 65003" : "64501 64503"} i\n*>                  ${variant.values!.preferredPeer}                  0    100   1000 ${variant.id === "a" ? "65002" : "64502"} i\n`,
        wrongHint: "Re-run show ip bgp — the '>' should now sit on the preferred peer's path (weight ties, so the shorter AS path wins).",
        explain: "Both paths now hold weight 1000, so BGP falls to AS path length and the shorter path via the preferred peer becomes best.",
      },
    ],
  },
  {
    id: "lab-qos-priority",
    title: "Voice drops under congestion",
    objectiveIds: ["1.4"],
    skill: "troubleshoot",
    simulatorNote: "Queue behavior here is text-based; on real IOS XE use show policy-map interface to watch drops per class. Reproduce an MQC priority policy on CML or a DevNet device to see live queue counts.",
    scenario: "Voice quality collapses during peak hours, even though a QoS policy exists on the WAN interface — the voice class is treated as data, not strict priority.",
    variants: [
      {
        id: "a",
        label: "Variant A · bandwidth instead of priority",
        symptom: "Class VOICE uses bandwidth 30 — under congestion it competes with data and drops, instead of being served strictly first.",
        addressing: "WAN interface Gi0/0/0; policy-map QOS-OUT, class VOICE (EF) 30 Mbps of 100 Mbps",
        interfaces: "GigabitEthernet0/0/0 (WAN)",
        distractors: ["police 30000000", "service-policy output QOS-OUT", "class-map match-any DATA", "bandwidth 30"],
        values: { iface: "GigabitEthernet0/0/0", shortIface: "Gi0/0/0", fix: "priority 30", dscp: "EF", wrong: "bandwidth 30" },
      },
      {
        id: "b",
        label: "Variant B · police instead of priority",
        symptom: "Class VOICE is policed at 15 Mbps — bursts of voice are dropped on arrival instead of being queued strictly.",
        addressing: "WAN interface Gi0/0/2; policy-map QOS-OUT, class VOICE (EF) 15 Mbps of 50 Mbps",
        interfaces: "GigabitEthernet0/0/2 (WAN)",
        distractors: ["bandwidth 15", "service-policy input QOS-OUT", "class-map match-any DATA", "police 15000000"],
        values: { iface: "GigabitEthernet0/0/2", shortIface: "Gi0/0/2", fix: "priority 15", dscp: "EF", wrong: "police 15000000" },
      },
    ],
    steps: [
      {
        kind: "inspect",
        title: "Inspect the policy",
        prompt: "Show the policy map and the interface's queue behavior.",
        commands: ["show policy-map", "show policy-map interface", "show class-map"],
        output: (variant) =>
          `Policy Map QOS-OUT\n  Class VOICE\n    ${variant.values!.wrong} (DSCP ${variant.values!.dscp})\n  Class class-default\n    fair-queue\n\n${variant.values!.shortIface} output:\n  Class VOICE\n    ${variant.values!.wrong}\n    0 packets matched\n    (under congestion: voice packets share the queue with data and drop)`,
        wrongHint: "The policy is shown by show policy-map; the live behavior by show policy-map interface.",
        explain: "The voice class uses a non-strict treatment (bandwidth share or policing), so under congestion voice is dropped like data instead of being served first.",
      },
      {
        kind: "diagnose",
        title: "Diagnose the fault",
        prompt: "Voice is being dropped under congestion despite a QoS policy. What is wrong with the policy?",
        options: [
          { value: "strict", title: "The voice class lacks strict priority queueing", note: "priority is the strict-queue action; bandwidth/police are not" },
          { value: "marking", title: "Voice is marked with the wrong DSCP", note: "The class matches EF and the treatment is what's wrong" },
          { value: "direction", title: "The policy is applied in the wrong direction", note: "The policy is applied to the WAN output — the treatment is the fault" },
        ],
        correct: "strict",
        wrongHint: "The class is matched correctly but treated as data — the missing action is strict priority (priority <kbps>).",
        explain: "priority gives the class strict scheduling ahead of everything else; bandwidth guarantees a share and police drops bursts — neither protects voice like priority.",
      },
      {
        kind: "configure",
        title: "Apply the fix",
        prompt: "Give the voice class strict priority queueing.",
        acceptedCommands: (variant) => [variant.values!.fix],
        appliedOutput: (variant) =>
          `R1(config)# policy-map QOS-OUT\nR1(config-pmap)# class VOICE\nR1(config-pmap-c)# ${variant.values!.fix}\nR1(config-pmap-c)#\n%QOS-5-POLICY: policy-map QOS-OUT updated`,
        wrongHint: "The fix is priority <kbps> under class VOICE — not bandwidth, police, or a service-policy command.",
        explain: "priority places voice in the strict queue, so it is served before data and never competes for the bandwidth share.",
      },
      {
        kind: "verify",
        title: "Verify the queue",
        prompt: "Confirm the class now shows strict priority and zero voice drops.",
        commands: ["show policy-map", "show policy-map interface"],
        output: (variant) =>
          `Policy Map QOS-OUT\n  Class VOICE\n    Strict Priority (${variant.values!.fix})\n\n${variant.values!.shortIface} output:\n  Class VOICE\n    priority ${variant.values!.fix.split(" ")[1]}\n    0 packets dropped\n    (voice served first — no drops under congestion)`,
        wrongHint: "Re-run show policy-map interface — the class should show Strict Priority with no drops.",
        explain: "Strict priority with zero drops confirms voice now bypasses the shared queues entirely.",
      },
    ],
  },
];
