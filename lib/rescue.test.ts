import { describe, expect, it } from "vitest";
import {
  advanceRescue,
  answerRescueCheckpoint,
  currentRescueStep,
  revealRescueAnswer,
  runRescueCommand,
  startRescue,
  type RescueDefinition,
} from "./rescue";

const FIXTURE: RescueDefinition = {
  id: "fixture",
  mission: "vlan",
  phases: [],
  isDefault: true,
  title: "Fixture rescue",
  teaches: "test engine",
  tip: "back to the mission",
  steps: [
    { kind: "explain", title: "Intro", body: "A trunk carries many VLANs between switches." },
    {
      kind: "checkpoint",
      title: "Pick the trunk",
      prompt: "Which link is a trunk?",
      options: [
        { value: "trunk", title: "Trunk", note: "many VLANs" },
        { value: "access", title: "Access", note: "one VLAN" },
      ],
      correct: "trunk",
      explain: "Trunks carry many VLANs.",
      wrongGuidance: "Compare the two definitions again.",
    },
    {
      kind: "cli",
      device: "SW1",
      prompt: "SW1(config-if)#",
      title: "Type the fix",
      command: "switchport trunk allowed vlan add 20",
      expectedOutput: "VLAN 20 added to the allowed VLAN list.",
      wrongHint: "Try the switchport command.",
      explain: "That adds VLAN 20 to the trunk.",
    },
  ],
};

describe("rescue engine", () => {
  it("starts in progress on step 0", () => {
    const state = startRescue();
    expect(state.status).toBe("in_progress");
    expect(state.stepIndex).toBe(0);
    expect(state.attempts).toBe(0);
    expect(state.eventLog[0].tone).toBe("info");
    expect(currentRescueStep(state, FIXTURE)?.kind).toBe("explain");
  });

  it("advances past explain steps", () => {
    const state = advanceRescue(startRescue(), FIXTURE);
    expect(state.stepIndex).toBe(1);
    expect(currentRescueStep(state, FIXTURE)?.kind).toBe("checkpoint");
  });

  it("does not advance a checkpoint until it is answered", () => {
    const started = advanceRescue(startRescue(), FIXTURE);
    expect(advanceRescue(started, FIXTURE).stepIndex).toBe(1);
  });

  it("advances on a correct checkpoint answer and logs the explanation", () => {
    const started = advanceRescue(startRescue(), FIXTURE);
    const state = answerRescueCheckpoint(started, FIXTURE, "trunk");
    expect(state.stepIndex).toBe(2);
    expect(currentRescueStep(state, FIXTURE)?.kind).toBe("cli");
    expect(state.eventLog.some((entry) => entry.tone === "success" && entry.message.includes("Trunks carry many VLANs"))).toBe(true);
  });

  it("counts a wrong checkpoint answer and stays on the step", () => {
    const started = advanceRescue(startRescue(), FIXTURE);
    const state = answerRescueCheckpoint(started, FIXTURE, "access");
    expect(state.stepIndex).toBe(1);
    expect(state.attempts).toBe(1);
    expect(state.lastAnswerCorrect).toBe(false);
    expect(state.checkpointAnswer).toBe("access");
    expect(state.eventLog.some((entry) => entry.tone === "error")).toBe(true);
  });

  it("revealing an answer requires a prior attempt, then lets the player continue", () => {
    const started = advanceRescue(startRescue(), FIXTURE);
    // With no attempt yet, the mercy reveal is refused.
    expect(revealRescueAnswer(started, FIXTURE)).toBe(started);

    // After one wrong answer, reveal works without counting another attempt.
    const tried = answerRescueCheckpoint(started, FIXTURE, "access");
    const revealed = revealRescueAnswer(tried, FIXTURE);
    expect(revealed.revealed).toBe(true);
    expect(revealed.lastAnswerCorrect).toBe(true);
    expect(revealed.checkpointAnswer).toBe("trunk");
    expect(revealed.attempts).toBe(1);
    expect(advanceRescue(revealed, FIXTURE).stepIndex).toBe(2);
  });

  /** Walks the fixture to its CLI step: explain → correct checkpoint → cli. */
  function atCliStep() {
    return answerRescueCheckpoint(advanceRescue(startRescue(), FIXTURE), FIXTURE, "trunk");
  }

  it("runs the CLI command: wrong answer is guided, help lists the command", () => {
    const wrong = runRescueCommand(atCliStep(), FIXTURE, "shutdown");
    expect(wrong.attempts).toBe(1);
    expect(wrong.cliHistory).toHaveLength(1);
    expect(wrong.cliHistory[0].output).toBe("Try the switchport command.");
    expect(wrong.stepIndex).toBe(2);

    const helped = runRescueCommand(atCliStep(), FIXTURE, "help");
    expect(helped.cliHistory[0].output).toContain("switchport trunk allowed vlan add 20");
    expect(helped.stepIndex).toBe(2);
  });

  it("completes the rescue after the correct CLI command", () => {
    const state = runRescueCommand(atCliStep(), FIXTURE, "SWITCHPORT TRUNK ALLOWED VLAN ADD 20");
    expect(state.status).toBe("complete");
    expect(state.stepIndex).toBe(3);
    expect(state.cliHistory).toHaveLength(1);
    expect(state.cliHistory[0].output).toBe("VLAN 20 added to the allowed VLAN list.");
    expect(state.eventLog.some((entry) => entry.tone === "success" && entry.message.includes("Rescue complete"))).toBe(true);
  });

  it("ignores actions on a completed rescue", () => {
    const complete = runRescueCommand(atCliStep(), FIXTURE, "switchport trunk allowed vlan add 20");
    expect(answerRescueCheckpoint(complete, FIXTURE, "trunk")).toBe(complete);
    expect(runRescueCommand(complete, FIXTURE, "anything")).toBe(complete);
  });
});
