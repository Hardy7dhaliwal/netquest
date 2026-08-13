import type { LabTemplate } from "./labs";

/**
 * Remaining lab-able objectives — 3.2.d (PBR), 3.2.a (EIGRP vs OSPF),
 * 5.1.a (local access auth). Interpret-style labs: the learner reads the
 * real device state, diagnoses the fault, applies the policy/config fix, and
 * verifies with show output.
 *
 * Same engine contract as the rest of the catalog: two variants per lab
 * (different interfaces/addressing/symptoms/distractors), inspect →
 * diagnose → configure → verify, alternate commands accepted, and every fix
 * is variant-aware so a variant B fix never passes on variant A.
 */
export const LAB_TEMPLATES_EXTRA6: LabTemplate[] = [
  {
    id: "lab-pbr",
    title: "The policy is all set and ignored",
    objectiveIds: ["3.2.d"],
    skill: "troubleshoot",
    simulatorNote: "PBR state here is text-based; on real IOS XE use show route-map, show ip policy, and show ip interface. Build a router pair with voice traffic on CML, EVE-NG, or a DevNet router sandbox to watch a policy-map override the routing table.",
    scenario: "Voice traffic must exit through the voice gateway regardless of what the routing table prefers — but the route-map exists and does nothing.",
    variants: [
      {
        id: "a",
        label: "Variant A · policy never applied",
        symptom: "route-map VOICE-PBR is defined (match ACL 110, set ip next-hop 10.0.0.2) but ip policy route-map was never applied to the ingress interface Gi0/1 — voice follows the routing table.",
        addressing: "Voice subnet 10.10.1.0/24 (Gi0/1); voice gateway 10.0.0.2; default next hop 10.0.0.1",
        interfaces: "GigabitEthernet0/1 (ingress), GigabitEthernet0/0 (WAN)",
        distractors: ["set ip next-hop 10.0.0.2", "access-list 110 permit ip host 10.10.1.10 any", "ip route 10.0.0.0 255.255.255.0 10.0.0.2"],
        values: { iface: "GigabitEthernet0/1", map: "VOICE-PBR", acl: "110", nexthop: "10.0.0.2", wrongNexthop: "10.0.0.3", fix: "ip policy route-map VOICE-PBR", srcLabel: "the voice subnet", gwLabel: "the voice gateway" },
      },
      {
        id: "b",
        label: "Variant B · set clause points at an unreachable next hop",
        symptom: "The policy IS applied inbound on Gi0/2, but set ip next-hop points at 10.0.0.3 (unreachable) instead of 10.0.0.2 — matched voice never exits via the gateway.",
        addressing: "Voice subnet 10.20.1.0/24 (Gi0/2); voice gateway 10.0.0.2; configured next-hop 10.0.0.3",
        interfaces: "GigabitEthernet0/2 (ingress), GigabitEthernet0/0 (WAN)",
        distractors: ["ip policy route-map VOICE-PBR", "access-list 110 permit ip host 10.20.1.10 any", "ip route 10.0.0.0 255.255.255.0 10.0.0.3"],
        values: { iface: "GigabitEthernet0/2", map: "VOICE-PBR", acl: "110", nexthop: "10.0.0.2", wrongNexthop: "10.0.0.3", fix: "set ip next-hop 10.0.0.2", srcLabel: "the voice subnet", gwLabel: "the voice gateway" },
      },
    ],
    steps: [
      {
        kind: "inspect",
        title: "Inspect the policy state",
        prompt: "Show the route map and where (if anywhere) it is applied.",
        commands: ["show route-map", "show ip policy", "show ip interface brief"],
        output: (variant) =>
          variant.values!.fix.startsWith("ip policy")
            ? `route-map ${variant.values!.map}, permit, sequence 10\n  Match clauses:\n    ip address (access-lists): ${variant.values!.acl}\n  Set clauses:\n    ip next-hop ${variant.values!.nexthop}\n\nip policy: (no interface has the policy applied)\n\n(${variant.values!.srcLabel} leaves via the routing-table next hop — PBR is defined but never attached)`
            : `route-map ${variant.values!.map}, permit, sequence 10\n  Match clauses:\n    ip address (access-lists): ${variant.values!.acl}\n  Set clauses:\n    ip next-hop ${variant.values!.wrongNexthop}\n\nip policy: ${variant.values!.iface} (inbound)\n\n(${variant.values!.srcLabel} is matched — but sent toward the unreachable ${variant.values!.wrongNexthop})`,
        wrongHint: "show route-map lists the policy and its set clause; show ip policy reveals whether any interface actually applies it.",
        explain: "A route-map only acts where it is applied — and only if its set clause points somewhere reachable.",
      },
      {
        kind: "diagnose",
        title: "Diagnose the fault",
        prompt: "Voice is matched by the policy, yet it still follows the routing table. What is wrong?",
        options: [
          { value: "enforcement", title: "The policy is defined but never effectively enforced", note: "Not applied to the ingress interface, or sent toward an unreachable next hop" },
          { value: "match", title: "The match clause doesn't classify the voice traffic", note: "show route-map shows the ACL matching — classification is not the fault" },
          { value: "routing", title: "The routing table itself is broken", note: "The table is healthy; PBR simply overrides it for matched traffic" },
        ],
        correct: "enforcement",
        wrongHint: "show route-map and show ip policy show either no application point (A) or a set clause aimed at an unreachable next hop (B).",
        explain: "PBR is only effective when the policy is applied on the ingress interface AND its set action is reachable — otherwise it silently no-ops.",
      },
      {
        kind: "configure",
        title: "Apply the fix",
        prompt: "Make the policy actually steer the matched voice traffic.",
        acceptedCommands: (variant) => [variant.values!.fix],
        appliedOutput: (variant) =>
          variant.values!.fix.startsWith("ip policy")
            ? `R1(config)# interface ${variant.values!.iface}\nR1(config-if)# ${variant.values!.fix}\nR1(config-if)#\n(voice entering ${variant.values!.iface} is now matched by ${variant.values!.map} and sent to ${variant.values!.nexthop})`
            : `R1(config)# route-map ${variant.values!.map} permit 10\nR1(config-route-map)# ${variant.values!.fix}\nR1(config-route-map)#\n(voice is now redirected toward the reachable ${variant.values!.nexthop})`,
        wrongHint: "For variant A apply the policy inbound: ip policy route-map VOICE-PBR. For variant B correct the set clause: set ip next-hop 10.0.0.2.",
        explain: "Applying the policy (or pointing its set clause at a reachable next hop) lets PBR override destination-based forwarding for matched traffic.",
      },
      {
        kind: "verify",
        title: "Verify the policy",
        prompt: "Confirm the policy is applied inbound and the set clause targets the reachable gateway.",
        commands: (variant) => ["show ip policy", "show route-map", "show ip interface brief"],
        output: (variant) =>
          `ip policy: Route map ${variant.values!.map} on ${variant.values!.iface} (inbound)\nroute-map ${variant.values!.map}, permit, sequence 10\n  Set clauses:\n    ip next-hop ${variant.values!.nexthop}\n\n(voice now exits via ${variant.values!.gwLabel})`,
        wrongHint: "Re-run show ip policy and show route-map — the policy should be attached inbound with the set clause pointing at the reachable gateway.",
        explain: "An applied policy with a reachable set next-hop confirms PBR is now steering matched traffic away from the routing table's default.",
      },
    ],
  },
  {
    id: "lab-eigrp-ospf",
    title: "The fast link is the backup",
    objectiveIds: ["3.2.a"],
    skill: "troubleshoot",
    simulatorNote: "Metric state here is text-based; on real IOS XE use show ip eigrp topology and show ip ospf interface. Build a two-path router on CML, EVE-NG, or a DevNet sandbox to compare EIGRP's composite metric (bandwidth + delay) with OSPF's cost.",
    scenario: "Two paths lead to the remote LAN — a low-latency fiber link and a satellite link — yet traffic prefers the satellite path. The fiber is only the backup.",
    variants: [
      {
        id: "a",
        label: "Variant A · EIGRP delay inflated on the fiber",
        symptom: "EIGRP sees the fiber Gi0/1 with delay 10000 (100 ms) instead of 100 — its composite metric makes the satellite link the successor and the fiber only a feasible successor.",
        addressing: "Remote LAN 10.1.1.0/24; fiber via Gi0/1 (delay 10000), satellite via Gi0/2",
        interfaces: "GigabitEthernet0/1 (fiber), GigabitEthernet0/2 (satellite)",
        distractors: ["bandwidth 10000", "ip ospf cost 1", "passive-interface default"],
        values: { iface: "GigabitEthernet0/1", fix: "delay 100", proto: "EIGRP", net: "10.1.1.0/24", fiberHop: "10.0.0.9", satHop: "10.0.0.5" },
      },
      {
        id: "b",
        label: "Variant B · OSPF cost pinned high on the fiber",
        symptom: "OSPF has ip ospf cost 1000 on the fiber Gi0/1 — auto cost would prefer it, but the manual cost sends traffic over the satellite.",
        addressing: "Remote LAN 10.2.2.0/24; fiber via Gi0/1 (cost 1000), satellite via Gi0/2",
        interfaces: "GigabitEthernet0/1 (fiber), GigabitEthernet0/2 (satellite)",
        distractors: ["delay 100", "bandwidth 1000000", "network 10.2.2.0 0.0.0.255 area 0"],
        values: { iface: "GigabitEthernet0/1", fix: "no ip ospf cost", proto: "OSPF", net: "10.2.2.0/24", fiberHop: "10.0.1.9", satHop: "10.0.1.5" },
      },
    ],
    steps: [
      {
        kind: "inspect",
        title: "Inspect the routing state",
        prompt: "Show the protocol's topology table and the routes it installed.",
        commands: (variant) =>
          variant.values!.fix.startsWith("no ip ospf")
            ? ["show ip ospf interface", "show ip route ospf"]
            : ["show ip eigrp topology", "show ip route eigrp"],
        output: (variant) =>
          variant.values!.fix.startsWith("no ip ospf")
            ? `OSPF Router with ID 10.0.0.1\n  ${variant.values!.iface} is up — cost 1000 (MANUALLY configured)\n  GigabitEthernet0/2 is up — cost 20 (auto)\n\nshow ip route ospf: ${variant.values!.net} via ${variant.values!.satHop} (satellite) — the fiber is second-best`
            : `EIGRP-IPv4 Topology Table for AS 100\n  P ${variant.values!.net}, 1 successors, FD is 28185600\n      via ${variant.values!.satHop} (satellite), 28185600, FD — successor\n      via ${variant.values!.fiberHop} (fiber), 33561600, FD — feasible successor (delay 10000 inflates the metric)\n\nshow ip route eigrp: ${variant.values!.net} via ${variant.values!.satHop} (satellite)`,
        wrongHint: "show ip eigrp topology or show ip ospf interface shows how each protocol computed the fiber path's metric — the anomaly is on the preferred (fiber) link.",
        explain: "Both protocols pick the lowest metric: a manual delay (EIGRP) or a manual cost (OSPF) on the fiber silently demotes the fast path.",
      },
      {
        kind: "diagnose",
        title: "Diagnose the fault",
        prompt: "The low-latency fiber is the backup path even though it is faster. What is wrong?",
        options: [
          { value: "metric", title: "The fiber's metric is artificially inflated", note: "A manual delay (EIGRP) or manual cost (OSPF) makes the satellite look better" },
          { value: "bandwidth", title: "The satellite genuinely has more bandwidth", note: "The topology shows the fiber's metric is the anomaly — not the satellite's speed" },
          { value: "adjacency", title: "One neighbor adjacency is down", note: "Both paths appear in the topology table — adjacencies are healthy" },
        ],
        correct: "metric",
        wrongHint: "The inspect output shows a manually inflated metric on the fiber for both protocols (delay for EIGRP, cost for OSPF).",
        explain: "EIGRP's composite metric weighs delay; OSPF uses cost. A manual override on the fast link makes the slow path win under either protocol.",
      },
      {
        kind: "configure",
        title: "Apply the fix",
        prompt: "Restore the fiber link's true metric so it wins the path selection.",
        acceptedCommands: (variant) => [variant.values!.fix],
        appliedOutput: (variant) =>
          variant.values!.fix.startsWith("no ip ospf")
            ? `R1(config)# interface ${variant.values!.iface}\nR1(config-if)# ${variant.values!.fix}\nR1(config-if)#\n(OSPF recomputes the fiber cost from the reference bandwidth — the fiber is now preferred)`
            : `R1(config)# interface ${variant.values!.iface}\nR1(config-if)# ${variant.values!.fix}\nR1(config-if)#\n(EIGRP recomputes — the fiber's delay drops and its composite metric now beats the satellite)`,
        wrongHint: "For variant A set the fiber's delay back to the default: delay 100. For variant B remove the manual OSPF cost: no ip ospf cost.",
        explain: "Restoring the true metric lets the protocol's normal path selection pick the fiber — the fast link stops being the backup.",
      },
      {
        kind: "verify",
        title: "Verify the best path",
        prompt: "Confirm the remote LAN is now reached over the fiber.",
        commands: (variant) => ["show ip route", "show ip route eigrp", "show ip route ospf", "show ip eigrp topology"],
        output: (variant) =>
          `show ip route: ${variant.values!.net} via ${variant.values!.fiberHop} (${variant.values!.iface} — fiber)\n  * ${variant.values!.proto} best path: the fiber link (metric corrected)\n\n(remote LAN now reached over the low-latency fiber)`,
        wrongHint: "Re-run show ip route — the installed next hop should now be the fiber link, not the satellite.",
        explain: "With the fiber's metric restored, both protocols converge on the fast path — proving you understand how each metric is computed.",
      },
    ],
  },
  {
    id: "lab-local-auth",
    title: "The password is a shared secret",
    objectiveIds: ["5.1.a"],
    skill: "troubleshoot",
    simulatorNote: "Access security here is text-based; on real IOS XE use show running-config | include username and show line vty. Harden a router's vty on CML, EVE-NG, or a DevNet sandbox: local usernames with hashed secrets plus login local.",
    scenario: "Every admin logs in with the same shared line password — there is no per-user identity, so the audit trail cannot tell who did what.",
    variants: [
      {
        id: "a",
        label: "Variant A · vty lines skip the local database",
        symptom: "Local usernames exist (admin, netops) but the vty lines run login with a shared password — login local is never set, so the local database is never checked.",
        addressing: "line vty 0 4 with password Cisco123 + login; local users admin/netops present",
        interfaces: "line vty 0 4",
        distractors: ["username backup privilege 15 secret Cisco123", "enable secret Cisco123", "transport input ssh"],
        values: { fix: "login local", users: "admin (privilege 15), netops (privilege 1)", gap: "login local is not set — the shared line password is the only gate" },
      },
      {
        id: "b",
        label: "Variant B · local database is empty",
        symptom: "The vty lines DO run login local, but no local usernames exist — every login attempt is rejected and admins are locked out (the console still uses a line password).",
        addressing: "line vty 0 4 with login local; no username entries; console uses password Cisco123",
        interfaces: "line vty 0 4",
        distractors: ["login local", "password Cisco123", "aaa new-model"],
        values: { fix: "username netadmin privilege 15 secret Cisco123", users: "(none configured)", gap: "login local has nothing to check — the local database is empty" },
      },
    ],
    steps: [
      {
        kind: "inspect",
        title: "Inspect the login configuration",
        prompt: "Show the local username database and the vty line configuration.",
        commands: ["show running-config | include username", "show running-config | section line vty"],
        output: (variant) =>
          variant.values!.fix.startsWith("username")
            ? `username (none configured)\n\nline vty 0 4\n  login local\n\n(login local is set, but there is no local user to authenticate — every attempt is rejected)`
            : `username ${variant.values!.users.split(", ").join("\nusername ")}\n\nline vty 0 4\n  password Cisco123\n  login\n\n(vty logins check the shared line password — the local database is never consulted)`,
        wrongHint: "show running-config | include username lists the local database; the line vty section shows whether login consults it.",
        explain: "Per-user login needs both halves: a local user database AND login local on the line — missing either one breaks identity-based access.",
      },
      {
        kind: "diagnose",
        title: "Diagnose the fault",
        prompt: "Admins cannot be individually identified in the audit trail. What is wrong with the access configuration?",
        options: [
          { value: "identity", title: "The login path does not use per-user identity", note: "VTY checks a shared password (A), or login local has no users to check (B)" },
          { value: "encryption", title: "Passwords are stored in clear text", note: "The secrets are hashed (type 5) — storage is not the fault" },
          { value: "ssh", title: "SSH transport is disabled", note: "Transport is configured — the issue is who (or what) is checked at login" },
        ],
        correct: "identity",
        wrongHint: "The inspect output shows either a shared vty password with no login local (A) or login local with an empty database (B).",
        explain: "Without a local database plus login local, the device authenticates by shared password or locks everyone out — either way there is no per-user identity.",
      },
      {
        kind: "configure",
        title: "Apply the fix",
        prompt: "Make vty login require a per-user local account.",
        acceptedCommands: (variant) => [variant.values!.fix],
        appliedOutput: (variant) =>
          variant.values!.fix.startsWith("username")
            ? `R1(config)# ${variant.values!.fix}\nR1(config)#\n(login local now has netadmin to authenticate — the lockout is lifted)`
            : `R1(config)# line vty 0 4\nR1(config-line)# ${variant.values!.fix}\nR1(config-line)#\n(vty logins now authenticate against the local user database)`,
        wrongHint: "For variant A set login local on the vty lines. For variant B create the local user: username netadmin privilege 15 secret Cisco123.",
        explain: "Checking the local database on login (with at least one user in it) restores per-user authentication and a usable audit trail.",
      },
      {
        kind: "verify",
        title: "Verify the login",
        prompt: "Confirm vty login consults the local database and a user can authenticate.",
        commands: ["show running-config | include username", "show running-config | section line vty", "show login"],
        output: (variant) =>
          `username ${variant.values!.fix.startsWith("username") ? "netadmin privilege 15 secret 5 $1$zzzz" : "admin privilege 15 secret 5 $1$xxxx\nusername netops privilege 1 secret 5 $1$yyyy"}\n\nline vty 0 4\n  login local\n\n(login now requires a local username + secret — per-user audit restored)`,
        wrongHint: "Re-run show running-config | section line vty and show running-config | include username — login local plus at least one local user must both be present.",
        explain: "A local user database checked by login local means every admin authenticates with their own identity — the shared-secret hole is closed.",
      },
    ],
  },
];
