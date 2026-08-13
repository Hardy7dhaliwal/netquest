import { describe, expect, it } from "vitest";
import { LAB_TEMPLATES } from "./lab-templates";
import {
  advanceLab,
  answerLabDiagnose,
  getLabVariant,
  pickVariant,
  revealLabAnswer,
  runLabCommand,
  startLab,
  type LabState,
  type LabTemplate,
} from "./labs";

function findLab(id: string): LabTemplate {
  return LAB_TEMPLATES.find((template) => template.id === id)!;
}

function runLab(template: LabTemplate, variantId: string, commands: string[], diagnose: string, fix: string, verify: string): LabState {
  let state = startLab(template, variantId);
  state = runLabCommand(state, template, commands[0]);
  state = answerLabDiagnose(state, template, diagnose);
  state = runLabCommand(state, template, fix);
  state = runLabCommand(state, template, verify);
  return state;
}

describe("lab catalog", () => {
  it("ships every lab with at least two variants", () => {
    expect(LAB_TEMPLATES.length).toBeGreaterThanOrEqual(4);
    for (const template of LAB_TEMPLATES) {
      expect(template.variants.length, `${template.id} variants`).toBeGreaterThanOrEqual(2);
    }
  });

  it("links each lab to blueprint objectives", () => {
    for (const template of LAB_TEMPLATES) {
      expect(template.objectiveIds.length).toBeGreaterThan(0);
    }
  });

  it("labels simulator limits on every lab", () => {
    for (const template of LAB_TEMPLATES) {
      expect(template.simulatorNote.length).toBeGreaterThan(40);
      expect(template.simulatorNote.toLowerCase()).toMatch(/cml|eve-ng|devnet/);
    }
  });

  it("follows inspect → diagnose → configure → verify", () => {
    for (const template of LAB_TEMPLATES) {
      expect(template.steps.map((step) => step.kind)).toEqual(["inspect", "diagnose", "configure", "verify"]);
    }
  });
});

describe("variant behavior", () => {
  it("picks a variant deterministically from a seed", () => {
    const template = findLab("lab-ospf-adjacency");
    expect(pickVariant(template, "same").id).toBe(pickVariant(template, "same").id);
  });

  it("differs across seeds", () => {
    const template = findLab("lab-nat-pat");
    const ids = new Set(["x1", "x2", "x3", "x4", "x5"].map((seed) => pickVariant(template, seed).id));
    expect(ids.size).toBeGreaterThan(1);
  });

  it("changes addressing, interfaces, and symptoms between variants", () => {
    const template = findLab("lab-ospf-adjacency");
    const a = getLabVariant(template, "a");
    const b = getLabVariant(template, "b");
    expect(a.addressing).not.toBe(b.addressing);
    expect(a.interfaces).not.toBe(b.interfaces);
    expect(a.symptom).not.toBe(b.symptom);
    expect(a.distractors).not.toEqual(b.distractors);
  });
});

