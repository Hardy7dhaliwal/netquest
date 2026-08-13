import type { LabTemplate } from "./labs";

/**
 * Blueprint-depth labs — fills the objective-level gaps found in the coverage
 * deep-dive: OSPFv3 (3.2.b), SNMP + syslog as diagnostic tools (4.1),
 * NTP/PTP interpretation (3.3.a), MST region/instance configuration (3.1.c),
 * VRF route leaking (2.2.a), GRE-over-IPsec phase-2 faults (2.2.b), and
 * TrustSec/MACsec session establishment (5.4.d).
 *
 * Same engine contract as the rest of the catalog: two variants per lab
 * (different addressing/interfaces/symptoms/distractors), inspect →
 * diagnose → configure → verify, alternate commands accepted, and every fix
 * is variant-aware so a variant B fix never passes on variant A.
 */
export const LAB_TEMPLATES_EXTRA3: LabTemplate[] = [
  {
    id: "lab-ospfv3",
    title: "OSPFv3 adjacency stuck at Down",
    objectiveIds: ["3.2.b"],
    skill: "troubleshoot",
    simulatorNote: "OSPFv3 behavior here is text-based; on real IOS XE the neighbor table, process id, and area must all line up. Confirm with show ipv6 ospf neighbor and show ipv6 ospf interface on a DevNet sandbox or CML device running IPv6.",
    scenario: "Two IPv6 routers share a subnet and both run an OSPFv3 process, but no adjacency ever forms — the neighbor table stays empty.",
    variants: [
      {
        id: "a",
        label: "Variant A · process 1, area 0",
        symptom: "R2 never appears in show ipv6 ospf neighbor — Gi0/0 has an IPv6 address but is not enabled for OSPFv3.",
        addressing: "R1 Gi0/0 = 2001:db8:1::1/64, R2 Gi0/0 = 2001:db8:1::2/64, process 1 area 0",
        interfaces: "GigabitEthernet0/0 on both routers",
        distractors: ["network 2001:db8:1::/64 area 0", "ip ospf 1 area 0", "router ospf 1"],
        values: { iface: "GigabitEthernet0/0", pid: "1", fix: "ipv6 ospf 1 area 0" },
      },
      {
        id: "b",
        label: "Variant B · process 10, area 0",
        symptom: "R2 never appears in show ipv6 ospf neighbor — Gi0/2 is addressed but OSPFv3 was never enabled on it.",
        addressing: "R1 Gi0/2 = 2001:db8:2::1/64, R2 Gi0/2 = 2001:db8:2::2/64, process 10 area 0",
        interfaces: "GigabitEthernet0/2 on both routers",
        distractors: ["network 2001:db8:2::/64 area 0", "ip ospf 10 area 0", "router ospf 10"],
        values: { iface: "GigabitEthernet0/2", pid: "10", fix: "ipv6 ospf 10 area 0" },
      },
    ],
    steps: [
      {
        kind: "inspect",
        title: "Inspect the OSPFv3 state",
        prompt: "Show the OSPFv3 neighbor table and the interface's OSPFv3 status.",
        commands: (variant) => [`show ipv6 ospf ${variant.values!.pid} neighbor`, "show ipv6 ospf neighbor", `show ipv6 ospf interface ${variant.values!.iface}`],
        output: (variant) =>
          `Neighbor ID     Pri   State           Dead Time   Address         Interface\n(no neighbors found)\n\n${variant.values!.iface} is up, line protocol is up\n  Internet Address : FE80::1\n  Process ID ${variant.values!.pid}, Router ID 1.1.1.1\n  (interface not enabled for OSPFv3)`,
        wrongHint: "The OSPFv3 state is shown by show ipv6 ospf neighbor and show ipv6 ospf interface.",
        explain: "The interface is addressed and the process exists, but OSPFv3 is not enabled on the interface — so no hellos are sourced and no adjacency forms.",
      },
      {
        kind: "diagnose",
        title: "Diagnose the fault",
        prompt: "The IPv6 addresses are on the same subnet and a process exists, yet no neighbor appears. What is wrong?",
        options: [
          { value: "not-enabled", title: "OSPFv3 is not enabled on the interface itself", note: "OSPFv3 enables per-interface, not with a network statement" },
          { value: "link-local", title: "The link-local addresses are missing", note: "A configured IPv6 address implies a link-local — they exist" },
          { value: "process", title: "The process id is wrong on one side", note: "Process ids need not match across neighbors; the interface enable is the missing piece" },
        ],
        correct: "not-enabled",
        wrongHint: "The inspect output explicitly says the interface is not enabled for OSPFv3 — the process exists but the interface isn't in it.",
        explain: "OSPFv3 requires ipv6 ospf <pid> area <n> on the interface; without it, the interface sources no hellos and no adjacency forms.",
      },
      {
        kind: "configure",
        title: "Apply the fix",
        prompt: "Enable OSPFv3 for the process on the interface (entered under interface configuration).",
        acceptedCommands: (variant) => [variant.values!.fix],
        appliedOutput: (variant) =>
          `R1(config)# interface ${variant.values!.iface}\nR1(config-if)# ${variant.values!.fix}\nR1(config-if)#\n%OSPFv3-5-ADJCHG: Process ${variant.values!.pid}, Nbr 2.2.2.2 on ${variant.values!.iface} from DOWN to FULL, Done`,
        wrongHint: "The fix is the interface command ipv6 ospf <pid> area <n> — not an IPv4 network statement or router ospf.",
        explain: "Enabling OSPFv3 on the interface sources hellos over the link-local address, and the adjacency climbs to FULL.",
      },
      {
        kind: "verify",
        title: "Verify the adjacency",
        prompt: "Confirm the OSPFv3 neighbor is now FULL.",
        commands: (variant) => [`show ipv6 ospf ${variant.values!.pid} neighbor`, "show ipv6 ospf neighbor"],
        output: (variant) =>
          `Neighbor ID     Pri   State           Dead Time   Address         Interface\n2.2.2.2         1     FULL/  -        00:00:36    FE80::2         ${variant.values!.iface}`,
        wrongHint: "Re-run show ipv6 ospf neighbor — the state column should read FULL.",
        explain: "FULL confirms the OSPFv3 adjacency formed over link-local and LSAs are exchanging.",
      },
    ],
  },
  {
    id: "lab-snmp-syslog",
    title: "The NOC can't read the router",
    objectiveIds: ["4.1"],
    skill: "troubleshoot",
    simulatorNote: "SNMP/syslog behavior here is text-based; on real IOS XE verify with show snmp community, show snmp, and show logging. Reproduce on a CML or DevNet sandbox device to watch counters live.",
    scenario: "Monitoring is broken in two ways: the NOC's polling or its event stream is not reaching the network. Read the outputs and fix the fault.",
    variants: [
      {
        id: "a",
        label: "Variant A · SNMP poll fails",
        symptom: "The NOC polls interface counters with community 'netops-ro', but the router only accepts 'cisco' — every get times out.",
        addressing: "Router mgmt IP 192.0.2.1; NOC polls with community netops-ro (v2c)",
        interfaces: "Management interface Loopback0",
        distractors: ["snmp-server enable traps", "logging trap 5", "snmp-server location NOC-1"],
        values: { fix: "snmp-server community netops-ro ro", checkCmd: "show snmp community", bad: "cisco", good: "netops-ro" },
      },
      {
        id: "b",
        label: "Variant B · syslog events missing",
        symptom: "The collector receives nothing, even though logging is configured — the trap level is set to 3 (errors only), so notifications like interface flaps (severity 5) are dropped.",
        addressing: "Router mgmt IP 198.51.100.1; syslog collector 203.0.113.50",
        interfaces: "Management interface Loopback0",
        distractors: ["snmp-server community public ro", "logging source-interface loopback0", "snmp-server enable traps"],
        values: { fix: "logging trap 5", checkCmd: "show logging", bad: "3", good: "5" },
      },
    ],
    steps: [
      {
        kind: "inspect",
        title: "Inspect the monitoring config",
        prompt: "Show how the device answers monitoring (SNMP community or syslog forwarding).",
        commands: ["show snmp community", "show logging", "show snmp"],
        output: (variant) =>
          variant.values!.checkCmd === "show snmp community"
            ? `Community name: ${variant.values!.bad}\n  Community Access: read-only\n  Access-list name: (none)\n\n(no community named '${variant.values!.good}')`
            : `Syslog logging: enabled (0 messages dropped, 2 messages rate-limited)\n    Trap logging: level errors, 0 message lines logged\n\n(collector 203.0.113.50 configured — nothing arrives because the trap level excludes notifications)`,
        wrongHint: "The monitoring state is shown by show snmp community (SNMP) or show logging (syslog).",
        explain: "The wrong SNMP community (or a trap level that filters out the events) is silently blocking monitoring.",
      },
      {
        kind: "diagnose",
        title: "Diagnose the fault",
        prompt: "The device forwards traffic fine but monitoring gets nothing. What is wrong?",
        options: [
          { value: "mismatch", title: "The device's monitoring config doesn't match what the collector expects", note: "A wrong SNMP community or a trap level that filters events" },
          { value: "reachability", title: "The device is unreachable from the NOC", note: "The device forwards traffic — reachability is fine" },
          { value: "traps", title: "SNMP traps are disabled", note: "Traps push; they don't affect polling or syslog forwarding" },
        ],
        correct: "mismatch",
        wrongHint: "The inspect output shows the mismatch directly — the poll community or the syslog trap level.",
        explain: "For variant A the accepted SNMP community doesn't match the NOC's get; for variant B the trap level (3) drops the severity-5 notifications the collector needs.",
      },
      {
        kind: "configure",
        title: "Apply the fix",
        prompt: "Make the device answer the NOC's monitoring (match the community or raise the syslog trap level).",
        acceptedCommands: (variant) => [variant.values!.fix],
        appliedOutput: (variant) =>
          variant.values!.checkCmd === "show snmp community"
            ? `R1(config)# snmp-server community ${variant.values!.good} ro\nR1(config)#\n%SNMP-5-MODIFY: SNMP community ${variant.values!.good} added`
            : `R1(config)# logging trap ${variant.values!.good}\nR1(config)#\n%SYS-5-CONFIG_I: Configured from console — trap level now ${variant.values!.good}`,
        wrongHint: "Match the exact community the NOC polls with, or raise logging trap to the severity the collector needs.",
        explain: "Accepting the NOC's community lets v2c polling succeed; logging trap 5 forwards notifications (severity 5) and everything more severe.",
      },
      {
        kind: "verify",
        title: "Verify monitoring",
        prompt: "Confirm the device now answers polling or forwards events.",
        commands: ["show snmp community", "show logging", "show snmp"],
        output: (variant) =>
          variant.values!.checkCmd === "show snmp community"
            ? `Community name: ${variant.values!.good}\n  Community Access: read-only\n  Access-list name: (none)\n\nSNMP packets sent/received: 0/24`
            : `Syslog logging: enabled (0 messages dropped)\n    Trap logging: level notifications, 5 message lines logged\n\ninterface GigabitEthernet0/1, changed state to up (logged to 203.0.113.50)`,
        wrongHint: "Re-run the check — the matching community or the forwarded event should now appear.",
        explain: "A poll answer (rising SNMP counters) or a forwarded syslog event proves monitoring is working end to end.",
      },
    ],
  },
  {
    id: "lab-ntp-ptp",
    title: "Logs disagree on event times",
    objectiveIds: ["3.3.a"],
    skill: "troubleshoot",
    simulatorNote: "Time behavior here is text-based; on real devices verify with show ntp status/associations or show ptp clock/port. Practice against a real NTP server and a PTP domain on CML or a DevNet sandbox.",
    scenario: "Network devices disagree on time, so correlated logs are useless. The right fix depends on whether the fault is NTP (millisecond sync) or PTP (microsecond sync).",
    variants: [
      {
        id: "a",
        label: "Variant A · NTP stratum 16",
        symptom: "The router polls its NTP server but the association shows stratum 16 (unsynchronized) — the server itself has no valid time source.",
        addressing: "Router NTP client → server 192.0.2.1 (unsynchronized); the good server is 10.10.0.1",
        interfaces: "Management interface Loopback0",
        distractors: ["ntp server 203.0.113.5", "clock timezone UTC 0", "ntp broadcast"],
        values: { fix: "ntp server 10.10.0.1", checkCmd: "show ntp status", bad: "192.0.2.1", good: "10.10.0.1", stratum: "2" },
      },
      {
        id: "b",
        label: "Variant B · PTP grandmaster not elected",
        symptom: "The intended master has priority1 128 and the backup 129, but both claim the same default — the BMCA can't decide, so no grandmaster is elected and sync never starts.",
        addressing: "PTP domain 0; SW-A intended grandmaster, SW-B backup",
        interfaces: "GigabitEthernet0/1 on both switches",
        distractors: ["ntp master 4", "ptp domain 1", "clock timezone UTC 0"],
        values: { fix: "ptp priority1 127", checkCmd: "show ptp clock", bad: "128", good: "127", stratum: "grandmaster" },
      },
    ],
    steps: [
      {
        kind: "inspect",
        title: "Inspect time sync state",
        prompt: "Show the NTP association/status or the PTP clock state.",
        commands: (variant) => [variant.values!.checkCmd, "show ntp associations", "show ptp clock", "show ptp port"],
        output: (variant) =>
          variant.values!.checkCmd === "show ntp status"
            ? `Clock is unsynchronized, stratum 16, no reference clock\n  reference clock: 192.0.2.1 (stratum 16 — unsynchronized)\n  nominal freq: 250.0000 Hz, actual freq: 250.0000 Hz`
            : `PTP Ordinary Clock\n  Domain 0\n  Clock identity : 0x34:23:87:ff:fe:9a:cc:01\n  Priority1 : 128, Priority2 : 128, Clock class : 248\n  State : LISTENING (no grandmaster elected)`,
        wrongHint: "NTP state is show ntp status; PTP state is show ptp clock.",
        explain: "The NTP server is unsynchronized (stratum 16), or the PTP BMCA cannot elect a grandmaster because both devices advertise the same default priority.",
      },
      {
        kind: "diagnose",
        title: "Diagnose the fault",
        prompt: "Time sync is configured but never takes effect. What is the cause?",
        options: [
          { value: "bad-source", title: "The configured time source can't synchronize the device", note: "A stratum-16 NTP server, or no elected PTP grandmaster" },
          { value: "timezone", title: "The timezone is configured wrong", note: "Timezone shifts the display; it doesn't break synchronization" },
          { value: "domain", title: "The NTP/PTP domain is wrong", note: "A wrong domain would show no association at all, not a hung source" },
        ],
        correct: "bad-source",
        wrongHint: "The output shows the real cause: stratum 16, or two devices tied on priority with no elected grandmaster.",
        explain: "For variant A a stratum-16 server has nothing to give; for variant B the BMCA needs a clear priority winner before any port leaves LISTENING.",
      },
      {
        kind: "configure",
        title: "Apply the fix",
        prompt: "Point NTP at a synchronized server, or give the intended PTP master a winning priority.",
        acceptedCommands: (variant) => [variant.values!.fix],
        appliedOutput: (variant) =>
          variant.values!.checkCmd === "show ntp status"
            ? `R1(config)# ntp server 10.10.0.1\nR1(config)#\n%NTP-5-SYNC: Clock synchronized to 10.10.0.1, stratum 2`
            : `SW-A(config)# ptp priority1 127\nSW-A(config)#\n%PTP-5-GM: Grandmaster elected — clock identity 0x34:23:87:ff:fe:9a:cc:01, state MASTER`,
        wrongHint: "For NTP, configure the synchronized server; for PTP, set a winning priority1 on the intended master.",
        explain: "A stratum-2 NTP server synchronizes the client; a lower priority1 (127 < 128) makes the BMCA elect the intended grandmaster.",
      },
      {
        kind: "verify",
        title: "Verify time sync",
        prompt: "Confirm the clock is now synchronized or the grandmaster is elected.",
        commands: (variant) => [variant.values!.checkCmd, "show ntp associations", "show ptp clock"],
        output: (variant) =>
          variant.values!.checkCmd === "show ntp status"
            ? `Clock is synchronized, stratum 2, reference is 10.10.0.1\n  reference clock: 10.10.0.1\n  nominal freq: 250.0000 Hz\n  actual offset: 0.014 ms`
            : `PTP Ordinary Clock\n  Domain 0\n  Clock identity : 0x34:23:87:ff:fe:9a:cc:01\n  Priority1 : 127, Priority2 : 128, Clock class : 248\n  State : MASTER (grandmaster — ports in MASTER state)`,
        wrongHint: "Re-run the check — synchronized stratum 2, or a MASTER-state grandmaster, confirms the fix.",
        explain: "A non-16 stratum (or an elected grandmaster) proves time sync is now working end to end.",
      },
    ],
  },
  {
    id: "lab-mst",
    title: "MST roots diverge across the boundary",
    objectiveIds: ["3.1.c"],
    skill: "troubleshoot",
    simulatorNote: "MST behavior here is text-based; on real switches use show spanning-tree mst configuration and show spanning-tree mst. Practice region design on CML, EVE-NG, or a DevNet switch sandbox.",
    scenario: "Two switches are configured for MST, but VLANs that should be load-balanced across instances are all blocking on one uplink — the region is split.",
    variants: [
      {
        id: "a",
        label: "Variant A · map mismatch on SW2",
        symptom: "SW1 maps VLANs 1-10 to instance 1; SW2 maps VLANs 1-20 to instance 1 — the maps differ, so the region splits and VLAN 20's traffic behaves unpredictably.",
        addressing: "SW1 ↔ SW2 uplink; VLANs 1-10 in instance 1 (SW1), SW2 also folds VLANs 11-20 in",
        interfaces: "GigabitEthernet0/1 on both switches",
        distractors: ["spanning-tree mst 0 priority 4096", "spanning-tree mode rapid-pvst", "spanning-tree vlan 20 root primary"],
        values: { fix: "spanning-tree mst 1 vlan 1-10" },
      },
      {
        id: "b",
        label: "Variant B · revision mismatch",
        symptom: "SW1 and SW2 have the same name and VLAN map, but SW2 still has revision 0 while SW1 is revision 2 — different revisions split the region.",
        addressing: "SW1 ↔ SW2 uplink; region name CAMPUS, SW1 revision 2, SW2 revision 0",
        interfaces: "GigabitEthernet0/3 on both switches",
        distractors: ["spanning-tree mst 0 priority 8192", "spanning-tree mode mst", "spanning-tree mst 2 vlan 1-10"],
        values: { fix: "revision 2" },
      },
    ],
    steps: [
      {
        kind: "inspect",
        title: "Inspect the MST region config",
        prompt: "Show the MST configuration (name, revision, and VLAN map) on this switch.",
        commands: ["show spanning-tree mst configuration", "show spanning-tree mst"],
        output: (variant) =>
          `Name      : CAMPUS\nRevision  : ${variant.id === "a" ? "2" : "0"}\nInstance  Vlans mapped\n--------  ------------------------------------------\n0         none\n1         1-${variant.id === "a" ? "20" : "10"}\n\n(This switch reports root 4c00.1234.0001 for instance 1; the far end reports a different root)`,
        wrongHint: "The MST region attributes are shown by show spanning-tree mst configuration.",
        explain: "The region name, revision, or VLAN map differs from the peer, so the switches form separate regions and the same instance runs two different trees.",
      },
      {
        kind: "diagnose",
        title: "Diagnose the fault",
        prompt: "Both switches run MST and use the same instance number, yet they report different roots. What is wrong?",
        options: [
          { value: "region", title: "A region attribute (map or revision) doesn't match the peer", note: "Name, revision, and map must all agree" },
          { value: "priority", title: "The instance priority is too high on one side", note: "Priority affects root choice within one region, not a split" },
          { value: "mode", title: "One switch is running rapid-PVST", note: "A mode mismatch would show per-VLAN trees, not a divergent MST root" },
        ],
        correct: "region",
        wrongHint: "Different roots for the same instance number is the signature of a region split — the region attributes disagree.",
        explain: "An MST region is defined by name + revision + VLAN map; any mismatch makes the two switches treat each other as a separate region with independent instances.",
      },
      {
        kind: "configure",
        title: "Apply the fix",
        prompt: "Align the region so both switches share one MST region (fix the map or the revision).",
        acceptedCommands: (variant) => [variant.values!.fix],
        appliedOutput: (variant) =>
          variant.values!.fix === "revision 2"
            ? `SW2(config)# spanning-tree mst configuration\nSW2(config-mst)# revision 2\nSW2(config-mst)#\n%MSTP-5-REGION_CHANGE: MST region configuration changed`
            : `SW2(config)# spanning-tree mst 1 vlan 1-10\nSW2(config)#\n%MSTP-5-REGION_CHANGE: MST region configuration changed`,
        wrongHint: "For variant A the map command is spanning-tree mst 1 vlan 1-10 (global config); for variant B the revision is set as revision 2 inside spanning-tree mst configuration.",
        explain: "Matching the map (variant A) or the revision (variant B) merges the switches into one region, so instance 1 runs a single consistent tree.",
      },
      {
        kind: "verify",
        title: "Verify the region",
        prompt: "Confirm both switches now agree on the instance root.",
        commands: ["show spanning-tree mst configuration", "show spanning-tree mst"],
        output: () =>
          `Name      : CAMPUS\nRevision  : 2\nInstance  Vlans mapped\n--------  ------------------------------------------\n0         none\n1         1-10\n\nMST1 Root: 4c00.1234.0001  (both switches report the same root)`,
        wrongHint: "Re-run show spanning-tree mst — the same root for the instance confirms the region is shared.",
        explain: "One region with one root per instance proves the map/revision now match and MST is working as designed.",
      },
    ],
  },
  {
    id: "lab-vrf",
    title: "VRF route leaking broken",
    objectiveIds: ["2.2.a"],
    skill: "troubleshoot",
    simulatorNote: "VRF behavior here is text-based; on real IOS XE verify with show ip vrf, show ip route vrf, and the route-target import/export lines. Practice VRF-lite leaking on a CML or DevNet sandbox router.",
    scenario: "Customer A's VRF must reach a shared subnet that lives in Customer B's VRF, but the leak was never completed — traffic to the shared prefix is black-holed.",
    variants: [
      {
        id: "a",
        label: "Variant A · missing export RT",
        symptom: "The shared route 10.0.0.0/24 is connected in CUST-A, and CUST-B imports RT 65000:100 — but CUST-A never exports that RT, so the route never leaks to CUST-B.",
        addressing: "10.0.0.0/24 connected in CUST-A (Gi0/0); CUST-B imports 65000:100; the export side on CUST-A is missing",
        interfaces: "Gi0/0 in CUST-A, Gi0/1 in CUST-B",
        distractors: ["ip vrf forwarding CUST-B", "ip route vrf CUST-B 10.0.0.0 255.255.255.0 10.1.1.1", "route-target import 65000:100"],
        values: { vrf: "CUST-A", target: "CUST-B", shared: "10.0.0.0/24", fix: "route-target export 65000:100" },
      },
      {
        id: "b",
        label: "Variant B · wrong import RT",
        symptom: "CUST-A exports RT 65000:100 for 172.16.0.0/24, but CUST-B imports 65000:200 by mistake — the shared route is never imported.",
        addressing: "172.16.0.0/24 connected in CUST-A; CUST-B imports 65000:200 (wrong RT) instead of 65000:100",
        interfaces: "Gi0/0 in CUST-A, Gi0/1 in CUST-B",
        distractors: ["ip vrf forwarding CUST-A", "ip route vrf CUST-B 172.16.0.0 255.255.255.0 10.2.2.2", "route-target export 65000:300"],
        values: { vrf: "CUST-B", target: "CUST-B", shared: "172.16.0.0/24", fix: "route-target import 65000:100" },
      },
    ],
    steps: [
      {
        kind: "inspect",
        title: "Inspect the VRF route-targets",
        prompt: "Show the VRF definitions and the VRF routing table.",
        commands: ["show ip vrf", "show ip route vrf CUST-A", "show ip route vrf CUST-B", "show run | section vrf"],
        output: (variant) =>
          variant.id === "a"
            ? `VRF CUST-A; VPN RD 65000:1\n  import route-target: 65000:100\n  export route-target: (none)\n\n${variant.values!.shared} is directly connected, GigabitEthernet0/0 (in CUST-A)\n\nVRF CUST-B; VPN RD 65000:2\n  import route-target: 65000:100\n  export route-target: (none)\n\n(no route to ${variant.values!.shared} in CUST-B's table)`
            : `VRF CUST-A; VPN RD 65000:1\n  import route-target: (none)\n  export route-target: 65000:100\n\n${variant.values!.shared} is directly connected, GigabitEthernet0/0 (in CUST-A)\n\nVRF CUST-B; VPN RD 65000:2\n  import route-target: 65000:200\n  export route-target: (none)\n\n(no route to ${variant.values!.shared} in CUST-B's table)`,
        wrongHint: "The VRF route-targets are shown by show ip vrf or the running-config vrf section.",
        explain: "The source VRF holds the shared prefix, but the route-targets don't line up — the exporter never exports (variant A) or the importer accepts the wrong RT (variant B) — so the prefix never leaks.",
      },
      {
        kind: "diagnose",
        title: "Diagnose the fault",
        prompt: "The shared subnet is configured on one side but never appears in the other VRF. What is wrong?",
        options: [
          { value: "rt-mismatch", title: "The import/export route-targets don't match", note: "Route leaking is driven by matching RTs" },
          { value: "no-vrf", title: "The interfaces aren't in the VRFs", note: "Interface assignment matters for forwarding, but the route exchange itself is the RT match" },
          { value: "no-route", title: "There is no static route to the shared prefix", note: "The prefix exists in the source VRF — the leak is what's missing" },
        ],
        correct: "rt-mismatch",
        wrongHint: "The inspect output shows the RTs explicitly — one side exports or imports a value the other never uses.",
        explain: "VRF-to-VRF leaking happens via matching route-targets: the exporter must advertise the same RT the importer is configured to accept.",
      },
      {
        kind: "configure",
        title: "Apply the fix",
        prompt: "Complete the route-target so the shared prefix leaks into the other VRF (entered under vrf definition).",
        acceptedCommands: (variant) => [variant.values!.fix],
        appliedOutput: (variant) =>
          `R1(config)# vrf definition ${variant.values!.vrf}\nR1(config-vrf)# ${variant.values!.fix}\nR1(config-vrf)#\n%VRF-5-UPDATED: VRF ${variant.values!.vrf} route-target updated`,
        wrongHint: "The fix is the route-target import/export command under the vrf definition, matched to the peer's RT.",
        explain: "Adding the matching RT (export on A, or the correct import RT on B) lets the shared prefix leak between the two VRF tables.",
      },
      {
        kind: "verify",
        title: "Verify the leak",
        prompt: "Confirm the shared prefix now appears in the importer VRF's table (CUST-B).",
        commands: ["show ip route vrf CUST-B", "show ip route vrf CUST-A", "show ip vrf"],
        output: (variant) =>
          `Routing Table: ${variant.values!.target}\nCodes: C - connected, S - static, R - RIP, O - OSPF, B - BGP\n\n${variant.values!.shared} [1/0] via 10.1.1.2, GigabitEthernet0/1`,
        wrongHint: "Re-run show ip route vrf CUST-B — the shared prefix should now be present in the importer's table.",
        explain: "The shared prefix visible in CUST-B's table confirms the leak is complete and the importer can route to it.",
      },
    ],
  },
  {
    id: "lab-gre-ipsec",
    title: "Tunnel up, phase 2 dead",
    objectiveIds: ["2.2.b"],
    skill: "troubleshoot",
    simulatorNote: "Crypto behavior here is text-based; on real IOS XE use show crypto isakmp sa and show crypto ipsec sa to trace the phases. Reproduce GRE-over-IPsec on a DevNet CSR1000v or CML lab to see live SA negotiation.",
    scenario: "A GRE-over-IPsec tunnel between two sites is up at the interface level, but no data flows — phase 2 never completes because the crypto map's access list matches the wrong traffic.",
    variants: [
      {
        id: "a",
        label: "Variant A · ACL matches inner subnets",
        symptom: "The crypto ACL permits 10.0.0.0/24 → 10.0.1.0/24 (inner private subnets) instead of the GRE flow between WAN addresses — phase 2 never negotiates.",
        addressing: "R1 WAN 203.0.113.1 ↔ R2 WAN 203.0.113.2; inner subnets 10.0.0.0/24 and 10.0.1.0/24",
        interfaces: "Tunnel0 (GRE), GigabitEthernet0/1 (WAN)",
        distractors: ["crypto ipsec transform-set TS esp-aes esp-sha-hmac", "crypto isakmp key cisco address 203.0.113.2", "interface tunnel0 tunnel source loopback0"],
        values: { srcWan: "203.0.113.1", dstWan: "203.0.113.2", fix: "access-list 101 permit gre host 203.0.113.1 host 203.0.113.2", acl: "101" },
      },
      {
        id: "b",
        label: "Variant B · ACL permits the wrong pair",
        symptom: "The crypto ACL permits GRE from 198.51.100.1 to 198.51.100.2, but the tunnel actually runs between 198.51.100.5 and 198.51.100.6 — the matched flow never exists.",
        addressing: "R1 WAN 198.51.100.5 ↔ R2 WAN 198.51.100.6; tunnel inner 172.16.0.0/24 ↔ 172.16.1.0/24",
        interfaces: "Tunnel0 (GRE), GigabitEthernet0/3 (WAN)",
        distractors: ["crypto ipsec transform-set TS esp-aes esp-sha-hmac", "crypto isakmp key cisco address 198.51.100.6", "interface tunnel0 tunnel source loopback0"],
        values: { srcWan: "198.51.100.5", dstWan: "198.51.100.6", fix: "access-list 102 permit gre host 198.51.100.5 host 198.51.100.6", acl: "102" },
      },
    ],
    steps: [
      {
        kind: "inspect",
        title: "Inspect the crypto state",
        prompt: "Show the IKE and IPsec SA state and the crypto ACL.",
        commands: ["show crypto isakmp sa", "show crypto ipsec sa", "show access-lists"],
        output: (variant) =>
          `IPv4 Crypto ISAKMP SA\nState: QM_IDLE (phase 1 complete)\n\nIPv4 Crypto IPSec SAs: (no active SAs)\n\nExtended IP access list ${variant.values!.acl}\n    10 permit gre host ${variant.id === "a" ? "10.0.0.1" : "198.51.100.1"} host ${variant.id === "a" ? "10.0.1.1" : "198.51.100.2"}  (0 matches)`,
        wrongHint: "IKE state is show crypto isakmp sa; IPsec SAs are show crypto ipsec sa; the ACL is show access-lists.",
        explain: "Phase 1 is up (QM_IDLE) but phase 2 never negotiates — the crypto ACL isn't matching the GRE flow that actually traverses the tunnel.",
      },
      {
        kind: "diagnose",
        title: "Diagnose the fault",
        prompt: "IKE phase 1 is complete, but no IPsec SAs exist and nothing flows. What is wrong?",
        options: [
          { value: "acl-flow", title: "The crypto ACL doesn't match the GRE flow between the WAN addresses", note: "Phase 2 only negotiates for traffic the ACL matches" },
          { value: "phase1", title: "Phase 1 failed", note: "QM_IDLE means phase 1 succeeded" },
          { value: "transform", title: "The transform set is undefined", note: "A bad transform set fails the proposal — but the ACL is the visible mismatch here" },
        ],
        correct: "acl-flow",
        wrongHint: "The crypto ACL shows zero matches for the real GRE flow — phase 2 has nothing to protect, so no IPsec SAs form.",
        explain: "In GRE-over-IPsec the crypto ACL must match the outer GRE flow (protocol 47 between WAN addresses); matching inner subnets (or the wrong pair) starves phase 2.",
      },
      {
        kind: "configure",
        title: "Apply the fix",
        prompt: "Rewrite the crypto ACL to match the GRE flow between the two WAN endpoints.",
        acceptedCommands: (variant) => [variant.values!.fix],
        appliedOutput: (variant) =>
          `R1(config)# ${variant.values!.fix}\nR1(config)#\n%CRYPTO-5-SA_ESTABLISHED: IPsec SA established between ${variant.values!.srcWan} and ${variant.values!.dstWan}`,
        wrongHint: "The ACL must permit gre between the WAN addresses — the tunnel endpoints, not the inner subnets.",
        explain: "Matching the GRE flow lets phase 2 negotiate IPsec SAs that protect the tunnel, carrying the private traffic inside.",
      },
      {
        kind: "verify",
        title: "Verify phase 2",
        prompt: "Confirm active IPsec SAs now exist.",
        commands: ["show crypto ipsec sa", "show crypto isakmp sa", "show access-lists"],
        output: (variant) =>
          `IPv4 Crypto IPSec SAs\n  INBOUND: encr aes, hash sha, from ${variant.values!.dstWan} to ${variant.values!.srcWan}, SA created\n  OUTBOUND: encr aes, hash sha, from ${variant.values!.srcWan} to ${variant.values!.dstWan}, SA created\n\nExtended IP access list ${variant.values!.acl}\n    10 permit gre host ${variant.values!.srcWan} host ${variant.values!.dstWan}  (47 matches)`,
        wrongHint: "Re-run show crypto ipsec sa — active inbound/outbound SAs confirm phase 2 completed.",
        explain: "Established IPsec SAs plus rising ACL match counters prove the tunnel is protected and data now flows.",
      },
    ],
  },
  {
    id: "lab-trustsec-macsec",
    title: "The link refuses to encrypt",
    objectiveIds: ["5.4.d"],
    skill: "troubleshoot",
    simulatorNote: "MACsec/MKA behavior here is text-based; on real switches use show mka sessions and show macsec summary. Practice MKA with a PSK key chain or 802.1X-derived keys on CML, EVE-NG, or a DevNet switch sandbox.",
    scenario: "Two switches with MACsec configured are connected, but the link passes plaintext — the MKA session never activates because the peers disagree on the key or the cipher suite.",
    variants: [
      {
        id: "a",
        label: "Variant A · PSK chain mismatch",
        symptom: "SW1 references key chain MKA-KEYS with key 'Cisco123'; SW2 references key chain MKA-KEYS with key 'Cisco456' — the PSKs differ, so MKA never forms.",
        addressing: "SW1 Gi0/1 ↔ SW2 Gi0/1; both run macsec + mka with the same chain name but different key strings",
        interfaces: "GigabitEthernet0/1 on both switches",
        distractors: ["mka policy default", "macsec cipher-suite gcm-aes-128", "switchport mode trunk"],
        values: { iface: "GigabitEthernet0/1", fix: "key string Cisco123" },
      },
      {
        id: "b",
        label: "Variant B · cipher suite mismatch",
        symptom: "SW1 negotiates gcm-aes-256 while SW2 only offers gcm-aes-128 — the cipher suites never agree, so the session stays down.",
        addressing: "SW1 Gi0/3 ↔ SW2 Gi0/3; both share the same PSK but offer different cipher suites",
        interfaces: "GigabitEthernet0/3 on both switches",
        distractors: ["key string Cisco123", "mka policy default", "switchport mode trunk"],
        values: { iface: "GigabitEthernet0/3", fix: "macsec cipher-suite gcm-aes-256" },
      },
    ],
    steps: [
      {
        kind: "inspect",
        title: "Inspect the MACsec session",
        prompt: "Show the MKA session and MACsec status.",
        commands: ["show mka sessions", "show macsec summary", "show macsec status"],
        output: (variant) =>
          variant.values!.fix.startsWith("key")
            ? `MKA Session on ${variant.values!.iface}\n  Status: NOT-ACTIVE (PSK mismatch — peer is not responding to MKA)\n  Key server : none\n  Cipher suite: gcm-aes-128\n\n(no MACsec SecY session — traffic flowing in clear)`
            : `MKA Session on ${variant.values!.iface}\n  Status: NOT-ACTIVE (cipher suite negotiation failed)\n  Key server : none\n  Local cipher suite: gcm-aes-256 (peer offers only gcm-aes-128)`,
        wrongHint: "The MKA state is shown by show mka sessions.",
        explain: "MKA is not active: the peers can't agree on the pre-shared key or on a common cipher suite, so no SecY session encrypts the link.",
      },
      {
        kind: "diagnose",
        title: "Diagnose the fault",
        prompt: "Both switches run MACsec with the same chain name, yet the session stays down. What is wrong?",
        options: [
          { value: "key-cipher", title: "The peers don't share the same key or a common cipher suite", note: "MKA needs matching credentials and algorithms" },
          { value: "macsec-off", title: "MACsec isn't enabled on the interface", note: "macsec is configured — the failure is in MKA agreement" },
          { value: "trunk", title: "The link isn't a trunk", note: "MACsec works on access or trunk links — the mode isn't the blocker" },
        ],
        correct: "key-cipher",
        wrongHint: "The MKA output names the mismatch directly: PSK mismatch, or a cipher suite the peer doesn't offer.",
        explain: "MKA activates only when both peers share the same key material and negotiate a common cipher suite — any mismatch leaves the link unencrypted.",
      },
      {
        kind: "configure",
        title: "Apply the fix",
        prompt: "Align the key or the cipher suite so MKA can establish.",
        acceptedCommands: (variant) => [variant.values!.fix],
        appliedOutput: (variant) =>
          variant.values!.fix.startsWith("key")
            ? `SW2(config)# key chain MKA-KEYS\nSW2(config-keychain)# key 1\nSW2(config-keychain-key)# key string Cisco123\nSW2(config-keychain-key)#\n%MKA-5-SESSION: MKA session established on ${variant.values!.iface}`
            : `SW2(config)# interface ${variant.values!.iface}\nSW2(config-if)# ${variant.values!.fix}\nSW2(config-if)#\n%MKA-5-SESSION: MKA session established on ${variant.values!.iface}`,
        wrongHint: "For variant A fix the key string to match the peer; for variant B offer the same cipher suite the peer uses.",
        explain: "Matching the PSK (or the cipher suite) lets MKA establish, and the SecY session begins encrypting the link.",
      },
      {
        kind: "verify",
        title: "Verify the session",
        prompt: "Confirm the MKA session is active and MACsec is encrypting.",
        commands: ["show mka sessions", "show macsec summary"],
        output: (variant) =>
          `MKA Session on ${variant.values!.iface}\n  Status: ACTIVE (SecY)\n  Key server : this device\n  Cipher suite: ${variant.values!.fix.startsWith("key") ? "gcm-aes-128" : "gcm-aes-256"}\n\nMACsec summary: 1 active session — traffic encrypted on ${variant.values!.iface}`,
        wrongHint: "Re-run show mka sessions — an ACTIVE SecY session confirms the link now encrypts.",
        explain: "An active MKA session with a SecY cipher suite proves MACsec is encrypting the link between the switches.",
      },
    ],
  },
];
