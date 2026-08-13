import type { LabTemplate } from "./labs";

/**
 * Security-domain interpret-labs — 5.4.a–d, the highest-weight domain's
 * hands-on gap. These are *interpret* labs: the learner reads real-style
 * security state (zone/ACL placement, 802.1X sessions, NGFW inspection
 * policy, SGT/SXP propagation), diagnoses the gap, applies the policy fix,
 * and verifies with show output.
 *
 * Same engine contract as the rest of the catalog: two variants per lab
 * (different interfaces/addressing/symptoms/distractors), inspect →
 * diagnose → configure → verify, alternate commands accepted, and every fix
 * is variant-aware so a variant B fix never passes on variant A.
 */
export const LAB_TEMPLATES_EXTRA5: LabTemplate[] = [
  {
    id: "lab-sec-design",
    title: "The DMZ isn't demilitarized",
    objectiveIds: ["5.4.a"],
    skill: "troubleshoot",
    simulatorNote: "Zone/ACL placement here is text-based; on real IOS XE use show ip interface <intf> and show access-lists to confirm where an ACL is applied. Design a three-tier segment (WAN → DMZ → LAN) with the right control on the right boundary on CML, EVE-NG, or a DevNet router sandbox.",
    scenario: "The security design calls for a DMZ with the web tier isolated from the LAN, but a scan from the LAN reaches the web tier — the control exists in the config, just on the wrong boundary.",
    variants: [
      {
        id: "a",
        label: "Variant A · ACL in the wrong direction",
        symptom: "ACL 110 (deny LAN→DMZ) is attached outbound on the LAN-side interface Gi0/1, so it never inspects LAN→DMZ flows — the traffic is only filtered when it leaves toward the LAN, not when it enters.",
        addressing: "WAN Gi0/0 → FW → DMZ Gi0/2 (web tier 10.1.2.0/24); LAN Gi0/1 (10.1.1.0/24)",
        interfaces: "GigabitEthernet0/1 (LAN), GigabitEthernet0/2 (DMZ)",
        distractors: ["ip access-group 110 out", "access-list 110 deny ip any any", "interface GigabitEthernet0/1"],
        values: { iface: "GigabitEthernet0/2", shortIface: "gi0/2", wrongIface: "GigabitEthernet0/1", wrongDir: "Outbound", acl: "110", fix: "ip access-group 110 in", denySrc: "10.1.1.0 0.0.0.255", denyDst: "10.1.2.0 0.0.0.255", srcLabel: "the LAN", dstLabel: "the web tier" },
      },
      {
        id: "b",
        label: "Variant B · control not applied at the boundary",
        symptom: "ACL 120 (deny app-tier→DB) is defined but attached on the app-tier Gi0/3 instead of the DB-tier Gi0/4 — the east-west boundary between tiers is open.",
        addressing: "App tier 10.2.1.0/24 (Gi0/3); DB tier 10.2.2.0/24 (Gi0/4)",
        interfaces: "GigabitEthernet0/3 (app), GigabitEthernet0/4 (DB)",
        distractors: ["ip access-group 120 out", "access-list 120 deny ip any any", "interface GigabitEthernet0/3"],
        values: { iface: "GigabitEthernet0/4", shortIface: "gi0/4", wrongIface: "GigabitEthernet0/3", wrongDir: "Inbound", acl: "120", fix: "ip access-group 120 in", denySrc: "10.2.1.0 0.0.0.255", denyDst: "10.2.2.0 0.0.0.255", srcLabel: "the app tier", dstLabel: "the DB tier" },
      },
    ],
    steps: [
      {
        kind: "inspect",
        title: "Inspect the zone boundaries",
        prompt: "Show the access lists and where each is applied on the interfaces.",
        commands: ["show access-lists", "show ip interface brief", "show run | include access-group"],
        output: (variant) =>
          `Extended IP access list ${variant.values!.acl}\n    10 deny ip ${variant.values!.denySrc} ${variant.values!.denyDst} (5 matches)\n    20 permit ip any any\n\n${variant.values!.wrongIface}\n  ${variant.values!.wrongDir}  access list is ${variant.values!.acl}\n${variant.values!.iface}\n  Inbound  access list is not set\n\n(traffic from ${variant.values!.srcLabel} reaches ${variant.values!.dstLabel}: the deny is enforced on the wrong boundary or direction)`,
        wrongHint: "show access-lists lists the ACL; show ip interface <intf> reveals where and in which direction it is applied.",
        explain: "The deny rule exists but is enforced on the wrong boundary or direction — the control must sit inbound on the interface facing the protected tier.",
      },
      {
        kind: "diagnose",
        title: "Diagnose the fault",
        prompt: "The ACL exists and matches traffic, yet the protected tier is reachable. What is wrong with the design?",
        options: [
          { value: "placement", title: "The control is applied on the wrong interface/direction", note: "Enforcement must be inbound on the boundary facing the protected zone" },
          { value: "missing", title: "The ACL itself is missing the deny entry", note: "show access-lists shows the deny and match counters" },
          { value: "technology", title: "The wrong technology (ACL instead of zone firewall)", note: "The ACL would work — it's just on the wrong boundary" },
        ],
        correct: "placement",
        wrongHint: "Check show ip interface on both boundaries — the ACL is on the wrong interface or direction, not on the one protecting the tier.",
        explain: "Threat-control placement matters: an ACL enforced on the wrong boundary leaves the protected zone exposed even though the rule exists.",
      },
      {
        kind: "configure",
        title: "Apply the fix",
        prompt: "Enforce the ACL inbound on the interface that protects the tier.",
        acceptedCommands: (variant) => [variant.values!.fix],
        appliedOutput: (variant) =>
          `FW(config)# interface ${variant.values!.iface}\nFW(config-if)# ${variant.values!.fix}\nFW(config-if)#\n(ACL ${variant.values!.acl} now filters inbound on the boundary facing the protected tier)`,
        wrongHint: "The fix is ip access-group <acl> in on the interface facing the protected tier.",
        explain: "Moving enforcement to the correct boundary closes the path the scan was using while keeping the same rule.",
      },
      {
        kind: "verify",
        title: "Verify the boundary",
        prompt: "Confirm the ACL is now inbound on the correct interface with rising deny counters.",
        commands: (variant) => [`show ip interface ${variant.values!.shortIface}`, "show ip interface brief", "show access-lists"],
        output: (variant) =>
          `${variant.values!.iface}\n  Inbound  access list is ${variant.values!.acl}\n\nExtended IP access list ${variant.values!.acl}\n    10 deny ip ${variant.values!.denySrc} ${variant.values!.denyDst} (41 matches)\n    20 permit ip any any\n\n(${variant.values!.dstLabel} is no longer reachable from ${variant.values!.srcLabel})`,
        wrongHint: "Re-run show ip interface and show access-lists — the ACL should be inbound on the protected boundary with rising matches.",
        explain: "Enforcement on the correct boundary plus rising deny counters confirms the segmentation design now works.",
      },
    ],
  },
  {
    id: "lab-8021x-nac",
    title: "The uninvited laptop got a seat",
    objectiveIds: ["5.4.b"],
    skill: "troubleshoot",
    simulatorNote: "802.1X state here is text-based; on real switches use show authentication sessions and show dot1x all. Build an ISE/ACS + switch lab on CML, EVE-NG, or a DevNet switch sandbox to watch port states change live.",
    scenario: "A visitor's laptop plugs into an access port and reaches the network with no credentials — the 802.1X admission story has a hole.",
    variants: [
      {
        id: "a",
        label: "Variant A · port forced open",
        symptom: "Port Gi0/5 runs authentication port-control force-authorized, so every device is admitted without a dot1x exchange.",
        addressing: "Access port Gi0/5 serving the wired user segment; ISE reachable via Gi0/0",
        interfaces: "GigabitEthernet0/5 (access)",
        distractors: ["switchport mode trunk", "dot1x pae both", "authentication violation shutdown"],
        values: { iface: "GigabitEthernet0/5", fix: "authentication port-control auto" },
      },
      {
        id: "b",
        label: "Variant B · global 802.1X off",
        symptom: "The port is set to auto, but dot1x system-auth-control is globally disabled — no interface ever starts the EAP exchange.",
        addressing: "Access port Gi0/7; ISE reachable via Gi0/0; AAA method lists configured",
        interfaces: "GigabitEthernet0/7 (access)",
        distractors: ["authentication port-control force-authorized", "aaa new-model", "dot1x pae authenticator"],
        values: { iface: "GigabitEthernet0/7", fix: "dot1x system-auth-control" },
      },
    ],
    steps: [
      {
        kind: "inspect",
        title: "Inspect the admission state",
        prompt: "Show the authentication session and the global 802.1X state.",
        commands: ["show authentication sessions", "show dot1x all", "show dot1x interface"],
        output: (variant) =>
          variant.values!.fix.startsWith("dot1x")
            ? `Sysauthcontrol: Disabled\n\nInterface  Role  State\nGi0/7      Authenticator  AUTO (no EAP started — system auth control is off)\n\n(visitor laptop authenticated with no credentials: MAB fallback admitted it)`
            : `Interface  Gi0/5\n  Port-control: FORCE-AUTHORIZED\n  Auth Method: NONE\n  Session State: Authorized\n\n(visitor laptop admitted with no EAP exchange: the port never asks for credentials)`,
        wrongHint: "show authentication sessions reveals per-port control and method; show dot1x all shows the global switch.",
        explain: "The port (or the whole switch) is not actually enforcing 802.1X, so any device is admitted — the NAC story is bypassed.",
      },
      {
        kind: "diagnose",
        title: "Diagnose the fault",
        prompt: "The visitor reached the network without credentials. Where is the admission hole?",
        options: [
          { value: "bypass", title: "802.1X is not enforced on the port or switch", note: "force-authorized or system-auth-control off = no authentication happens" },
          { value: "radius", title: "The RADIUS server is unreachable", note: "No EAP exchange even starts — the failure is before RADIUS" },
          { value: "posture", title: "The endpoint failed the posture check", note: "Posture comes after authentication; here there was no authentication" },
        ],
        correct: "bypass",
        wrongHint: "The inspect output shows admission without credentials — force-authorized or system-auth-control disabled.",
        explain: "802.1X only works when the port actually challenges the device; force-authorized or a disabled global control bypasses NAC entirely.",
      },
      {
        kind: "configure",
        title: "Apply the fix",
        prompt: "Make the port require 802.1X credentials.",
        acceptedCommands: (variant) => [variant.values!.fix],
        appliedOutput: (variant) =>
          variant.values!.fix.startsWith("dot1x")
            ? `SW1(config)# ${variant.values!.fix}\nSW1(config)#\n%DOT1X-5-SYSTEM_AUTH_CONTROL: 802.1X system auth control enabled\n\n(laptop now receives an EAP identity request)`
            : `SW1(config)# interface ${variant.values!.iface}\nSW1(config-if)# ${variant.values!.fix}\nSW1(config-if)#\n(port now challenges the endpoint before granting access)`,
        wrongHint: "For variant A set authentication port-control auto on the port; for variant B enable dot1x system-auth-control globally.",
        explain: "Enabling enforcement starts the EAP exchange, so admission now depends on the device/user authenticating with the RADIUS server.",
      },
      {
        kind: "verify",
        title: "Verify the enforcement",
        prompt: "Confirm the port now runs an EAP exchange and demands credentials.",
        commands: ["show authentication sessions", "show dot1x all"],
        output: (variant) =>
          `Interface  ${variant.values!.iface}\n  Port-control: AUTO\n  Auth Method: 802.1X\n  Session State: Unauthorized (EAP identity request sent — waiting for credentials)\n\n(visitor without credentials is now blocked at the port)`,
        wrongHint: "Re-run show authentication sessions — the port should be AUTO with 802.1X as the method and the session unauthorized until credentials arrive.",
        explain: "With 802.1X enforced, the port stays unauthorized until the endpoint authenticates — the admission hole is closed.",
      },
    ],
  },
  {
    id: "lab-ngfw-ssl",
    title: "The firewall allows 443 and hopes",
    objectiveIds: ["5.4.c"],
    skill: "troubleshoot",
    simulatorNote: "NGFW inspection here is text-based; on real FTD use show service-policy inspect and the FMC SSL-decryption view. Deep inspection on FTD/ASA needs an SSL proxy policy and a bound trust point — reproduce on a DevNet FTD or CML ASA to watch TLS flows decrypt.",
    scenario: "An NGFW rule allows web traffic on 443, but malware riding in HTTPS passes through untouched — the firewall is not actually inspecting the encrypted flow.",
    variants: [
      {
        id: "a",
        label: "Variant A · HTTPS inspection not configured",
        symptom: "The inspection policy allows the flow but has no HTTPS/SSL inspection action, so the firewall sees only encrypted blobs.",
        addressing: "FTD outside Gi0/0 → inside Gi0/1; policy allows web on 443; SSL-decrypt not present",
        interfaces: "GigabitEthernet0/0 (outside), GigabitEthernet0/1 (inside)",
        distractors: ["inspect icmp", "policy-map type inspect dns preset_dns_map", "access-list WEB permit tcp any any eq 443"],
        values: { iface: "GigabitEthernet0/1", fix: "inspect https" },
      },
      {
        id: "b",
        label: "Variant B · no trust point for decryption",
        symptom: "The SSL-decrypt policy is configured but no CA trust point is bound, so decryption can never start and TLS flows stay opaque.",
        addressing: "FTD outside Gi0/2 → inside Gi0/3; SSL proxy policy references a missing trust point",
        interfaces: "GigabitEthernet0/2 (outside), GigabitEthernet0/3 (inside)",
        distractors: ["inspect https", "crypto ca enroll NGFW-CA", "access-list WEB permit tcp any any eq 443"],
        values: { iface: "GigabitEthernet0/3", fix: "ssl trust-point NGFW-CA" },
      },
    ],
    steps: [
      {
        kind: "inspect",
        title: "Inspect the inspection policy",
        prompt: "Show the service-policy inspection state and the SSL trust point.",
        commands: ["show service-policy inspect", "show run policy-map", "show run ssl", "show crypto ca certificates"],
        output: (variant) =>
          variant.values!.fix.startsWith("ssl")
            ? `Service-policy global_policy: outside\n  Class inspection_default\n    Inspect https: Off\n\nSSL trust point: NONE (policy references NGFW-CA but no trust point is bound)\n\n(HTTPS rides through encrypted — no decryption possible)`
            : `Service-policy global_policy: outside\n  Class inspection_default\n    Inspect https: Off\n  Class WEB\n    Allow tcp any eq 443 (flow permitted — not inspected)\n\n(HTTPS is allowed but never decrypted — IPS sees only ciphertext)`,
        wrongHint: "show service-policy inspect reveals which inspections are on; show run ssl shows the trust point binding.",
        explain: "Allowing 443 is not inspection: without an HTTPS inspection action (or a bound trust point to decrypt with) the firewall cannot see inside TLS.",
      },
      {
        kind: "diagnose",
        title: "Diagnose the fault",
        prompt: "Web traffic is allowed on 443 but IPS events show nothing for the flow. What is wrong?",
        options: [
          { value: "ssl-gap", title: "TLS is allowed but never decrypted/inspected", note: "No inspect https, or no bound trust point to decrypt with" },
          { value: "acl", title: "The access rule blocks the traffic", note: "The flow is permitted — the rule isn't the problem" },
          { value: "ips", title: "The IPS policy is misconfigured", note: "IPS can't see anything — the TLS flow never reaches it decrypted" },
        ],
        correct: "ssl-gap",
        wrongHint: "The inspect output shows the flow allowed with inspection off — that is exactly the blind spot NGFWs exist to close.",
        explain: "An NGFW only protects what it inspects: 'allow 443' without SSL decryption lets encrypted malware straight through.",
      },
      {
        kind: "configure",
        title: "Apply the fix",
        prompt: "Enable deep inspection of the encrypted flow.",
        acceptedCommands: (variant) => [variant.values!.fix],
        appliedOutput: (variant) =>
          variant.values!.fix.startsWith("ssl")
            ? `FTD(config)# ${variant.values!.fix}\nFTD(config)#\n%SSL-5-TRUSTPOINT: trust point NGFW-CA bound — decryption key available`
            : `FTD(config)# policy-map global_policy\nFTD(config-pmap)# class inspection_default\nFTD(config-pmap-c)# ${variant.values!.fix}\nFTD(config-pmap-c)#\n%HTTPS-5-INSPECT: HTTPS inspection enabled on class inspection_default`,
        wrongHint: "For variant A add inspect https to the inspection class; for variant B bind the CA trust point the policy references.",
        explain: "With decryption enabled, the firewall terminates the TLS proxy, inspects the payload with IPS/app-ID, and re-encrypts — the blind spot closes.",
      },
      {
        kind: "verify",
        title: "Verify deep inspection",
        prompt: "Confirm the HTTPS flow is now decrypted and inspected.",
        commands: ["show service-policy inspect", "show run ssl"],
        output: (variant) =>
          `Service-policy global_policy: outside\n  Class inspection_default\n    Inspect https: On (active)\n\nSSL trust point: ${variant.values!.fix.startsWith("ssl") ? "NGFW-CA (bound)" : "default (proxy cert in use)"}\n  Decrypted connections: 12\n  TLS sessions inspected by IPS: 12\n\n(HTTPS payload now visible to IPS and app-ID)`,
        wrongHint: "Re-run show service-policy inspect — HTTPS inspection should be active with decrypted connection counters.",
        explain: "Active HTTPS inspection with decrypted-session counters proves the NGFW now sees inside the TLS flow and can enforce policy on it.",
      },
    ],
  },
  {
    id: "lab-sxp-sgt",
    title: "The tag gets lost in transit",
    objectiveIds: ["5.4.d"],
    skill: "troubleshoot",
    simulatorNote: "TrustSec state here is text-based; on real switches use show cts role-based counters, show cts sxp connections, and show cts role-based sgt-map. Reproduce SXP propagation and SGT enforcement on CML or a DevNet switch pair.",
    scenario: "Policy enforcement relies on the employee group's SGT, but the enforcement switch treats the traffic as untagged — the tag never makes it across the transit network.",
    variants: [
      {
        id: "a",
        label: "Variant A · SXP connection down",
        symptom: "The SXP connection to the core peer is down (wrong peer address configured), so the SGT mapping is never propagated.",
        addressing: "Access switch SW1 → transit to core SW2; SXP peer should be 192.0.2.2",
        interfaces: "GigabitEthernet0/1 (transit), GigabitEthernet0/2 (SXP source)",
        distractors: ["cts role-based sgt-map 10.1.1.0 255.255.255.0 sgt 40", "show cts role-based counters", "switchport mode trunk"],
        values: { peer: "192.0.2.2", fix: "cts sxp connection peer 192.0.2.2 source GigabitEthernet0/2 password Cisco123", sgt: "40" },
      },
      {
        id: "b",
        label: "Variant B · SGT map missing at enforcement",
        symptom: "SXP is up and the employee subnet propagates, but the enforcement switch has no role-based SGT mapping for it — traffic arrives untagged.",
        addressing: "Core switch enforcement on Gi0/3; employee subnet 10.1.1.0/24 should map to SGT 40",
        interfaces: "GigabitEthernet0/3 (enforcement), GigabitEthernet0/4 (SXP)",
        distractors: ["cts sxp connection peer 192.0.2.4 source GigabitEthernet0/4 password Cisco123", "switchport mode trunk", "show cts role-based sgt-map"],
        values: { peer: "192.0.2.4", fix: "cts role-based sgt-map 10.1.1.0 255.255.255.0 sgt 40", sgt: "40" },
      },
    ],
    steps: [
      {
        kind: "inspect",
        title: "Inspect the SGT path",
        prompt: "Show the SXP connection state and the role-based SGT mappings.",
        commands: ["show cts sxp connections", "show cts role-based sgt-map", "show cts role-based counters"],
        output: (variant) =>
          variant.values!.fix.startsWith("cts sxp")
            ? `SXP Connections:\n  Peer 192.0.2.2  Source Gi0/2  Password: set  Status: DOWN (no TCP session — peer address wrong)\n\nRole-based SGT map: (empty at enforcement switch — nothing propagated)`
            : `SXP Connections:\n  Peer 192.0.2.4  Source Gi0/4  Password: set  Status: UP (TCP established)\n\nRole-based SGT map: (no entry for 10.1.1.0/24 — employee traffic is untagged)\n  IP-SGT Active Bindings: 0`,
        wrongHint: "show cts sxp connections reveals whether the mapping channel is up; show cts role-based sgt-map shows what the enforcement switch actually knows.",
        explain: "SGT policy only works where the tag is known: a down SXP session stops propagation, and a missing role-based map leaves traffic untagged at enforcement.",
      },
      {
        kind: "diagnose",
        title: "Diagnose the fault",
        prompt: "Enforcement sees no SGT for the employee subnet. What is wrong?",
        options: [
          { value: "sgt-missing", title: "The SGT mapping never reaches the enforcement switch", note: "SXP is down, or the role-based sgt-map is missing locally" },
          { value: "macsec", title: "The link isn't encrypted", note: "MACsec encrypts the link — it doesn't carry SGT policy" },
          { value: "trunk", title: "The transit link isn't a trunk", note: "SXP runs over TCP regardless of trunk mode" },
        ],
        correct: "sgt-missing",
        wrongHint: "The inspect output shows either a down SXP connection or an empty role-based sgt-map at the enforcing switch.",
        explain: "Without a propagated (or locally mapped) SGT the enforcement switch can't apply group policy — it treats the flow as untagged default.",
      },
      {
        kind: "configure",
        title: "Apply the fix",
        prompt: "Get the SGT to the enforcement point.",
        acceptedCommands: (variant) => [variant.values!.fix],
        appliedOutput: (variant) =>
          variant.values!.fix.startsWith("cts sxp")
            ? `SW1(config)# ${variant.values!.fix}\nSW1(config)#\n%CTS-5-SXP: SXP TCP connection to peer 192.0.2.2 established — mapping propagation started`
            : `SW2(config)# ${variant.values!.fix}\nSW2(config)#\n%CTS-5-SGT: role-based sgt-map created — 10.1.1.0/24 now maps to SGT ${variant.values!.sgt}`,
        wrongHint: "For variant A fix the SXP peer address so the session comes up; for variant B create the role-based sgt-map at enforcement.",
        explain: "Restoring the SXP session (or mapping the subnet locally) puts the SGT at the enforcement point so group policy can be applied.",
      },
      {
        kind: "verify",
        title: "Verify the tag",
        prompt: "Confirm the SXP session is up and the enforcement switch holds the SGT binding.",
        commands: ["show cts sxp connections", "show cts role-based sgt-map", "show cts role-based counters"],
        output: (variant) =>
          `SXP Connections:\n  Peer ${variant.values!.peer}  Status: UP (TCP established)\n\nRole-based SGT map:\n  IP 10.1.1.0/24  SGT ${variant.values!.sgt}  (Active bindings: 1)\n\n(enforcement now classifies employee traffic with SGT ${variant.values!.sgt})`,
        wrongHint: "Re-run show cts sxp connections and show cts role-based sgt-map — the session should be UP with the subnet mapped to the right SGT.",
        explain: "A live SXP session plus an active role-based SGT binding confirms the enforcement switch now tags and polices the traffic.",
      },
    ],
  },
];