describe("lab flow", () => {
  it("completes the full inspect → diagnose → configure → verify loop cleanly", () => {
    const template = findLab("lab-trunk-vlan");
    const state = runLab(template, "a", ["show interfaces trunk"], "allowed", "switchport trunk allowed vlan add 30", "show interfaces trunk");
    expect(state.status).toBe("complete");
    expect(state.clean).toBe(true);
    expect(state.eventLog.some((entry) => entry.tone === "success")).toBe(true);
  });

  it("accepts alternate valid commands for inspect and verify", () => {
    const template = findLab("lab-ospf-adjacency");
    let state = startLab(template, "a");
    state = runLabCommand(state, template, "show ip ospf neighbor detail"); // alternate
    expect(state.stepIndex).toBe(1); // moved past inspect
  });

  it("accepts alternate valid fix commands for configure", () => {
    const template = findLab("lab-nat-pat");
    let state = startLab(template, "a");
    state = runLabCommand(state, template, "show ip nat translations");
    state = answerLabDiagnose(state, template, "direction");
    // Alternate spelling of the same fix (g0/0 = GigabitEthernet0/0).
    state = runLabCommand(state, template, "interface g0/0 ip nat inside");
    expect(state.status).toBe("in_progress");
    expect(state.stepIndex).toBe(3);
  });

  it("rejects another variant's fix on this variant (no cross-variant memorization)", () => {
    const template = findLab("lab-nat-pat");
    let state = startLab(template, "a");
    state = runLabCommand(state, template, "show ip nat translations");
    state = answerLabDiagnose(state, template, "direction");
    // Variant B's fix (Gi0/2 inside) must NOT apply on variant A.
    state = runLabCommand(state, template, "interface g0/2 ip nat inside");
    expect(state.stepIndex).toBe(2); // still on configure
    expect(state.clean).toBe(false);
  });

  it("rejects distractor commands with targeted feedback and marks the run non-clean", () => {
    const template = findLab("lab-iacl");
    let state = startLab(template, "a");
    state = runLabCommand(state, template, "show access-lists");
    state = answerLabDiagnose(state, template, "notapplied");
    state = runLabCommand(state, template, "access-list 150 permit icmp any any"); // distractor
    expect(state.clean).toBe(false);
    expect(state.attempts).toBe(1);
    expect(state.cliHistory[state.cliHistory.length - 1].output).toContain("access-list 150 permit icmp");
  });

  it("records wrong diagnoses without advancing", () => {
    const template = findLab("lab-ospf-adjacency");
    let state = startLab(template, "a");
    state = runLabCommand(state, template, "show ip ospf neighbor");
    state = answerLabDiagnose(state, template, "area"); // wrong
    expect(state.stepIndex).toBe(1); // still on diagnose
    expect(state.attempts).toBe(1);
  });

  it("reveals the answer after a failed attempt", () => {
    const template = findLab("lab-ospf-adjacency");
    let state = startLab(template, "a");
    state = runLabCommand(state, template, "show ip ospf neighbor");
    state = answerLabDiagnose(state, template, "network"); // wrong
    state = revealLabAnswer(state, template);
    expect(state.checkpointAnswer).toBe("mtu");
    expect(state.lastAnswerCorrect).toBe(true);
  });

  it("does not reveal before any attempt", () => {
    const template = findLab("lab-ospf-adjacency");
    const state = revealLabAnswer(startLab(template, "a"), template);
    expect(state.checkpointAnswer).toBeNull();
  });

  it("lets a revealed diagnose step advance to the next step", () => {
    const template = findLab("lab-ospf-adjacency");
    let state = startLab(template, "a");
    state = runLabCommand(state, template, "show ip ospf neighbor");
    state = answerLabDiagnose(state, template, "area"); // wrong → allows reveal
    state = revealLabAnswer(state, template);
    expect(state.lastAnswerCorrect).toBe(true);
    state = advanceLab(state, template);
    expect(state.stepIndex).toBe(2); // moved past diagnose onto configure
    expect(state.clean).toBe(false);
  });

  it("does not advance a diagnose step that was answered correctly (it already advanced)", () => {
    const template = findLab("lab-ospf-adjacency");
    let state = startLab(template, "a");
    state = runLabCommand(state, template, "show ip ospf neighbor");
    state = answerLabDiagnose(state, template, "mtu"); // correct → auto-advances
    expect(state.stepIndex).toBe(2);
    expect(advanceLab(state, template).stepIndex).toBe(2); // no double-advance
  });

  it("produces different outputs per variant (addressing differs)", () => {
    const template = findLab("lab-nat-pat");
    const a = runLab(template, "a", ["show ip nat translations"], "direction", "interface g0/0 ip nat inside", "show ip nat translations");
    const b = runLab(template, "b", ["show ip nat translations"], "direction", "interface g0/2 ip nat inside", "show ip nat translations");
    const lastA = a.cliHistory[a.cliHistory.length - 1].output;
    const lastB = b.cliHistory[b.cliHistory.length - 1].output;
    expect(lastA).not.toBe(lastB);
  });
});

