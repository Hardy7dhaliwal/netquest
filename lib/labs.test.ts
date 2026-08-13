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
});
