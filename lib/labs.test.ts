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
  function runLab(template: LabTemplate, variantId: string, commands: string[], diagnose: string, fix: string, verify: string): LabState {
    let state = startLab(template, variantId);
    state = runLabCommand(state, template, commands[0]);
    state = answerLabDiagnose(state, template, diagnose);
    state = runLabCommand(state, template, fix);
    state = runLabCommand(state, template, verify);
    return state;
  }

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