describe("gap-topic labs", () => {
  it("covers every gap-topic objective with at least one lab", () => {
    const gapObjectives = ["3.2.c", "3.3.c", "4.2", "4.3", "5.1.b", "5.2.b", "4.6"];
    const covered = new Set(LAB_TEMPLATES.flatMap((template) => template.objectiveIds));
    for (const objective of gapObjectives) {
      expect(covered.has(objective), `objective ${objective} should have a lab`).toBe(true);
    }
  });

  it("covers every 4.x and 6.x objective with at least one lab", () => {
    const assuranceAutomation = ["4.1", "4.2", "4.3", "4.4", "4.5", "4.6", "6.1", "6.2", "6.3", "6.4", "6.5", "6.6", "6.7"];
    const covered = new Set(LAB_TEMPLATES.flatMap((template) => template.objectiveIds));
    for (const objective of assuranceAutomation) {
      expect(covered.has(objective), `objective ${objective} should have a lab`).toBe(true);
    }
  });

  it("completes the eBGP lab cleanly with the corrected remote-as", () => {
    const template = findLab("lab-ebgp");
    const state = runLab(template, "a", ["show ip bgp summary"], "asn", "neighbor 10.1.0.2 remote-as 65002", "show ip bgp summary");
    expect(state.status).toBe("complete");
    expect(state.clean).toBe(true);
  });

  it("rejects another variant's eBGP fix on this variant", () => {
    const template = findLab("lab-ebgp");
    let state = startLab(template, "a");
    state = runLabCommand(state, template, "show ip bgp summary");
    state = answerLabDiagnose(state, template, "asn");
    // Variant B's fix (172.16.0.2 / AS 65101) must NOT apply on variant A.
    state = runLabCommand(state, template, "neighbor 172.16.0.2 remote-as 65101");
    expect(state.stepIndex).toBe(2);
    expect(state.clean).toBe(false);
  });

  it("uses variant-aware show commands for HSRP vs VRRP", () => {
    const template = findLab("lab-hsrp-vrrp");
    let a = startLab(template, "a"); // HSRP
    a = runLabCommand(a, template, "show standby");
    expect(a.stepIndex).toBe(1);
    let b = startLab(template, "b"); // VRRP
    b = runLabCommand(b, template, "show vrrp");
    expect(b.stepIndex).toBe(1);
  });

  it("accepts the HSRP preempt fix on variant A and VRRP preempt on variant B", () => {
    const template = findLab("lab-hsrp-vrrp");
    const a = runLab(template, "a", ["show standby"], "preempt", "standby 10 preempt", "show standby");
    expect(a.status).toBe("complete");
    const b = runLab(template, "b", ["show vrrp"], "preempt", "vrrp 1 preempt", "show vrrp");
    expect(b.status).toBe("complete");
  });

  it("rejects the VRRP command on the HSRP variant even with the same group", () => {
    const template = findLab("lab-hsrp-vrrp");
    let state = startLab(template, "a");
    state = runLabCommand(state, template, "show standby");
    state = answerLabDiagnose(state, template, "preempt");
    // Variant A is HSRP group 10 — a VRRP command for the SAME group must be rejected.
    state = runLabCommand(state, template, "vrrp 10 preempt");
    expect(state.stepIndex).toBe(2); // still on configure
    expect(state.clean).toBe(false);
  });

  it("rejects the HSRP command on the VRRP variant", () => {
    const template = findLab("lab-hsrp-vrrp");
    let state = startLab(template, "b");
    state = runLabCommand(state, template, "show vrrp");
    state = answerLabDiagnose(state, template, "preempt");
    state = runLabCommand(state, template, "standby 1 preempt");
    expect(state.stepIndex).toBe(2); // still on configure
  });

  it("completes the NetFlow lab once the monitor is applied", () => {
    const template = findLab("lab-netflow");
    const state = runLab(template, "a", ["show flow monitor"], "notapplied", "flow monitor FLEX-A input", "show flow monitor");
    expect(state.status).toBe("complete");
    expect(state.clean).toBe(true);
  });

  it("completes the SPAN lab once the destination is added", () => {
    const template = findLab("lab-span");
    const state = runLab(template, "b", ["show monitor session 2"], "nodest", "monitor session 2 destination interface GigabitEthernet0/11", "show monitor session 2");
    expect(state.status).toBe("complete");
    expect(state.clean).toBe(true);
  });

  it("completes the AAA lab with the local fallback fix", () => {
    const template = findLab("lab-aaa");
    const state = runLab(template, "a", ["show aaa method-lists"], "nofallback", "aaa authentication login default group radius local", "show aaa method-lists");
    expect(state.status).toBe("complete");
    expect(state.clean).toBe(true);
  });

  it("completes the CoPP lab with the variant-aware protocol fix", () => {
    const template = findLab("lab-copp");
    const a = runLab(template, "a", ["show policy-map control-plane"], "unmatched", "access-list 110 permit ospf any any", "show policy-map control-plane");
    expect(a.status).toBe("complete");
    const b = runLab(template, "b", ["show policy-map control-plane"], "unmatched", "access-list 120 permit eigrp any any", "show policy-map control-plane");
    expect(b.status).toBe("complete");
  });

  it("rejects the other variant's CoPP protocol fix", () => {
    const template = findLab("lab-copp");
    let state = startLab(template, "a");
    state = runLabCommand(state, template, "show policy-map control-plane");
    state = answerLabDiagnose(state, template, "unmatched");
    state = runLabCommand(state, template, "access-list 120 permit eigrp any any"); // variant B's fix
    expect(state.stepIndex).toBe(2); // still on configure
  });

  it("completes the NETCONF and RESTCONF labs with the enable command", () => {
    const template = findLab("lab-netconf-restconf");
    const a = runLab(template, "a", ["show netconf-yang sessions"], "notenabled", "netconf-yang", "show netconf-yang sessions");
    expect(a.status).toBe("complete");
    const b = runLab(template, "b", ["show running-config | include restconf"], "notenabled", "restconf", "show running-config | include restconf");
    expect(b.status).toBe("complete");
  });

  it("uses variant-aware verify commands for NETCONF vs RESTCONF", () => {
    const template = findLab("lab-netconf-restconf");
    let a = startLab(template, "a");
    a = runLabCommand(a, template, "show netconf-yang sessions");
    a = answerLabDiagnose(a, template, "notenabled");
    a = runLabCommand(a, template, "netconf-yang");
    a = runLabCommand(a, template, "show running-config | include restconf"); // variant B's verify must NOT pass on A
    expect(a.stepIndex).toBe(3); // still on verify
  });

  it("completes the diagnose lab cleanly with the MTU fix", () => {
    const template = findLab("lab-diagnose");
    const state = runLab(template, "a", ["ping 10.1.0.10 size 1500 df-bit"], "mtu", "ip mtu 1400", "ping 10.1.0.10 size 1500 df-bit");
    expect(state.status).toBe("complete");
    expect(state.clean).toBe(true);
  });

  it("uses variant-aware commands for RSPAN vs ERSPAN", () => {
    const template = findLab("lab-rspan-erspan");
    let a = startLab(template, "a"); // RSPAN
    a = runLabCommand(a, template, "show vlan 900");
    expect(a.stepIndex).toBe(1);
    let b = startLab(template, "b"); // ERSPAN
    b = runLabCommand(b, template, "show monitor session 2");
    expect(b.stepIndex).toBe(1);
  });

  it("completes the RSPAN lab with remote-span and ERSPAN with erspan-id", () => {
    const template = findLab("lab-rspan-erspan");
    const a = runLab(template, "a", ["show vlan 900"], "remote", "remote-span", "show vlan 900");
    expect(a.status).toBe("complete");
    const b = runLab(template, "b", ["show monitor session 2"], "remote", "monitor session 2 destination erspan-id 1 ip 192.0.2.10", "show monitor session 2");
    expect(b.status).toBe("complete");
  });

  it("rejects the ERSPAN fix on the RSPAN variant", () => {
    const template = findLab("lab-rspan-erspan");
    let state = startLab(template, "a");
    state = runLabCommand(state, template, "show vlan 900");
    state = answerLabDiagnose(state, template, "remote");
    state = runLabCommand(state, template, "monitor session 2 destination erspan-id 1 ip 192.0.2.10");
    expect(state.stepIndex).toBe(2); // still on configure
  });

  it("completes the IP SLA lab once the probe is scheduled", () => {
    const template = findLab("lab-ipsla");
    const state = runLab(template, "a", ["show ip sla statistics"], "notscheduled", "ip sla schedule 10 life forever start-time now", "show ip sla statistics");
    expect(state.status).toBe("complete");
    expect(state.clean).toBe(true);
  });

  it("completes the Catalyst Center lab with the matching SNMP community", () => {
    const template = findLab("lab-catalyst-center");
    const a = runLab(template, "a", ["show snmp community"], "snmp", "snmp-server community public ro", "show snmp community");
    expect(a.status).toBe("complete");
    const b = runLab(template, "b", ["show snmp community"], "snmp", "snmp-server community v3-user ro", "show snmp community");
    expect(b.status).toBe("complete");
  });

  it("completes the Python lab with a blank-line guard", () => {
    const template = findLab("lab-python");
    const a = runLab(template, "a", ["python3 check_status.py"], "blank", "if not parts: continue", "python3 check_status.py");
    expect(a.status).toBe("complete");
    const b = runLab(template, "b", ["python3 check_status.py"], "blank", "if len(parts) < 6: continue", "python3 check_status.py");
    expect(b.status).toBe("complete");
  });

  it("rejects the other variant's Python guard", () => {
    const template = findLab("lab-python");
    let state = startLab(template, "a");
    state = runLabCommand(state, template, "python3 check_status.py");
    state = answerLabDiagnose(state, template, "blank");
    state = runLabCommand(state, template, "if len(parts) < 6: continue"); // variant B's fix
    expect(state.stepIndex).toBe(2); // still on configure
  });

  it("completes the JSON lab with a valid payload", () => {
    const template = findLab("lab-json");
    const a = runLab(template, "a", ["curl -X PATCH -d @payload.json https://10.1.1.5/restconf/data/Cisco-IOS-XE-native:native/interface/GigabitEthernet=0/1"], "json", '{"name": "GigabitEthernet0/1", "description": "uplink"}', "curl -X GET https://10.1.1.5/restconf/data/Cisco-IOS-XE-native:native/interface/GigabitEthernet=0/1");
    expect(a.status).toBe("complete");
    expect(a.clean).toBe(true);
  });

  it("completes the YANG lab with the module-qualified path", () => {
    const template = findLab("lab-yang");
    const a = runLab(template, "a", ["curl -X GET https://10.1.1.5/restconf/data/interfaces"], "path", "curl -X GET https://10.1.1.5/restconf/data/ietf-interfaces:interfaces", "curl -X GET https://10.1.1.5/restconf/data/ietf-interfaces:interfaces");
    expect(a.status).toBe("complete");
    expect(a.clean).toBe(true);
  });

  it("completes the Catalyst API lab with the token request", () => {
    const template = findLab("lab-catalyst-api");
    const a = runLab(template, "a", ["curl -k -X GET https://10.1.1.5/dna/intent/api/v1/network-device"], "token", "curl -k -X POST https://10.1.1.5/dna/system/api/v1/auth/token -u admin:Cisco123!", "curl -k -X GET https://10.1.1.5/dna/intent/api/v1/network-device -H \"X-Auth-Token: TOKEN\"");
    expect(a.status).toBe("complete");
    const b = runLab(template, "b", ["curl -k -X GET https://172.16.1.5/dataservice/device"], "token", "curl -k -X POST https://172.16.1.5/dataservice/client/token -u admin:Cisco123!", "curl -k -X GET https://172.16.1.5/dataservice/device -b \"jSID=TOKEN\"");
    expect(b.status).toBe("complete");
  });

  it("completes the EEM lab once the pattern matches real syslog", () => {
    const template = findLab("lab-eem");
    const a = runLab(template, "a", ["show event manager policy"], "pattern", 'event syslog pattern "LINEPROTO-5-UPDOWN"', "show event manager history events");
    expect(a.status).toBe("complete");
    expect(a.clean).toBe(true);
  });

  it("completes the orchestration lab with the fleet-fitting tool", () => {
    const template = findLab("lab-orchestration");
    const a = runLab(template, "a", ["cat fleet.txt"], "mode", "ansible-playbook site.yml -i inventory.ini", "ansible-playbook site.yml -i inventory.ini");
    expect(a.status).toBe("complete");
    const b = runLab(template, "b", ["cat fleet.txt"], "mode", "chef-client --runlist 'role[network]'", "chef-client --runlist 'role[network]'");
    expect(b.status).toBe("complete");
  });

  it("completes the OSPFv3 lab once the interface is enabled in the process", () => {
    const template = findLab("lab-ospfv3");
    const a = runLab(template, "a", ["show ipv6 ospf 1 neighbor"], "not-enabled", "ipv6 ospf 1 area 0", "show ipv6 ospf 1 neighbor");
    expect(a.status).toBe("complete");
    expect(a.clean).toBe(true);
    const b = runLab(template, "b", ["show ipv6 ospf 10 neighbor"], "not-enabled", "ipv6 ospf 10 area 0", "show ipv6 ospf 10 neighbor");
    expect(b.status).toBe("complete");
    expect(b.clean).toBe(true);
  });

  it("rejects the IPv4 network statement as the OSPFv3 fix", () => {
    const template = findLab("lab-ospfv3");
    let state = startLab(template, "a");
    state = runLabCommand(state, template, "show ipv6 ospf 1 neighbor");
    state = answerLabDiagnose(state, template, "not-enabled");
    state = runLabCommand(state, template, "network 2001:db8:1::/64 area 0");
    expect(state.stepIndex).toBe(2);
    expect(state.clean).toBe(false);
  });

  it("completes the SNMP/syslog lab with the matching community or trap level", () => {
    const template = findLab("lab-snmp-syslog");
    const a = runLab(template, "a", ["show snmp community"], "mismatch", "snmp-server community netops-ro ro", "show snmp community");
    expect(a.status).toBe("complete");
    const b = runLab(template, "b", ["show logging"], "mismatch", "logging trap 5", "show logging");
    expect(b.status).toBe("complete");
  });

  it("rejects the other variant's SNMP/syslog fix", () => {
    const template = findLab("lab-snmp-syslog");
    let state = startLab(template, "a");
    state = runLabCommand(state, template, "show snmp community");
    state = answerLabDiagnose(state, template, "mismatch");
    state = runLabCommand(state, template, "logging trap 5");
    expect(state.stepIndex).toBe(2);
  });

  it("completes the NTP/PTP lab once the time source is fixed", () => {
    const template = findLab("lab-ntp-ptp");
    const a = runLab(template, "a", ["show ntp status"], "bad-source", "ntp server 10.10.0.1", "show ntp status");
    expect(a.status).toBe("complete");
    const b = runLab(template, "b", ["show ptp clock"], "bad-source", "ptp priority1 127", "show ptp clock");
    expect(b.status).toBe("complete");
  });

  it("completes the MST lab once the region attributes align", () => {
    const template = findLab("lab-mst");
    const a = runLab(template, "a", ["show spanning-tree mst configuration"], "region", "spanning-tree mst 1 vlan 1-10", "show spanning-tree mst");
    expect(a.status).toBe("complete");
    const b = runLab(template, "b", ["show spanning-tree mst configuration"], "region", "revision 2", "show spanning-tree mst");
    expect(b.status).toBe("complete");
  });

  it("rejects the rapid-PVST distractor in the MST lab", () => {
    const template = findLab("lab-mst");
    let state = startLab(template, "a");
    state = runLabCommand(state, template, "show spanning-tree mst configuration");
    state = answerLabDiagnose(state, template, "region");
    state = runLabCommand(state, template, "spanning-tree mode rapid-pvst");
    expect(state.stepIndex).toBe(2);
    expect(state.clean).toBe(false);
  });

  it("completes the VRF lab with the matching route-target", () => {
    const template = findLab("lab-vrf");
    const a = runLab(template, "a", ["show ip vrf"], "rt-mismatch", "route-target export 65000:100", "show ip route vrf CUST-B");
    expect(a.status).toBe("complete");
    expect(a.clean).toBe(true);
    const b = runLab(template, "b", ["show ip vrf"], "rt-mismatch", "route-target import 65000:100", "show ip route vrf CUST-B");
    expect(b.status).toBe("complete");
    expect(b.clean).toBe(true);
  });

  it("completes the GRE-over-IPsec lab once the crypto ACL matches the GRE flow", () => {
    const template = findLab("lab-gre-ipsec");
    const a = runLab(template, "a", ["show crypto isakmp sa"], "acl-flow", "access-list 101 permit gre host 203.0.113.1 host 203.0.113.2", "show crypto ipsec sa");
    expect(a.status).toBe("complete");
    const b = runLab(template, "b", ["show crypto isakmp sa"], "acl-flow", "access-list 102 permit gre host 198.51.100.5 host 198.51.100.6", "show crypto ipsec sa");
    expect(b.status).toBe("complete");
  });

  it("completes the TrustSec/MACsec lab once key or cipher suite aligns", () => {
    const template = findLab("lab-trustsec-macsec");
    const a = runLab(template, "a", ["show mka sessions"], "key-cipher", "key string Cisco123", "show mka sessions");
    expect(a.status).toBe("complete");
    const b = runLab(template, "b", ["show mka sessions"], "key-cipher", "macsec cipher-suite gcm-aes-256", "show mka sessions");
    expect(b.status).toBe("complete");
  });

  it("covers the deep-dive gap objectives with a lab", () => {
    const gapObjectives = ["3.2.b", "4.1", "3.3.a", "3.1.c", "2.2.a", "2.2.b", "5.4.d"];
    const covered = new Set(LAB_TEMPLATES.flatMap((template) => template.objectiveIds));
    for (const objective of gapObjectives) {
      expect(covered.has(objective), `objective ${objective} should have a lab`).toBe(true);
    }
  });

  it("completes the multicast RP lab once the RP is reachable", () => {
    const template = findLab("lab-multicast-rp");
    const a = runLab(template, "a", ["show ip pim rp mapping"], "rp", "ip pim rp-address 192.0.2.10", "show ip mroute");
    expect(a.status).toBe("complete");
    expect(a.clean).toBe(true);
    const b = runLab(template, "b", ["show ip pim rp mapping"], "rp", "ip pim rp-address 203.0.113.9", "show ip mroute");
    expect(b.status).toBe("complete");
    expect(b.clean).toBe(true);
  });

  it("rejects the other variant's RP address in the multicast lab", () => {
    const template = findLab("lab-multicast-rp");
    let state = startLab(template, "a");
    state = runLabCommand(state, template, "show ip pim rp mapping");
    state = answerLabDiagnose(state, template, "rp");
    state = runLabCommand(state, template, "ip pim rp-address 203.0.113.9");
    expect(state.stepIndex).toBe(2);
    expect(state.clean).toBe(false);
  });

  it("completes the eBGP weight lab once the preferred peer holds the weight", () => {
    const template = findLab("lab-bgp-weight");
    const a = runLab(template, "a", ["show ip bgp"], "weight", "neighbor 192.0.2.2 weight 1000", "show ip bgp");
    expect(a.status).toBe("complete");
    const b = runLab(template, "b", ["show ip bgp"], "weight", "neighbor 198.51.100.2 weight 1000", "show ip bgp");
    expect(b.status).toBe("complete");
  });

  it("completes the QoS priority lab once voice gets strict priority", () => {
    const template = findLab("lab-qos-priority");
    const a = runLab(template, "a", ["show policy-map"], "strict", "priority 30", "show policy-map interface");
    expect(a.status).toBe("complete");
    expect(a.clean).toBe(true);
    const b = runLab(template, "b", ["show policy-map"], "strict", "priority 15", "show policy-map interface");
    expect(b.status).toBe("complete");
    expect(b.clean).toBe(true);
  });

  it("rejects the bandwidth distractor in the QoS lab", () => {
    const template = findLab("lab-qos-priority");
    let state = startLab(template, "a");
    state = runLabCommand(state, template, "show policy-map");
    state = answerLabDiagnose(state, template, "strict");
    state = runLabCommand(state, template, "bandwidth 30");
    expect(state.stepIndex).toBe(2);
    expect(state.clean).toBe(false);
  });

  it("covers the depth-expansion objectives with a lab", () => {
    const depthObjectives = ["3.3.d", "3.2.c", "1.4"];
    const covered = new Set(LAB_TEMPLATES.flatMap((template) => template.objectiveIds));
    for (const objective of depthObjectives) {
      expect(covered.has(objective), `objective ${objective} should have a lab`).toBe(true);
    }
  });
});
