import { describe, expect, it } from "vitest";
import {
  CAMPUS_PHASES,
  campusPromptFor,
  chooseInterop,
  chooseLisp,
  chooseRoles,
  lispInspected,
  resetCampusFabricMission,
  runCampusCommand,
  startCampusFabricMission,
} from "./campus-fabric-mission";

function atLisp() {
  let state = startCampusFabricMission();
  return chooseRoles(state, "cp-lisp");
}

function atLispCheck() {
  let state = atLisp();
  state = runCampusCommand(state, "enable");
  state = runCampusCommand(state, "show lisp session");
  state = runCampusCommand(state, "show lisp map-cache");
  return runCampusCommand(state, "show lisp site");
}

function atInterop() {
  let state = atLispCheck();
  return chooseLisp(state, "eid-rloc");
}

describe("The Campus Fabric mission", () => {
  it("starts in the roles phase and records a mission-started event", () => {
    const state = startCampusFabricMission();
    expect(state.status).toBe("in_progress");
    expect(state.phase).toBe("roles");
    expect(state.attempts).toBe(0);
    expect(state.eventLog[0].tone).toBe("info");
  });

  describe("roles phase (1.3.a)", () => {
    it("names the control plane node as the LISP brain and advances", () => {
      const state = startCampusFabricMission();
      const correct = chooseRoles(state, "cp-lisp");
      expect(correct.selectedRoles).toBe("cp-lisp");
      expect(correct.phase).toBe("lisp");
      expect(correct.eventLog.at(-1)?.tone).toBe("success");
    });

    it("explains why edge nodes do not hold the mapping database", () => {
      const state = startCampusFabricMission();
      const wrong = chooseRoles(state, "edge-hosts");
      expect(wrong.phase).toBe("roles");
      expect(wrong.attempts).toBe(1);
      expect(wrong.eventLog.at(-1)?.tone).toBe("error");
    });
  });

  describe("LISP inspection (2.3.a)", () => {
    it("walks the control plane node: sessions, map-cache, and the site database", () => {
      let state = atLisp();
      expect(state.phase).toBe("lisp");
      state = runCampusCommand(state, "enable");
      expect(state.cliMode).toBe("privileged");
      state = runCampusCommand(state, "show lisp session");
      expect(state.sessionSeen).toBe(true);
      expect(state.cliHistory.at(-1)?.output).toContain("UP");
      state = runCampusCommand(state, "show lisp map-cache");
      expect(state.mapCacheSeen).toBe(true);
      expect(state.cliHistory.at(-1)?.output).toContain("10.10.10.0/24");
      const inspected = runCampusCommand(state, "show lisp site");
      expect(inspected.siteSeen).toBe(true);
      expect(lispInspected(inspected)).toBe(true);
      expect(inspected.phase).toBe("lisp-check");
      expect(inspected.cliMode).toBe("user");
      expect(inspected.cliHistory.at(-1)?.output).toContain("registered");
      expect(inspected.eventLog.at(-1)?.tone).toBe("success");
    });

    it("needs all three reads before the checkpoint unlocks", () => {
      let state = atLisp();
      state = runCampusCommand(state, "enable");
      state = runCampusCommand(state, "show lisp session");
      state = runCampusCommand(state, "show lisp map-cache");
      expect(state.phase).toBe("lisp");
      const attemptsBefore = state.attempts;
      const locked = chooseLisp(state, "eid-rloc");
      expect(locked.phase).toBe("lisp");
      expect(locked.attempts).toBe(attemptsBefore);
    });

    it("guides show commands typed before enable", () => {
      let state = atLisp();
      const early = runCampusCommand(state, "show lisp map-cache");
      expect(early.cliHistory.at(-1)?.output).toContain("Type enable");
      expect(early.mapCacheSeen).toBe(false);
    });

    it("reads the map-cache as an EID-to-RLOC binding and advances to interop", () => {
      let state = atLispCheck();
      expect(state.phase).toBe("lisp-check");
      const correct = chooseLisp(state, "eid-rloc");
      expect(correct.selectedLisp).toBe("eid-rloc");
      expect(correct.phase).toBe("interop");
      expect(correct.eventLog.at(-1)?.tone).toBe("success");
    });
  });

  describe("interop phase (1.3.b)", () => {
    it("completes the mission when the border node + fusion router bridge the legacy world", () => {
      let state = atInterop();
      expect(state.phase).toBe("interop");
      const done = chooseInterop(state, "border-fusion");
      expect(done.status).toBe("complete");
      expect(done.phase).toBe("complete");
      expect(done.selectedInterop).toBe("border-fusion");
    });

    it("explains why a legacy host never runs VXLAN itself", () => {
      let state = atInterop();
      const wrong = chooseInterop(state, "vxlan-only");
      expect(wrong.phase).toBe("interop");
      expect(wrong.eventLog.at(-1)?.tone).toBe("error");
    });
  });

  it("guards every choice behind its own phase", () => {
    let state = startCampusFabricMission();
    expect(chooseLisp(state, "eid-rloc").phase).toBe("roles");
    expect(chooseInterop(state, "border-fusion").phase).toBe("roles");
    expect(chooseRoles(state, "cp-lisp").phase).toBe("lisp");
  });

  it("lists exactly the four in-progress phases", () => {
    expect(CAMPUS_PHASES).toEqual(["roles", "lisp", "lisp-check", "interop"]);
  });

  it("renders the CP-1 prompts", () => {
    expect(campusPromptFor("user")).toBe("CP-1>");
    expect(campusPromptFor("privileged")).toBe("CP-1#");
  });

  it("is immutable: actions never mutate the input state", () => {
    const state = startCampusFabricMission();
    const before = JSON.stringify(state);
    runCampusCommand(state, "enable");
    chooseRoles(state, "cp-lisp");
    expect(JSON.stringify(state)).toBe(before);
  });

  it("resets to a clean slate", () => {
    const next = resetCampusFabricMission();
    expect(next).toEqual(resetCampusFabricMission());
    expect(next.status).toBe("not_started");
    expect(next.cliHistory).toHaveLength(0);
    expect(next.eventLog).toHaveLength(0);
  });
});
