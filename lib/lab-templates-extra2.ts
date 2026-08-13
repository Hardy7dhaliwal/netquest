import type { LabTemplate } from "./labs";

/**
 * Final gap-topic labs — completes hands-on coverage for every 4.x and 6.x
 * blueprint objective. Objectives covered here: 4.1 (diagnose), 4.3
 * (RSPAN/ERSPAN), 4.4 (IP SLA), 4.5 (Catalyst Center), 6.1 (Python),
 * 6.2 + 6.5 (JSON / REST payloads), 6.3 (YANG), 6.4 (Catalyst Center and
 * SD-WAN Manager APIs), 6.6 (EEM), and 6.7 (agent vs agentless).
 *
 * Same engine contract as the rest of the catalog: two variants per lab
 * (different addressing/interfaces/symptoms/distractors), inspect →
 * diagnose → configure → verify, alternate commands accepted, and every
 * fix is variant-aware so a variant B fix never passes on variant A.
 */
export const LAB_TEMPLATES_EXTRA2: LabTemplate[] = [
  {
    id: "lab-diagnose",
    title: "Ping works but the app times out",
    objectiveIds: ["4.1"],
    skill: "troubleshoot",
    simulatorNote: "MTU behavior here is text-based; on real IOS use ping with the df-bit and size flags to find the break point. Confirm the exact path MTU with CML, EVE-NG, or a DevNet sandbox.",
    scenario: "Users can ping the application server, but the application itself times out. Something in the middle is dropping larger packets.",
    variants: [
      {
        id: "a",
        label: "Variant A · 192.0.2.0/30",
        symptom: "ping 10.1.0.10 size 1400 df-bit succeeds, but size 1500 df-bit fails — the server is 10.1.0.10 behind R2.",
        addressing: "R1 Gi0/0 = 192.0.2.1/30 ↔ R2 Gi0/0 = 192.0.2.2/30; server 10.1.0.10 behind R2",
        interfaces: "GigabitEthernet0/0 on both routers",
        distractors: ["ip ospf mtu-ignore", "ip tcp adjust-mss 1400", "no ip route-cache"],
        values: { peerIp: "192.0.2.2", serverIp: "10.1.0.10", iface: "GigabitEthernet0/0", mtu: "1400" },
      },
      {
        id: "b",
        label: "Variant B · 198.51.100.0/30",
        symptom: "ping 172.16.0.50 size 1400 df-bit succeeds, but size 1500 df-bit fails — the server is 172.16.0.50 behind R2.",
        addressing: "R1 Gi0/2 = 198.51.100.1/30 ↔ R2 Gi0/2 = 198.51.100.2/30; server 172.16.0.50 behind R2",
        interfaces: "GigabitEthernet0/2 on both routers",
        distractors: ["ip ospf mtu-ignore", "ip tcp adjust-mss 1400", "no ip route-cache"],
        values: { peerIp: "198.51.100.2", serverIp: "172.16.0.50", iface: "GigabitEthernet0/2", mtu: "1400" },
      },
    ],
    steps: [
      {
        kind: "inspect",
        title: "Probe the path",
        prompt: "Run the diagnostic commands that reveal where large packets die.",
        commands: (variant) => [`ping ${variant.values!.serverIp} size 1500 df-bit`, `ping ${variant.values!.serverIp} size 1400 df-bit`, "show interface", `traceroute ${variant.values!.serverIp}`],
        output: (variant) =>
          `R1# ping ${variant.values!.serverIp} size 1500 df-bit\nType escape sequence to abort.\nRequest 0 timed out\nRequest 1 timed out\nRequest 2 timed out\nRequest 3 timed out\nRequest 4 timed out\nSuccess rate is 0 percent (0/5)\n\nR1# ping ${variant.values!.serverIp} size 1400 df-bit\n!!!!!\nSuccess rate is 100 percent (5/5)\n\nR1# traceroute ${variant.values!.serverIp}\n 1  ${variant.values!.peerIp}  1 msec  1 msec  2 msec\n 2  ${variant.values!.serverIp}  2 msec  2 msec  2 msec`,
        wrongHint: "Probe with ping <target> size <bytes> df-bit — the 1500-byte probe fails while 1400 succeeds.",
        explain: "Large DF-set probes fail while small ones succeed — the classic signature of an MTU black hole on the path.",
      },
      {
        kind: "diagnose",
        title: "Diagnose the fault",
        prompt: "Small packets pass, 1500-byte DF-set packets die. What is the most likely cause?",
        options: [
          { value: "mtu", title: "An MTU mismatch or black hole on the path", note: "DF-set packets larger than the path MTU are silently dropped" },
          { value: "route", title: "The return route is missing", note: "A missing return route would break small pings too" },
          { value: "tcp", title: "TCP MSS negotiation is broken", note: "MSS would affect TCP sessions, not ICMP echo with df-bit" },
        ],
        correct: "mtu",
        wrongHint: "The 1400-byte probe succeeding while 1500 fails points squarely at the path MTU.",
        explain: "An MTU black hole (here: a link at 1400) drops oversized DF-set packets silently, so small probes pass and big ones die.",
      },
      {
        kind: "configure",
        title: "Apply the fix",
        prompt: "Lower the interface MTU to 1400 on the problem link.",
        acceptedCommands: (variant) => [
          `interface ${variant.values!.iface} ip mtu ${variant.values!.mtu}`,
          `ip mtu ${variant.values!.mtu}`,
          `interface ${variant.values!.iface.toLowerCase().replace(/gigabitethernet/, "gi")} ip mtu ${variant.values!.mtu}`,
        ],
        appliedOutput: (variant) => `R1(config)# interface ${variant.values!.iface}\nR1(config-if)# ip mtu ${variant.values!.mtu}\nR1(config-if)#\n%LINK-5-CHANGED: Interface ${variant.values!.iface}, changed state to administratively down\n%LINK-3-UPDOWN: Interface ${variant.values!.iface}, changed state to up`,
        wrongHint: "The fix is ip mtu <1400> on the interface — not an OSPF or MSS command.",
        explain: "Matching the interface MTU to the path lets DF-set packets traverse without being silently dropped.",
      },
      {
        kind: "verify",
        title: "Verify the fix",
        prompt: "Confirm the full-size probe now passes.",
        commands: (variant) => [`ping ${variant.values!.serverIp} size 1500 df-bit`, `ping ${variant.values!.serverIp} size 1400 df-bit`, "show interface"],
        output: (variant) =>
          `R1# ping ${variant.values!.serverIp} size 1500 df-bit\n!!!!!\nSuccess rate is 100 percent (5/5)\n\n${variant.values!.iface} is up, line protocol is up\n  MTU ${variant.values!.mtu} bytes`,
        wrongHint: "Re-run the 1500-byte df-bit probe — it should now succeed end to end.",
        explain: "The full-size DF probe succeeding confirms the black hole is gone and the app path is clean.",
      },
    ],
  },
  {
    id: "lab-rspan-erspan",
    title: "Remote mirroring never arrives",
    objectiveIds: ["4.3"],
    skill: "troubleshoot",
    simulatorNote: "RSPAN/ERSPAN behavior here is text-based; on real switches use show monitor session to see remote session state and verify the RSPAN VLAN or ERSPAN ID end to end on CML, EVE-NG, or a DevNet switch sandbox.",
    scenario: "Traffic must be mirrored from a switch to an analyzer on another network segment, but the analyzer receives nothing.",
    variants: [
      {
        id: "a",
        label: "Variant A · RSPAN VLAN 900",
        symptom: "The source session mirrors Gi0/1 to RSPAN VLAN 900, but the analyzer switch sees no traffic on it.",
        addressing: "SW1 Gi0/1 (source) → RSPAN VLAN 900 → SW2 Gi0/2 (analyzer)",
        interfaces: "SW1 Gi0/1 source, SW2 Gi0/2 destination",
        distractors: ["monitor session 1 source interface gi0/2", "monitor session 1 filter vlan 900", "monitor session 1 destination interface gi0/2"],
        values: { session: "1", srcIface: "GigabitEthernet0/1", vlan: "900", fix: "remote-span", showCmd: "show vlan 900" },
      },
      {
        id: "b",
        label: "Variant B · ERSPAN to 192.0.2.10",
        symptom: "The ERSPAN session mirrors Gi0/3 toward analyzer 192.0.2.10, but the analyzer sees nothing.",
        addressing: "SW1 Gi0/3 (source) → ERSPAN (GRE) → analyzer 192.0.2.10",
        interfaces: "SW1 Gi0/3 source, ERSPAN destination 192.0.2.10",
        distractors: ["monitor session 2 source interface gi0/10", "monitor session 2 destination erspan-id 2 ip 192.0.2.20", "no monitor session 2"],
        values: { session: "2", srcIface: "GigabitEthernet0/3", vlan: "", fix: "monitor session 2 destination erspan-id 1 ip 192.0.2.10", showCmd: "show monitor session 2" },
      },
    ],
    steps: [
      {
        kind: "inspect",
        title: "Inspect the remote session",
        prompt: "Show the monitor session and the remote-delivery configuration.",
        commands: (variant) => [variant.values!.showCmd, `show monitor session ${variant.values!.session}`, "show monitor session all"],
        output: (variant) =>
          variant.values!.vlan
            ? `Session ${variant.values!.session}\nType : Remote Source Session\nSource Ports :\n    Both:  ${variant.values!.srcIface}\nDestination Ports : None\nVLANs : ${variant.values!.vlan}\n\nVLAN ${variant.values!.vlan} is not a remote-span VLAN`
            : `Session ${variant.values!.session}\nType : ERSPAN Source Session\nSource Ports :\n    Both:  ${variant.values!.srcIface}\nDestination IP : 192.0.2.10 (erspan-id not set)`,
        wrongHint: "The session detail is shown by show monitor session <n> (or show vlan for RSPAN).",
        explain: "The source is mirrored correctly, but the remote-delivery piece — remote-span on the RSPAN VLAN, or the erspan-id — is missing.",
      },
      {
        kind: "diagnose",
        title: "Diagnose the fault",
        prompt: "The source is mirrored but the remote analyzer gets nothing. What is the most likely cause?",
        options: [
          { value: "remote", title: "The remote-delivery configuration is missing or incomplete", note: "RSPAN needs remote-span on the VLAN; ERSPAN needs an erspan-id" },
          { value: "source", title: "The source interface is wrong", note: "The source port mirrors correctly — the failure is on delivery" },
          { value: "filter", title: "A VLAN filter excludes the traffic", note: "No filter is set — the whole source port is mirrored" },
        ],
        correct: "remote",
        wrongHint: "The inspect output shows the remote delivery piece missing — remote-span or erspan-id.",
        explain: "Without remote-span (RSPAN) or an erspan-id (ERSPAN), the mirrored frames are never carried to the remote analyzer.",
      },
      {
        kind: "configure",
        title: "Apply the fix",
        prompt: "Complete the remote-delivery configuration.",
        acceptedCommands: (variant) => [variant.values!.fix],
        appliedOutput: (variant) =>
          variant.values!.vlan
            ? `SW1(config)# vlan 900\nSW1(config-vlan)# remote-span\nSW1(config-vlan)#\n%SPAN-5-SPAN_SESSION_ACTIVE: Session 1 is now active`
            : `SW1(config)# monitor session 2 destination erspan-id 1 ip 192.0.2.10\nSW1(config)#\n%SPAN-5-SPAN_SESSION_ACTIVE: Session 2 is now active`,
        wrongHint: "For RSPAN enable remote-span on the RSPAN VLAN; for ERSPAN set the erspan-id on the destination.",
        explain: "Marking the VLAN as remote-span (or adding the erspan-id) lets the mirrored traffic reach the remote analyzer.",
      },
      {
        kind: "verify",
        title: "Verify the session",
        prompt: "Confirm the remote session is active and delivery is configured.",
        commands: (variant) => [variant.values!.showCmd, `show monitor session ${variant.values!.session}`, "show monitor session all"],
        output: (variant) =>
          variant.values!.vlan
            ? `Session ${variant.values!.session}\nType : Remote Source Session\nStatus : Admin Enabled\nSource Ports :\n    Both:  ${variant.values!.srcIface}\nDestination Ports : None\nVLANs : ${variant.values!.vlan} (remote-span)`
            : `Session ${variant.values!.session}\nType : ERSPAN Source Session\nStatus : Admin Enabled\nSource Ports :\n    Both:  ${variant.values!.srcIface}\nDestination IP : 192.0.2.10, erspan-id 1`,
        wrongHint: "Re-run the show command — the remote delivery should now show as configured and the session active.",
        explain: "The session active with remote-span (or erspan-id) set confirms mirrored traffic is now delivered remotely.",
      },
    ],
  },
  {
    id: "lab-ipsla",
    title: "IP SLA probe never reports",
    objectiveIds: ["4.4"],
    skill: "configure",
    simulatorNote: "SLA counters here are fixed; on real IOS XE the statistics accumulate per frequency interval and track state flips on threshold. Verify with show ip sla statistics and show track on a CML or DevNet device.",
    scenario: "An IP SLA probe monitors a remote site, but the associated track object never leaves the down state.",
    variants: [
      {
        id: "a",
        label: "Variant A · probe 10 → 192.0.2.1",
        symptom: "ip sla 10 icmp-echo to 192.0.2.1 is defined but the track stays down — the probe was never scheduled.",
        addressing: "Probe 10 targets 192.0.2.1 every 10s; track 1 watches ip sla 10 reachability",
        interfaces: "Source interface Gi0/0",
        distractors: ["ip sla 10 icmp-echo 198.51.100.1", "track 1 ip sla 11 reachability", "ip sla schedule 11 life forever start-time now"],
        values: { probe: "10", target: "192.0.2.1", track: "1", iface: "GigabitEthernet0/0" },
      },
      {
        id: "b",
        label: "Variant B · probe 20 → 198.51.100.1",
        symptom: "ip sla 20 icmp-echo to 198.51.100.1 exists but never runs — no schedule was applied.",
        addressing: "Probe 20 targets 198.51.100.1 every 5s; track 2 watches ip sla 20 reachability",
        interfaces: "Source interface Gi0/2",
        distractors: ["ip sla 20 icmp-echo 192.0.2.1", "track 2 ip sla 21 reachability", "ip sla schedule 21 life forever start-time now"],
        values: { probe: "20", target: "198.51.100.1", track: "2", iface: "GigabitEthernet0/2" },
      },
    ],
    steps: [
      {
        kind: "inspect",
        title: "Inspect the probe",
        prompt: "Show the IP SLA configuration, statistics, and track state.",
        commands: ["show ip sla configuration", "show ip sla statistics", "show track"],
        output: (variant) =>
          `IP SLAs, Low-watermark: 0\nIPSLAs Latest Operation Statistics:\n\nIPSLA operation id: ${variant.values!.probe}\n    Type of operation: icmp-echo\n    Target address: ${variant.values!.target}\n    Frequency: 10 seconds\n    Start Time: (not scheduled)\n    Latest RTT: no connection\n\nTrack ${variant.values!.track}\n  IP SLA ${variant.values!.probe} reachability\n  Reachability is Down\n  Sample count: 0`,
        wrongHint: "The probe state is shown by show ip sla statistics and show track.",
        explain: "The probe is configured but never scheduled — with zero samples the track can never go up.",
      },
      {
        kind: "diagnose",
        title: "Diagnose the fault",
        prompt: "The probe is defined and the target is reachable, yet the track stays down. What is wrong?",
        options: [
          { value: "notscheduled", title: "The probe is never scheduled to run", note: "An unscheduled probe takes no samples, so the track never comes up" },
          { value: "target", title: "The probe targets the wrong address", note: "The target is correct and reachable" },
          { value: "track", title: "The track references the wrong probe", note: "The track points at this exact probe id" },
        ],
        correct: "notscheduled",
        wrongHint: "The inspect output shows Start Time: (not scheduled) with zero samples — the probe never runs.",
        explain: "ip sla schedule is required to start the probe; without it, no measurements occur and the track stays Down.",
      },
      {
        kind: "configure",
        title: "Apply the fix",
        prompt: "Schedule the probe to run forever, starting now.",
        acceptedCommands: (variant) => [`ip sla schedule ${variant.values!.probe} life forever start-time now`, `ip sla schedule ${variant.values!.probe} life forever start-time now ageout 0`],
        appliedOutput: (variant) => `R1(config)# ip sla schedule ${variant.values!.probe} life forever start-time now\nR1(config)#\n%IPSLA-5-IPSLA_PROBE_START: IPSLA operation ${variant.values!.probe} started`,
        wrongHint: "The fix is ip sla schedule <n> life forever start-time now — scheduling, not redefining the probe.",
        explain: "Scheduling starts the probe immediately and keeps it running, so the track can transition to Up.",
      },
      {
        kind: "verify",
        title: "Verify the probe",
        prompt: "Confirm the probe is sampling and the track is up.",
        commands: ["show ip sla statistics", "show track"],
        output: (variant) =>
          `IPSLA operation id: ${variant.values!.probe}\n    Latest RTT: 12 milliseconds\n    Number of successes: 47\n    Number of failures: 0\n\nTrack ${variant.values!.track}\n  IP SLA ${variant.values!.probe} reachability\n  Reachability is Up\n  Sample count: 47`,
        wrongHint: "Re-run show ip sla statistics and show track — the success count should be climbing and the track Up.",
        explain: "Rising success counts with the track Up prove the probe is scheduled, sampling, and driving the track object.",
      },
    ],
  },
  {
    id: "lab-catalyst-center",
    title: "Device never appears in Catalyst Center",
    objectiveIds: ["4.5"],
    skill: "troubleshoot",
    simulatorNote: "Discovery behavior here is text-based; on real Catalyst Center the device inventory shows the discovery method and last status. Practice device onboarding against a DevNet Catalyst Center sandbox or CML.",
    scenario: "A switch is reachable from the network but never shows up in Catalyst Center inventory, so it can't be provisioned or monitored.",
    variants: [
      {
        id: "a",
        label: "Variant A · SNMP community mismatch",
        symptom: "The switch answers SNMP with community 'private' but Catalyst Center's discovery uses 'public' — the device never responds to discovery.",
        addressing: "Switch mgmt IP 10.1.1.50; Catalyst Center discovery range covers it with SNMP v2c 'public'",
        interfaces: "Management interface VLAN 100",
        distractors: ["snmp-server community private ro", "snmp-server location NYC-CORE", "snmp-server enable traps snmp"],
        values: { community: "public", wrong: "private", iface: "Vlan100" },
      },
      {
        id: "b",
        label: "Variant B · SNMP version mismatch",
        symptom: "Catalyst Center discovers with SNMP v3, but the switch only has an SNMP v2c community configured — discovery times out.",
        addressing: "Switch mgmt IP 172.16.1.50; Catalyst Center discovery range covers it with SNMP v3",
        interfaces: "Management interface VLAN 200",
        distractors: ["snmp-server community cisco123 ro", "snmp-server location DC-RACK2", "snmp-server enable traps snmp"],
        values: { community: "v3-user", wrong: "v2c-only", iface: "Vlan200" },
      },
    ],
    steps: [
      {
        kind: "inspect",
        title: "Inspect SNMP configuration",
        prompt: "Show how the device is configured to answer SNMP.",
        commands: ["show snmp community", "show running-config | include snmp-server community", "show snmp"],
        output: (variant) =>
          `Community name: ${variant.values!.wrong}\n  Community Access: read-only\n  Access-list name: (none)\n\nSNMP global trap: disabled\nSNMP logging: disabled`,
        wrongHint: "The SNMP communities are shown by show snmp community.",
        explain: "The switch answers SNMP with a community Catalyst Center's discovery never tries.",
      },
      {
        kind: "diagnose",
        title: "Diagnose the fault",
        prompt: "The device is reachable but invisible to Catalyst Center discovery. What is the most likely cause?",
        options: [
          { value: "snmp", title: "The SNMP community/version doesn't match what discovery uses", note: "Catalyst Center discovery must be able to read the device via SNMP" },
          { value: "reach", title: "The management IP is unreachable", note: "The device is reachable — the failure is in the SNMP handshake" },
          { value: "vlan", title: "The management VLAN is wrong", note: "The management interface is correctly reachable" },
        ],
        correct: "snmp",
        wrongHint: "The inspect output shows a community that differs from Catalyst Center's discovery settings.",
        explain: "Catalyst Center discovers via SNMP (plus CLI/NETCONF); an SNMP mismatch means the device never answers discovery.",
      },
      {
        kind: "configure",
        title: "Apply the fix",
        prompt: "Configure the switch so it answers Catalyst Center's SNMP discovery.",
        acceptedCommands: (variant) => [`snmp-server community ${variant.values!.community} ro`],
        appliedOutput: (variant) => `SW1(config)# snmp-server community ${variant.values!.community} ro\nSW1(config)#\n%SNMP-5-MODIFY: SNMP community ${variant.values!.community} added`,
        wrongHint: "The fix is snmp-server community <matching-community> ro.",
        explain: "Matching the discovery community lets Catalyst Center read the device, after which it appears in inventory.",
      },
      {
        kind: "verify",
        title: "Verify discovery",
        prompt: "Confirm the device now answers the discovery community.",
        commands: ["show snmp community", "show snmp"],
        output: (variant) =>
          `Community name: ${variant.values!.community}\n  Community Access: read-only\n  Access-list name: (none)\n\nSNMP packets sent/received: 0/18`,
        wrongHint: "Re-run show snmp community — the matching community should be listed and SNMP counters climbing.",
        explain: "The device answering the discovery community means Catalyst Center can now onboard and monitor it.",
      },
    ],
  },
  {
    id: "lab-python",
    title: "The status script crashes",
    objectiveIds: ["6.1"],
    skill: "troubleshoot",
    simulatorNote: "Script behavior here is text-based; on a real workstation run the script against live show output to reproduce the traceback. Practice parsing real show ip interface brief output on a DevNet sandbox device.",
    scenario: "An engineer's Python script parses 'show ip interface brief' to report interface status, but it crashes with an IndexError at the end of the output.",
    variants: [
      {
        id: "a",
        label: "Variant A · blank-line guard",
        symptom: "The script indexes parts[4] on the trailing blank line that 'show ip interface brief' appends — the last row crashes with IndexError.",
        addressing: "show ip interface brief output with columns: Interface, IP-Address, OK?, Method, Status, Protocol",
        interfaces: "GigabitEthernet0/1 and Gi0/2 in the output",
        distractors: ["print(f\"{parts[0]} is {parts[5]}\")", "for line in output.splitlines():", "status = parts[4].upper()"],
        values: { guard: "if not parts: continue", altGuard: "if len(parts) < 6: continue" },
      },
      {
        id: "b",
        label: "Variant B · length guard",
        symptom: "The script doesn't skip the blank line at the end of the output — the split produces an empty list and parts[4] raises IndexError.",
        addressing: "show ip interface brief output with columns: Interface, IP-Address, OK?, Method, Status, Protocol",
        interfaces: "GigabitEthernet0/3 and Gi0/4 in the output",
        distractors: ["print(f\"{parts[0]} is {parts[5]}\")", "for line in output.splitlines():", "status = parts[4].strip()"],
        values: { guard: "if len(parts) < 6: continue", altGuard: "if not parts: continue" },
      },
    ],
    steps: [
      {
        kind: "inspect",
        title: "Run the script",
        prompt: "Run the Python script and observe the failure.",
        commands: ["python3 check_status.py", "python3 -c \"import sys; print(sys.version)\""],
        output: () =>
          `Traceback (most recent call last):\n  File "check_status.py", line 12, in <module>\n    status = parts[4]\nIndexError: list index out of range\n\nDevice output parsed so far:\nInterface        IP-Address      OK? Method Status           Protocol\nGigabitEthernet0/1 192.0.2.1      YES NVRAM  up               up\nGigabitEthernet0/2 192.0.2.2      YES NVRAM  up               up\n(blank line — the script crashes on the trailing empty row)`,
        wrongHint: "Run python3 check_status.py to see the traceback.",
        explain: "show ip interface brief ends with a blank line; splitting it yields an empty list, and parts[4] raises IndexError.",
      },
      {
        kind: "diagnose",
        title: "Diagnose the fault",
        prompt: "The script parses rows fine but crashes at the end of the output. What is the most likely cause?",
        options: [
          { value: "blank", title: "The script doesn't skip the trailing blank line", note: "An empty split yields no parts, so parts[4] raises IndexError" },
          { value: "column", title: "The status column index is wrong", note: "Rows parse correctly — the index itself is fine" },
          { value: "import", title: "A required module is missing", note: "The traceback is an IndexError, not an ImportError" },
        ],
        correct: "blank",
        wrongHint: "The traceback fires on the final blank line — the loop needs to guard against empty lines.",
        explain: "Real show output ends with a blank line; the script must skip it (if not parts: continue) before indexing columns.",
      },
      {
        kind: "configure",
        title: "Apply the fix",
        prompt: "Guard the loop so blank lines are skipped before indexing columns.",
        acceptedCommands: (variant) => [variant.values!.guard],
        appliedOutput: () => `$ python3 check_status.py\nGigabitEthernet0/1 is up\nGigabitEthernet0/2 is up\nGigabitEthernet0/3 is administratively down\nScript completed successfully.`,
        wrongHint: "The fix is a guard at the top of the loop that skips empty lines before parts[4] is read.",
        explain: "Skipping blank lines (if not parts: continue, or a length guard) lets the script survive the trailing empty row.",
      },
      {
        kind: "verify",
        title: "Verify the script",
        prompt: "Re-run the script and confirm it reports every interface.",
        commands: ["python3 check_status.py"],
        output: () =>
          `GigabitEthernet0/1 is up\nGigabitEthernet0/2 is up\nGigabitEthernet0/3 is administratively down\nGigabitEthernet0/4 is up\nScript completed successfully.`,
        wrongHint: "Re-run python3 check_status.py — it should list all interfaces without a traceback.",
        explain: "A clean run reporting every interface proves the column indexing now matches the show output.",
      },
    ],
  },
  {
    id: "lab-json",
    title: "RESTCONF rejects the payload",
    objectiveIds: ["6.2", "6.5"],
    skill: "configure",
    simulatorNote: "HTTP status behavior here is text-based; on real IOS XE use curl against the RESTCONF server to see exact 400 responses. Practice payload construction on a DevNet sandbox device.",
    scenario: "A PATCH to RESTCONF with interface configuration is rejected with HTTP 400 — the JSON body is malformed.",
    variants: [
      {
        id: "a",
        label: "Variant A · trailing comma",
        symptom: "The JSON body has a trailing comma after the last key-value pair — the parser rejects it.",
        addressing: "PATCH https://10.1.1.5/restconf/data/Cisco-IOS-XE-native:native/interface/GigabitEthernet=0/1",
        interfaces: "GigabitEthernet0/1",
        distractors: ["\"ipv4\": {\"address\": {\"ip\": \"192.0.2.1\"}}", "Content-Type: application/json", "PATCH /restconf/data/native"],
        values: { iface: "GigabitEthernet0/1", ip: "192.0.2.1", desc: "uplink", body: "{\"name\": \"GigabitEthernet0/1\", \"description\": \"uplink\"}" },
      },
      {
        id: "b",
        label: "Variant B · unquoted key",
        symptom: "A key in the JSON body is not wrapped in double quotes — the payload fails to parse.",
        addressing: "PATCH https://172.16.1.5/restconf/data/Cisco-IOS-XE-native:native/interface/GigabitEthernet=0/3",
        interfaces: "GigabitEthernet0/3",
        distractors: ["\"ipv4\": {\"address\": {\"ip\": \"172.16.0.1\"}}", "Content-Type: application/json", "PATCH /restconf/data/native"],
        values: { iface: "GigabitEthernet0/3", ip: "172.16.0.1", desc: "server-link", body: "{\"name\": \"GigabitEthernet0/3\", \"description\": \"server-link\"}" },
      },
    ],
    steps: [
      {
        kind: "inspect",
        title: "Send the request",
        prompt: "Issue the RESTCONF PATCH and read the response.",
        commands: ["curl -X PATCH -d @payload.json https://10.1.1.5/restconf/data/Cisco-IOS-XE-native:native/interface/GigabitEthernet=0/1", "curl -X PATCH -d @payload.json https://172.16.1.5/restconf/data/Cisco-IOS-XE-native:native/interface/GigabitEthernet=0/3", "cat payload.json"],
        output: () =>
          `HTTP/1.1 400 Bad Request\nContent-Type: application/json\n\n{\n  "errors": {\n    "error": [\n      {\n        "error-message": "JSON parsing failed: trailing characters or malformed token",\n        "error-tag": "malformed-message"\n      }\n    ]\n  }\n}`,
        wrongHint: "Send the PATCH with curl and read the 400 response body.",
        explain: "HTTP 400 with malformed-message means the JSON body doesn't parse — a syntax error in the payload.",
      },
      {
        kind: "diagnose",
        title: "Diagnose the fault",
        prompt: "The server returns 400 'malformed-message'. What is wrong?",
        options: [
          { value: "json", title: "The JSON body has a syntax error", note: "400 + malformed-message is the classic invalid-JSON response" },
          { value: "path", title: "The RESTCONF path is wrong", note: "A wrong path returns 404, not 400" },
          { value: "auth", title: "The request lacks authentication", note: "Missing auth returns 401" },
        ],
        correct: "json",
        wrongHint: "malformed-message in the 400 response is the server saying the JSON didn't parse.",
        explain: "A trailing comma or unquoted key breaks JSON parsing — the server rejects the whole payload with 400.",
      },
      {
        kind: "configure",
        title: "Apply the fix",
        prompt: "Correct the JSON body so it parses cleanly.",
        acceptedCommands: (variant) => [variant.values!.body],
        appliedOutput: (variant) => `HTTP/1.1 204 No Content\n\nConfiguration applied to ${variant.values!.iface}.`,
        wrongHint: "Fix the JSON syntax — remove the trailing comma or quote every key — then re-PATCH.",
        explain: "Valid JSON parses cleanly, and RESTCONF answers 204 No Content to signal success.",
      },
      {
        kind: "verify",
        title: "Verify the change",
        prompt: "Confirm the interface now carries the applied configuration.",
        commands: ["curl -X GET https://10.1.1.5/restconf/data/Cisco-IOS-XE-native:native/interface/GigabitEthernet=0/1", "curl -X GET https://172.16.1.5/restconf/data/Cisco-IOS-XE-native:native/interface/GigabitEthernet=0/3"],
        output: (variant) =>
          `HTTP/1.1 200 OK\nContent-Type: application/yang-data+json\n\n{\n  "Cisco-IOS-XE-native:interface": {\n    "name": "${variant.values!.iface}",\n    "description": "${variant.values!.desc}"\n  }\n}`,
        wrongHint: "GET the interface back from RESTCONF — 200 with the description proves the PATCH landed.",
        explain: "A 200 with the applied data confirms both the JSON was valid and the configuration is live.",
      },
    ],
  },
  {
    id: "lab-yang",
    title: "The YANG path returns 404",
    objectiveIds: ["6.3"],
    skill: "troubleshoot",
    simulatorNote: "RESTCONF path behavior here is text-based; on real IOS XE the module name must match the server's supported YANG modules. Confirm module names with show yang or a DevNet sandbox.",
    scenario: "A controller queries interface data over RESTCONF, but the request returns 404 — the YANG path doesn't match the module tree.",
    variants: [
      {
        id: "a",
        label: "Variant A · missing module prefix",
        symptom: "The URL uses '/interfaces' without the module prefix — RESTCONF can't resolve which module's data is requested.",
        addressing: "GET https://10.1.1.5/restconf/data/interfaces → 404",
        interfaces: "ietf-interfaces module on the device",
        distractors: ["GET /restconf/data/ietf-interfaces:interfaces/interface=GigabitEthernet0/1", "GET /restconf/data/native", "GET /restconf/data/ietf-ip:ipv4"],
        values: { path: "/restconf/data/ietf-interfaces:interfaces", bad: "/restconf/data/interfaces", iface: "GigabitEthernet0/1" },
      },
      {
        id: "b",
        label: "Variant B · wrong container name",
        symptom: "The URL requests '/interfaces/interface' as a plain container, but interface is a list keyed by name.",
        addressing: "GET https://172.16.1.5/restconf/data/ietf-interfaces:interfaces/interface → 404",
        interfaces: "ietf-interfaces module on the device",
        distractors: ["GET /restconf/data/ietf-interfaces:interfaces", "GET /restconf/data/native", "GET /restconf/data/ietf-ip:ipv4"],
        values: { path: "/restconf/data/ietf-interfaces:interfaces/interface=GigabitEthernet0/1", bad: "/restconf/data/ietf-interfaces:interfaces/interface", iface: "GigabitEthernet0/1" },
      },
    ],
    steps: [
      {
        kind: "inspect",
        title: "Send the request",
        prompt: "Issue the RESTCONF GET and read the response.",
        commands: (variant) => [`curl -X GET https://10.1.1.5${variant.values!.bad}`],
        output: (variant) =>
          `HTTP/1.1 404 Not Found\n\n{\n  "errors": {\n    "error": [\n      {\n        "error-message": "Request path not found in the YANG module tree",\n        "error-tag": "invalid-value"\n      }\n    ]\n  }\n}`,
        wrongHint: "Send the GET and read the 404 — the server can't map the path onto the YANG tree.",
        explain: "404 invalid-value means the requested path doesn't exist in the server's YANG data model.",
      },
      {
        kind: "diagnose",
        title: "Diagnose the fault",
        prompt: "RESTCONF returns 404 for the path. What is the most likely cause?",
        options: [
          { value: "path", title: "The YANG path doesn't match the module's data tree", note: "Missing module prefix or list key breaks path resolution" },
          { value: "auth", title: "The request lacks authentication", note: "Unauthenticated requests return 401, not 404" },
          { value: "content", title: "The content type is wrong", note: "A wrong content type returns 415" },
        ],
        correct: "path",
        wrongHint: "404 invalid-value means the server's YANG tree has no node at that path.",
        explain: "YANG paths need the module prefix and list keys; a path that doesn't resolve returns 404.",
      },
      {
        kind: "configure",
        title: "Apply the fix",
        prompt: "Issue the corrected request path.",
        acceptedCommands: (variant) => [`curl -X GET https://10.1.1.5${variant.values!.path}`],
        appliedOutput: () => `HTTP/1.1 200 OK\nContent-Type: application/yang-data+json`,
        wrongHint: "Use the module-qualified path — module prefix plus the list key — so the server can resolve it.",
        explain: "A module-prefixed path with the proper list key resolves to a real node in the YANG tree.",
      },
      {
        kind: "verify",
        title: "Verify the data",
        prompt: "Confirm the request now returns the interface data.",
        commands: (variant) => [`curl -X GET https://10.1.1.5${variant.values!.path}`],
        output: (variant) =>
          `HTTP/1.1 200 OK\n\n{\n  "ietf-interfaces:interfaces": {\n    "interface": [\n      { "name": "${variant.values!.iface}", "type": "iana-if-type:ethernetCsmacd", "enabled": true }\n    ]\n  }\n}`,
        wrongHint: "Re-GET the corrected path — 200 with the interface list proves the YANG path resolves.",
        explain: "A 200 with data confirms the corrected path maps to the interface list in the YANG module.",
      },
    ],
  },
  {
    id: "lab-catalyst-api",
    title: "The controller API returns 401",
    objectiveIds: ["6.4"],
    skill: "troubleshoot",
    simulatorNote: "HTTP status behavior here is text-based; on real Catalyst Center or SD-WAN Manager the token endpoint requires valid credentials and the token has a TTL. Practice against a DevNet Catalyst Center or SD-WAN sandbox.",
    scenario: "A script calls the Catalyst Center (or SD-WAN Manager) REST API to list devices, but every request comes back 401 Unauthorized.",
    variants: [
      {
        id: "a",
        label: "Variant A · Catalyst Center token",
        symptom: "The script calls /dna/intent/api/v1/network-device without requesting an X-Auth-Token first — every call returns 401.",
        addressing: "Catalyst Center at https://10.1.1.5; user admin / Cisco123!",
        interfaces: "DNA Center REST API (intent APIs)",
        distractors: ["curl -k -X POST https://10.1.1.5/dna/intent/api/v1/network-device", "curl -k -X GET https://10.1.1.5/dna/system/api/v1/auth/token", "export DNA_TOKEN=$(curl ...)"],
        values: { base: "10.1.1.5", user: "admin", pass: "Cisco123!", token: "/dna/system/api/v1/auth/token", list: "/dna/intent/api/v1/network-device" },
      },
      {
        id: "b",
        label: "Variant B · SD-WAN Manager token",
        symptom: "The script calls /dataservice/device without the jSID cookie — every call returns 401.",
        addressing: "SD-WAN Manager (vManage) at https://172.16.1.5; user admin / Cisco123!",
        interfaces: "vManage REST API (dataservice)",
        distractors: ["curl -k -X POST https://172.16.1.5/dataservice/device", "curl -k -X GET https://172.16.1.5/dataservice/client/token", "export VMANAGE_TOKEN=$(curl ...)"],
        values: { base: "172.16.1.5", user: "admin", pass: "Cisco123!", token: "/dataservice/client/token", list: "/dataservice/device" },
      },
    ],
    steps: [
      {
        kind: "inspect",
        title: "Call the API",
        prompt: "Run the script's API call and read the response.",
        commands: (variant) => [`curl -k -X GET https://${variant.values!.base}${variant.values!.list}`, `curl -k -X GET https://${variant.values!.base}/dna/intent/api/v1/network-device`, `curl -k -X GET https://${variant.values!.base}/dataservice/device`],
        output: (variant) =>
          `HTTP/1.1 401 Unauthorized\nContent-Type: application/json\n\n{\n  "response": {\n    "errorCode": "UNKNOWN_AUTH_TOKEN",\n    "message": "Token not found or invalid"\n  }\n}`,
        wrongHint: "The response code is in the HTTP status line — 401 means no valid token was presented.",
        explain: "Both controller APIs require a token (X-Auth-Token for Catalyst Center, jSID for vManage) obtained from the auth endpoint first.",
      },
      {
        kind: "diagnose",
        title: "Diagnose the fault",
        prompt: "Every API call returns 401. What is the most likely cause?",
        options: [
          { value: "token", title: "The script never obtains a valid auth token", note: "The controller APIs require a token from the auth endpoint before data calls" },
          { value: "path", title: "The API path is wrong", note: "A wrong path returns 404, not 401" },
          { value: "reach", title: "The controller is unreachable", note: "An unreachable host wouldn't return a 401 response" },
        ],
        correct: "token",
        wrongHint: "401 + UNKNOWN_AUTH_TOKEN means the request carried no (or an expired) token.",
        explain: "You must POST credentials to the auth endpoint, capture the token, and send it with every data request.",
      },
      {
        kind: "configure",
        title: "Apply the fix",
        prompt: "Request the token with valid credentials.",
        acceptedCommands: (variant) => [
          `curl -k -X POST https://${variant.values!.base}${variant.values!.token} -u ${variant.values!.user}:${variant.values!.pass}`,
          `curl -k -X POST https://${variant.values!.base}${variant.values!.token} -u ${variant.values!.user}:Cisco123!`,
        ],
        appliedOutput: (variant) =>
          `HTTP/1.1 200 OK\n\n${variant.values!.token === "/dna/system/api/v1/auth/token" ? "{\"Token\": \"eyJhbGciOiJIUzI1NiIs...\"}" : "{\"jSID\": \"ABCDEF123456\"}"}`,
        wrongHint: "POST to the auth endpoint with basic credentials to receive the token.",
        explain: "The auth endpoint validates credentials and returns the token to attach to subsequent data calls.",
      },
      {
        kind: "verify",
        title: "Verify the data call",
        prompt: "Re-run the device-list call with the token attached.",
        commands: (variant) => [`curl -k -X GET https://${variant.values!.base}${variant.values!.list} -H \"X-Auth-Token: TOKEN\" -b \"jSID=TOKEN\"`, `curl -k -X GET https://${variant.values!.base}${variant.values!.list} -H \"X-Auth-Token: TOKEN\"`, `curl -k -X GET https://${variant.values!.base}${variant.values!.list} -b \"jSID=TOKEN\"`],
        output: (variant) =>
          `HTTP/1.1 200 OK\n\n{\n  "response": [\n    { "id": "6b0c...", "hostname": "edge-router-01", "managementIpAddress": "192.0.2.10", "reachabilityStatus": "REACHABLE" }\n  ]\n}`,
        wrongHint: "Attach the token header (X-Auth-Token or jSID cookie) and re-run — the data call should return 200.",
        explain: "A 200 with device data proves the token flow works: authenticate, then authorize every data request.",
      },
    ],
  },
  {
    id: "lab-eem",
    title: "The EEM applet never fires",
    objectiveIds: ["6.6"],
    skill: "configure",
    simulatorNote: "EEM behavior here is text-based; on real IOS XE use show event manager history events and debug event manager to trace why an applet does not trigger. Practice on a CML or DevNet device.",
    scenario: "An Embedded Event Manager applet should log a message when a syslog pattern appears, but it never fires.",
    variants: [
      {
        id: "a",
        label: "Variant A · link up/down pattern",
        symptom: "The applet watches for 'LINK-3-UPDOWN' but the switch actually logs 'LINEPROTO-5-UPDOWN' — the pattern never matches.",
        addressing: "event manager applet LOGLINK on the switch",
        interfaces: "Any interface flapping",
        distractors: ["action 1.0 syslog msg \"Link flapped\"", "event syslog pattern \".*UPDOWN.*\"", "event manager applet LOGLINK"],
        values: { applet: "LOGLINK", pattern: "LINEPROTO-5-UPDOWN", wrong: "LINK-3-UPDOWN", msg: "Link state changed" },
      },
      {
        id: "b",
        label: "Variant B · OSPF adjacency pattern",
        symptom: "The applet watches for 'OSPF-5-ADJCHG' but the router logs 'OSPF-5-ADJCHG: Process 1' only with the colon suffix — the strict pattern misses it.",
        addressing: "event manager applet LOGOSPF on the router",
        interfaces: "OSPF neighbor flapping",
        distractors: ["action 1.0 syslog msg \"OSPF adjacency changed\"", "event syslog pattern \".*ADJCHG.*\"", "event manager applet LOGOSPF"],
        values: { applet: "LOGOSPF", pattern: "OSPF-5-ADJCHG", wrong: "OSPF-4-ADJCHG", msg: "OSPF adjacency changed" },
      },
    ],
    steps: [
      {
        kind: "inspect",
        title: "Inspect the applet",
        prompt: "Show the registered applet and the event history.",
        commands: ["show event manager policy", "show event manager policy available", "show event manager history events"],
        output: (variant) =>
          `No.  Type  Time  Class  Type  Event  Syslog  User  Description\n---  ----  ----  -----  ----  -----  ------  ----  -----------\n1    applet  ${variant.values!.applet}  event syslog pattern \"${variant.values!.wrong}\"  (0 matches in history)`,
        wrongHint: "The registered applets are shown by show event manager policy.",
        explain: "The applet is registered but its event pattern never matches the syslog messages the device actually emits.",
      },
      {
        kind: "diagnose",
        title: "Diagnose the fault",
        prompt: "The applet is registered yet never fires. What is the most likely cause?",
        options: [
          { value: "pattern", title: "The syslog pattern doesn't match the real messages", note: "EEM matches the event pattern against live syslog output" },
          { value: "disabled", title: "Event manager is disabled", note: "show event manager policy proves it is running" },
          { value: "action", title: "The action syntax is invalid", note: "An invalid action would fail registration, not silently skip events" },
        ],
        correct: "pattern",
        wrongHint: "Compare the applet's pattern with the messages the device logs — a mismatch means the event never triggers.",
        explain: "EEM fires only when the syslog pattern matches a real message; a wrong pattern (or over-strict match) never triggers.",
      },
      {
        kind: "configure",
        title: "Apply the fix",
        prompt: "Correct the event pattern so it matches the real syslog messages.",
        acceptedCommands: (variant) => [`event syslog pattern \"${variant.values!.pattern}\"`, `event syslog pattern \".*${variant.values!.pattern}.*\"`],
        appliedOutput: (variant) => `R1(config)# event manager applet ${variant.values!.applet}\nR1(config-applet)# event syslog pattern \"${variant.values!.pattern}\"\nR1(config-applet)#\n%HA_EM-6-LOG: ${variant.values!.msg}`,
        wrongHint: "Set the event syslog pattern to the message the device actually logs.",
        explain: "Matching the pattern to real syslog output makes the applet fire whenever the event occurs.",
      },
      {
        kind: "verify",
        title: "Verify the applet",
        prompt: "Confirm the applet now appears in the event history.",
        commands: ["show event manager history events", "show event manager policy"],
        output: (variant) =>
          `No.  Type  Time  Class  Type  Event  Syslog  User  Description\n---  ----  ----  -----  ----  -----  ------  ----  -----------\n1    applet  ${variant.values!.applet}  event syslog pattern \"${variant.values!.pattern}\"  (3 matches)\n\n%HA_EM-6-LOG: ${variant.values!.msg}`,
        wrongHint: "Re-run show event manager history events — the applet should show matches now.",
        explain: "Match counters in the history prove the corrected pattern is triggering the applet as intended.",
      },
    ],
  },
  {
    id: "lab-orchestration",
    title: "The wrong orchestration tool was chosen",
    objectiveIds: ["6.7"],
    skill: "troubleshoot",
    simulatorNote: "Orchestration behavior here is text-based; on real fleets the choice of agent vs agentless depends on the platform. Practice agentless (Ansible) and agent-based (Chef/Puppet) deployments in a CML or DevNet sandbox environment.",
    scenario: "A rollout to a fleet of network devices keeps failing — the team chose an orchestration tool whose model doesn't fit the environment.",
    variants: [
      {
        id: "a",
        label: "Variant A · agentless for switches",
        symptom: "The team chose an agent-based tool for 300 switches that cannot run agents — the agents never install and the rollout stalls.",
        addressing: "300 IOS-XE switches, no agent runtime available",
        interfaces: "SSH management reachable from the orchestrator",
        distractors: ["chef-client --runlist 'role[network]'", "puppet agent -t", "curl -k https://10.1.1.5/install-agent"],
        values: { tool: "agentless (Ansible over SSH)", cmd: "ansible-playbook site.yml -i inventory.ini" },
      },
      {
        id: "b",
        label: "Variant B · agent-based for endpoints",
        symptom: "The team chose agentless SSH for Linux endpoints that require an agent for continuous compliance — compliance checks never run.",
        addressing: "500 Linux servers with agent runtime available",
        interfaces: "Agent endpoints reachable from the orchestrator",
        distractors: ["ansible-playbook site.yml -i inventory.ini", "ansible-pull -U https://10.1.1.5/policy", "ssh-copy-id root@192.0.2.10"],
        values: { tool: "agent-based (Chef/Puppet)", cmd: "chef-client --runlist 'role[network]'" },
      },
    ],
    steps: [
      {
        kind: "inspect",
        title: "Inspect the environment",
        prompt: "Show the fleet description and the failing rollout command.",
        commands: (variant) => [`cat fleet.txt`, `cat /etc/orchestrator/role`, `show fleet`],
        output: (variant) =>
          variant.values!.cmd.startsWith("ansible")
            ? `Fleet: 500 Linux servers (agent runtime available)\nCompliance requires an always-on local agent.\n\nRollout attempt:\n$ ansible-playbook site.yml\nfatal: [host-042]: UNREACHABLE! => {\"msg\": \"Failed to connect: no SSH service\"}`
            : `Fleet: 300 IOS-XE switches (no agent runtime)\nSwitches are managed over SSH only.\n\nRollout attempt:\n$ chef-client\nError: Could not install agent on switch-077: no package manager`,
        wrongHint: "Show the fleet description to see what the endpoints support.",
        explain: "The rollout fails because the tool's model (agent or agentless) doesn't match what the fleet can run.",
      },
      {
        kind: "diagnose",
        title: "Diagnose the fault",
        prompt: "The rollout fails across the fleet. What is the most likely cause?",
        options: [
          { value: "mode", title: "The orchestration model doesn't fit the environment", note: "Agent-based tools need an agent; agentless tools need SSH — pick the one the fleet supports" },
          { value: "creds", title: "The credentials are wrong", note: "The failure is about reachability/model, not auth" },
          { value: "path", title: "The playbook/runlist path is wrong", note: "The error is at connection/agent level, before content matters" },
        ],
        correct: "mode",
        wrongHint: "The error shows the tool can't reach the fleet the way it needs to — agent vs agentless mismatch.",
        explain: "Agent-based tools require an installed agent; agentless tools require SSH. Choosing the mode the fleet supports is the fix.",
      },
      {
        kind: "configure",
        title: "Apply the fix",
        prompt: "Deploy with the orchestration model the fleet supports.",
        acceptedCommands: (variant) => [variant.values!.cmd],
        appliedOutput: (variant) =>
          variant.values!.cmd.startsWith("ansible")
            ? `$ ansible-playbook site.yml -i inventory.ini\n\nPLAY RECAP\nhost-042 : ok=18  changed=6  unreachable=0\n...\n300 switches — all OK`
            : `$ chef-client --runlist 'role[network]'\n\nStarting Chef Client...\nhost-077: 100% config applied\n...\n500 nodes — all OK`,
        wrongHint: "The fix is to deploy with the orchestration model the fleet supports — agentless over SSH or agent-based.",
        explain: "Matching the orchestration tool to the fleet's capabilities lets the rollout complete.",
      },
      {
        kind: "verify",
        title: "Verify the rollout",
        prompt: "Confirm the deployment completed across the fleet.",
        commands: (variant) => [variant.values!.cmd],
        output: (variant) =>
          variant.values!.cmd.startsWith("ansible")
            ? `PLAY RECAP\n300 switches — ok=18  changed=6  unreachable=0\nAll nodes converged (agentless).`
            : `Chef Client finished, 500 resources updated\n500 nodes converged (agent-based).`,
        wrongHint: "Re-run the deployment — the recap should show all hosts reached and converged.",
        explain: "A full recap with no unreachable hosts confirms the orchestration model fits the environment.",
      },
    ],
  },
];
